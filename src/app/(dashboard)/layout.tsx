import type { ReactNode } from "react";

import { AppShell } from "@/components/dashboard/app-shell";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return <AppShell session={session}>{children}</AppShell>;
}
