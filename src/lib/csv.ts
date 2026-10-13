const FORMULA_PREFIX = /^[\t\r\n ]*(?:[=+@]|-(?!\d+(?:[.,]\d+)?[\t ]*$))/;

export function escapeCsvCell(
  value: string | number | null | undefined,
): string {
  const raw = String(value ?? "");
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function formatCsvDecimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function buildPtBrCsv(
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const content = rows
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\r\n");

  return `\ufeff${content}`;
}
