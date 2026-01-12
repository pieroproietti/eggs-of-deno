// src/classes/utils.ts
export class Utils {
  
  /**
   * Esegue un comando shell e ritorna output/errori.
   * Sostituisce execa.
   */
  static async run(cmd: string, args: string[] = []) {
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
   * Un piccolo helper per stampare titoli (stile eggs)
   */
  static title(text: string) {
    console.log(`\n=== ${text} ===\n`);
  }
}