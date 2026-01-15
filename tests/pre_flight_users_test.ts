// tests/pre_flight_users_test.ts
import { assertEquals, assert } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { ensureDir, exists } from "https://deno.land/std@0.210.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.210.0/path/mod.ts";
import { PreFlight } from "../src/classes/ovary.d/pre-flight.ts";
import { IEggsConfig } from "../src/classes/settings.ts";
import { IDistroInfo } from "../src/classes/distro.ts";

const TEST_DIR = "/tmp/eggs-preflight-test";

async function setupEnv() {
  if (await exists(TEST_DIR)) {
    await Deno.remove(TEST_DIR, { recursive: true });
  }
  const etc = path.join(TEST_DIR, "etc");
  await ensureDir(etc);

  // Dummy files
  await Deno.writeTextFile(path.join(etc, "passwd"), 
    "root:x:0:0:root:/root:/bin/bash\n" +
    "standard:x:1000:1000:Standard User:/home/standard:/bin/bash\n" +
    "other:x:1001:1001:Other User:/home/other:/bin/bash\n"
  );
  await Deno.writeTextFile(path.join(etc, "shadow"), 
    "root:!:19700:0:99999:7:::\n" +
    "standard:$6$hash:19700:0:99999:7:::\n" +
    "other:$6$hash:19700:0:99999:7:::\n"
  );
  
  await ensureDir(path.join(etc, "skel"));
  await Deno.writeTextFile(path.join(etc, "skel", ".testrc"), "alias ll='ls -l'\n");

  await Deno.writeTextFile(path.join(etc, "group"), 
    "root:x:0:\n" +
    "sudo:x:27:\n" +
    "wheel:x:10:root\n" +
    "standard:x:1000:\n" +
    "other:x:1001:\n"
  );
  await Deno.writeTextFile(path.join(etc, "gshadow"), "");
  await Deno.writeTextFile(path.join(etc, "subuid"), "");
  await Deno.writeTextFile(path.join(etc, "subgid"), "");
}

Deno.test("PreFlight: cleanUsers (Debian-like)", async () => {
    await setupEnv();

    const mockConfig: IEggsConfig = {} as any;
    const mockDistro: IDistroInfo = {
        familyId: "debian",
        id: "debian",
        distribId: "Debian",
        codename: "bookworm",
        releaseId: "12"
    } as any;

    const preflight = new PreFlight(mockConfig, mockDistro);
    
    // Access private method for testing
    // deno-lint-ignore no-explicit-any
    await (preflight as any).cleanUsers(TEST_DIR);

    const passwd = await Deno.readTextFile(path.join(TEST_DIR, "etc/passwd"));
    const group = await Deno.readTextFile(path.join(TEST_DIR, "etc/group"));
    const shadow = await Deno.readTextFile(path.join(TEST_DIR, "etc/shadow"));

    // 1. Should have removed users >= 1000 (standard, other)
    assert(!passwd.includes("standard:x:1000"), "User 'standard' should be removed");
    assert(!passwd.includes("other:x:1001"), "User 'other' should be removed");

    // 2. Should have added 'live' user (1000)
    assert(passwd.includes("live:x:1000:1000:Live User"), "User 'live' should be added");
    
    // 3. Should be in 'sudo' group (Debian)
    assert(group.includes("sudo:x:27:live"), "User 'live' should be in sudo");

    // 4. Shadow should contain hash (we set it to 'evolution')
    // We check if an entry exists
    assert(shadow.includes("live:$2a$"), "User 'live' should have a bcrypt hash");

    // 5. Verify Home Creation
    // Check if /home/live exists
    assert(await exists(path.join(TEST_DIR, "home/live")), "Home directory should exist");
    // Check if .testrc (from mocked skel) exists
    assert(await exists(path.join(TEST_DIR, "home/live/.testrc")), "Skel files should be copied");
});

Deno.test("PreFlight: cleanUsers (Arch-like)", async () => {
    await setupEnv();

    const mockConfig: IEggsConfig = {} as any;
    const mockDistro: IDistroInfo = {
        familyId: "arch",
        id: "archlinux",
        distribId: "Arch",
        codename: "rolling",
        releaseId: "curr"
    } as any;

    const preflight = new PreFlight(mockConfig, mockDistro);
    
    // deno-lint-ignore no-explicit-any
    await (preflight as any).cleanUsers(TEST_DIR);

    const group = await Deno.readTextFile(path.join(TEST_DIR, "etc/group"));

    // Should be in 'wheel' group (Arch)
    assert(group.includes("wheel:x:10:root,live"), "User 'live' should be in wheel");
    assert(!group.includes("sudo:x:27:live"), "User 'live' should NOT be in sudo (if logic is correct)");
});
