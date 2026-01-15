sudo rm /home/eggs -rf
sudo deno run -A src/main.ts produce
scp /home/eggs/mnt/egg-of*.iso root@192.168.1.2:/var/lib/vz/template/iso

