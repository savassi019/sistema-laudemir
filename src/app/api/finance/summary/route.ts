import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getFinanceOverview } from "@/server/services/finance-service";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // Bloquear a pagina nao basta: sem isto o funcionario baixa o caixa
  // inteiro chamando a API direto.
  if (session.role === "STAFF") {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  return NextResponse.json(await getFinanceOverview(session));
}
