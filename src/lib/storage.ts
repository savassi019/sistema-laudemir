import { mkdir } from "fs/promises";
import path from "path";

export function getUploadRoot() {
  return process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

export async function ensureOrgUploadDir(organizationId: string) {
  const dir = path.join(getUploadRoot(), organizationId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function resolveStoragePath(storagePath: string) {
  return path.join(getUploadRoot(), storagePath);
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function validateUpload(file: File) {
  if (file.size > MAX_UPLOAD_SIZE) {
    return "Arquivo maior que 10MB.";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Tipo de arquivo nao permitido. Envie foto (jpg/png/webp/heic) ou PDF.";
  }

  return null;
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(-80);
}
