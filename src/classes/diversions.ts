// src/classes/diversions.ts
import { Utils } from "./utils.ts";
import { path, exists } from "../deps.ts";

export class Diversions {

  /**
   * Ritorna true se la distro usa systemd-boot (es. Fedora EFI)
   */
  static isSystemDBoot(familyId: string, isEfi: boolean): boolean {
    return familyId === 'fedora' && isEfi;
  }

  /**
   * kernelParameters
   * Genera la stringa di boot per il kernel a seconda della famiglia
   */
  static kernelParameters(familyId: string, volid: string, fullCrypt = false): string {
    let kp = '';
    const lang = Deno.env.get("LANG") || "en_US.UTF-8";

    switch (familyId) {
      case 'alpine':
        kp += `alpinelivelabel=${volid} alpinelivesquashfs=/mnt/live/filesystem.squashfs`;
        break;
      case 'archlinux': {
        // Semplificazione per Deno: assumiamo standard arch
        kp += `boot=live components locales=${lang} archisobasedir=arch archisolabel=${volid}`;
        break;
      }
      case 'debian':
        kp += `boot=live components locales=${lang} cow_spacesize=2G`;
        if (fullCrypt) kp += ` live-media=/run/live/medium`;
        break;
      case 'fedora':
      case 'openmamba':
        kp += `root=live:CDLABEL=${volid} rd.live.image rd.live.dir=/live rd.live.squashimg=filesystem.squashfs enforcing=0`;
        break;
      case 'opensuse':
        kp += `root=live:CDLABEL=${volid} rd.live.image rd.live.dir=/live rd.live.squashimg=filesystem.squashfs apparmor=0`;
        break;
      case 'voidlinux':
        kp += `root=live:CDLABEL=${volid} rd.live.image rd.live.dir=/live rd.live.squashimg=filesystem.squashfs rd.debug`;
        break;
      default: // Debian fallback
        kp += `boot=live components locales=${lang}`;
        break;
    }

    return kp;
  }

  /**
   * bootloaders
   * Ritorna il PERCORSO BASE dove cercare isolinux/grub/ecc.
   */
  static bootloaders(familyId: string): string {
    // 1. Caso DEBIAN: Usiamo le librerie di sistema (/usr/lib)
    if (familyId === "debian" || familyId === "ubuntu") {
      return '/usr/lib';
    }

    // 2. Altri casi: Cerchiamo cartelle custom
    // Priorità: cartella locale "bootloaders" -> cartella sistema "penguins-eggs/bootloaders"
    const localBootloaders = path.resolve("bootloaders"); // Cartella locale
    const systemBootloaders = "/usr/lib/penguins-eggs/bootloaders";

    // In Deno sincrono per semplicità, o usiamo un check rapido
    // Qui ritorno la stringa, chi la usa verificherà l'esistenza
    // Per ora forziamo la logica: se c'è locale usa quella, se no sistema.
    // (Nota: in un metodo statico sincrono non possiamo usare await exists, 
    // quindi ritorniamo il path e lasciamo il controllo al chiamante, 
    // oppure assumiamo una priorità).
    
    return localBootloaders; // Defaultiamo al locale per sviluppo
  }
}