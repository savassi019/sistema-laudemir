import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf-8").trim();
const swPath = join(root, "public/sw.js");
const sw = readFileSync(swPath, "utf-8");
const updated = sw.replace("laudemir-BUILD_ID_PLACEHOLDER", `laudemir-${buildId}`);
writeFileSync(swPath, updated);
console.log(`SW cache atualizado: laudemir-${buildId}`);
