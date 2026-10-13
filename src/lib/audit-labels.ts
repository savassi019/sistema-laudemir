import { moduleCatalog } from "@/lib/module-catalog";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: "Cliente cadastrado",
  MODULE_CLIENT_CREATED: "Cliente do módulo cadastrado",
  MODULE_OPERATION_CREATED: "Operação registrada",
  MODULE_OPERATION_CORRECTED: "Operação corrigida",
  MODULE_OPERATION_CANCELLED: "Operação cancelada",
  VISIT_CREATED: "Visita registrada",
  VISIT_UPDATED: "Visita alterada",
  VISIT_DELETED: "Visita excluida",
  FINANCIAL_ENTRY_CREATED: "Lançamento financeiro criado",
  FINANCIAL_ENTRY_UPDATED: "Lançamento financeiro alterado",
  FINANCIAL_ENTRY_CANCELLED: "Lançamento financeiro cancelado",
  FINANCIAL_PAYMENT_REGISTERED: "Pagamento registrado",
  FINANCIAL_STATUS_PENDING: "Lançamento voltou para pendente",
  FINANCIAL_STATUS_UPDATED: "Situação financeira alterada",
  DAILY_CLOSE_COMPLETED: "Fechamento diário concluído",
  DAILY_CLOSE_REOPENED: "Fechamento diário reaberto",
  EMPLOYEE_CASH_ADVANCE_SAVED: "Valor entregue ao funcionário registrado",
  EMPLOYEE_EXPENSE_CREATED: "Gasto do funcionário registrado",
  EMPLOYEE_EXPENSE_CANCELLED: "Gasto do funcionário cancelado",
  EMPLOYEE_CASH_SUBMITTED: "Gastos enviados para conferência",
  EMPLOYEE_CASH_APPROVED: "Gastos do funcionário aprovados",
  EMPLOYEE_CASH_RETURNED: "Gastos devolvidos para correção",
  USER_CREATED: "Usuário criado",
  USER_UPDATED: "Usuário e acessos alterados",
  USER_PASSWORD_RESET: "Senha de usuário redefinida",
  USER_STATUS_CHANGED: "Situação do usuário alterada",
  CONTACT_PHONES_UPDATED: "Telefones de contato alterados",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? "Alteração registrada";
}

export function auditModuleLabel(module: string) {
  if (module === "SETTINGS") return "Configurações";
  if (module === "FINANCE") return "Financeiro";
  if (module === "CLIENTS") return "Clientes";
  if (module === "CORE") return "Sistema";
  return moduleCatalog.find((item) => item.module === module)?.title ?? "Sistema";
}
