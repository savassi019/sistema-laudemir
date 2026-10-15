import assert from "node:assert/strict";
import test from "node:test";

import { generateAssetCode } from "../src/lib/asset-code";

test("código automático é estável para o mesmo ativo", () => {
  const value = "Cliente com nome muito extenso-maquina-01";

  assert.equal(generateAssetCode("GRUA", value), generateAssetCode("GRUA", value));
});

test("código automático diferencia máquinas depois do trecho legível", () => {
  const commonPrefix = "Cliente com nome muito extenso-maquina-";

  assert.notEqual(
    generateAssetCode("GRUA", `${commonPrefix}01`),
    generateAssetCode("GRUA", `${commonPrefix}02`),
  );
});
