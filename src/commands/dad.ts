// src/commands/dad.ts
import { Command } from "../deps.ts";
import { Daddy } from "../classes/daddy.ts";
import { Utils } from "../classes/utils.ts";

export const dadCommand = new Command()
  .name("dad")
  .description("Daddy command: Configure and Setup")
  .option("-d, --default", "Reset configuration to defaults")
  .option("-c, --clean", "Clean repositories and temporary files")
  .option("-v, --verbose", "Show verbose output")
  .action(async (options) => {
    
    // Controllo ROOT obbligatorio per scrivere in /etc
    const uid = (await Utils.run("id", ["-u"])).out.trim();
    if (uid !== "0") {
        console.error("❌ Errore: 'dad' deve essere eseguito come ROOT per scrivere le configurazioni.");
        console.error("   Usa: sudo eggs dad ...");
        Deno.exit(1);
    }

    const dad = new Daddy();

    if (options.default) {
        await dad.reset(options.verbose);
    } 
    else if (options.clean) {
        await dad.clean(options.verbose);
    } 
    else {
        // Se non passa opzioni, mostriamo l'help
        console.log("ℹ️  Specifica un'opzione: --default (-d) o --clean (-c)");
        console.log("   Esempio: sudo eggs dad -d");
    }
  });