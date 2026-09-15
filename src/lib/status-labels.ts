/**
 * Nomes em portugues para os status guardados no banco.
 *
 * Os enums do Prisma sao em ingles e viviam chegando crus na tela: o cartao
 * do contrato mostrava "PENDING_SIGNATURE" para quem so precisa saber que
 * falta assinar. Um lugar so para o texto, para nao corrigir modulo a modulo
 * toda vez que o problema reaparece.
 */

/**
 * PersonType: o formulario do Marketing usa PF/PJ; ao salvar isso vira
 * INDIVIDUAL/COMPANY (vocabulario do Client generico) e e isso que volta
 * do banco nas telas de historico/relatorio. Cobre os dois lados para
 * funcionar em qualquer um dos dois pontos de leitura.
 */
export const PERSON_TYPE_LABEL: Record<string, string> = {
  PF: "Pessoa física",
  PJ: "Pessoa jurídica",
  INDIVIDUAL: "Pessoa física",
  COMPANY: "Pessoa jurídica",
};

/**
 * PaymentMethod: cobre o vocabulario dos formularios (PIX/DINHEIRO/
 * CARTAO/ABERTO) e o do enum do Prisma (armazenado apos o mapeamento),
 * porque o texto do comprovante usa ora um lado ora o outro.
 */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  ABERTO: "Em aberto",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CHECK: "Cheque",
  OTHER: "Outro",
};

/** BxReceiptStatus */
export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Recebido",
  NOT_RECEIVED: "Não recebido",
};

/** ContractStatus */
export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_SIGNATURE: "Falta assinar",
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
  DEFAULTED: "Inadimplente",
  CANCELLED: "Cancelado",
};

/** FinancialStatus */
export const FINANCIAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

/** FinancialDirection */
export const DIRECTION_LABEL: Record<string, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
  // Alguns formularios (Mercado autonomo) usam esse vocabulario direto,
  // sem passar pelo enum do Prisma.
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

/** Status proprios da Plataforma Online (nao e um enum do Prisma). */
export const PLATFORM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  POSTED: "Lancado",
};

/** PersonalEntryType */
export const PERSONAL_ENTRY_TYPE_LABEL: Record<string, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saida",
  PAYABLE: "A pagar",
  PAID: "Pago",
};

/**
 * Traduz usando o mapa informado. Se aparecer um valor que ninguem previu,
 * devolve algo legivel ("PENDING_SIGNATURE" -> "Pending signature") em vez
 * do grito em maiusculas com underline.
 */
export function rotuloDeStatus(valor: string | null | undefined, mapa: Record<string, string>): string {
  if (!valor) return "";
  const conhecido = mapa[valor];
  if (conhecido) return conhecido;
  const legivel = valor.replace(/_/g, " ").toLowerCase();
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}
