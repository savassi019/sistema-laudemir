import { type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { listVisitsInRange } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

function esc(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
    "Saida (R$)",
    "Liquido (R$)",
    "Checklist",
    "Observacoes",
    "Registrado por",
  ].join(",");

  const rows = visits.map((v) => {
    const income = v.incomeAmount;
    const expense = v.expenseAmount;
    return [
      esc(fmtDate(v.occurredAt)),
      esc(v.clientName),
      esc(v.visitType),
      income.toFixed(2).replace(".", ","),
      expense.toFixed(2).replace(".", ","),
      (income - expense).toFixed(2).replace(".", ","),
      esc(v.checkedItems.join(" | ")),
      esc(v.notes ?? ""),
      esc(v.createdBy ?? ""),
    ].join(",");
  });

  const bom = "﻿";
  const csv = bom + [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visitas-${from}-a-${to}.csv"`,
    },
  });
}
