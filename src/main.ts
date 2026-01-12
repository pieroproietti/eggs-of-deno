// src/main.ts
import { Command } from "./deps.ts";
import { dadCommand } from "./commands/dad.ts";
import { produceCommand } from "./commands/produce.ts";
import { momCommand } from "./commands/mom.ts";
import { checkCommand } from "./commands/check.ts";

await new Command()
  .name("eggs")
  .version("10.0.0-deno")
  .description("Penguins-Eggs: Deno Edition")
  
  // Registrazione comandi
  .command("dad", dadCommand)
  .command("produce", produceCommand)
  .command("mom", momCommand)
  .command("check", checkCommand) 

  // --- MODIFICA QUI ---
  // Commentiamo l'azione di default. 
  // Se non commentiamo questo, Cliffy esegue questo blocco 
  // invece di passare il controllo al comando "check" se c'è un'ambiguità.
  /*
  .action(() => {
    console.log("🥚 Eggs Core System Ready.");
    console.log("Usa 'eggs check' per verificare i requisiti.");
    console.log("Usa 'eggs mom' se ti serve aiuto!");
  })
  */
  // --------------------

  .parse(Deno.args);