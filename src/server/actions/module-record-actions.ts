"use server";

import { requireSession } from "@/lib/auth";
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

export async function listModuleClientRecordsAction(
  slug: string,
  clientId: string,
  clientName: string,
) {
  const session = await requireSession();

  if (!moduleSlugs.includes(slug as ModuleSlug)) {
    throw new Error("Modulo invalido.");
  }

  return listModuleClientRecords(session, slug as ModuleSlug, clientId, clientName);
}

export async function getClientPrefillDataAction(slug: string, id: string) {
  const session = await requireSession();
  if (!moduleSlugs.includes(slug as ModuleSlug)) throw new Error("Modulo invalido.");
  return getClientPrefillData(session, slug as ModuleSlug, id);
}

export async function listModuleRecordsAction(
  slug: string,
  from?: string,
  to?: string,
  take = 30,
) {
  const session = await requireSession();
  if (!moduleSlugs.includes(slug as ModuleSlug)) throw new Error("Modulo invalido.");
  return listModuleRecords(session, slug as ModuleSlug, take, {
    from: from ? new Date(from) : undefined,
    to:   to   ? new Date(to)   : undefined,
  });
}

export async function listBxPrizeRecordsAction() {
  const session = await requireSession();
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
