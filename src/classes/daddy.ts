// src/classes/daddy.ts
import { Constants } from "./constants.ts";
import { Utils } from "./utils.ts";
import { stringifyYaml, ensureDir, path, exists } from "../deps.ts";

export class Daddy {
  
  /**
   * Resetta la configurazione (crea /etc/penguins-eggs.d e i file yaml)
   */
  async reset(verbose = false) {
    Utils.title("🎩 Dad: Reset Configuration");

    // 1. Crea la directory di configurazione (/etc/penguins-eggs.d)
    if (verbose) console.log(`-> Ensuring directory: ${Constants.CONFIG_DIR}`);
    await ensureDir(Constants.CONFIG_DIR);

    // 2. Crea eggs.yaml (Configurazione Principale)
    const eggsConfig = {
      snapshot_dir: "eggs",
      snapshot_prefix: "eggs",
      snapshot_basename: "iso",
      compression: "gzip", // o "zstd"
      make_iso: true,
      make_efi: true,
      make_isohybrid: true,
      user_opt: "live", // utente live default
      user_opt_passwd: "evolution", // password default
      root_passwd: "evolution"
    };

    await this.writeConfig(Constants.FILES.MAIN, eggsConfig, verbose);

    // 3. Crea krill.yaml (Installer TUI - Opzionale per ora, ma lo mettiamo)
    const krillConfig = {
      name: "Krill Installer",
      version: "1.0",
      steps: ["welcome", "timezone", "keyboard", "partition", "users", "summary", "install"]
    };
    await this.writeConfig(Constants.FILES.KRILL, krillConfig, verbose);

    // 4. Crea i file di exclude di base
    await this.createDefaultExcludes(verbose);

    console.log("\n✅ Configuration reset completed.");
  }

  /**
   * Pulisce repository e file temporanei
   */
  async clean(verbose = false) {
    Utils.title("🧹 Dad: Cleaning Workspace");

    const dirsToClean = [
        Constants.NEST, // /home/eggs
        // Aggiungi qui altre directory se necessario
    ];

    for (const dir of dirsToClean) {
        if (await exists(dir)) {
            if (verbose) console.log(`-> Removing: ${dir}`);
            // await Deno.remove(dir, { recursive: true }); // PERICOLOSO: Abilitare solo se sicuri
            console.log(`   (Simulated) Removed ${dir}`);
        } else {
            if (verbose) console.log(`-> Nothing to clean in: ${dir}`);
        }
    }
    
    console.log("✅ Workspace cleaned.");
  }

  // --- HELPERS ---

  private async writeConfig(filePath: string, data: any, verbose: boolean) {
    try {
        const yamlContent = stringifyYaml(data);
        await Deno.writeTextFile(filePath, yamlContent);
        if (verbose) console.log(`-> Written: ${filePath}`);
    } catch (e) {
        console.error(`❌ Error writing ${filePath}:`, e);
        throw new Error("Permission Denied? Are you root?");
    }
  }

  private async createDefaultExcludes(verbose: boolean) {
    const excludeDir = Constants.EXCLUDES_DIR;
    await ensureDir(excludeDir);

    // Creiamo un exclude.list master di base
    const masterList = Constants.FILES.EXCLUDE_LIST;
    const content = [
        "/dev/*", 
        "/proc/*", 
        "/sys/*", 
        "/tmp/*", 
        "/run/*", 
        "/mnt/*", 
        "/media/*", 
        "/lost+found",
        Constants.NEST // Escludiamo /home/eggs
    ].join("\n");

    await Deno.writeTextFile(masterList, content);
    if (verbose) console.log(`-> Written Excludes: ${masterList}`);
  }
}