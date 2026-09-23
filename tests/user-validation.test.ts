import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarUsuario,
  usuarioLegadoDoEmail,
  validarUsuario,
} from "../src/lib/user-validation";

test("usuário de acesso é normalizado sem depender de e-mail", () => {
  assert.equal(normalizarUsuario("  Joao.Silva  "), "joao.silva");
  assert.equal(validarUsuario("joao.silva"), null);
  assert.match(validarUsuario("joao@email.com") ?? "", /somente letras/i);
  assert.match(validarUsuario("ab") ?? "", /pelo menos 3/i);
});

test("contas antigas recebem como usuário a parte anterior ao arroba", () => {
  assert.equal(usuarioLegadoDoEmail("Laudemir@lmgestao.local"), "laudemir");
});
