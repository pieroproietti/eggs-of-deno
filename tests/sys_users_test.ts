// tests/sys_users_test.ts
import { assertEquals, assert } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { ensureDir, exists } from "https://deno.land/std@0.210.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.210.0/path/mod.ts";
import { SysUsers, IPasswdEntry } from "../src/classes/sys-users.ts";

const TEST_DIR = "/tmp/eggs-sysusers-test";

async function setupEnv() {
  if (await exists(TEST_DIR)) {
    await Deno.remove(TEST_DIR, { recursive: true });
  }
  await ensureDir(path.join(TEST_DIR, "etc"));

  // Create initial dummy files
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/passwd"), "root:x:0:0:root:/root:/bin/bash\n");
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/shadow"), "root:!:19700:0:99999:7:::\n");
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/group"), "root:x:0:\nwheel:x:10:root\n");
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/gshadow"), "");
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/subuid"), "");
  await Deno.writeTextFile(path.join(TEST_DIR, "etc/subgid"), "");
}

Deno.test("SysUsers: Add User", async () => {
    await setupEnv();
    
    // Test
    const sys = new SysUsers(TEST_DIR, "debian");
    await sys.load();
    
    const newUser: IPasswdEntry = {
        username: "testuser",
        password: "x",
        uid: "1000",
        gid: "1000",
        gecos: "Test User",
        home: "/home/testuser",
        shell: "/bin/bash"
    };

    sys.addUser(newUser, "mypassword");
    await sys.save();

    // Verify Passwd
    const passwdContent = await Deno.readTextFile(path.join(TEST_DIR, "etc/passwd"));
    assert(passwdContent.includes("testuser:x:1000:1000:Test User:/home/testuser:/bin/bash"));

    // Verify Shadow (Should have hash)
    const shadowContent = await Deno.readTextFile(path.join(TEST_DIR, "etc/shadow"));
    assert(shadowContent.includes("testuser:$2a$")); // Bcrypt prefix

    // Verify Group (Should have primary group)
    const groupContent = await Deno.readTextFile(path.join(TEST_DIR, "etc/group"));
    assert(groupContent.includes("testuser:x:1000:"));
});

Deno.test("SysUsers: Add User to Group", async () => {
    await setupEnv();
    
    const sys = new SysUsers(TEST_DIR, "debian");
    await sys.load();
    
    // Add dummy user manually to memory for group test
    sys.addUserToGroup("root", "wheel");
    await sys.save();

    const groupContent = await Deno.readTextFile(path.join(TEST_DIR, "etc/group"));
    assert(groupContent.includes("wheel:x:10:root")); // Should just be root
    
    // Add another
    sys.addUserToGroup("newguy", "wheel");
    await sys.save();
    
    const groupContent2 = await Deno.readTextFile(path.join(TEST_DIR, "etc/group"));
    assert(groupContent2.includes("wheel:x:10:root,newguy"));
});

Deno.test("SysUsers: Remove User", async () => {
    await setupEnv();
    const sys = new SysUsers(TEST_DIR, "debian");
    await sys.load();
    
    const newUser: IPasswdEntry = {
        username: "toremove",
        password: "x",
        uid: "1001",
        gid: "1001",
        gecos: "Remove Me",
        home: "/home/toremove",
        shell: "/bin/false"
    };
    sys.addUser(newUser, "pass");
    await sys.save();

    let passwd = await Deno.readTextFile(path.join(TEST_DIR, "etc/passwd"));
    assert(passwd.includes("toremove"));

    sys.removeUser("toremove");
    await sys.save();

    passwd = await Deno.readTextFile(path.join(TEST_DIR, "etc/passwd"));
    assert(!passwd.includes("toremove"));
});
