import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessModule,
  canManageTeam,
  canViewCalculatedFinancials,
  canViewOwnerDashboard,
} from "../src/lib/access-policy";

test("dono acessa qualquer módulo e as áreas exclusivas", () => {
  assert.equal(canAccessModule("OWNER", [], "SLOT_H"), true);
  assert.equal(canViewCalculatedFinancials("OWNER"), true);
  assert.equal(canManageTeam("OWNER"), true);
  assert.equal(canViewOwnerDashboard("OWNER"), true);
});

test("gestor acessa somente módulos liberados e vê os cálculos deles", () => {
  const modules = ["BX", "BILLIARD"] as const;
  assert.equal(canAccessModule("ADMIN", modules, "BX"), true);
  assert.equal(canAccessModule("ADMIN", modules, "SLOT_H"), false);
  assert.equal(canViewCalculatedFinancials("ADMIN"), true);
  assert.equal(canManageTeam("ADMIN"), false);
  assert.equal(canViewOwnerDashboard("ADMIN"), false);
});

test("funcionário acessa a operação liberada, mas nunca os totais calculados", () => {
  const modules = ["SLOT_H"] as const;
  assert.equal(canAccessModule("STAFF", modules, "SLOT_H"), true);
  assert.equal(canAccessModule("STAFF", modules, "BX"), false);
  assert.equal(canViewCalculatedFinancials("STAFF"), false);
  assert.equal(canManageTeam("STAFF"), false);
  assert.equal(canViewOwnerDashboard("STAFF"), false);
});
