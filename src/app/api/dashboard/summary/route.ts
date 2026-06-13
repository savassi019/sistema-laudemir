import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getDashboardOverview } from "@/server/services/dashboard-service";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  return NextResponse.json(await getDashboardOverview());
}
