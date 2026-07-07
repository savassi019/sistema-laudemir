"use server";

import { requireSession } from "@/lib/auth";
import { markReminderDone } from "@/server/services/dashboard-service";

export async function markReminderDoneAction(reminderId: string): Promise<void> {
  const session = await requireSession();
  await markReminderDone(session, reminderId);
}
