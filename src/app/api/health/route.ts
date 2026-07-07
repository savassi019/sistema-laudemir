import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const base = {
    app: env.appName,
    mode: env.demoMode ? "demo" : "database",
    timestamp: new Date().toISOString(),
  };

  if (env.demoMode) {
    return NextResponse.json({ ok: true, ...base, database: "skipped" });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ...base, database: "up" });
  } catch (error) {
    console.error("[health] banco de dados inacessivel:", error);
    return NextResponse.json(
      { ok: false, ...base, database: "down" },
      { status: 503 },
    );
  }
}
