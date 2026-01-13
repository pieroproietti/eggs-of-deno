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
   * @param stream Se true, mostra l'output a video in tempo reale (inherit).
   */
  static async run(cmd: string, args: string[] = [], stream = false): Promise<IRunResult> {
    const command = new Deno.Command(cmd, {
      args: args,
      stdout: stream ? "inherit" : "piped",
      stderr: stream ? "inherit" : "piped",
    });

    // Usiamo spawn() per avere il controllo del processo figlio
    const process = command.spawn();

    if (stream) {
      // CASO 1: STREAMING (Barra di avanzamento visibile)
      // L'output va direttamente alla console. Noi aspettiamo solo che finisca.
      const status = await process.status;
      
      return { 
        success: status.success, 
        code: status.code, 
        out: "", // Non abbiamo catturato nulla, è andato tutto a video
        err: "" 
      };

    } else {
      // CASO 2: CATTURA (Silenzioso)
      // process.output() aspetta la fine E raccoglie i buffer
      const output = await process.output();
      const outStr = new TextDecoder().decode(output.stdout).trim();
      const errStr = new TextDecoder().decode(output.stderr).trim();

      return { 
        success: output.success, 
        code: output.code, 
        out: outStr, 
        err: errStr 
      };
    }
  }

  // ... (Tutti gli altri metodi title, getPrimaryUser, isSystemd, etc. restano uguali)
  
  static title(text: string) {
    console.log(`\n=== ${text} ===\n`);
  }

  static warning(text: string) {
    console.log(`⚠️  ${text}`);
  }

  static error(text: string) {
    console.error(`❌ ${text}`);
  }

  static async getPrimaryUser(): Promise<string> {
    try {
      const content = await Deno.readTextFile("/etc/passwd");
      for (const line of content.split("\n")) {
        const parts = line.split(":");
        if (parts.length > 2 && parseInt(parts[2]) === 1000) {
          return parts[0];
        }
      }
    } catch (e) {}
    return Deno.env.get("SUDO_USER") || Deno.env.get("USER") || "root";
  }

  static async isSystemd(): Promise<boolean> {
    return await exists("/run/systemd/system");
  }
  
  static async isLive(): Promise<boolean> {
    try {
        const cmdline = await Deno.readTextFile("/proc/cmdline");
        return cmdline.includes("boot=live") || cmdline.includes("toram");
    } catch {
        return false;
    }
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}