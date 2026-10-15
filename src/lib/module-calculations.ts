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
  roofPaidAmount?: number;
  /** Compatibilidade com fechamentos antigos, nos quais telhado era custo. */
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
    finalValue: companyShare + (input.roofPaidAmount ?? 0) - totalCosts,
    clothTotal,
    clothRemaining: Math.max(clothLimit - clothTotal, 0),
    clothWarning: clothTotal >= clothLimit,
  };
}

export function calculateBilliardRoofBalance(input: {
  previousBalance?: number;
  installmentAmount?: number;
  paidAmount?: number;
}) {
  const previousBalance = Math.max(input.previousBalance ?? 0, 0);
  const installmentAmount = Math.max(input.installmentAmount ?? 0, 0);
  const paidAmount = Math.max(input.paidAmount ?? 0, 0);

  return {
    previousBalance,
    installmentAmount,
    paidAmount,
    balanceAfter: Math.max(previousBalance + installmentAmount - paidAmount, 0),
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
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const grossAmount = roundMoney(input.grossAmount);
  const rawClientAmount = grossAmount * (input.commissionPercentage / 100);
  // Regra operacional da GRUA: o valor entregue ao cliente nao usa centavos
  // e qualquer fracao e arredondada para cima (ex.: 299,25 vira 300,00).
  // A Infinity fica com o restante exato, portanto nenhum centavo desaparece
  // nem e contado duas vezes durante o arredondamento.
  const clientAmount = Math.ceil(rawClientAmount - 1e-9);
  const companyAmount = roundMoney(grossAmount - clientAmount);
  return {
    clientAmount,
    companyAmount,
    netAmount: roundMoney(
      companyAmount - (input.discountAmount ?? 0) - (input.ownerExpenseAmount ?? 0),
    ),
  };
}

export type PlushClientPaymentMethod =
  | "PIX"
  | "DINHEIRO"
  | "PIX_DINHEIRO"
  | "CARTAO"
  | "ABERTO";

export function validatePlushClientPayment(input: {
  paymentMethod: PlushClientPaymentMethod;
  clientAmount: number;
  pixAmount?: number;
  cashAmount?: number;
  hasPixProof?: boolean;
}) {
  const toCents = (value: number) => Math.round((value + Number.EPSILON) * 100);
  const clientCents = toCents(input.clientAmount);
  const pixCents = toCents(input.pixAmount ?? 0);
  const cashCents = toCents(input.cashAmount ?? 0);

  if (pixCents < 0 || cashCents < 0) {
    return {
      valid: false as const,
      field: "amounts" as const,
      message: "Os valores pagos nao podem ser negativos.",
    };
  }

  if (input.paymentMethod === "PIX_DINHEIRO") {
    if (pixCents <= 0 || cashCents <= 0) {
      return {
        valid: false as const,
        field: "amounts" as const,
        message: "Informe uma parte em PIX e outra em dinheiro.",
      };
    }
    if (pixCents + cashCents !== clientCents) {
      return {
        valid: false as const,
        field: "amounts" as const,
        message: "A soma do PIX com o dinheiro deve ser igual ao repasse do cliente.",
      };
    }
  } else if (input.paymentMethod === "PIX" && (pixCents !== clientCents || cashCents !== 0)) {
    return {
      valid: false as const,
      field: "amounts" as const,
      message: "O valor em PIX deve ser igual ao repasse do cliente.",
    };
  } else if (
    input.paymentMethod === "DINHEIRO" &&
    (cashCents !== clientCents || pixCents !== 0)
  ) {
    return {
      valid: false as const,
      field: "amounts" as const,
      message: "O valor em dinheiro deve ser igual ao repasse do cliente.",
    };
  } else if (
    (input.paymentMethod === "CARTAO" || input.paymentMethod === "ABERTO") &&
    (pixCents !== 0 || cashCents !== 0)
  ) {
    return {
      valid: false as const,
      field: "amounts" as const,
      message: "Esta forma de pagamento nao aceita divisao entre PIX e dinheiro.",
    };
  }

  if (pixCents > 0 && !input.hasPixProof) {
    return {
      valid: false as const,
      field: "pixProof" as const,
      message: "Anexe o comprovante do PIX.",
    };
  }

  return { valid: true as const };
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
