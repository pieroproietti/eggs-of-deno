// src/classes/pacman.ts
import { Utils } from "./utils.ts";
import { IDistroInfo } from "./distro.ts";

// INTERFACCIA: Il contratto che tutti devono rispettare
export interface IPacman {
  update(): Promise<void>;
  install(packages: string[]): Promise<void>;
  clean(): Promise<void>;
  id: string; // "apt", "dnf", "pacman", etc.
}

// --- IMPLEMENTAZIONI SPECIFICHE ---

// 1. APT (Debian, Ubuntu, Devuan...)
class AptPacman implements IPacman {
  id = "apt";

  async update() {
    console.log("Running: apt-get update");
    await Utils.run("apt-get", ["update"]);
  }

  async install(packages: string[]) {
    console.log(`Running: apt-get install ${packages.join(" ")}`);
    // -y per non chiedere conferma
    await Utils.run("apt-get", ["install", "-y", ...packages]);
  }

  async clean() {
    await Utils.run("apt-get", ["clean"]);
  }
}

// 2. PACMAN (Arch, Manjaro...)
class ArchPacman implements IPacman {
  id = "pacman";

  async update() {
    console.log("Running: pacman -Sy");
    await Utils.run("pacman", ["-Sy"]);
  }

  async install(packages: string[]) {
    console.log(`Running: pacman -S ${packages.join(" ")}`);
    await Utils.run("pacman", ["-S", "--noconfirm", ...packages]);
  }

  async clean() {
    await Utils.run("pacman", ["-Scc", "--noconfirm"]);
  }
}

// 3. DNF (Fedora, AlmaLinux...)
class DnfPacman implements IPacman {
  id = "dnf";

  async update() {
     await Utils.run("dnf", ["check-update"]);
  }

  async install(packages: string[]) {
    await Utils.run("dnf", ["install", "-y", ...packages]);
  }

  async clean() {
    await Utils.run("dnf", ["clean", "all"]);
  }
}

// --- LA FABBRICA ---
// Qui avviene la magia della selezione
export class PacmanFactory {
  static get(distro: IDistroInfo): IPacman {
    const id = distro.id.toLowerCase();
    const like = (distro.distribId || "").toLowerCase();

    // Logica di assegnazione
    if (id === "debian" || id === "ubuntu" || id === "linuxmint" || like.includes("debian")) {
      return new AptPacman();
    }
    
    if (id === "arch" || id === "manjaro" || like.includes("arch")) {
      return new ArchPacman();
    }

    if (id === "fedora" || id === "almalinux" || id === "rocky") {
      return new DnfPacman();
    }

    // Default o errore
    console.warn(`Package manager non riconosciuto per ${id}. Uso APT come fallback.`);
    return new AptPacman();
  }
}