function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSlotCustomerDebt({
  clientShareBeforeDebt,
  previousCustomerDebt,
}: {
  clientShareBeforeDebt: number;
  previousCustomerDebt: number;
}) {
  const roundedClientShare = roundMoney(clientShareBeforeDebt);
  const previousDebt = roundMoney(Math.max(previousCustomerDebt, 0));
  const generatedDebtAmount = roundMoney(Math.max(-roundedClientShare, 0));
  const debtAvailable = roundMoney(previousDebt + generatedDebtAmount);
  const customerDebtDiscounted = roundMoney(
    Math.min(debtAvailable, Math.max(roundedClientShare, 0)),
  );
  const finalCustomerDebt = roundMoney(debtAvailable - customerDebtDiscounted);

  return {
    generatedDebtAmount,
    customerDebtDiscounted,
    finalCustomerDebt,
  };
}
