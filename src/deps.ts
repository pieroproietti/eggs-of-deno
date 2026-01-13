// src/deps.ts

// Cliffy (CLI Framework)
export { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
export { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.4/table/mod.ts";
export { Select } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/select.ts";
export * as mustache from "https://deno.land/x/mustache@v0.3.0/mod.ts";

// Standard Library (File System, Path, Yaml)
export * as path from "https://deno.land/std@0.210.0/path/mod.ts";
export { 
  ensureDir, 
  exists, 
  copy as copyDir // Alias utile se serve
} from "https://deno.land/std@0.210.0/fs/mod.ts";

export { 
  parse as parseYaml, 
  stringify as stringifyYaml 
} from "https://deno.land/std@0.210.0/yaml/mod.ts";