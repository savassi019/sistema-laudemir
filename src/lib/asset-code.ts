import { createHash } from "crypto";

export function generateAssetCode(prefix: string, value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 18)
    .toUpperCase();
  const fingerprint = createHash("sha256")
    .update(value.trim().toLocaleUpperCase("pt-BR"))
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

  return `${prefix}-${normalized || "ITEM"}-${fingerprint}`;
}
