"use server";

import { requireSession } from "@/lib/auth";
import { deleteVisit, saveVisit, updateVisit } from "@/server/services/visit-service";
import type { VisitRecord } from "@/types/app";

export async function saveVisitAction(
  data: Omit<VisitRecord, "id" | "createdAt">,
): Promise<VisitRecord> {
  const session = await requireSession();
  return saveVisit(session, { ...data, createdBy: data.createdBy ?? session.name });
}

export async function updateVisitAction(
  visitId: string,
  data: Pick<VisitRecord, "visitType" | "occurredAt" | "incomeAmount" | "expenseAmount" | "notes">,
): Promise<VisitRecord | null> {
  const session = await requireSession();
  return updateVisit(session, visitId, data);
}

export async function deleteVisitAction(visitId: string): Promise<boolean> {
  const session = await requireSession();
  return deleteVisit(session, visitId);
}
