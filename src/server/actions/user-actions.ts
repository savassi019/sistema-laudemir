"use server";

import { requireSession } from "@/lib/auth";
import { createStaff } from "@/server/services/user-service";
import type { ModuleName, StaffMember } from "@/types/app";

export async function createStaffAction(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "STAFF" | "ADMIN";
  modules: ModuleName[];
}): Promise<StaffMember> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new Error("Sem permissão.");
  }
  return createStaff(session, data);
}
