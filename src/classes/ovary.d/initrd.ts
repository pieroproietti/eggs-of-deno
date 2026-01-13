/**
 * ./src/classes/ovary.d/initrd.ts
 * penguins-eggs (Deno Port)
 * author: Piero Proietti
 * email: piero.proietti@gmail.com
 * license: MIT
 */

import { path, exists } from "../../deps.ts";
import { Utils } from "../utils.ts"; 
import { Diversions } from "../diversions.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

export interface InitrdOptions {
  kernel: string;
  isoWork: string;
  isoSource: string; // Used for Debian chroot
  distroId: string;
  distribId: string; // Used for Manjaro checks
  snapshotPrefix: string;
  echo?: boolean;
}

/**
 * Helper to run shell commands
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
    throw new Error(`Command failed: ${cmd}\n${errStr}`);
  }
  return new TextDecoder().decode(stdout);
}

export class Initrd {

  /**
   * Main entry point to generate initrd based on distro family
   */
  static async generate(opts: InitrdOptions) {
    const family = opts.distroId.toLowerCase();
    
    // Simple detection based on commonly known IDs
    // Extend logic as needed for more specific detections
    if (family === "alpine") {
       await this.alpine(opts);
    } else if (["arch", "manjaro", "biglinux", "bigcommunity"].includes(family)) {
       await this.arch(opts);
    } else if (["debian", "ubuntu", "linuxmint", "pop", "kali", "devuan"].includes(family)) {
       await this.debian(opts);
    } else {
       // Fallback for RPM based or others usually supported by dracut
       // e.g. fedora, centos, rocky, almalinux, opensuse
       await this.dracut(opts);
    }
  }

  /**
   * initrdAlpine
   */
  private static async alpine(opts: InitrdOptions) {
    Utils.warning(`creating initramfs-lts (Alpine) on (ISO)/live`);
    
    // In Alpine typically named initramfs-lts or similar. 
    // We stick to standard naming "initrd.img" for uniformity in Ovary or keep Alpine style?
    // eggs-deno seems to use standard names. Let's use initrd.img as generic output.
    const loopName = "initrd.img"; 

    const pathConf = path.resolve(__dirname, "../../../mkinitfs/live.conf");
    const log = `> ${opts.isoWork}${opts.snapshotPrefix}mkinitfs.log.txt 2>&1`;
    
    // Ensure destination exists
    await Deno.mkdir(path.join(opts.isoWork, "live"), { recursive: true });

    const cmd = `mkinitfs -c ${pathConf} -o ${opts.isoWork}live/${loopName} ${opts.kernel} ${log}`;
    await sh(cmd, opts.echo);
  }

  /**
   * initrdArch
   */
  private static async arch(opts: InitrdOptions) {
    Utils.warning(`creating initrd.img (Arch) using mkinitcpio on (ISO)/live`);

    let dirConf = 'arch';
    let hookSrc = '/usr/lib/initcpio/hooks/archiso_pxe_http';
    let hookDest = '/etc/initcpio/hooks/archiso_pxe_http';
    let edit = `sed -i 's/export copytoram="y"/# export copytoram="y"/' ${hookDest}`;

    if (Diversions.isManjaroBased(opts.distribId)) {
      dirConf = 'manjaro';
      hookSrc = `/etc/initcpio/hooks/miso_pxe_http`;
      hookDest = hookSrc;
      edit = `sed -i 's/copytoram="y"/# copytoram="y"/' ${hookDest}`;

      if (opts.distribId === "Biglinux" || opts.distribId === "Bigcommunity") {
        dirConf = 'biglinux';
      }
    }

    const restore = await exists(hookDest);
    const pathConf = path.resolve(__dirname, `../../../mkinitcpio/${dirConf}`);
    const fileConf = path.join(pathConf, 'live.conf');
    
    const hookSaved = `/tmp/${path.basename(hookSrc)}`;

    // Backup & Edit hook
    if (hookSrc !== hookDest) {
      await sh(`cp ${hookSrc} ${hookDest}`);
    }
    await sh(`cp ${hookSrc} ${hookSaved}`);
    await sh(edit, opts.echo);

    const log = `> ${opts.isoWork}${opts.snapshotPrefix}mkinitcpio.log.txt 2>&1`;
    const dest = path.join(opts.isoWork, "live", "initrd.img");

    // Ensure destination exists
    await Deno.mkdir(path.dirname(dest), { recursive: true });

    // mkinitcpio -g generates the image
    const cmd = `mkinitcpio -c ${fileConf} -g ${dest} -k ${opts.kernel} ${log}`;
    
    try {
      await sh(cmd, opts.echo);
    } finally {
      // Cleanup
      await sh(`rm -f ${hookDest}`);
      if (restore) {
        await sh(`cp ${hookSaved} ${hookDest}`);
      }
      await sh(`rm -f ${hookSaved}`);
    }
  }

  /**
   * initrdDebian
   * Uses chroot to run mkinitramfs
   */
  private static async debian(opts: InitrdOptions) {
    Utils.warning(`creating initrd.img (Debian) inside CHROOT`);

    const chrootPath = opts.isoSource; 
    const internalDest = `/tmp/initrd.img`;
    const tempFileOnHost = path.join(chrootPath, internalDest);
    
    const destFinal = path.join(opts.isoWork, "live", "initrd.img");
    const logFile = path.join(opts.isoWork, `${opts.snapshotPrefix}mkinitramfs.log.txt`);

    // Ensure destination exists
    await Deno.mkdir(path.dirname(destFinal), { recursive: true });

    // const cmd = `chroot ${chrootPath} mkinitramfs -o ${internalDest} ${opts.kernel} > ${logFile} 2>&1`;
    const cmd = `mkinitramfs -o ${destFinal} ${opts.kernel}`;
    
    await sh(cmd, opts.echo);

    if (await exists(destFinal)) {
      console.log(`Initrd created at ${destFinal}`);
    } else {
      Utils.error(`Error: Initrd not found at ${tempFileOnHost}. See log: ${logFile}`);
      throw new Error("Initrd generation failed inside chroot.");
    }
  }

  /**
   * initrdDracut
   * RedHat/Fedora/OpenSuse families
   */
  private static async dracut(opts: InitrdOptions) {
    Utils.warning(`creating initrd.img (Dracut) on (ISO)/live`);
    
    const destFinal = path.join(opts.isoWork, "live", "initrd.img");
    const log = `> ${opts.isoWork}${opts.snapshotPrefix}dracut.log.txt 2>&1`;
    
    const confdirPath = path.resolve(__dirname, `../../../dracut/dracut.conf.d`);
    const confdir = `--confdir ${confdirPath}`;
    const kmoddir = `--kmoddir /lib/modules/${opts.kernel}`;
    
    await Deno.mkdir(path.dirname(destFinal), { recursive: true });

    const cmd = `dracut --force -v ${confdir} ${kmoddir} ${destFinal} ${opts.kernel} ${log}`;
    await sh(cmd, opts.echo);
  }
}