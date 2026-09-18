"use server";

import { requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  createFinancialEntry,
  createModuleFinancialEntry,
  listModuleFinancialEntries,
  updateModuleFinancialEntryStatus,
} from "@/server/services/finance-service";
import { moduleSlugs, type ModuleSlug } from "@/server/services/module-record-service";
import type { FinanceEntryListItem } from "@/types/app";

export async function createFinancialEntryAction(
  payload: Record<string, unknown>,
): Promise<FinanceEntryListItem> {
  const session = await requireSession();
  return createFinancialEntry(session, payload);
}

export async function createModuleFinancialEntryAction(
  slug: string,
  payload: Record<string, unknown>,
) {
  const session = await requireSession();
  const moduleItem = getModuleBySlug(slug);

  if (!moduleItem) {
    throw new Error("Modulo nao encontrado.");
  }

  return createModuleFinancialEntry(session, moduleItem.module, payload);
}

export async function listModuleFinancialEntriesAction(
  slug: string,
  from?: string,
  to?: string,
) {
  const session = await requireSession();
  const moduleItem = getModuleBySlug(slug);

  if (!moduleItem) {
    throw new Error("Modulo nao encontrado.");
  }

  return listModuleFinancialEntries(
    session,
    moduleItem.module,
    moduleSlugs.includes(slug as ModuleSlug) ? (slug as ModuleSlug) : null,
    { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
  );
}

export async function updateModuleFinancialEntryStatusAction(
  id: string,
  status: "PENDING" | "PARTIAL" | "PAID",
) {
  const session = await requireSession();
  return updateModuleFinancialEntryStatus(session, id, status);
}
