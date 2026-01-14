// src/classes/ovary.d/squash.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, ensureDir, exists } from "../../deps.ts";

export class Squash {
  private config: IEggsConfig;
  private distro: IDistroInfo;
  
  private sessionExcludes: string[] = [];

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  async compress(options: any) {
    Utils.title("📦 SquashFS: Compressing Filesystem");

    const source = path.join(Constants.NEST, "chroot");
    const destDir = path.join(Constants.NEST, "iso/live");
    const destFile = path.join(destDir, "filesystem.squashfs");
    const binDir = path.join(Constants.NEST, "bin");
    await ensureDir(binDir);
    const scriptFile = path.join(binDir, "mksquash.sh"); 

    await ensureDir(destDir);

    if (await exists(destFile)) {
        await Deno.remove(destFile);
    }

    // --- 1. ESCLUSIONI STANDARD ---
    const fexcludes = [
        'boot/efi/EFI',
        'boot/loader/entries',
        'etc/fstab',
        'var/lib/containers',
        'var/lib/docker',
        'etc/mtab',
        'etc/udev/rules.d/70-persistent-cd.rules',
        'etc/udev/rules.d/70-persistent-net.rules',
        'root/.bash_history',
        'var/tmp/*'
    ];

    for (const excl of fexcludes) this.addExclusion(excl);

    // --- 2. SAFETY NET (Esclusioni Critiche) ---
    // Queste DEVONO esserci per evitare loop infiniti o iso giganti
    
    // Escludiamo il NEST (/home/eggs -> home/eggs)
    let nestRel = Constants.NEST;
    if (nestRel.startsWith('/')) nestRel = nestRel.slice(1);
    this.addExclusion(nestRel);                 // Esclude la cartella intera
    this.addExclusion(`${nestRel}/*`);          // Esclude il contenuto

    // Escludiamo TUTTA la home se non richiesto diversamente
    // (Manteniamo solo lo scheletro della directory)
    if (!options.includeRootHome) {
        this.addExclusion("root/*");
        this.addExclusion("root/.*");
    }

    // Se stiamo facendo una distro (non un clone completo), via la home utente
    if (!options.clone) {
        this.addExclusion("home/*");
        // Ma attenzione: se /home/eggs è dentro /home, è già escluso da home/*
        // Tuttavia meglio abbondare.
        console.log("🛡️  Excluding /home content (Distro Mode)");
    }

    // --- 3. EXCLUDE.LIST (Utente) ---
    const masterExclude = path.join(Constants.CONFIG_DIR, "exclude.list"); 
    if (await exists(masterExclude)) {
        try {
            const content = await Deno.readTextFile(masterExclude);
            content.split('\n').forEach(line => {
                const l = line.trim();
                if (l && !l.startsWith('#')) this.addExclusion(l);
            });
        } catch (e) {
            console.warn("⚠️ Cannot read exclude.list", e);
        }
    }

    // --- 4. PREPARAZIONE COMANDO ---
    const args = [source, destFile];

    switch (this.config.compression) {
        case "xz": 
            // XZ è lento ma comprime molto.
            args.push("-comp", "xz", "-b", "1M"); 
            break;
            
        case "zstd": 
            // I tuoi nuovi parametri ottimizzati: 
            // Blocco 1M (buono per seek speed) e Level 3 (veloce e decente)
            args.push("-comp", "zstd", "-b", "1M", "-Xcompression-level", "3"); 
            break;
            
        default: 
            // Default zstd
            args.push("-comp", "zstd", "-b", "1M", "-Xcompression-level", "3"); 
            // args.push("-comp", "gzip");
    }

    // Aggiungiamo sempre le opzioni standard
    args.push("-no-xattrs", "-wildcards");

    if (this.sessionExcludes.length > 0) {
        args.push("-e", ...this.sessionExcludes);
    }

    // Script debug
    const cmdString = `mksquashfs ${args.join(" ")}`;
    await Deno.writeTextFile(scriptFile, `#!/bin/bash\n${cmdString}\n`);
    await Deno.chmod(scriptFile, 0o755);

    console.log(`Script: ${scriptFile}`);
    console.log(`Esclusioni attive: ${this.sessionExcludes.length}`);
    
    // Debug: stampa le prime 5 esclusioni per verifica
    // console.log("Sample excludes:", this.sessionExcludes.slice(0, 5));

// ESECUZIONE REALE
    if (!options.scriptOnly) {
        // Rimuoviamo il console.log statico perché ora vedremo l'output vero
        // console.log("⏳ Compressing... (Check process with 'top' if stuck)"); 
        
        // Passiamo 'true' come terzo argomento per abilitare lo streaming
        const result = await Utils.run("mksquashfs", args, true); 
        
        if (!result.success) {
            console.error("❌ Errore mksquashfs (vedi output sopra)"); // L'errore è già stato stampato a video
            throw new Error("Compressione fallita");
        }
        console.log("✅ Filesystem compresso.");
    }
  }

  private addExclusion(exclusion: string): void {
    let clean = exclusion.trim();
    // Pulisci slash iniziali multipli
    while (clean.startsWith('/') || clean.startsWith('./')) {
        if (clean.startsWith('/')) clean = clean.slice(1);
        if (clean.startsWith('./')) clean = clean.slice(2);
    }
    if (clean && !this.sessionExcludes.includes(clean)) {
        this.sessionExcludes.push(clean);
    }
  }
}
