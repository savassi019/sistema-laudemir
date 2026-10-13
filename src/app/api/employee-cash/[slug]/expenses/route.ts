import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  createEmployeeExpenseIdempotently,
  EMPLOYEE_CASH_MODULES,
  EmployeeExpenseAlreadyReceivedError,
} from "@/server/services/employee-cash-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { slug } = await context.params;
  const item = getModuleBySlug(slug);
  // ASVS V8.2/V8.4: escopo do tenant e permissao do modulo derivam da sessao.
  if (!item || !EMPLOYEE_CASH_MODULES.has(item.module)) {
    return NextResponse.json({ error: "Módulo não suportado." }, { status: 404 });
  }
  if (!hasModuleAccess(session, item.module)) {
    return NextResponse.json({ error: "Sem permissão para este módulo." }, { status: 403 });
  }

  const requestKey = request.headers.get("x-idempotency-key");
  if (!requestKey || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) {
    return NextResponse.json(
      { error: "Identificador seguro do envio não informado." },
      { status: 400 },
    );
  }

  try {
    const payload: unknown = await request.json();
    const result = await createEmployeeExpenseIdempotently(
      session,
      item.module,
      slug,
      payload,
      requestKey,
    );
    return NextResponse.json({ expense: result }, { status: 201 });
  } catch (error) {
    if (error instanceof EmployeeExpenseAlreadyReceivedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Confira os dados informados." },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    }

    const safeBusinessError =
      error instanceof Error &&
      /^(O comprovante|Este comprovante|Este caixa|O caixa|Não é permitido|Sem permissão)/.test(error.message);
    if (safeBusinessError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error(`[api/employee-cash/${slug}/expenses] falha ao salvar:`, error);
    return NextResponse.json(
      { error: "Não foi possível salvar o gasto. Tente novamente." },
      { status: 500 },
    );
  }
}
