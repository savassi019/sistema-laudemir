import assert from "node:assert/strict";
import test from "node:test";

import { classifyOfflineResponseStatus } from "../src/lib/offline-submission-queue";

test("fila offline tenta novamente apenas em falhas temporarias", () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(classifyOfflineResponseStatus(status), "pending", `status ${status}`);
  }
});

test("fila offline exige conferencia em autenticacao, validacao e conflito", () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.equal(classifyOfflineResponseStatus(status), "attention", `status ${status}`);
  }
});
