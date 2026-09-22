"use server";

import { hasModuleAccess, requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  cancelModuleFinancialEntry,
  createFinancialEntry,
  createModuleFinancialEntry,
  listModuleFinancialAudit,
  listModuleFinancialEntries,
  registerModuleFinancialPayment,
  updateModuleFinancialEntry,
  updateModuleFinancialEntryStatus,
} from "@/server/services/finance-service";
import { moduleSlugs, type ModuleSlug } from "@/server/services/module-record-service";
import type { FinanceEntryListItem } from "@/types/app";

function assertFinancialAccess(role: string) {
  if (role === "STAFF") throw new Error("Sem permissao para acessar valores financeiros.");
}

function parsePeriodDate(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}-03:00`);
}

async function requireModuleFinancialAccess(slug: string) {
  const session = await requireSession();
  assertFinancialAccess(session.role);
  const moduleItem = getModuleBySlug(slug);

  if (!moduleItem) {
    throw new Error("Modulo nao encontrado.");
  }
  if (!hasModuleAccess(session, moduleItem.module)) {
    throw new Error("Sem permissao para este modulo.");
  }

  return { session, moduleItem };
}

export async function createFinancialEntryAction(
  payload: Record<string, unknown>,
): Promise<FinanceEntryListItem> {
  const session = await requireSession("FINANCE");
  assertFinancialAccess(session.role);
  return createFinancialEntry(session, payload);
}

export async function createModuleFinancialEntryAction(
  slug: string,
  payload: Record<string, unknown>,
) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);

  return createModuleFinancialEntry(session, moduleItem.module, payload);
}

export async function listModuleFinancialEntriesAction(
  slug: string,
  from?: string,
  to?: string,
) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);

  return listModuleFinancialEntries(
    session,
    moduleItem.module,
    moduleSlugs.includes(slug as ModuleSlug) ? (slug as ModuleSlug) : null,
    {
      from: from ? parsePeriodDate(from) : undefined,
      to: to ? parsePeriodDate(to, true) : undefined,
    },
  );
}

export async function listModuleFinancialAuditAction(slug: string) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);
  return listModuleFinancialAudit(session, moduleItem.module);
}

export async function updateModuleFinancialEntryStatusAction(
  slug: string,
  id: string,
  status: "PENDING" | "PARTIAL" | "PAID",
) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);
  return updateModuleFinancialEntryStatus(session, moduleItem.module, id, status);
}

export async function registerModuleFinancialPaymentAction(
  slug: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);
  return registerModuleFinancialPayment(session, moduleItem.module, id, payload);
}

export async function updateModuleFinancialEntryAction(
  slug: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);
  return updateModuleFinancialEntry(session, moduleItem.module, id, payload);
}

export async function cancelModuleFinancialEntryAction(slug: string, id: string) {
  const { session, moduleItem } = await requireModuleFinancialAccess(slug);
  return cancelModuleFinancialEntry(session, moduleItem.module, id);
}
