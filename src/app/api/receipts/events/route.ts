import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  slug: z.string().min(1).max(80),
  receiptId: z.string().min(1).max(120),
  event: z.enum(["SHARED", "DOWNLOADED", "WHATSAPP_OPENED"]),
  phone: z.string().max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Evento inválido." }, { status: 400 });

  const moduleItem = getModuleBySlug(parsed.data.slug);
  if (!moduleItem || !hasModuleAccess(session, moduleItem.module)) {
    return Response.json({ error: "Sem permissão para este módulo." }, { status: 403 });
  }

  const event = await prisma.receiptEvent.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      module: moduleItem.module,
      slug: parsed.data.slug,
      receiptId: parsed.data.receiptId,
      event: parsed.data.event,
      phone: parsed.data.phone?.replace(/[^0-9+]/g, "") || null,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return Response.json({ id: event.id }, { status: 201 });
}
