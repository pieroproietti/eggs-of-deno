// src/classes/ovary.d/pre-flight.ts
import { IEggsConfig } from "../settings.ts";
import { Constants } from "../constants.ts";
import { Utils } from "../utils.ts";
import { IDistroInfo } from "../distro.ts";
import { path, ensureDir, exists, copyDir } from "../../deps.ts";
import { SysUsers, IPasswdEntry } from "../sys-users.ts";

export class PreFlight {
  private config: IEggsConfig;
  private distro: IDistroInfo;

  constructor(config: IEggsConfig, distro: IDistroInfo) {
    this.config = config;
    this.distro = distro;
  }

  /**
   * Prepara le cartelle e copia i file di avvio (kernel/initrd)
   */
  async prepare(options: any) {
    Utils.title("🛫 Pre-Flight Checks");

    // 1. Crea directory di lavoro
    const workDir = path.join(Constants.NEST, "chroot");
    const isoDir = path.join(Constants.NEST, "iso");
    
    await ensureDir(workDir);
    await ensureDir(isoDir);

    // 2. Trova e Copia Kernel
    await this.handleKernel(isoDir);

    // 3. Gestione Utenti (se non è clone)
    if (!options.clone) {
        await this.cleanUsers(workDir);
    }
  }

  private async handleKernel(isoDest: string) {
    console.log("-> Searching for Kernel...");
    
    // --- MODIFICA: Destinazione è iso/live ---
    const liveDest = path.join(isoDest, "live");
    await ensureDir(liveDest); 
    // ----------------------------------------

    try {
        const uname = (await Utils.run("uname", ["-r"])).out.trim();
        
        // Percorsi Sorgente (Host)
        const vmlinuzSrc = `/boot/vmlinuz-${uname}`;

        // Percorsi Destinazione (ISO/live)
        const destKernel = path.join(liveDest, "vmlinuz");

        // Copia Vmlinuz
        if (await exists(vmlinuzSrc)) {
            console.log(`   Copying ${vmlinuzSrc} -> ${destKernel}`);
            await Deno.copyFile(vmlinuzSrc, destKernel);
        } else {
            console.warn(`⚠️ Kernel not found at ${vmlinuzSrc}`);
        }
        
        // Initrd is generated separately
        console.log("   ℹ️  Skipping host initrd copy (will be generated)");
        
    } catch (e) {
        console.error("❌ Kernel copy failed:", e);
    }
  }

  private async cleanUsers(mountPoint: string) {
    console.log("-> Cleaning users (Redistribution Mode)...");
    
    const familyId = this.distro.familyId || this.distro.id || "debian";
    const sysUsers = new SysUsers(mountPoint, familyId);
    await sysUsers.load();

    // 2. Remove Users >= 1000
    // Get list first to avoid concurrent modification issues if any
    const usersToRemove = sysUsers.getUsers()
        .filter(u => parseInt(u.uid) >= 1000 && u.username !== "nobody") // Keep nobody usually
        .map(u => u.username);
    
    for (const user of usersToRemove) {
        console.log(`   - Removing user: ${user}`);
        sysUsers.removeUser(user);
    }

    // 3. Detect Shell
    let shell = "/bin/bash";
    const bashPath = path.join(mountPoint, "bin/bash");
    const ashPath = path.join(mountPoint, "bin/ash");
    const shPath = path.join(mountPoint, "bin/sh");

    if (await exists(bashPath)) {
        shell = "/bin/bash";
    } else if (await exists(ashPath)) {
        shell = "/bin/ash";
    } else if (await exists(shPath)) {
        shell = "/bin/sh";
    }

    // 4. Add Live User
    const liveUser: IPasswdEntry = {
        username: "live",
        password: "x",
        uid: "1000",
        gid: "1000",
        gecos: "Live User",
        home: "/home/live",
        shell: shell
    };

    console.log(`   + Adding user: ${liveUser.username} (shell: ${shell})`);
    sysUsers.addUser(liveUser, "evolution"); // Password: evolution

    // 5. Add to Groups
    // Admin group
    let adminGroup = "sudo";
    if (["arch", "fedora", "manjaro", "almalinux", "rocky", "opensuse"].includes(familyId)) {
        adminGroup = "wheel";
    }
    sysUsers.addUserToGroup("live", adminGroup);
    
    // Standard groups
    const groups = ["video", "audio", "input", "network", "storage", "lp", "users"];
    for (const g of groups) {
        sysUsers.addUserToGroup("live", g);
    }

    // 6. Set Root Password
    console.log("   + Setting root password to 'evolution'");
    sysUsers.setPassword("root", "evolution");

    // 7. Create Home Directory
    const homeDir = path.join(mountPoint, "home/live");
    const skelDir = path.join(mountPoint, "etc/skel");

    // Cleanup previous if exists
    if (await exists(homeDir)) {
        await Deno.remove(homeDir, { recursive: true });
    }
    
    await ensureDir(homeDir);

    if (await exists(skelDir)) {
         // Recursive copy of skel
         await copyDir(skelDir, homeDir, { overwrite: true });
    }

    // Fix Owner (1000:1000)
    // We use "chown -R 1000:1000 <path>"
    console.log(`   + creating home: ${homeDir}`);
    
    // Only run expensive chowns if directory exists
    if (await exists(homeDir)) {
        await Utils.run("chown", ["-R", "1000:1000", homeDir], false);
        await Utils.run("chmod", ["-R", "755", homeDir], false); // 755 is safe for live
    }

    // 8. Save configuration
    await sysUsers.save();
    console.log("   ✅ User configuration updated.");
  }
}
