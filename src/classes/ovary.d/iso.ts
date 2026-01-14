// src/classes/ovary.d/iso.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, ensureDir, exists } from "../../deps.ts";

export class Iso {
  private config: IEggsConfig;
  private distro: IDistroInfo;

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  async build(options: any) {
    Utils.title("💿 ISO: Building Hybrid Image");

    const isoWork = path.join(Constants.NEST, "iso"); 
    
    // Nomi file sicuri
    const safeDistroId = this.distro.distribId.replaceAll(" ", "_").replaceAll("/", "-");
    const safeCodename = this.distro.codename.replaceAll(" ", "_");
    // Hardcoded per user request
    const isoName = "debian-eggs-live.iso";
    const isoPath = path.join(Constants.NEST, isoName);

    // Volume ID (Max 32 chars, Uppercase)
    let volId = `${this.config.snapshot_prefix}_${safeDistroId}_${safeCodename}`.toUpperCase();
    volId = volId.replace(/[^A-Z0-9_]/g, "_");
    if (volId.length > 30) volId = volId.substring(0, 30);

    // Generazione checksums interni
    await this.generateChecksums(isoWork);

    // --- XORRISO COMMAND ---
    // Usiamo ISOLINUX per il BIOS (legacy) e GRUB per EFI
    const xorrisoArgs = [
        "-as", "mkisofs",
        "-iso-level", "3",
        "-full-iso9660-filenames",
        "-volid", volId,
        "-output", isoPath,
        
        // --- BIOS BOOT (Legacy / CD) ---
        // Usiamo isolinux.bin invece di bios.img
        "-b", "isolinux/isolinux.bin",       // Il file binario di boot
        "-c", "isolinux/boot.cat",           // Il catalogo (verrà creato da xorriso)
        "-no-emul-boot",
        "-boot-load-size", "4",
        "-boot-info-table",
        
        // --- EFI BOOT (UEFI) ---
        "-eltorito-alt-boot",
        "-e", "EFI/efiboot.img",
        "-no-emul-boot",
        "-isohybrid-gpt-basdat",             // Crea tabella partizioni ibrida GPT
        
        isoWork
    ];

    console.log(`-> Creating ISO: ${isoName}`);
    console.log(`-> Boot Strategy: ISOLINUX (Bios) + GRUB (Efi)`);

    const result = await Utils.run("xorriso", xorrisoArgs, true);
    const isoCreated = await exists(isoPath);

    if (result.success || (isoCreated && result.code === 32)) { // Tolleranza codice 32
        console.log(`\n✅ ISO Created Successfully!`);
        console.log(`📂 Path: ${isoPath}`);
        
        console.log("-> Calculating ISO checksum...");
        await Utils.run("sh", ["-c", `md5sum ${isoPath} > ${isoPath}.md5`]);
        console.log("✅ Checksum ready.");
    } else {
        throw new Error("ISO Creation Failed");
    }
  }

  private async generateChecksums(isoWork: string) {
    console.log("-> Generating internal md5sum.txt...");
    // Escludiamo i file di boot dal checksum interno per evitare loop strani
    const cmd = `cd ${isoWork} && find . -type f -not -name 'md5sum.txt' -not -path '*/isolinux/*' -not -path '*/EFI/*' -print0 | xargs -0 md5sum > md5sum.txt`;
    await Utils.run("sh", ["-c", cmd]);
  }
}
