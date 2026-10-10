export type CreditTerms = {
  principal: number;
  monthlyInterestRate: number;
  installmentsCount: number;
  totalInterest: number;
  totalReceivable: number;
  installmentAmount: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Juros simples por quantidade de parcelas. A funcao e compartilhada entre
 * tela, persistencia e testes para que o valor exibido seja o mesmo salvo.
 */
export function calculateCreditTerms(
  principal: number,
  monthlyInterestRate: number,
  installmentsCount: number,
): CreditTerms {
  const safePrincipal = money(Math.max(0, principal));
  const safeRate = Math.max(0, monthlyInterestRate);
  const safeInstallments = Math.max(1, Math.trunc(installmentsCount));
  const totalInterest = money(safePrincipal * (safeRate / 100) * safeInstallments);
  const totalReceivable = money(safePrincipal + totalInterest);

  return {
    principal: safePrincipal,
    monthlyInterestRate: safeRate,
    installmentsCount: safeInstallments,
    totalInterest,
    totalReceivable,
    installmentAmount: money(totalReceivable / safeInstallments),
  };
}

/**
 * Pagamentos amortizam os juros contratados primeiro. Assim o sistema
 * consegue informar quanto de juros ja entrou sem criar outro livro-caixa.
 */
export function calculateReceivedInterest(paidAmount: number, totalInterest: number) {
  return money(Math.min(Math.max(0, paidAmount), Math.max(0, totalInterest)));
}

export function isCreditOverdue(params: {
  dueDate: Date | string | null | undefined;
  remainingAmount: number;
  status: string;
  now?: Date;
}) {
  if (!params.dueDate || params.remainingAmount <= 0) return false;
  if (!["PENDING", "PARTIAL", "OVERDUE"].includes(params.status)) return false;
  const dueDate = params.dueDate instanceof Date ? params.dueDate : new Date(params.dueDate);
  const now = params.now ?? new Date();
  return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime();
}
