
import { Initrd } from "../src/classes/ovary.d/initrd.ts";
import { Utils } from "../src/classes/utils.ts";

// Mock Utils.run to avoid actual execution but log commands
Utils.run = async (cmd: string, args: string[] = [], stream = false) => {
    console.log(`[MOCK RUN]: ${cmd} ${args.join(" ")}`);
    return { success: true, code: 0, out: "6.6.6-generico", err: "" };
};

// Mock Deno.Command for the 'sh' helper in initrd.ts
// We need to monkeytype the 'sh' function or mock Deno.Command global if possible.
// Since 'sh' is internal to initrd.ts and uses Deno.Command, we mock Deno.Command.

const originalCommand = Deno.Command;
// @ts-ignore: Mocking global
Deno.Command = class MockCommand {
    constructor(cmd: string, options: any) {
        console.log(`[MOCK COMMAND]: ${cmd} ${JSON.stringify(options.args)}`);
    }
    spawn() { return { status: Promise.resolve({ success: true, code: 0 }) }; }
    output() { 
        return Promise.resolve({ 
            success: true, 
            code: 0, 
            stdout: new TextEncoder().encode("mock output"), 
            stderr: new TextEncoder().encode("") 
        }); 
    }
};

async function testAlpine() {
    console.log("--- Testing Alpine ---");
    await Initrd.generate({
        kernel: "6.1.0-alpine",
        isoWork: "/tmp/iso/",
        isoSource: "/tmp/source",
        distroId: "alpine",
        distribId: "Alpine Linux",
        snapshotPrefix: "egg-",
        echo: true
    });
}

async function testArch() {
    console.log("\n--- Testing Arch ---");
    await Initrd.generate({
        kernel: "6.1.0-arch",
        isoWork: "/tmp/iso/",
        isoSource: "/tmp/source",
        distroId: "arch",
        distribId: "Arch Linux",
        snapshotPrefix: "egg-",
        echo: true
    });
}

async function testDebian() {
    console.log("\n--- Testing Debian ---");
    // Needs Deno.mkdir and Deno.rename mocks effectively or they will fail if paths don't exist
    // simplified for check
    try {
        await Initrd.generate({
            kernel: "6.1.0-debian",
            isoWork: "/tmp/iso/",
            isoSource: "/tmp/source",
            distroId: "debian",
            distribId: "Debian GNU/Linux",
            snapshotPrefix: "egg-",
            echo: true
        });
    } catch (e) {
        console.log("Expected failure due to fs ops (ignore if command logged): " + e.message);
    }
}

async function runTests() {
    await testAlpine();
    await testArch();
    await testDebian();
}

runTests();
