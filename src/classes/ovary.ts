// src/classes/ovary.ts
// Aggiungi exists e ensureDir qui:
import { Settings, IEggsConfig } from "./settings.ts";
import { Utils } from "./utils.ts";
import { Distro } from "./distro.ts";
import { Incubator } from "./incubator.ts";
import { Constants } from "./constants.ts";

// I Worker specializzati
import { FileSystem } from "./ovary.d/filesystem.ts";
import { PreFlight } from "./ovary.d/pre-flight.ts";
import { Squash } from "./ovary.d/squash.ts";
import { Iso } from "./ovary.d/iso.ts";
import { Diversions } from "./diversions.ts";
import { Theme } from "./theme.ts";
import { path, ensureDir, exists } from "../deps.ts"; 
import { Syslinux } from "./ovary.d/syslinux.ts";
import { Grub } from "./ovary.d/grub.ts";
import * as Initrd from "./ovary.d/initrd.ts";

export interface IProduceOptions {
  clone?: boolean;
  homecrypt?: boolean;
  fullcrypt?: boolean;
  fast?: boolean;
  max?: boolean;
  verbose?: boolean;
  scriptOnly?: boolean;
  includeRootHome?: boolean;
}

export class Ovary {
  private config: IEggsConfig;
  private distro: any;

  constructor(config: IEggsConfig) {
    this.config = config;
  }

  /**
   * Produce: Il ciclo di vita dell'uovo
   */
  async produce(options: IProduceOptions = {}) {
    Utils.title("🥚 Ovary: Production Cycle Started");

    // 1. Identità
    this.distro = await Distro.getInfo();
    console.log(`🐧 Distro: ${this.distro.distribId} (${this.distro.codename})`);

    // 2. FileSystem (Overlay / Bind)
    const fsLayer = new FileSystem(this.config, this.distro);
    await fsLayer.bind(options);

    // 3. Pre-Flight (Kernel, Initrd, Users)
    // Nota: PreFlight lavora dentro il mountpoint creato da fsLayer
    const flight = new PreFlight(this.config, this.distro);
    await flight.prepare(options);

    // 4. Incubator (Configurazione Calamares/Krill)
    const incubator = new Incubator(this.distro);
    const calamaresPath = `${Constants.NEST}/.mnt/${Constants.CALAMARES_DIR}`;
    await incubator.configure(calamaresPath);

    // 5. SquashFS (Compressione)
    const squash = new Squash(this.config, this.distro);
    await squash.compress(options);

    // --- 5.1. BOOTLOADERS INJECTION (Via Diversions) ---
    await this.injectBootloaders();

    // --- 5.2. THEME (Configs & Assets) ---
    const themePath = path.resolve("addons/eggs/theme");
    const theme = new Theme();
    await theme.apply(themePath);

    const syslinux = new Syslinux(this.config, this.distro);
    await syslinux.configure(themePath);    

    // 4. GRUB (UEFI)
    const grub = new Grub(this.config, this.distro);
    await grub.configure(themePath);    

    // --- 3. PULIZIA ISO ROOT (NUOVO STEP) ---
    await this.cleanIsoRoot();    

    // 6. ISO (Creazione Immagine)
    const iso = new Iso(this.config, this.distro);
    await iso.build(options);

    // 7. Cleanup (Unbind)
    await fsLayer.unbind(); // Decommentare in produzione

    Utils.title("✅ Uovo Deposto con Successo!");
  }


  /**
     * Copia i file binari (syslinux/grub) basandosi sui path di Diversions
     */
  private async injectBootloaders() {
    Utils.title("🔧 Injecting Bootloaders");

    // Chiediamo a Diversions dove sono i file
    // Nota: distro.id su Debian torna 'debian', su Ubuntu 'ubuntu'. 
    // Diversions.bootloaders gestisce la logica.
    const familyId = this.distro.distribId.toLowerCase().includes("debian") ? "debian" : this.distro.distribId.toLowerCase();
    const sourceBase = Diversions.bootloaders(familyId);

    console.log(`-> Family: ${familyId}`);
    console.log(`-> Source Base: ${sourceBase}`);

    const isoWork = path.join(Constants.NEST, "iso");

    // Lista di cosa copiare e dove
    // [Sorgente relativa a sourceBase, Destinazione relativa a isoWork]
    const targets = [
      { src: "ISOLINUX", dest: "isolinux" }, // BIOS Legacy
      { src: "syslinux/modules/bios", dest: "isolinux/modules" }, // Moduli BIOS
      { src: "grub", dest: "boot/grub" } // GRUB (Moduli + Efi images se presenti)
    ];

    for (const target of targets) {
      const fullSrc = path.join(sourceBase, target.src);
      const fullDest = path.join(isoWork, target.dest);

      if (await exists(fullSrc)) {
        await ensureDir(fullDest);
        // Usiamo rsync per copiare il CONTENUTO
        await Utils.run("rsync", ["-a", `${fullSrc}/`, `${fullDest}/`]);
        console.log(`   ✅ Injected: ${target.src}`);
      } else {
        console.warn(`   ⚠️  Missing: ${fullSrc} (Boot might fail if required)`);
      }
    }
  }


  /**
   * Pulisce la root della ISO dai file che non dovrebbero stare lì
   * o che sono finiti lì per sbaglio copiando il tema.
   */
  private async cleanIsoRoot() {
    Utils.title("🧹 Cleaning ISO Root");
    const isoRoot = path.join(Constants.NEST, "iso");

    // Lista delle cose da eliminare dalla root della ISO
    const trash = [
        "applications",
        "artwork",
        "calamares",
        "catfish.desktop", // Esempi comuni
        "eggs.desktop",
        "livecd", 
        // Se vmlinuz è rimasto nella root per errore, togliamolo (ce l'abbiamo in live/)
        "vmlinuz", 
        "vmlinuz.old",
        "initrd.img",
        "initrd.img.old"
    ];

    for (const item of trash) {
        const p = path.join(isoRoot, item);
        if (await exists(p)) {
            await Deno.remove(p, { recursive: true });
            console.log(`   🗑️  Removed: ${item}`);
        }
    }
    
    // Verifica che kernel sia in live
    if (!await exists(path.join(isoRoot, "live/vmlinuz"))) {
        console.warn("⚠️  ATTENZIONE: vmlinuz non trovato in /live! Il boot fallirà.");
    }
  }
}