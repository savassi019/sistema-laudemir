import { type NextRequest } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { buildPtBrCsv, formatCsvDecimal } from "@/lib/csv";
import { listVisitsInRange } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }
  if (session.role === "STAFF" || !hasModuleAccess(session, "REPORTS")) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { searchParams } = request.nextUrl;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  const visits = await listVisitsInRange(session, from, to);

  const header = [
    "Data",
    "Cliente",
    "Tipo",
    "Entrada (R$)",
    "Saída (R$)",
    "Líquido (R$)",
    "Checklist",
    "Observações",
    "Registrado por",
  ];

  const rows = visits.map((v) => {
    const income = v.incomeAmount;
    const expense = v.expenseAmount;
    return [
      fmtDate(v.occurredAt),
      v.clientName,
      v.visitType,
      formatCsvDecimal(income),
      formatCsvDecimal(expense),
      formatCsvDecimal(income - expense),
      v.checkedItems.join(" | "),
      v.notes ?? "",
      v.createdBy ?? "",
    ];
  });

  const csv = buildPtBrCsv([header, ...rows]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visitas-${from}-a-${to}.csv"`,
    },
  });
}
