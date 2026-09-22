export type SavedModuleRecordResponse = {
  source?: string;
  record?: {
    id: string;
    createdAt: string;
  };
};

/**
 * Identificador curto e estavel para a via do cliente. O valor deriva do ID
 * real do fechamento; nao e um contador inventado no navegador.
 */
export function formatClosingReceiptId(closingId: string, occurredAt: string) {
  let hash = 2166136261;
  for (const character of closingId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const year = occurredAt.match(/^\d{4}/)?.[0] ?? String(new Date().getFullYear());
  const numericId = String((hash >>> 0) % 100_000).padStart(5, "0");
  return `FECH-${year}-${numericId}`;
}
