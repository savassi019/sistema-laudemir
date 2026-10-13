import { type NextRequest } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { buildPtBrCsv, formatCsvDecimal } from "@/lib/csv";
import { getModuleReportSummary } from "@/server/services/module-report-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Nao autenticado.", { status: 401 });
  }

  // Mesmo motivo do /api/finance/summary: sem isto o CSV com os valores
  // sai pela API mesmo com a pagina de relatorio bloqueada.
  if (session.role === "STAFF" || !hasModuleAccess(session, "REPORTS")) {
    return new Response("Sem permissao.", { status: 403 });
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

  const header = ["Módulo", "Registros", "Total (R$)"];

  const csvRows: Array<Array<string | number>> = rows.map((row) => [
    row.title,
    row.count,
    formatCsvDecimal(row.total),
  ]);

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  csvRows.push(["Total geral", "", formatCsvDecimal(total)]);

  const csv = buildPtBrCsv([header, ...csvRows]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-modulos-${from}-a-${to}.csv"`,
    },
  });
}
