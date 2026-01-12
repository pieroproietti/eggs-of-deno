// src/classes/ovary.d/iso.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, exists } from "../../deps.ts";

export class Iso {
  private config: IEggsConfig;
  private distro: IDistroInfo;

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  async build(options: any) {
    Utils.title("💿 ISO Generation (Xorriso)");

    // 1. Definizioni Variabili
    const arch = Deno.build.arch; 
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const volid = `EGGS-${dateStr.replace(/-/g, '')}`; 

    // Logica suffisso file
    let typology = "";
    const prefix = this.config.snapshot_prefix;
    if (prefix.startsWith("egg-of_")) {
        if (options.clone) typology = "_clone";
        else if (options.homecrypt) typology = "_clone-home-crypted";
        else if (options.fullcrypt) typology = "_clone-full-crypted";
    }

    // Nome file finale
    const isoFilename = `${prefix}-${this.distro.distribId}-${this.distro.codename}${typology}-${dateStr}.iso`;
    const outputPath = path.join(Constants.NEST, isoFilename);
    
    // Directory sorgente (dove abbiamo messo filesystem.squashfs, kernel, etc.)
    const sourcePath = path.join(Constants.NEST, "iso"); 

    console.log(`-> Architecture: ${arch}`);
    console.log(`-> Output: ${outputPath}`);

    // 2. Costruzione Comando Xorriso (Array è più sicuro delle stringhe)
    const args = [
      "-as", "mkisofs",
      "-J",
      "-joliet-long",
      "-l",
      "-iso-level", "3",
      "-partition_offset", "16",
      "-V", volid
    ];

    // --- ARCHITETTURA X86/X64 (MBR HYBRID) ---
    const isArm = arch === "aarch64";
    const isRiscV = arch === "x86_64" ? false : true; // Semplificazione, da affinare

    if (!isArm && !isRiscV) {
        // Cerchiamo isohdpfx.bin
        const possibleMbrs = [
            "/usr/lib/ISOLINUX/isohdpfx.bin",
            "/usr/lib/syslinux/isohdpfx.bin",
            "/usr/share/syslinux/isohdpfx.bin"
        ];
        
        let mbrFound = false;
        for (const bin of possibleMbrs) {
            if (await exists(bin)) {
                args.push("-isohybrid-mbr", bin);
                mbrFound = true;
                break;
            }
        }
        
        // Boot params standard x86
        args.push("-b", "isolinux/isolinux.bin");
        args.push("-c", "isolinux/boot.cat");
        args.push("-no-emul-boot", "-boot-load-size", "4", "-boot-info-table");
    }

    // --- UEFI SUPPORT ---
    if (this.config.make_efi !== false) { // Default true
       args.push("-eltorito-alt-boot");
       args.push("-e", "boot/grub/efi.img");
       args.push("-no-emul-boot");
       args.push("-isohybrid-gpt-basdat");
    }

    // --- LUKS PARTITION APPEND (Se serve) ---
    if (options.fullcrypt) {
        const luksMapName = "root.img"; 
        const luksPath = path.join(sourcePath, "live", luksMapName);
        if (await exists(luksPath)) {
            console.log("🔒 Appending LUKS partition...");
            args.push("-append_partition", "3", "0x80", luksPath);
        }
    }

    // --- FINALIZZAZIONE ---
    args.push("-o", outputPath);
    args.push(sourcePath); // Sorgente alla fine

    // ESECUZIONE
    // await Utils.run("xorriso", args);
    console.log(`[SIMULATION] xorriso ${args.join(" ")}`);
  }
}
