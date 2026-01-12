// src/commands/mom.ts
import { Command, Select, Table } from "../deps.ts";
import { Utils } from "../classes/utils.ts";

export const momCommand = new Command()
  .description("Mom: The Assistant (Help & Documentation)")
  .action(async () => {
    Utils.title("Eggs Mom - Your Friendly Assistant");

    // Menu interattivo
    const choice = await Select.prompt({
      message: "Cosa vuoi sapere, tesoro?",
      options: [
        { name: "Cos'è Dad?", value: "dad" },
        { name: "Come funziona Produce?", value: "produce" },
        { name: "Info su Eggs", value: "info" },
        Select.separator("---------"),
        { name: "Esci", value: "exit" },
      ],
    });

    console.log(""); // Spazio vuoto

    switch (choice) {
      case "dad":
        console.log("👔 **DAD (Il Papà)**");
        console.log("Si occupa della configurazione e della pulizia.");
        console.log("Usa: eggs dad --reset (per ricominciare da zero)");
        break;
      
      case "produce":
        console.log("🏗️ **PRODUCE (Il Produttore)**");
        console.log("È il comando che crea fisicamente la ISO.");
        console.log("Usa: eggs produce --fast (per una compressione veloce)");
        console.log("Usa: eggs produce --clone (per clonare il tuo sistema intero)");
        break;

      case "info":
        new Table()
            .body([
                ["Versione", "10.0.0-deno"],
                ["Autore", "Piero Proietti"],
                ["Obiettivo", "Remastering Linux Semplice"],
            ])
            .border(true)
            .render();
        break;

      case "exit":
        console.log("Ciao! Torna quando vuoi.");
        break;
    }
  });