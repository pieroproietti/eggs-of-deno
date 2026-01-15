// src/classes/settings.ts
import { parseYaml, stringifyYaml, path, exists, ensureDir } from "../deps.ts";

export interface IEggsConfig {
  snapshot_dir: string;
  snapshot_prefix: string;
  compression: "gzip" | "xz" | "zstd";
  // AGGIUNGI QUESTI CAMPI MANCANTI:
  make_efi?: boolean;       // Supporto UEFI
  make_isohybrid?: boolean; // Supporto Hybrid Boot
  user_opt?: string;        // Utente live default
  user_opt_passwd?: string; // Password utente live
}

const DEFAULT_CONFIG: IEggsConfig = {
  snapshot_dir: "eggs",
  snapshot_prefix: "egg-of",
  compression: "gzip",
  make_efi: true,       // Default true
  make_isohybrid: true,  // Default true
  user_opt: "live",
  user_opt_passwd: "evolution"
};

export class Settings {
  // Percorso del file di configurazione (per ora locale per test)
  private static configPath = "./eggs.yaml"; 

  static async load(): Promise<IEggsConfig> {
    if (await exists(this.configPath)) {
      try {
        const content = await Deno.readTextFile(this.configPath);
        const parsed = parseYaml(content) as Partial<IEggsConfig>;
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (e) {
        console.error(`Errore leggendo config:`, e);
      }
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Salva la configurazione su disco
   */
  static async save(config: IEggsConfig): Promise<void> {
    try {
      // Convertiamo l'oggetto in stringa YAML
      const yamlContent = stringifyYaml(config as unknown as Record<string, unknown>);
      
      // Scriviamo il file
      await Deno.writeTextFile(this.configPath, yamlContent);
      console.log(`✅ Configurazione salvata in: ${this.configPath}`);
    } catch (e) {
      console.error("❌ Errore durante il salvataggio:", e);
    }
  }
}