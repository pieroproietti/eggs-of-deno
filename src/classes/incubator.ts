// src/classes/incubator.ts
import { IDistroInfo } from "./distro.ts";
import { Utils } from "./utils.ts";
import { stringifyYaml, ensureDir, path } from "../deps.ts";

export class Incubator {
  private distro: IDistroInfo;

  constructor(distro: IDistroInfo) {
    this.distro = distro;
  }

  /**
   * Il metodo principale: prepara la configurazione dell'installer
   * in una cartella di destinazione (es. /tmp/eggs-work/calamares)
   */
  async configure(destinationPath: string) {
    Utils.title(`Incubator: Configuring for ${this.distro.distribId}`);

    // Creiamo la cartella di destinazione
    await ensureDir(destinationPath);

    // 1. Generiamo la config di Calamares
    await this.generateCalamaresConfig(destinationPath);
    
    // 2. Generiamo la config di Krill (il nostro TUI installer)
    await this.generateKrillConfig(destinationPath);
  }

  /**
   * Genera i file YAML per Calamares
   */
  private async generateCalamaresConfig(dest: string) {
    console.log("-> Generando configurazione Calamares...");

    // Esempio: Moduli diversi per Arch vs Debian
    const isArch = this.distro.id === "arch" || this.distro.id === "manjaro";
    
    const modulesUrl = isArch 
      ? ["pacman-init", "partition", "mount", "unpackfs", "networkcfg"]
      : ["partition", "mount", "unpackfs", "apt-update", "networkcfg"];

    const calamaresConfig = {
      modules: modulesUrl,
      showPrompt: true,
      branding: "eggs-branding",
      promptInstall: false,
      dontChroot: false,
      oemSetup: false,
      disableCancel: false,
      disableRestart: false,
    };

    // Scrittura del file
    const filePath = path.join(dest, "settings.conf");
    const yamlContent = stringifyYaml(calamaresConfig);
    
    await Deno.writeTextFile(filePath, yamlContent);
    console.log(`   ✅ Scritto: ${filePath}`);
  }

  /**
   * Genera la configurazione per Krill (JSON)
   */
  private async generateKrillConfig(dest: string) {
    console.log("-> Generando configurazione Krill...");
    
    const krillConfig = {
      distro_target: this.distro.id,
      installer_version: "1.0.0",
      use_efi: true, // Qui dovremmo controllare se siamo in UEFI
      swap_file: true
    };

    const filePath = path.join(dest, "krill.json");
    await Deno.writeTextFile(filePath, JSON.stringify(krillConfig, null, 2));
    console.log(`   ✅ Scritto: ${filePath}`);
  }
}
