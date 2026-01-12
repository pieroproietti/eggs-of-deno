// src/main.ts
import { Command } from "./deps.ts";
import { dadCommand } from "./commands/dad.ts";
import { produceCommand } from "./commands/produce.ts";
import { momCommand } from "./commands/mom.ts"; // <--- Importiamo Mom

// Configurazione CLI
await new Command()
  .name("eggs")
  .version("10.0.0-deno")
  .description("Penguins-Eggs: Deno Edition")
  
  .command("dad", dadCommand)
  .command("produce", produceCommand)
  .command("mom", momCommand) // <--- Ora Mom è un comando distinto, non un alias

  .action(() => {
    console.log("🥚 Eggs Core System Ready.");
    console.log("Usa 'eggs mom' se ti serve aiuto!");
  })
  .parse(Deno.args);