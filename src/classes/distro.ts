// src/classes/distro.ts
import { exists } from "../deps.ts";

export interface IDistroInfo {
  id: string;          // es: "debian", "arch", "manjaro"
  familyId: string;    // es: "debian", "arch" (derivato da ID_LIKE o ID)
  releaseId: string;   // es: "11", "rolling"
  codename: string;    // es: "bullseye"
  distribId: string;   // ID univoco tipo "Debian" o "Ubuntu"
}

export class Distro {
  
  /**
   * Identifica la distribuzione corrente leggendo /etc/os-release
   */
  static async getInfo(): Promise<IDistroInfo> {
    const osReleasePath = "/etc/os-release";
    
    // Default valori vuoti
    const info: IDistroInfo = {
      id: "unknown",
      familyId: "unknown",
      releaseId: "0",
      codename: "unknown",
      distribId: "Unknown Linux"
    };

    if (await exists(osReleasePath)) {
      const content = await Deno.readTextFile(osReleasePath);
      
      // Parsiamo riga per riga
      const lines = content.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("ID=")) {
          info.id = this.cleanValue(line);
        } else if (line.startsWith("ID_LIKE=")) {
          info.familyId = this.cleanValue(line).split(" ")[0]; // Prendi il primo se ce ne sono più di uno
        } else if (line.startsWith("VERSION_ID=")) {
          info.releaseId = this.cleanValue(line);
        } else if (line.startsWith("VERSION_CODENAME=")) {
          info.codename = this.cleanValue(line);
        } else if (line.startsWith("NAME=")) {
          info.distribId = this.cleanValue(line);
        }
      }
      
      // Fallback per familyId se non c'è ID_LIKE (es: Debian puri)
      if (info.familyId === "unknown" && info.id !== "unknown") {
        info.familyId = info.id;
      }
    }
    
    return info;
  }

  /**
   * Helper per pulire le stringhe (toglie "ID=" e le virgolette)
   */
  private static cleanValue(line: string): string {
    // Prende tutto dopo l'uguale
    const val = line.split("=")[1] || "";
    // Rimuove virgolette doppie o singole
    return val.replace(/["']/g, "").trim();
  }
}