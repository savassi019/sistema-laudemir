"use server";

import { requireSession } from "@/lib/auth";
import {
  listModuleClientRecords,
  moduleSlugs,
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
