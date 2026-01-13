// src/classes/theme.ts
import { Utils } from "./utils.ts";
import { Constants } from "./constants.ts";
import { path, exists } from "../deps.ts";

export class Theme {
  
  /**
   * Applica il tema alla directory di lavoro ISO.
   * Copia i file di configurazione (grub.cfg, isolinux.cfg), sfondi e icone.
   * Sovrascrive i file esistenti (è voluto).
   * * @param themePath Il percorso della cartella del tema (es. addons/eggs/theme)
   */
  async apply(themePath: string) {
    Utils.title("🎨 Theme: Applying Look & Feel");

    const isoWork = path.join(Constants.NEST, "iso"); // Destinazione: /home/eggs/iso

    // Controllo esistenza
    if (!await exists(themePath)) {
        console.warn(`⚠️  Theme path not found: ${themePath}`);
        console.warn("    ISO will be created with raw binaries only (might not boot properly without configs).");
        return;
    }

    console.log(`-> Source: ${themePath}`);
    console.log(`-> Dest:   ${isoWork}`);

    // Strategia di copia: RSYNC (Consigliato)
    // Rsync è perfetto per fare il "merge" delle directory mantenendo permessi e sovrascrivendo
    const hasRsync = (await Utils.run("which", ["rsync"])).success;
    
    if (hasRsync) {
        // rsync -a source/ dest/
        // IMPORTANTE: Lo slash finale su themePath/ dice "copia il CONTENUTO", non la cartella stessa.
        const result = await Utils.run("rsync", ["-a", `${themePath}/`, `${isoWork}/`]);
        
        if (!result.success) {
            console.error("❌ Error applying theme with rsync:", result.err);
            throw new Error("Theme application failed");
        }
    } else {
        // Strategia di copia: CP (Fallback)
        // cp -r source/. dest/
        await Utils.run("cp", ["-r", `${themePath}/.`, isoWork]);
    }

    console.log("✅ Theme applied successfully.");
  }
}