import { Command } from "../deps.ts";
import { Utils } from "../classes/utils.ts";
import { Distro } from "../classes/distro.ts";
import { PacmanFactory } from "../classes/pacman.ts"; // <--- Importiamo Pacman

export const dadCommand = new Command()
  .description("Daddy command: Configure and Setup")
  .option("-c, --clean", "Clean package cache and temp files")
  .option("-i, --install <pkg:string>", "Test installazione pacchetto") // Aggiungiamo per test
  
  .action(async (options) => {
    Utils.title("Eggs Dad - Configuration Manager");

    // 1. Rilevamento (Necessario per istanziare Pacman)
    const distro = await Distro.getInfo();
    const pacman = PacmanFactory.get(distro); // <--- Creiamo l'istanza giusta

    console.log(`🐧 Distro: ${distro.id}`);
    console.log(`📦 Package Manager: ${pacman.id.toUpperCase()}`);

    // TEST: Pulizia
    if (options.clean) {
        console.log("\n--> Cleaning System...");
        // Non dobbiamo sapere se è apt clean o pacman -Scc
        // Pacman lo sa.
        await pacman.clean(); 
        console.log("✅ Cache cleaned.");
        return;
    }

    // TEST: Installazione dummy
    if (options.install) {
        console.log(`\n--> Installing test package: ${options.install}`);
        await pacman.install([options.install]);
        return;
    }

    console.log("\nReady via Pacman abstraction.");
  });
  