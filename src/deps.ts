// src/deps.ts
export { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
export { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.4/table/mod.ts";
// Aggiungi questo per i menu interattivi:
export { Select } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/select.ts"; 

export { parse as parseYaml, stringify as stringifyYaml } from "https://deno.land/std@0.210.0/yaml/mod.ts";
export * as path from "https://deno.land/std@0.210.0/path/mod.ts";
export { ensureDir, exists } from "https://deno.land/std@0.210.0/fs/mod.ts";