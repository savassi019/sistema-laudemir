import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * Veredito do vigia da VPS (watchdog.sh), publicado aqui de forma grosseira
 * — so "ok" ou "degradado", sem dizer o que quebrou. Detalhe ficaria exposto
 * publicamente; o suficiente e o monitor externo saber que precisa avisar.
 */
async function lerVigia(): Promise<{ estado: string; desde?: string }> {
  try {
    const bruto = await readFile(join(process.cwd(), ".watchdog-status"), "utf8");
    const [estado, quando] = bruto.trim().split("|");
    if (estado !== "ok" && estado !== "degradado") return { estado: "desconhecido" };

    // Vigia parado ha muito tempo tambem e problema: o cron pode ter morrido.
    if (quando) {
      const idadeMin = (Date.now() - Number(quando) * 1000) / 60000;
      if (Number.isFinite(idadeMin) && idadeMin > 30) return { estado: "parado", desde: quando };
    }
    return { estado, desde: quando };
  } catch {
    return { estado: "desconhecido" };
  }
}

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
    const vigia = await lerVigia();
    return NextResponse.json({ ok: true, ...base, database: "up", checks: vigia.estado });
  } catch (error) {
    console.error("[health] banco de dados inacessivel:", error);
    return NextResponse.json(
      { ok: false, ...base, database: "down", checks: "degradado" },
      { status: 503 },
    );
  }
}
