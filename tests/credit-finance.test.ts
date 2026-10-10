import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCreditTerms,
  calculateReceivedInterest,
  isCreditOverdue,
} from "../src/lib/credit-finance";

test("calcula o total e a parcela do credito pela mesma regra do servidor", () => {
  assert.deepEqual(calculateCreditTerms(1_000, 10, 3), {
    principal: 1_000,
    monthlyInterestRate: 10,
    installmentsCount: 3,
    totalInterest: 300,
    totalReceivable: 1_300,
    installmentAmount: 433.33,
  });
});

test("historico de juros recebidos nao ultrapassa os juros contratados", () => {
  assert.equal(calculateReceivedInterest(80, 150), 80);
  assert.equal(calculateReceivedInterest(230, 150), 150);
});

test("marca como vencido somente quando ainda existe saldo", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(isCreditOverdue({ dueDate: "2026-10-09T12:00:00Z", remainingAmount: 10, status: "PARTIAL", now }), true);
  assert.equal(isCreditOverdue({ dueDate: "2026-10-09T12:00:00Z", remainingAmount: 0, status: "PAID", now }), false);
  assert.equal(isCreditOverdue({ dueDate: "2026-10-11T12:00:00Z", remainingAmount: 10, status: "PENDING", now }), false);
});
