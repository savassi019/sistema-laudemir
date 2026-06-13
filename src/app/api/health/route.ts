import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: env.appName,
    mode: env.demoMode ? "demo" : "database",
    timestamp: new Date().toISOString(),
  });
}
