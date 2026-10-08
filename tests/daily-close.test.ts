import assert from "node:assert/strict";
import test from "node:test";

import {
  isBusinessDayLocked,
  summarizeDailyMovements,
} from "../src/lib/daily-close-calculations";

test("fechamento diário separa formas de recebimento e despesas sem duplicar", () => {
  const totals = summarizeDailyMovements(
    [
      {
        direction: "INCOME",
        status: "PAID",
        totalAmount: 100,
        paidAmount: 100,
        paymentMethod: "PIX",
        category: "OPERATION_INCOME",
      },
      {
        direction: "INCOME",
        status: "PARTIAL",
        totalAmount: 100,
        paidAmount: 40,
        paymentMethod: "CASH",
        category: "OPERATION_INCOME",
      },
      {
        direction: "EXPENSE",
        status: "PAID",
        totalAmount: 25,
        paidAmount: 25,
        paymentMethod: null,
        category: "PRIZE",
      },
      {
        direction: "INCOME",
        status: "CANCELLED",
        totalAmount: 999,
        paidAmount: 999,
        paymentMethod: "PIX",
        category: "OPERATION_INCOME",
      },
    ],
    [
      { amount: 60, method: "CASH", direction: "INCOME", entryStatus: "PAID" },
      { amount: 10, method: "CASH", direction: "EXPENSE", entryStatus: "PAID" },
    ],
  );

  assert.deepEqual(totals, {
    expectedCash: 100,
    expectedPix: 100,
    expectedCard: 0,
    expectedOther: 0,
    expectedIncome: 200,
    expectedExpense: 35,
    expectedPrize: 25,
    expectedNet: 165,
  });
});

test("funcionário não altera dia fechado, mas dono pode corrigir", () => {
  assert.equal(isBusinessDayLocked("STAFF", "CLOSED"), true);
  assert.equal(isBusinessDayLocked("ADMIN", "CLOSED"), true);
  assert.equal(isBusinessDayLocked("OWNER", "CLOSED"), false);
  assert.equal(isBusinessDayLocked("STAFF", "REOPENED"), false);
});
