// src/commands/produce.ts
import { Command } from "../deps.ts";
import { Settings } from "../classes/settings.ts";
import { Ovary } from "../classes/ovary.ts";
import { Utils } from "../classes/utils.ts";

export const produceCommand = new Command()
  .description("Produce the live ISO image (The Mother command)")
  .option("-c, --clone", "Create a complete backup (including user data)")
  .option("-f, --fast", "Use lighter compression for speed")
  .option("-M, --max", "Use maximum compression (slow but small)")
  
  .action(async (options) => {
    // 1. Load Configuration
    const config = await Settings.load();

    // 2. Apply CLI overrides (flags have priority over config)
    if (options.fast) {
        console.log("-> Speed mode active: Switching to gzip");
        config.compression = "gzip";
    } else if (options.max) {
        console.log("-> Max mode active: Switching to zstd/xz");
        config.compression = "zstd"; // Just an example
    }

    // 3. Initialize the Engine (Ovary)
    const ovary = new Ovary(config);

    // 4. Run the process
    try {
        await ovary.prepare(options.clone || false);
        await ovary.produce();
        
        Utils.title("Process Completed");
        console.log("Your egg is ready in /home/eggs/..."); // Placeholder
    } catch (error) {
        console.error("❌ Error during reproduction:", error);
    }
  });