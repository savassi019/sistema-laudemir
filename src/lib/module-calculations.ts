export function calculateBilliardFinancials(input: {
  quantityOfChips: number;
  chipValue: number;
  percentage: number;
  accumulatedChips?: number;
  employeeCost?: number;
  installationCost?: number;
  maintenanceCost?: number;
  otherCost?: number;
  structureCost?: number;
  roofDebt?: number;
  discountAmount?: number;
  clothLimit?: number;
}) {
  const grossAmount = input.quantityOfChips * input.chipValue;
  const clientShare = grossAmount * (input.percentage / 100);
  const companyShare = grossAmount - clientShare;
  const totalCosts =
    (input.employeeCost ?? 0) +
    (input.installationCost ?? 0) +
    (input.maintenanceCost ?? 0) +
    (input.otherCost ?? 0) +
    (input.structureCost ?? 0) +
    (input.roofDebt ?? 0) +
    (input.discountAmount ?? 0);
  const clothTotal = (input.accumulatedChips ?? 0) + input.quantityOfChips;
  const clothLimit = input.clothLimit ?? 1500;

  return {
    grossAmount,
    clientShare,
    companyShare,
    totalCosts,
    finalValue: companyShare - totalCosts,
    clothTotal,
    clothRemaining: Math.max(clothLimit - clothTotal, 0),
    clothWarning: clothTotal >= clothLimit,
  };
}

export function calculateBxFinancials(input: {
  incomeAmount: number;
  expenseAmount?: number;
  deliveredAmount?: number;
  discountAmount?: number;
  receiptStatus: string;
  previousDebt?: number;
  generatedDebtAmount?: number;
}) {
  const operatingExpenseAmount = input.expenseAmount ?? 0;
  const prizeExpenseAmount = ["DELIVERED", "PRIZE"].includes(input.receiptStatus)
    ? (input.deliveredAmount ?? 0)
    : 0;
  const discountAmount = input.discountAmount ?? 0;
  const expenseAmount = operatingExpenseAmount + prizeExpenseAmount;
  const generatedDebtAmount = input.receiptStatus === "NOT_RECEIVED"
    ? (input.generatedDebtAmount ?? 0)
    : 0;

  return {
    incomeAmount: input.incomeAmount,
    operatingExpenseAmount,
    prizeExpenseAmount,
    expenseAmount,
    discountAmount,
    netAmount: input.incomeAmount - expenseAmount - discountAmount,
    remainingDebt:
      Math.max((input.previousDebt ?? 0) - discountAmount, 0) + generatedDebtAmount,
  };
}

export function calculateCarretaFinancials(tablePrice: number, expenseAmount = 0) {
  return { totalAmount: Math.max(0, tablePrice - expenseAmount) };
}

export function calculatePlushFinancials(input: {
  grossAmount: number;
  commissionPercentage: number;
  discountAmount?: number;
  ownerExpenseAmount?: number;
}) {
  const clientAmount = input.grossAmount * (input.commissionPercentage / 100);
  const companyAmount = input.grossAmount - clientAmount;
  return {
    clientAmount,
    companyAmount,
    netAmount:
      companyAmount - (input.discountAmount ?? 0) - (input.ownerExpenseAmount ?? 0),
  };
}

export function calculateRentalFinancials(input: {
  totalAmount: number;
  signalEnabled: boolean;
  signalPercentage?: number;
  expenseAmount?: number;
}) {
  const signalAmount = input.signalEnabled
    ? input.totalAmount * ((input.signalPercentage ?? 0) / 100)
    : 0;
  return {
    signalAmount,
    balanceAmount: input.totalAmount - signalAmount - (input.expenseAmount ?? 0),
  };
}

export function calculateSlotMachineSplit(input: {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  percentageSplit: number;
  previousMachineDebt?: number;
  finalMachineDebt?: number;
  feedingNegativeAmount?: number;
  optionalGreedAmount?: number;
  customerDebtDiscounted?: number;
  generatedDebtAmount?: number;
}) {
  const incomeDifference = input.currentIncome - input.previousIncome;
  const expenseDifference = input.currentExpense - input.previousExpense;
  const netRevenue = incomeDifference - expenseDifference;
  const machineDebtChange =
    (input.finalMachineDebt ?? 0) - (input.previousMachineDebt ?? 0);
  const totalNegative = machineDebtChange + (input.feedingNegativeAmount ?? 0);
  const adjustedTotal = netRevenue - totalNegative;
  const clientShareBase = adjustedTotal * (input.percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const greed = input.optionalGreedAmount ?? 0;
  const clientShareFinal =
    clientShareBase - greed - (input.customerDebtDiscounted ?? 0);
  const houseAmount =
    houseShareBase +
    greed +
    (input.customerDebtDiscounted ?? 0) -
    (input.generatedDebtAmount ?? 0);

  return {
    incomeDifference,
    expenseDifference,
    netRevenue,
    machineDebtChange,
    adjustedTotal,
    clientShareFinal,
    houseAmount,
  };
}
