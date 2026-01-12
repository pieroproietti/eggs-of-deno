// src/classes/bleach.ts
import { Utils } from "./utils.ts";
import { Distro } from "./distro.ts";
import { path, exists } from "../deps.ts";

export class Bleach {
  
  /**
   * Pulisce il sistema host (o un chroot se passiamo logiche diverse, ma per ora è Host)
   */
  async clean(verbose = false) {
    Utils.title("🧹 Bleach: Deep System Cleaning");

    // 1. Identifica la Distro
    const distro = await Distro.getInfo();
    const familyId = distro.id; // o distro.familyId se lo abbiamo mappato

    console.log(`-> Detected Family: ${familyId}`);

    // 2. Pulizia Package Manager (Logica originale mantenuta)
    await this.cleanPackageCache(familyId, verbose);

    // 3. Moduli specifici
    await this.cleanFlatpak(verbose);
    await this.cleanHistory(verbose);
    await this.cleanJournal(verbose);
    
    // 4. Integrazione: Pulizia File Sensibili (Machine ID, Random Seed)
    await this.cleanSensitive(verbose);

    // 5. Drop Caches (Va fatto per ultimo)
    await this.cleanSystemCache(verbose);
    
    console.log("✨ System looks shiny and chrome!");
  }

  /**
   * Pulizia Cache dei Pacchetti (Logica tua originale portata su Utils.run)
   */
  private async cleanPackageCache(familyId: string, verbose: boolean) {
    if (verbose) console.log("-> Cleaning package cache...");

    switch (familyId) {
      case "alpine":
        await Utils.run("apk", ["cache", "clean"]);
        await Utils.run("apk", ["cache", "purge"]);
        break;

      case "arch":
      case "manjaro":
      case "archlinux":
        // "yes | sudo pacman -Scc"
        // In Deno non possiamo usare pipe facilmente in Utils.run, usiamo sh -c
        await Utils.run("sh", ["-c", "yes | pacman -Scc"]);
        break;

      case "debian":
      case "ubuntu":
      case "linuxmint":
      case "kali":
        await Utils.run("apt-get", ["clean"]);
        await Utils.run("apt-get", ["autoclean"]);
        // Rimuove lock e liste parziali
        await Utils.run("rm", ["-rf", "/var/lib/apt/lists/lock"]);
        // Integrazione: A volte serve pulire anche le liste per ridurre spazio
        // await Utils.run("rm", ["-rf", "/var/lib/apt/lists/*"]); 
        break;

      case "fedora":
      case "openmamba":
      case "almalinux":
        // Rimuove vecchi kernel (comando complesso con subshell)
        try {
           await Utils.run("bash", ["-c", "dnf remove $(dnf repoquery --installonly --latest-limit=-1 -q) -y"]);
        } catch (e) {
           console.warn("Nessun vecchio kernel da rimuovere o dnf fallito.");
        }
        await Utils.run("dnf", ["clean", "all"]);
        break;

      case "opensuse":
      case "suse":
        await Utils.run("zypper", ["clean"]);
        break;

      case "void":
      case "voidlinux":
        await Utils.run("xbps-remove", ["-O"]);
        break;

      default:
        console.warn(`⚠️ No specific cleaning strategy for ${familyId}`);
    }
  }

  /**
   * Pulizia Flatpak
   */
  private async cleanFlatpak(verbose: boolean) {
    if (verbose) console.log("-> Cleaning Flatpak cache...");
    // rm /var/tmp/flatpak-cache-* -rf
    // Usiamo sh -c per il wildcard *
    await Utils.run("sh", ["-c", "rm -rf /var/tmp/flatpak-cache-*"]);
  }

  /**
   * Pulizia History Bash
   */
  private async cleanHistory(verbose: boolean) {
    if (verbose) console.log("-> Cleaning bash history...");
    
    const histories = [
        "/root/.bash_history",
        `/home/${await Utils.getPrimaryUser()}/.bash_history` // Helper da implementare o usare Deno.env
    ];

    for (const hist of histories) {
        if (await exists(hist)) {
            await Deno.remove(hist);
            if (verbose) console.log(`   Removed: ${hist}`);
        }
    }
  }

  /**
   * Pulizia Journald / Logs
   */
  private async cleanJournal(verbose: boolean) {
    if (verbose) console.log("-> Cleaning journals...");

    // TODO: Implementare Utils.isSystemd(). Per ora assumiamo check cartella
    const hasSystemd = await exists("/run/systemd/system");

    if (hasSystemd) {
        try {
            await Utils.run("journalctl", ["--rotate"]);
            await Utils.run("journalctl", ["--vacuum-time=1s"]);
        } catch (e) {
            console.error("Errore journalctl:", e);
        }
    } else {
        // Logica SysVinit: trova .gz e tronca file
        if (verbose) console.log("   (Legacy log cleanup)");
        
        // 1. Rimuovi archivi gz
        await Utils.run("sh", ["-c", "find /var/log -name '*.gz' -delete"]);
        
        // 2. Tronca i file di log attivi (senza cancellarli)
        // find /var/log/ -type f -exec truncate -s 0 {} \;
        await Utils.run("sh", ["-c", "find /var/log/ -type f -exec truncate -s 0 {} \\;"]);
    }
  }

  /**
   * INTEGRAZIONE: Pulizia file sensibili
   * (Machine-ID, Random Seed, etc.)
   */
  private async cleanSensitive(verbose: boolean) {
    if (verbose) console.log("-> Cleaning sensitive identifiers...");

    const targets = [
        "/var/lib/dbus/machine-id",
        "/var/lib/systemd/random-seed",
        "/var/lib/dhcp/dhclient.leases" // Spesso dimenticato!
    ];

    for (const f of targets) {
        if (await exists(f)) {
            // Tronchiamo invece di rimuovere se serve mantenere il file vuoto
            // Ma per machine-id spesso è meglio rimuovere o svuotare
            await Deno.writeTextFile(f, ""); 
            if (verbose) console.log(`   Truncated: ${f}`);
        }
    }
  }

  /**
   * Drop Caches (Kernel)
   */
  private async cleanSystemCache(verbose: boolean) {
    if (verbose) console.log("-> Dropping system caches...");
    
    try {
        // await exec('sync; echo 3 > /proc/sys/vm/drop_caches')
        await Utils.run("sync", []);
        
        // Scriviamo direttamente sul file proc (richiede permessi, ma eggs gira come root)
        await Deno.writeTextFile("/proc/sys/vm/drop_caches", "3");
    } catch (e) {
        console.warn("⚠️ Non posso scrivere in /proc/sys/vm/drop_caches (Permessi?)");
    }
  }
}