import assert from "node:assert/strict";
import test from "node:test";

import { buildPtBrCsv, escapeCsvCell, formatCsvDecimal } from "../src/lib/csv";

test("CSV pt-BR usa BOM, ponto e vírgula e quebra de linha compatível com Excel", () => {
  const csv = buildPtBrCsv([
    ["Cliente", "Entrada (R$)"],
    ["Bar do Chico", formatCsvDecimal(1490)],
  ]);

  assert.equal(
    csv,
    '\ufeff"Cliente";"Entrada (R$)"\r\n"Bar do Chico";"1490,00"',
  );
});

test("CSV preserva aspas e neutraliza fórmulas vindas de texto", () => {
  assert.equal(
    escapeCsvCell('Loja "Centro"; Norte'),
    '"Loja ""Centro""; Norte"',
  );
  assert.equal(escapeCsvCell('=IMPORTXML("x")'), '"\'=IMPORTXML(""x"")"');
  assert.equal(escapeCsvCell("-25,00"), '"-25,00"');
});
