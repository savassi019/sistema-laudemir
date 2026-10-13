import assert from "node:assert/strict";
import test from "node:test";

import { canReviewEmployeeCash } from "../src/lib/access-policy";
import { calculateEmployeeCashTotals } from "../src/lib/employee-cash";
import { MODULE_CAPABILITIES } from "../src/lib/module-capabilities";

test("caixa do funcionario separa devolucao e reembolso sem duplicar despesas", () => {
  assert.deepEqual(
    calculateEmployeeCashTotals(200, [
      { amount: 80, funding: "COMPANY_ADVANCE" },
      { amount: 30, funding: "EMPLOYEE_OWN" },
      { amount: 50, funding: "COMPANY_DIRECT" },
      { amount: 999, funding: "COMPANY_ADVANCE", cancelled: true },
    ]),
    {
      totalExpense: 160,
      advanceSpent: 80,
      employeePaid: 30,
      companyDirect: 50,
      cashToReturn: 120,
      reimbursement: 30,
    },
  );
});

test("excesso do adiantamento vira reembolso e somente o dono revisa totais", () => {
  assert.deepEqual(
    calculateEmployeeCashTotals(100, [
      { amount: 130, funding: "COMPANY_ADVANCE" },
      { amount: 20, funding: "EMPLOYEE_OWN" },
    ]),
    {
      totalExpense: 150,
      advanceSpent: 130,
      employeePaid: 20,
      companyDirect: 0,
      cashToReturn: 0,
      reimbursement: 50,
    },
  );
  assert.equal(canReviewEmployeeCash("OWNER"), true);
  assert.equal(canReviewEmployeeCash("ADMIN"), false);
  assert.equal(canReviewEmployeeCash("STAFF"), false);
});

test("gastos da equipe ficam nos modulos operacionais e fora do marketing", () => {
  assert.equal(MODULE_CAPABILITIES["bilhar-pebolim"].employeeCash, true);
  assert.equal(MODULE_CAPABILITIES.bx.employeeCash, true);
  assert.equal(MODULE_CAPABILITIES["maquinas-de-pelucia"].employeeCash, true);
  assert.equal(MODULE_CAPABILITIES.marketing.employeeCash, false);
});
