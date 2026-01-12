// src/commands/produce.ts
import { Command } from "../deps.ts";
import { Settings } from "../classes/settings.ts";
import { Ovary } from "../classes/ovary.ts";
import { Utils } from "../classes/utils.ts";

export const produceCommand = new Command()
  .description("Produce the live ISO image")
  .option("-c, --clone", "Create a complete backup")
  .option("-f, --fast", "Use lighter compression")
  .option("-M, --max", "Use maximum compression")
  
  .action(async (options) => {
    const config = await Settings.load();

    // Override config da CLI
    if (options.fast) config.compression = "gzip";
    if (options.max) config.compression = "zstd";

    const ovary = new Ovary(config);

    try {
        // PRIMA C'ERA: await ovary.prepare(...);
        // ORA: Chiamiamo solo produce passando le opzioni
        await ovary.produce({
          clone: options.clone,
          fast: options.fast,
          max: options.max,
          verbose: true 
        });
        
    } catch (error) {
        console.error("❌ Error during reproduction:", error);
    }
  });