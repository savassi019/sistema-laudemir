"use server";

import { revalidatePath } from "next/cache";

import { hasModuleAccess, requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  cancelEmployeeExpense,
  EMPLOYEE_CASH_MODULES,
  listEmployeeCashBoxes,
  reviewEmployeeCash,
  saveEmployeeCashAdvance,
  submitEmployeeCash,
} from "@/server/services/employee-cash-service";

async function requireEmployeeCashModule(slug: string) {
  const session = await requireSession();
  const item = getModuleBySlug(slug);

  // ASVS V8.2/V8.3: Server Actions sao endpoints publicos; cada chamada
  // revalida empresa, usuario e permissao do modulo no servidor.
  if (!item || !EMPLOYEE_CASH_MODULES.has(item.module)) {
    throw new Error("Gastos de funcionário não estão disponíveis neste módulo.");
  }
  if (!hasModuleAccess(session, item.module)) {
    throw new Error("Sem permissão para este módulo.");
  }
  return { session, item };
}

export async function listEmployeeCashBoxesAction(slug: string, businessDate: string) {
  const { session, item } = await requireEmployeeCashModule(slug);
  return listEmployeeCashBoxes(session, item.module, businessDate);
}

export async function saveEmployeeCashAdvanceAction(
  slug: string,
  payload: Record<string, unknown>,
) {
  const { session, item } = await requireEmployeeCashModule(slug);
  const result = await saveEmployeeCashAdvance(session, item.module, payload);
  revalidatePath(`/modulos/${slug}`);
  return result;
}

export async function cancelEmployeeExpenseAction(slug: string, expenseId: string) {
  const { session, item } = await requireEmployeeCashModule(slug);
  const result = await cancelEmployeeExpense(session, item.module, expenseId);
  revalidatePath(`/modulos/${slug}`);
  return result;
}

export async function submitEmployeeCashAction(slug: string, cashId: string) {
  const { session, item } = await requireEmployeeCashModule(slug);
  const result = await submitEmployeeCash(session, item.module, cashId);
  revalidatePath(`/modulos/${slug}`);
  return result;
}

export async function reviewEmployeeCashAction(
  slug: string,
  cashId: string,
  payload: Record<string, unknown>,
) {
  const { session, item } = await requireEmployeeCashModule(slug);
  const result = await reviewEmployeeCash(session, item.module, cashId, payload);
  revalidatePath(`/modulos/${slug}`);
  return result;
}
