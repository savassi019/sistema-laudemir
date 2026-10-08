import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertBusinessDayOpen } from "@/server/services/daily-close-service";
import {
  saveSlotVisit,
  SlotVisitConflictError,
} from "@/server/services/module-record-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!hasModuleAccess(session, "SLOT_H")) {
    return NextResponse.json({ error: "Sem permissao para este modulo." }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dados da visita invalidos." }, { status: 400 });
  }

  try {
    await assertBusinessDayOpen(
      session,
      typeof payload.occurredAt === "string" ? payload.occurredAt : null,
    );
    const result = await saveSlotVisit(session, payload);
    if (!result.duplicate) {
      await prisma.$transaction([
        prisma.auditLog.create({
          data: {
            organizationId: session.organizationId,
            userId: session.userId,
            module: "SLOT_H",
            action: "MODULE_OPERATION_CREATED",
            entityType: "SLOT_COLLECTION",
            entityId: result.visitKey,
            newData: {
              slug: "h-caca-niquel",
              clientName: result.clientName,
              machineCount: result.results.length,
            },
          },
        }),
        prisma.receiptEvent.create({
          data: {
            organizationId: session.organizationId,
            userId: session.userId,
            module: "SLOT_H",
            slug: "h-caca-niquel",
            receiptId: result.visitKey,
            event: "GENERATED",
          },
        }),
      ]).catch((auditError) => {
        console.error(`[audit] fechamento H ${result.visitKey} salvo sem eventos:`, auditError);
      });
    }
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Confira os dados da visita." },
        { status: 400 },
      );
    }
    if (error instanceof SlotVisitConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("caixa deste dia já foi fechado")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[api/modules/h-caca-niquel/visits] falha ao salvar:", error);
    return NextResponse.json(
      { error: "Nao foi possivel salvar a visita. Nenhuma maquina foi alterada." },
      { status: 500 },
    );
  }
}
