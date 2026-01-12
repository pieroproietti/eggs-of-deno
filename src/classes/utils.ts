// src/classes/utils.ts
import { path, exists } from "../deps.ts";

export interface IRunResult {
  success: boolean;
  code: number;
  out: string;
  err: string;
}

export class Utils {
  
  /**
   * Esegue un comando shell.
   * Supporta array di argomenti per sicurezza.
   */
  static async run(cmd: string, args: string[] = []): Promise<IRunResult> {
    const command = new Deno.Command(cmd, {
      args: args,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const outStr = new TextDecoder().decode(stdout).trim();
    const errStr = new TextDecoder().decode(stderr).trim();

    return { 
      success: code === 0, 
      code, 
      out: outStr, 
      err: errStr 
    };
  }

  /**
   * Stampa un titolo formattato
   */
  static title(text: string) {
    console.log(`\n=== ${text} ===\n`);
  }

  /**
   * Trova l'utente principale (non root)
   * Cerca l'utente con UID 1000 (standard Linux)
   */
  static async getPrimaryUser(): Promise<string> {
    try {
      // Metodo 1: Leggi /etc/passwd
      const content = await Deno.readTextFile("/etc/passwd");
      const lines = content.split("\n");
      
      for (const line of lines) {
        const parts = line.split(":");
        if (parts.length > 2) {
          const uid = parseInt(parts[2]);
          // UID 1000 è il primo utente su Debian/Ubuntu/Arch
          if (uid === 1000) {
            return parts[0];
          }
        }
      }
    } catch (e) {
      console.warn("Impossibile leggere /etc/passwd");
    }

    // Fallback: usa variabile d'ambiente SUDO_USER o USER
    return Deno.env.get("SUDO_USER") || Deno.env.get("USER") || "root";
  }

  /**
   * Controlla se il sistema usa Systemd
   */
  static async isSystemd(): Promise<boolean> {
    return await exists("/run/systemd/system");
  }

  /**
   * Controlla se siamo su un sistema LIVE
   * (Legge /proc/cmdline cercando 'boot=live' o simili)
   */
  static async isLive(): Promise<boolean> {
    try {
        const cmdline = await Deno.readTextFile("/proc/cmdline");
        return cmdline.includes("boot=live") || cmdline.includes("toram");
    } catch {
        return false;
    }
  }

  /**
   * Helper per sleep (usato in Ovary)
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}