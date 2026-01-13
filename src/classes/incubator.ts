// src/classes/incubator.ts
import { Utils } from "./utils.ts";
import { Constants } from "./constants.ts";
import { IDistroInfo } from "./distro.ts";
import { path, ensureDir, exists, copyDir } from "../deps.ts";

export class Incubator {
  private distro: IDistroInfo;

  constructor(distro: IDistroInfo) {
    this.distro = distro;
  }

  /**
   * Configura gli installer (Calamares / Krill) nel sistema live
   * @param destRoot La root del sistema montato (es. .mnt)
   */
  async configure(destRoot: string) {
    Utils.title("🥚 Incubator: Configuring Installers");

    // 1. Configurazione Krill (CLI Installer)
    await this.setupKrill(destRoot);

    // 2. Configurazione Calamares (GUI Installer)
    // Lo facciamo solo se Calamares è installato sull'host
    if (await this.hasCalamares()) {
        await this.setupCalamares(destRoot);
    } else {
        console.log("⚠️  Calamares non trovato. La ISO avrà solo l'installer CLI (Krill).");
    }
  }

  /**
   * Prepara Krill (copia eggs.yaml e krill.yaml dentro la live)
   */
  private async setupKrill(destRoot: string) {
    console.log("-> Setup Krill (CLI Installer)...");
    
    // Destinazione: .mnt/etc/penguins-eggs.d/
    const destConfigDir = path.join(destRoot, Constants.CONFIG_DIR); // Nota: CONFIG_DIR è assoluto, dobbiamo togliere il primo slash se usiamo join o gestire path relativi
    // Fix path: Constants.CONFIG_DIR è "/etc/penguins-eggs.d"
    // destRoot è "/home/eggs/.mnt"
    // join unisce correttamente gestendo le root
    const realDest = path.join(destRoot, "etc/penguins-eggs.d");

    await ensureDir(realDest);

    // Copiamo la configurazione generata da DAD
    const filesToCopy = ["eggs.yaml", "krill.yaml"];
    for (const file of filesToCopy) {
        const source = path.join(Constants.CONFIG_DIR, file);
        const dest = path.join(realDest, file);
        
        if (await exists(source)) {
            await Deno.copyFile(source, dest);
            // console.log(`   Copied: ${file}`);
        }
    }
    
    // Copiamo l'eseguibile di eggs stesso? 
    // Per ora assumiamo che eggs sia installato nel sistema, 
    // ma in futuro potremmo dover copiare l'eseguibile Deno compilato.
  }

  /**
   * Prepara Calamares
   */
  private async setupCalamares(destRoot: string) {
    console.log("-> Setup Calamares (GUI Installer)...");

    // Percorsi Host
    const calamaresEtc = "/etc/calamares";
    const calamaresShare = "/usr/share/calamares";
    
    // Percorsi Destinazione Live
    const destEtc = path.join(destRoot, "etc/calamares");
    
    // Se abbiamo una configurazione custom in /etc/calamares, la usiamo
    if (await exists(calamaresEtc)) {
        console.log("   Cloning host configuration...");
        // Rimuoviamo la dest se esiste (per pulizia)
        if (await exists(destEtc)) {
            await Deno.remove(destEtc, { recursive: true });
        }
        
        // Copia ricorsiva
        // Nota: Deno.copy (std/fs) è deprecato in favore di copyDir o simili a seconda della versione std
        // Usiamo il comando cp per robustezza sui permessi
        await Utils.run("cp", ["-r", calamaresEtc, destEtc]);
        
        // Fix permessi specifici per Calamares (se servono)
        // Solitamente deve essere leggibile da root
    } else {
        console.warn("⚠️  Nessuna configurazione Calamares trovata in /etc/calamares.");
    }

    // Qui potremmo iniettare modules/welcome.conf personalizzato con il nome della distro
    // O configurare autologin sddm/lightdm (gestito di solito da PreFlight, ma a volte qui)
  }

  private async hasCalamares(): Promise<boolean> {
    const check = await Utils.run("which", ["calamares"]);
    return check.success;
  }
}
