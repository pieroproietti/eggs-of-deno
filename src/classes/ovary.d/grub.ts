// src/classes/ovary.d/grub.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { Diversions } from "../diversions.ts";
import { path, exists, mustache } from "../../deps.ts";

export class Grub {
  private config: IEggsConfig;
  private distro: IDistroInfo;
  private volId: string;

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
    
    // Calcolo VOLID (compatibile UEFI/ISO9660)
    const safeDistroId = this.distro.distribId.replaceAll(" ", "_").replaceAll("/", "-");
    const safeCodename = this.distro.codename.replaceAll(" ", "_");
    this.volId = `${this.config.snapshot_prefix}_${safeDistroId}_${safeCodename}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_").substring(0, 30);
  }

  async configure(themePath: string) {
    Utils.title("🐛 Grub: Configuring UEFI Boot");

    const isoWork = path.join(Constants.NEST, "iso");
    const grubDir = path.join(isoWork, "boot/grub");
    
    // Assicuriamoci che la destinazione esista
    await Deno.mkdir(grubDir, { recursive: true });

    // --- 1. DEFINIZIONE PERCORSI SORGENTE (Cartella livecd) ---
    // Come da tua indicazione, i template sono qui:
    const livecdThemeDir = path.join(themePath, "livecd");
    
    const themeCfgSrc = path.join(livecdThemeDir, "theme.cfg");
    const mainCfgTpl = path.join(livecdThemeDir, "grub.main.cfg"); // Il template Mustache
    
    // --- 2. DEFINIZIONE PERCORSI DESTINAZIONE (Nella ISO) ---
    const themeCfgDest = path.join(grubDir, "theme.cfg");
    const mainCfgDest = path.join(grubDir, "grub.cfg");

    // --- 3. COPIA CONFIGURAZIONE TEMA ---
    if (await exists(themeCfgSrc)) {
        await Deno.copyFile(themeCfgSrc, themeCfgDest);
        console.log(`   Copied theme cfg: ${themeCfgSrc} -> ${themeCfgDest}`);
    } else {
        console.warn(`⚠️  Missing theme cfg at: ${themeCfgSrc}`);
    }

    // --- 4. RENDER TEMPLATE (grub.cfg) ---
    if (await exists(mainCfgTpl)) {
        console.log(`-> Loading template: ${mainCfgTpl}`);
        const template = await Deno.readTextFile(mainCfgTpl);

        // Recuperiamo info dinamiche
        const kernelVer = (await Utils.run("uname", ["-r"])).out;
        
        // Parametri Kernel
        const familyId = this.distro.distribId.toLowerCase().includes("debian") ? "debian" : this.distro.distribId.toLowerCase();
        const kernelParams = Diversions.kernelParameters(familyId, this.volId);
        const fullname = `${this.distro.distribId} ${this.distro.codename}`.toUpperCase();

        // View Object per Mustache
        const view = {
            fullname: fullname,
            initrdImg: "/live/initrd.img",
            vmlinuz: "/live/vmlinuz",
            kernel_parameters: kernelParams,
            kernel: kernelVer, // Riempie il buco "kernel <versione>"
            // Campi extra per compatibilità con template complessi
            "suid": "", 
            "ip": ""
        };

        // Render e Scrittura
        const output = mustache.render(template, view);
        await Deno.writeTextFile(mainCfgDest, output);

        console.log(`✅ Generated: ${mainCfgDest}`);
        
        // Debug contenuto (opzionale)
        // console.log(output);
    } else {
        console.error(`❌ Template missing: ${mainCfgTpl}`);
        throw new Error("Missing grub.main.cfg template");
    }
  }
}
