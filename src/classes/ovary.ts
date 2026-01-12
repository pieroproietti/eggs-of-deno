// src/classes/ovary.ts
import { Settings, IEggsConfig } from "./settings.ts";
import { Utils } from "./utils.ts";
import { Distro } from "./distro.ts";
import { Incubator } from "./incubator.ts";
import { Constants } from "./constants.ts";

// I Worker specializzati
import { FileSystem } from "./ovary.d/filesystem.ts";
import { PreFlight } from "./ovary.d/pre-flight.ts";
import { Squash } from "./ovary.d/squash.ts";
import { Iso } from "./ovary.d/iso.ts";

export interface IProduceOptions {
  clone?: boolean;
  homecrypt?: boolean;
  fullcrypt?: boolean;
  fast?: boolean;
  max?: boolean;
  verbose?: boolean;
  scriptOnly?: boolean;
  includeRootHome?: boolean;
}

export class Ovary {
  private config: IEggsConfig;
  private distro: any; 

  constructor(config: IEggsConfig) {
    this.config = config;
  }

  /**
   * Produce: Il ciclo di vita dell'uovo
   */
  async produce(options: IProduceOptions = {}) {
    Utils.title("🥚 Ovary: Production Cycle Started");

    // 1. Identità
    this.distro = await Distro.getInfo();
    console.log(`🐧 Distro: ${this.distro.distribId} (${this.distro.codename})`);

    // 2. FileSystem (Overlay / Bind)
    const fsLayer = new FileSystem(this.config, this.distro);
    await fsLayer.bind(options);

    // 3. Pre-Flight (Kernel, Initrd, Users)
    // Nota: PreFlight lavora dentro il mountpoint creato da fsLayer
    const flight = new PreFlight(this.config, this.distro);
    await flight.prepare(options); 

    // 4. Incubator (Configurazione Calamares/Krill)
    const incubator = new Incubator(this.distro);
    const calamaresPath = `${Constants.NEST}/.mnt/${Constants.CALAMARES_DIR}`;
    await incubator.configure(calamaresPath);

    // 5. SquashFS (Compressione)
    const squash = new Squash(this.config, this.distro);
    await squash.compress(options);

    // 6. ISO (Creazione Immagine)
    const iso = new Iso(this.config, this.distro);
    await iso.build(options);

    // 7. Cleanup (Unbind)
    // await fsLayer.unbind(); // Decommentare in produzione

    Utils.title("✅ Uovo Deposto con Successo!");
  }
}