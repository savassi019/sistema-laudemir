import { NextResponse } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      module: "CLIENTS",
      action: "CLIENT_CREATED",
      entityType: "CLIENT",
      entityId: result.client.id,
      newData: {
        code: result.client.code,
        name: result.client.name,
        modules: result.client.modules ?? [],
      },
    },
  }).catch((error) => {
    console.error(`[audit] cliente ${result.client.id} salvo sem log:`, error);
  });

  return NextResponse.json(result, { status: 201 });
}
