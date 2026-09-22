import { NextResponse } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { createClient, listClients } from "@/server/services/client-service";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!hasModuleAccess(session, "CLIENTS")) {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  return NextResponse.json(await listClients(session));
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!hasModuleAccess(session, "CLIENTS")) {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const result = await createClient(session, payload);

  return NextResponse.json(result, { status: 201 });
}
