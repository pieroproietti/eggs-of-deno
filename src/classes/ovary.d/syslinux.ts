// src/classes/ovary.d/syslinux.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { Diversions } from "../diversions.ts";
import { path, exists, mustache } from "../../deps.ts";

export class Syslinux {
  private config: IEggsConfig;
  private distro: IDistroInfo;
  private volId: string; // Volume ID per il kernel param

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
    // Calcoliamo il VOLID come facciamo in Iso.ts
    // (Idealmente dovrebbe essere passato o calcolato centralmente, ma lo ricalcoliamo qui per semplicità)
    const safeDistroId = this.distro.distribId.replaceAll(" ", "_").replaceAll("/", "-");
    const safeCodename = this.distro.codename.replaceAll(" ", "_");
    this.volId = `${this.config.snapshot_prefix}_${safeDistroId}_${safeCodename}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_").substring(0, 30);
  }

  /**
   * Configura ISOLINUX (BIOS Legacy Boot)
   * @param themePath Path alla cartella del tema (es. addons/eggs/theme)
   */
  async configure(themePath: string) {
    Utils.title("🐧 Syslinux: Configuring Legacy Boot");

    const isoWork = path.join(Constants.NEST, "iso");
    const isolinuxDir = path.join(isoWork, "isolinux");
    
    // Path dei bootloaders (Sorgente binari)
    const familyId = this.distro.distribId.toLowerCase().includes("debian") ? "debian" : this.distro.distribId.toLowerCase();
    const blBase = Diversions.bootloaders(familyId); // es: /usr/lib o ./bootloaders

    // 1. COPIA BINARI ESSENZIALI (Se mancano o per sicurezza)
    // Nota: Vendor.ts potrebbe averli già copiati, ma qui siamo specifici.
    const sysModules = path.join(blBase, "syslinux/modules/bios");
    const isolinuxBin = path.join(blBase, "ISOLINUX");

    const filesToCopy = [
        { src: path.join(sysModules, "chain.c32"), dest: "chain.c32" },
        { src: path.join(isolinuxBin, "isohdpfx.bin"), dest: "isohdpfx.bin" },
        { src: path.join(isolinuxBin, "isolinux.bin"), dest: "isolinux.bin" },
        { src: path.join(sysModules, "ldlinux.c32"), dest: "ldlinux.c32" },
        { src: path.join(sysModules, "libcom32.c32"), dest: "libcom32.c32" },
        { src: path.join(sysModules, "libutil.c32"), dest: "libutil.c32" },
        { src: path.join(sysModules, "vesamenu.c32"), dest: "vesamenu.c32" }
    ];

    for (const f of filesToCopy) {
        if (await exists(f.src)) {
            await Deno.copyFile(f.src, path.join(isolinuxDir, f.dest));
        } else {
            console.warn(`⚠️  Syslinux binary missing: ${f.src}`);
        }
    }

    // 2. GESTIONE TEMPLATE E CONFIGURAZIONE
    // Cerchiamo i template nel tema
    const livecdThemeDir = path.join(themePath, "livecd");
    
    // File Sorgenti
    const splashSrc = path.join(livecdThemeDir, "splash.png");
    const themeCfgSrc = path.join(livecdThemeDir, "isolinux.theme.cfg");
    const mainCfgTpl = path.join(livecdThemeDir, "isolinux.main.cfg");

    // File Destinazione
    const splashDest = path.join(isolinuxDir, "splash.png");
    const themeCfgDest = path.join(isolinuxDir, "isolinux.theme.cfg");
    const mainCfgDest = path.join(isolinuxDir, "isolinux.cfg");

    // Copia risorse statiche
    if (await exists(splashSrc)) await Deno.copyFile(splashSrc, splashDest);
    if (await exists(themeCfgSrc)) await Deno.copyFile(themeCfgSrc, themeCfgDest);

    // 3. RENDER TEMPLATE (Mustache)
    if (await exists(mainCfgTpl)) {
        const template = await Deno.readTextFile(mainCfgTpl);
        
        // Calcolo parametri
        const kernelParams = Diversions.kernelParameters(familyId, this.volId);
        const fullname = `${this.distro.distribId} ${this.distro.codename}`.toUpperCase();

        const view = {
            fullname: fullname,
            initrdImg: "/live/initrd.img", // Hardcoded perché sappiamo dove li abbiamo messi
            vmlinuz: "/live/vmlinuz",
            kernel_parameters: kernelParams
        };

        // Renderizza
        const output = mustache.render(template, view);
        await Deno.writeTextFile(mainCfgDest, output);
        
        console.log(`✅ Generated: ${mainCfgDest}`);
        console.log(`   Kernel Params: ${kernelParams}`);
    } else {
        console.error(`❌ Template missing: ${mainCfgTpl}`);
        throw new Error("Missing isolinux.main.cfg template");
    }
  }
}