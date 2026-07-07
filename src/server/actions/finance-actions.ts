"use server";

import { requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  createFinancialEntry,
  createModuleFinancialEntry,
} from "@/server/services/finance-service";
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
