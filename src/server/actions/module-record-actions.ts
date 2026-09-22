"use server";

import { hasModuleAccess, requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  getClientPrefillData,
  getSlotClientMachines,
  listBxPrizeRecords,
  listModuleClientRecords,
  listModuleRecords,
  moduleSlugs,
  registerSlotClient,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import {
  listModuleReceipts,
  receiptModuleSlugs,
} from "@/server/services/module-receipt-service";

function assertSlugAccess(session: Awaited<ReturnType<typeof requireSession>>, slug: string) {
  if (!moduleSlugs.includes(slug as ModuleSlug)) {
    throw new Error("Modulo invalido.");
  }
  const item = getModuleBySlug(slug);
  if (!item || !hasModuleAccess(session, item.module)) {
    throw new Error("Sem permissao para este modulo.");
  }
}

export async function listModuleClientRecordsAction(
  slug: string,
  clientId: string,
  clientName: string,
) {
  const session = await requireSession();

  assertSlugAccess(session, slug);

  return listModuleClientRecords(session, slug as ModuleSlug, clientId, clientName);
}

export async function getClientPrefillDataAction(slug: string, id: string) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  return getClientPrefillData(session, slug as ModuleSlug, id);
}

export async function listModuleRecordsAction(
  slug: string,
  from?: string,
  to?: string,
  take = 30,
) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  return listModuleRecords(session, slug as ModuleSlug, take, {
    from: from ? new Date(from) : undefined,
    to:   to   ? new Date(to)   : undefined,
  });
}

export async function listModuleReceiptsAction(slug: string) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  if (!receiptModuleSlugs.includes(slug as ModuleSlug)) return [];
  return listModuleReceipts(session, slug as ModuleSlug);
}

export async function listBxPrizeRecordsAction() {
  const session = await requireSession("BX");
  return listBxPrizeRecords(session);
}

export async function registerSlotClientAction(payload: Record<string, unknown>) {
  const session = await requireSession("SLOT_H");
  return registerSlotClient(session, payload);
}

export async function getSlotClientMachinesAction(clientName: string) {
  const session = await requireSession("SLOT_H");
  return getSlotClientMachines(session, clientName);
}
