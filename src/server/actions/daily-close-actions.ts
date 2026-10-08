"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth";
import { closeBusinessDay, reopenBusinessDay } from "@/server/services/daily-close-service";

export async function closeBusinessDayAction(payload: unknown) {
  const session = await requireSession("FINANCE");
  const id = await closeBusinessDay(session, payload);
  revalidatePath("/financeiro");
  revalidatePath("/painel");
  return id;
}

export async function reopenBusinessDayAction(payload: unknown) {
  const session = await requireSession("FINANCE");
  await reopenBusinessDay(session, payload);
  revalidatePath("/financeiro");
  revalidatePath("/painel");
}
