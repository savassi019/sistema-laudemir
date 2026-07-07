"use server";

import { requireSession } from "@/lib/auth";
import { getContactPhones, setContactPhones } from "@/server/services/settings-service";

export async function getContactPhonesAction() {
  const session = await requireSession();
  return getContactPhones(session);
}

export async function setContactPhonesAction(data: { ownerPhone: string; staffPhone: string }) {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new Error("Sem permissão.");
  }
  return setContactPhones(session, data);
}
