"use server";

import { requireSession } from "@/lib/auth";
import {
  getClientPrefillData,
  listModuleClientRecords,
  moduleSlugs,
  type ClientPrefillData,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import { getModuleReport } from "@/server/services/module-report-service";

export type { ClientPrefillData };

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

export async function getModuleReportAction(slug: string, from?: string, to?: string) {
  const session = await requireSession();

  if (!moduleSlugs.includes(slug as ModuleSlug)) {
    throw new Error("Módulo inválido.");
  }

  return getModuleReport(
    session,
    slug as ModuleSlug,
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
  );
}
