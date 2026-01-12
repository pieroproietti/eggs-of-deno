// src/commands/check.ts
import { Command, Table } from "../deps.ts";
import { Utils } from "../classes/utils.ts";
import { Distro } from "../classes/distro.ts";

export const checkCommand = new Command()
  .name("check")
  .description("Check system requirements and dependencies")
  .action(async () => {
    Utils.title("🥚 Eggs System Check");

    // 1. Check Distro
    const distro = await Distro.getInfo();
    console.log(`🐧 OS: \x1b[36m${distro.distribId} (${distro.codename})\x1b[0m`);
    console.log(`   Release: ${distro.releaseId}`);
    console.log(`   Arch: ${Deno.build.arch}`);

    // 2. Check Privilegi
    const uidRes = await Utils.run("id", ["-u"]);
    const isRoot = uidRes.out.trim() === "0";
    
    const rootStatus = isRoot ? "✅ ROOT (God Mode)" : "❌ USER (limitato)";
    console.log(`\n🔑 Privileges: ${rootStatus}`);
    
    // 3. Check Tools Esterni
    const tools = [
      "xorriso",
      "mksquashfs",
      "unsquashfs",
      "rsync",
      "calamares", 
      "cryptsetup", 
      "parted",
      "sfdisk"
    ];

    const rows: string[][] = [];

    console.log("\n🛠️  External Tools Check:");
    
    for (const tool of tools) {
      const check = await Utils.run("which", [tool]);
      const status = check.success ? "✅ Found" : "❌ MISSING";
      const path = check.success ? check.out : "---";
      // Coloriamo di rosso se manca
      const rowColor = check.success ? tool : `\x1b[31m${tool}\x1b[0m`;
      rows.push([rowColor, status, path]);
    }

    new Table()
      .header(["Tool", "Status", "Path"])
      .body(rows)
      .border(true)
      .render();

    console.log("\n");
    if (!isRoot) {
        console.warn("⚠️  ATTENZIONE: Senza privilegi di root, molti comandi di eggs falliranno.");
    }
  });
  