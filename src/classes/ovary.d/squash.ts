// src/classes/ovary.d/squash.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, ensureDir, exists } from "../../deps.ts";

export class Squash {
  private config: IEggsConfig;
  private distro: IDistroInfo;
  
  // Accumulatore per le esclusioni dinamiche (-e file1 file2 ...)
  private sessionExcludes: string[] = [];

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  /**
   * Crea il filesystem compresso (filesystem.squashfs)
   */
  async compress(options: any) {
    Utils.title("📦 SquashFS: Compressing Filesystem");

    const source = path.join(Constants.NEST, ".mnt"); // La root del sistema unito
    const destDir = path.join(Constants.NEST, "iso/live");
    const destFile = path.join(destDir, "filesystem.squashfs");
    const scriptFile = path.join(Constants.NEST, "mksquashfs.sh"); // Salviamo lo script qui

    // Assicuriamo che la destinazione esista
    await ensureDir(destDir);

    // Rimuoviamo il vecchio file se esiste
    if (await exists(destFile)) {
        await Deno.remove(destFile);
    }

    // --- 1. GESTIONE ESCLUSIONI STATICHE ---
    const fexcludes = [
        '/boot/efi/EFI',
        '/boot/loader/entries/',
        '/etc/fstab',
        '/var/lib/containers/',
        '/var/lib/docker/',
        '/etc/mtab',
        '/etc/udev/rules.d/70-persistent-cd.rules',
        '/etc/udev/rules.d/70-persistent-net.rules',
        // '/etc/network/interfaces', // Attenzione: valutare se escludere
    ];

    for (const excl of fexcludes) {
        this.addExclusion(excl);
    }

    // --- 2. LOGICA DEBIAN (Cryptdisks cleanup) ---
    // Scansiona le directory rc*.d per rimuovere servizi di cifratura non voluti nella live
    if (this.distro.id === 'debian' || this.distro.distribId?.toLowerCase().includes('debian')) {
        const rcd = ['rc0.d', 'rc1.d', 'rc2.d', 'rc3.d', 'rc4.d', 'rc5.d', 'rc6.d', 'rcS.d'];
        
        for (const rcDir of rcd) {
            const fullPath = path.join(source, 'etc', rcDir);
            if (await exists(fullPath)) {
                for await (const entry of Deno.readDir(fullPath)) {
                    if (entry.name.includes('cryptdisks')) {
                        this.addExclusion(`/etc/${rcDir}/${entry.name}`);
                    }
                }
            }
        }
    }

    // --- 3. SICUREZZA (Root Home) ---
    // Se non richiesto esplicitamente, puliamo la home di root
    if (!options.includeRootHome) {
        this.addExclusion('root/*');
        this.addExclusion('root/.*'); // File nascosti
    }

    // Escludiamo la cartella di lavoro stessa per evitare loop ricorsivi
    // Nota: Constants.NEST di solito è /home/eggs. Se è dentro il source, va escluso.
    if (Constants.NEST.startsWith(source)) {
        const relPath = path.relative(source, Constants.NEST);
        this.addExclusion(relPath);
    }
    // Escludiamo anche .eggs-config se esiste
    this.addExclusion("/etc/penguins-eggs.d/eggs.yaml");


    // --- 4. COSTRUZIONE COMANDO ---
    const args = [
        source, 
        destFile
    ];

    // Compressione
    switch (this.config.compression) {
        case "xz": 
            args.push("-comp", "xz", "-b", "1M"); 
            break;
        case "zstd": 
            args.push("-comp", "zstd", "-Xcompression-level", "15"); 
            break;
        default: 
            args.push("-comp", "gzip");
    }

    // Opzioni standard
    args.push("-no-xattrs", "-wildcards");

    // Patch ARM64 (placeholder)
    if (Deno.build.arch === "aarch64") {
        // args.push("-processors", "2", "-mem", "1024M");
    }

    // File di esclusioni master (exclude.list)
    const masterExclude = path.join(Constants.CONFIG_DIR, "exclude.list"); // Controlla Constants.EXCLUDES
    if (await exists(masterExclude)) {
        args.push("-ef", masterExclude);
    }

    // Esclusioni di sessione (quelle accumulate sopra)
    if (this.sessionExcludes.length > 0) {
        args.push("-e", ...this.sessionExcludes);
    }

    // --- 5. SALVATAGGIO SCRIPT & ESECUZIONE ---
    const cmdString = `mksquashfs ${args.join(" ")}`;
    
    // Scriviamo lo script per debug (utile se l'utente vuole rilanciarlo a mano)
    await Deno.writeTextFile(scriptFile, `#!/bin/bash\n${cmdString}\n`);
    await Deno.chmod(scriptFile, 0o755);

    console.log(`Script generato in: ${scriptFile}`);
    console.log(`Source: ${source}`);
    console.log(`Dest: ${destFile}`);

    // ESECUZIONE REALE
    // Nota: mksquashfs è verboso, potremmo voler vedere l'output
    // Se scriptOnly è true, ci fermiamo qui
    /*
    if (!options.scriptOnly) {
        const result = await Utils.run("mksquashfs", args);
        if (!result.success) {
            console.error("❌ Errore mksquashfs:", result.err);
            throw new Error("Compressione fallita");
        }
        console.log("✅ Filesystem compresso.");
    }
    */
    console.log("✅ (Simulated) mksquashfs completato.");
  }

  /**
   * Helper per aggiungere esclusioni.
   * Rimuove lo slash iniziale perché mksquashfs lavora con path relativi.
   */
  private addExclusion(exclusion: string): void {
    let cleanExclusion = exclusion;
    if (cleanExclusion.startsWith('/')) {
        cleanExclusion = cleanExclusion.slice(1);
    }
    
    // Evitiamo duplicati
    if (!this.sessionExcludes.includes(cleanExclusion)) {
        this.sessionExcludes.push(cleanExclusion);
        // console.log(`Excluding: ${cleanExclusion}`); // Decommenta per debug
    }
  }
}
