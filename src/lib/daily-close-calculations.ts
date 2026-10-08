export type DailyCloseTotals = {
  expectedCash: number;
  expectedPix: number;
  expectedCard: number;
  expectedOther: number;
  expectedIncome: number;
  expectedExpense: number;
  expectedPrize: number;
  expectedNet: number;
};

type OperationMovement = {
  direction: "INCOME" | "EXPENSE";
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string | null;
  category: string;
};

type RegisteredPayment = {
  amount: number;
  method: string | null;
  direction: "INCOME" | "EXPENSE";
  entryStatus: string;
};

function methodBucket(method: string | null) {
  if (method === "CASH" || method === "DINHEIRO") return "cash" as const;
  if (method === "PIX") return "pix" as const;
  if (method === "CREDIT_CARD" || method === "DEBIT_CARD" || method === "CARTAO") {
    return "card" as const;
  }
  return "other" as const;
}

export function summarizeDailyMovements(
  operations: OperationMovement[],
  payments: RegisteredPayment[],
): DailyCloseTotals {
  const totals: DailyCloseTotals = {
    expectedCash: 0,
    expectedPix: 0,
    expectedCard: 0,
    expectedOther: 0,
    expectedIncome: 0,
    expectedExpense: 0,
    expectedPrize: 0,
    expectedNet: 0,
  };

  const addIncomeByMethod = (amount: number, method: string | null) => {
    const bucket = methodBucket(method);
    if (bucket === "cash") totals.expectedCash += amount;
    else if (bucket === "pix") totals.expectedPix += amount;
    else if (bucket === "card") totals.expectedCard += amount;
    else totals.expectedOther += amount;
  };

  for (const entry of operations) {
    const realized = entry.status === "PAID" ? entry.totalAmount : entry.paidAmount;
    if (realized <= 0 || entry.status === "CANCELLED") continue;
    if (entry.direction === "INCOME") {
      totals.expectedIncome += realized;
      addIncomeByMethod(realized, entry.paymentMethod);
    } else {
      totals.expectedExpense += realized;
      if (entry.category === "PRIZE") totals.expectedPrize += realized;
    }
  }

  for (const payment of payments) {
    if (payment.entryStatus === "CANCELLED" || payment.amount <= 0) continue;
    if (payment.direction === "INCOME") {
      totals.expectedIncome += payment.amount;
      addIncomeByMethod(payment.amount, payment.method);
    } else {
      totals.expectedExpense += payment.amount;
    }
  }

  totals.expectedNet = totals.expectedIncome - totals.expectedExpense;
  return totals;
}

export function isBusinessDayLocked(role: string, closeStatus: string | null | undefined) {
  return role !== "OWNER" && closeStatus === "CLOSED";
}
