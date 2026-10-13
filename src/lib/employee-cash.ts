export type EmployeeExpenseFundingValue =
  | "COMPANY_ADVANCE"
  | "EMPLOYEE_OWN"
  | "COMPANY_DIRECT";

export type EmployeeCashExpenseValue = {
  amount: number;
  funding: EmployeeExpenseFundingValue;
  cancelled?: boolean;
};

export type EmployeeCashTotals = {
  totalExpense: number;
  advanceSpent: number;
  employeePaid: number;
  companyDirect: number;
  cashToReturn: number;
  reimbursement: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEmployeeCashTotals(
  advanceAmount: number,
  expenses: EmployeeCashExpenseValue[],
): EmployeeCashTotals {
  let advanceSpent = 0;
  let employeePaid = 0;
  let companyDirect = 0;

  for (const expense of expenses) {
    if (expense.cancelled || expense.amount <= 0) continue;
    if (expense.funding === "COMPANY_ADVANCE") advanceSpent += expense.amount;
    else if (expense.funding === "EMPLOYEE_OWN") employeePaid += expense.amount;
    else companyDirect += expense.amount;
  }

  const normalizedAdvance = Math.max(0, money(advanceAmount));
  advanceSpent = money(advanceSpent);
  employeePaid = money(employeePaid);
  companyDirect = money(companyDirect);

  return {
    totalExpense: money(advanceSpent + employeePaid + companyDirect),
    advanceSpent,
    employeePaid,
    companyDirect,
    cashToReturn: money(Math.max(normalizedAdvance - advanceSpent, 0)),
    reimbursement: money(employeePaid + Math.max(advanceSpent - normalizedAdvance, 0)),
  };
}
