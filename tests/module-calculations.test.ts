import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBilliardFinancials,
  calculateBxFinancials,
  calculateCarretaFinancials,
  calculatePlushFinancials,
  calculateRentalFinancials,
  calculateSlotMachineSplit,
} from "../src/lib/module-calculations";
import { calculateSlotCustomerDebt } from "../src/lib/slot-finance";

test("bilhar calcula bruto, repasse, custos, resultado e alerta do pano", () => {
  const result = calculateBilliardFinancials({
    quantityOfChips: 200,
    chipValue: 2,
    percentage: 25,
    accumulatedChips: 1400,
    employeeCost: 20,
    maintenanceCost: 10,
    discountAmount: 5,
  });
  assert.deepEqual(result, {
    grossAmount: 400,
    clientShare: 100,
    companyShare: 300,
    totalCosts: 35,
    finalValue: 265,
    clothTotal: 1600,
    clothRemaining: 0,
    clothWarning: true,
  });
});

test("BX trata prêmio como despesa e carrega somente a dívida válida", () => {
  const prize = calculateBxFinancials({
    incomeAmount: 1000,
    expenseAmount: 100,
    deliveredAmount: 250,
    discountAmount: 50,
    receiptStatus: "DELIVERED",
    previousDebt: 200,
    generatedDebtAmount: 500,
  });
  assert.equal(prize.netAmount, 600);
  assert.equal(prize.prizeExpenseAmount, 250);
  assert.equal(prize.remainingDebt, 150);

  const pending = calculateBxFinancials({
    incomeAmount: 0,
    receiptStatus: "NOT_RECEIVED",
    previousDebt: 200,
    discountAmount: 50,
    generatedDebtAmount: 300,
  });
  assert.equal(pending.remainingDebt, 450);
});

test("carreta, grua e locação preservam suas fórmulas de fechamento", () => {
  assert.equal(calculateCarretaFinancials(40, 7).totalAmount, 33);
  assert.equal(calculateCarretaFinancials(20, 25).totalAmount, 0);

  assert.deepEqual(
    calculatePlushFinancials({
      grossAmount: 1000,
      commissionPercentage: 25,
      discountAmount: 50,
      ownerExpenseAmount: 100,
    }),
    { clientAmount: 250, companyAmount: 750, netAmount: 600 },
  );

  assert.deepEqual(
    calculateRentalFinancials({
      totalAmount: 1000,
      signalEnabled: true,
      signalPercentage: 30,
      expenseAmount: 50,
    }),
    { signalAmount: 300, balanceAmount: 650 },
  );
});

test("H usa somente a variação do negativo e mantém a dívida do cliente separada", () => {
  const split = calculateSlotMachineSplit({
    currentIncome: 8500,
    previousIncome: 8000,
    currentExpense: 3200,
    previousExpense: 3000,
    percentageSplit: 50,
    previousMachineDebt: 100,
    finalMachineDebt: 200,
    optionalGreedAmount: 10,
    customerDebtDiscounted: 20,
    generatedDebtAmount: 30,
  });
  assert.equal(split.incomeDifference, 500);
  assert.equal(split.expenseDifference, 200);
  assert.equal(split.machineDebtChange, 100);
  assert.equal(split.clientShareFinal, 70);
  assert.equal(split.houseAmount, 100);

  assert.deepEqual(
    calculateSlotCustomerDebt({ clientShareBeforeDebt: -120, previousCustomerDebt: 50 }),
    { generatedDebtAmount: 120, customerDebtDiscounted: 0, finalCustomerDebt: 170 },
  );
});
