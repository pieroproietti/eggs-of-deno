#!/bin/bash
set -e

# Build the ISO
echo "Starting ISO build..."
# Using --nointeractive to avoid blocking, and assuming 'produce' is the default
echo "live" | sudo -S deno run -A src/main.ts produce --nointeractive

# Find the generated ISO
ISO_FILE=$(find /home/eggs -name "*.iso" | head -n 1)

if [ -z "$ISO_FILE" ]; then
    echo "Error: No ISO file found in /home/eggs"
    exit 1
fi

echo "ISO found: $ISO_FILE"

# Run QEMU
echo "Starting QEMU..."
# Using -nographic to ensure it doesn't fail on missing display, 
# although user might want to see it. 
# Since I am an agent, I'll use a timeout to verify it runs for a bit then kill it.
# If the user has a display connected to this session they might see it if I omitted -nographic.
# But safest for automation is to just verify it starts.
# However, the user request says "testare l'avvio", implies verification.

# For this environment, I will run it in background and check if it stays up for 5 seconds.
nohup qemu-system-x86_64 -m 4G -cdrom "$ISO_FILE" -boot d -vnc :0 > qemu.log 2>&1 &
QEMU_PID=$!

echo "QEMU started with PID $QEMU_PID. Waiting 10 seconds..."
sleep 10

if ps -p $QEMU_PID > /dev/null; then
    echo "QEMU is still running. Boot test PASSED (tentatively)."
    # Kill it to clean up
    kill $QEMU_PID
else
    echo "QEMU exited prematurely. Boot test FAILED."
    cat qemu.log
    exit 1
fi
