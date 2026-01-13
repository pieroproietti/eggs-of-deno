// src/classes/ovary.d/pre-flight.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, ensureDir, exists } from "../../deps.ts";

export class PreFlight {
  private config: IEggsConfig;
  private distro: IDistroInfo;

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  /**
   * Prepara le cartelle e copia i file di avvio (kernel/initrd)
   */
  async prepare(options: any) {
    Utils.title("🛫 Pre-Flight Checks");

    // 1. Crea directory di lavoro
    const workDir = path.join(Constants.NEST, ".mnt");
    const isoDir = path.join(Constants.NEST, "iso");
    
    await ensureDir(workDir);
    await ensureDir(isoDir);

    // 2. Trova e Copia Kernel
    await this.handleKernel(isoDir);

    // 3. Gestione Utenti (se non è clone)
    if (!options.clone) {
        await this.cleanUsers(workDir);
    }
  }

  private async handleKernel(isoDest: string) {
    console.log("-> Searching for Kernel...");
    
    // --- MODIFICA: Destinazione è iso/live ---
    const liveDest = path.join(isoDest, "live");
    await ensureDir(liveDest); 
    // ----------------------------------------

    try {
        const uname = (await Utils.run("uname", ["-r"])).out;
        
        // Percorsi Sorgente (Host)
        const vmlinuzSrc = `/boot/vmlinuz-${uname}`;
        const initrdSrc = `/boot/initrd.img-${uname}`;

        // Percorsi Destinazione (ISO/live)
        const destKernel = path.join(liveDest, "vmlinuz");
        const destInitrd = path.join(liveDest, "initrd.img");

        // Copia Vmlinuz
        if (await exists(vmlinuzSrc)) {
            console.log(`   Copying ${vmlinuzSrc} -> ${destKernel}`);
            await Deno.copyFile(vmlinuzSrc, destKernel);
        } else {
            console.warn(`⚠️ Kernel not found at ${vmlinuzSrc}`);
        }

        // Copia Initrd
        // if (await exists(initrdSrc)) {
        //     console.log(`   Copying ${initrdSrc} -> ${destInitrd}`);
        //     await Deno.copyFile(initrdSrc, destInitrd);
        // }
        // MODIFIED: We now generate initrd separately using mkinitfs/dracut/mkinitcpio
        console.log("   ℹ️  Skipping host initrd copy (will be generated)");
        
    } catch (e) {
        console.error("❌ Kernel copy failed:", e);
    }
  }

  private async cleanUsers(mountPoint: string) {
    console.log("-> Cleaning users (Redistribution Mode)...");
    // TODO: Implementazione pulizia utenti
  }
}
