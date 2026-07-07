import { type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { getModuleReportSummary } from "@/server/services/module-report-service";

export const dynamic = "force-dynamic";

function esc(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Nao autenticado.", { status: 401 });
  }

  const { searchParams } = request.nextUrl;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  const rows = await getModuleReportSummary(
    session,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59`),
  );

  const header = ["Modulo", "Registros", "Total (R$)"].join(",");

  const csvRows = rows.map((row) =>
    [esc(row.title), row.count, row.total.toFixed(2).replace(".", ",")].join(","),
  );

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  csvRows.push(["Total geral", "", total.toFixed(2).replace(".", ",")].join(","));

  const bom = "﻿";
  const csv = bom + [header, ...csvRows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-modulos-${from}-a-${to}.csv"`,
    },
  });
}
