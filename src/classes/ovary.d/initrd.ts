/**
 * ./src/classes/ovary.d/initrd.ts
 * penguins-eggs (Deno Port)
 * author: Piero Proietti
 * email: piero.proietti@gmail.com
 * license: MIT
 */

// Imports standard Deno
import * as path from "jsr:@std/path";
import { exists, copy } from "jsr:@std/fs";

// Internal Imports (adattare i percorsi in base alla tua struttura Deno)
import { Utils } from "../utils.ts"; 
import { Diversions } from "../diversions.ts";
// import { Ovary } from "../ovary.ts"; // Importa la classe o l'interfaccia

// Helper per __dirname in Deno
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

// Interfaccia minima per 'this' (Ovary)
// Assicura che TypeScript sappia cosa aspettarsi da 'this'
interface Ovary {
  settings: {
    config: { snapshot_prefix: string };
    iso_work: string;
    iso_source: string; // Necessario per il chroot Debian
  };
  initrd: string;
  kernel: string;
  distroId: string;
  echo: boolean;
}

/**
 * Helper per eseguire comandi shell (sostituisce exec di Node)
 * Necessario per gestire redirezioni come "> file.log 2>&1"
 */
async function sh(cmd: string, verbose = false) {
  if (verbose) console.log(`$ ${cmd}`);
  const command = new Deno.Command("sh", {
    args: ["-c", cmd],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  
  if (code !== 0) {
    const errStr = new TextDecoder().decode(stderr);
    // Non blocchiamo tutto, ma lanciamo errore gestibile
    throw new Error(`Command failed: ${cmd}\n${errStr}`);
  }
  return new TextDecoder().decode(stdout);
}

/**
 * initrdAlpine
 */
export async function initrdAlpine(this: Ovary) {
  Utils.warning(`creating ${path.basename(this.initrd)} Alpine on (ISO)/live`);
  
  let initrdImg = Utils.initrdImg();
  // slice logic: mantiene solo il nome file se c'è un path
  initrdImg = path.basename(initrdImg);

  // Risoluzione path configurazione (risaliamo di 3 livelli come nell'originale)
  const pathConf = path.resolve(__dirname, "../../../mkinitfs/live.conf");
  const prefix = this.settings.config.snapshot_prefix;
  const log = `> ${this.settings.iso_work}${prefix}mkinitfs.log.txt 2>&1`;
  
  const cmd = `mkinitfs -c ${pathConf} -o ${this.settings.iso_work}live/${initrdImg} ${this.kernel} ${log}`;
  await sh(cmd, this.echo);
}

/**
 * initrdArch
 */
export async function initrdArch(this: Ovary) {
  Utils.warning(`creating ${path.basename(this.initrd)} using mkinitcpio on (ISO)/live`);

  let dirConf = 'arch';
  // let tool = 'archiso'; // Inutilizzato nel codice originale, lo lascio commentato
  let hookSrc = '/usr/lib/initcpio/hooks/archiso_pxe_http';
  let hookDest = '/etc/initcpio/hooks/archiso_pxe_http';
  // Nota: usiamo sed via shell perché è più rapido che reimplementarlo in TS
  let edit = `sed -i 's/export copytoram="y"/# export copytoram="y"/' ${hookDest}`;

  if (Diversions.isManjaroBased(this.distroId)) {
    dirConf = 'manjaro';
    // tool = 'miso';
    hookSrc = `/etc/initcpio/hooks/miso_pxe_http`;
    hookDest = hookSrc;
    edit = `sed -i 's/copytoram="y"/# copytoram="y"/' ${hookDest}`;

    if (this.distroId === "Biglinux" || this.distroId === "Bigcommunity") {
      dirConf = 'biglinux';
    }
  }

  const restore = await exists(hookDest);
  const pathConf = path.resolve(__dirname, `../../../mkinitcpio/${dirConf}`);
  const fileConf = path.join(pathConf, 'live.conf');
  
  const hookSaved = `/tmp/${path.basename(hookSrc)}`;

  // Backup e modifiche hook
  if (hookSrc !== hookDest) {
    await sh(`cp ${hookSrc} ${hookDest}`);
  }
  await sh(`cp ${hookSrc} ${hookSaved}`);
  await sh(edit, this.echo);

  // Esecuzione mkinitcpio
  const prefix = this.settings.config.snapshot_prefix;
  const log = `> ${this.settings.iso_work}${prefix}mkinitcpio.log.txt 2>&1`;
  
  // Nota: mkinitcpio -g genera l'immagine
  const cmd = `mkinitcpio -c ${fileConf} -g ${this.settings.iso_work}live/${path.basename(this.initrd)} -k ${this.kernel} ${log}`;
  
  try {
    await sh(cmd, this.echo);
  } finally {
    // Cleanup (in finally block per sicurezza)
    await sh(`rm -f ${hookDest}`);
    if (restore) {
      await sh(`cp ${hookSaved} ${hookDest}`);
    }
    await sh(`rm -f ${hookSaved}`);
  }
}

/**
 * initrdDebian
 * MODIFICATO PER DENO & FIX CHROOT:
 * Esegue mkinitramfs dentro il chroot per garantire che live-boot e overlay 
 * vengano caricati correttamente.
 */
export async function initrdDebian(this: Ovary, verbose = false) {
  Utils.warning(`creating ${this.initrd} using mkinitramfs inside CHROOT`);

  const prefix = this.settings.config.snapshot_prefix;
  
  // 1. Percorsi
  const chrootPath = this.settings.iso_source; 
  
  // Salviamo l'initrd temporaneamente dentro /tmp del chroot
  const internalDest = `/tmp/${path.basename(this.initrd)}`;
  const tempFileOnHost = path.join(chrootPath, internalDest);
  
  // Destinazione finale nell'ISO
  const destFinal = path.join(this.settings.iso_work, "live", path.basename(this.initrd));
  
  // Log file
  const logFile = path.join(this.settings.iso_work, `${prefix}mkinitramfs.log.txt`);

  // 2. Comando CHROOT
  // Assumiamo che /proc, /sys e /dev siano già montati nel chroot dal chiamante (Ovary)
  const cmd = `chroot ${chrootPath} mkinitramfs -o ${internalDest} ${this.kernel} > ${logFile} 2>&1`;
  
  await sh(cmd, this.echo || verbose);

  // 3. Recupero del file
  if (await exists(tempFileOnHost)) {
    // Creiamo directory destinazione se non esiste
    await Deno.mkdir(path.dirname(destFinal), { recursive: true });
    
    // Spostiamo il file (rename è atomico e veloce)
    await Deno.rename(tempFileOnHost, destFinal);
    
    if (verbose) Utils.warning(`Initrd moved to ${destFinal}`);
  } else {
    Utils.error(`Error: Initrd not found at ${tempFileOnHost}. See log: ${logFile}`);
    throw new Error("Initrd generation failed inside chroot.");
  }
}

/**
 * initrdDracut
 * Almalinux/Fedora/Openmamba/Opensuse/Rocky
 */
export async function initrdDracut(this: Ovary) {
  Utils.warning(`creating ${path.basename(this.initrd)} using dracut on (ISO)/live`);
  
  const prefix = this.settings.config.snapshot_prefix;
  const destFinal = path.join(this.settings.iso_work, "live", path.basename(this.initrd));
  const log = `> ${this.settings.iso_work}${prefix}dracut.log.txt 2>&1`;
  
  const confdirPath = path.resolve(__dirname, `../../../dracut/dracut.conf.d`);
  const confdir = `--confdir ${confdirPath}`;
  const kmoddir = `--kmoddir /lib/modules/${this.kernel}`;
  
  // Aggiunto mkdir recursive per sicurezza
  await Deno.mkdir(path.dirname(destFinal), { recursive: true });

  const cmd = `dracut --force -v ${confdir} ${kmoddir} ${destFinal} ${this.kernel} ${log}`;
  await sh(cmd, this.echo);
}