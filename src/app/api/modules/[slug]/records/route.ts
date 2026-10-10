import { NextResponse } from "next/server";
import type { EntityType, Prisma, SystemModule } from "@prisma/client";
import { z } from "zod";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import { assertBusinessDayOpen } from "@/server/services/daily-close-service";
import {
  listModuleRecords,
  ModuleRecordValidationError,
  moduleSlugs,
  saveModuleRecord,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import type { SessionData } from "@/types/app";

type SaveResult = Awaited<ReturnType<typeof saveModuleRecord>>;
type PendingSave = { expiresAt: number; promise: Promise<SaveResult> };

const globalForIdempotency = globalThis as unknown as {
  modulePendingSaves?: Map<string, PendingSave>;
};
const pendingSaves = globalForIdempotency.modulePendingSaves ?? new Map<string, PendingSave>();
globalForIdempotency.modulePendingSaves = pendingSaves;

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

class SubmissionAlreadyReceivedError extends Error {}

const operationEntityType: Partial<Record<ModuleSlug, EntityType>> = {
  "carreta-kids": "CARRETA_KIDS",
  locacao: "RENTAL",
  "maquinas-de-pelucia": "PLUSH_COLLECTION",
  "bilhar-pebolim": "BILLIARD_COLLECTION",
  bx: "BX_TRANSACTION",
  "h-caca-niquel": "SLOT_COLLECTION",
  "credito-financeiro": "MACHINE_CONTRACT",
  marketing: "MARKETING_CONTRACT",
};
const receiptSlugs = new Set<ModuleSlug>([
  "bilhar-pebolim",
  "bx",
  "h-caca-niquel",
  "carreta-kids",
  "maquinas-de-pelucia",
  "locacao",
]);

function operationDate(payload: Record<string, unknown>) {
  for (const key of ["occurredAt", "collectionDate", "serviceDate", "eventDate", "movementDate", "contractDate", "dueDate"]) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

async function recordOperationAudit(
  session: SessionData,
  module: SystemModule,
  slug: ModuleSlug,
  result: SaveResult,
  payload: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      module,
      action: "MODULE_OPERATION_CREATED",
      entityType: operationEntityType[slug] ?? "OTHER",
      entityId: result.record.id,
      newData: {
        slug,
        title: result.record.title,
        summary: result.record.summary,
        payload,
      } as Prisma.InputJsonValue,
    },
  }).catch((error) => {
    // A operacao principal ja esta persistida. Falha de auditoria deve gerar
    // alerta tecnico, nunca induzir um reenvio que duplicaria o fechamento.
    console.error(`[audit] operacao ${slug}/${result.record.id} salva sem log:`, error);
  });
  if (receiptSlugs.has(slug)) {
    await prisma.receiptEvent.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        slug,
        receiptId: result.record.id,
        event: "GENERATED",
      },
    }).catch((error) => {
      console.error(`[receipt] comprovante ${slug}/${result.record.id} gerado sem evento:`, error);
    });
  }
}

async function savePersistently(
  session: SessionData,
  module: SystemModule,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
  requestKey: string,
): Promise<SaveResult> {
  const unique = {
    organizationId: session.organizationId,
    userId: session.userId,
    slug,
    requestKey,
  };
  const where = { organizationId_userId_slug_requestKey: unique };
  let submission = await prisma.moduleSubmission.findUnique({ where });

  if (submission?.status === "SUCCEEDED" && submission.response) {
    return submission.response as unknown as SaveResult;
  }
  if (submission?.status === "PROCESSING") {
    throw new SubmissionAlreadyReceivedError(
      "Este envio já foi recebido e está sendo conferido. Consulte o histórico antes de tentar novamente.",
    );
  }

  if (submission?.status === "FAILED") {
    submission = await prisma.moduleSubmission.update({
      where: { id: submission.id },
      data: { status: "PROCESSING", lastError: null },
    });
  } else if (!submission) {
    try {
      submission = await prisma.moduleSubmission.create({
        data: { ...unique, module, status: "PROCESSING" },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const concurrent = await prisma.moduleSubmission.findUnique({ where });
      if (concurrent?.status === "SUCCEEDED" && concurrent.response) {
        return concurrent.response as unknown as SaveResult;
      }
      throw new SubmissionAlreadyReceivedError(
        "Este envio já foi recebido e está sendo conferido. Consulte o histórico antes de tentar novamente.",
      );
    }
  }

  let result: SaveResult;
  try {
    result = await saveModuleRecord(session, slug, payload);
    await recordOperationAudit(session, module, slug, result, payload);
  } catch (error) {
    await prisma.moduleSubmission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida",
      },
    }).catch(() => {});
    throw error;
  }

  // Depois que a operacao real foi gravada, nunca voltamos o marcador para
  // FAILED: uma falha apenas nesta confirmacao poderia permitir uma segunda
  // gravacao no reenvio. PROCESSING e o estado seguro para esse caso raro.
  try {
    await prisma.moduleSubmission.update({
      where: { id: submission.id },
      data: {
        status: "SUCCEEDED",
        response: result as unknown as Prisma.InputJsonValue,
        lastError: null,
      },
    });
  } catch (error) {
    console.error("[module-submission] operacao salva, mas confirmacao da chave falhou:", error);
  }
  return result;
}

function saveIdempotently(
  session: SessionData,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
  requestKey: string | null,
  module: SystemModule,
) {
  if (!requestKey) {
    return saveModuleRecord(session, slug, payload).then(async (result) => {
      await recordOperationAudit(session, module, slug, result, payload);
      return result;
    });
  }

  const now = Date.now();
  for (const [key, value] of pendingSaves) {
    if (value.expiresAt <= now) pendingSaves.delete(key);
  }

  const cacheKey = `${session.organizationId}:${session.userId}:${slug}:${requestKey}`;
  const existing = pendingSaves.get(cacheKey);
  if (existing && existing.expiresAt > now) return existing.promise;

  const promise = savePersistently(session, module, slug, payload, requestKey).catch((error) => {
    pendingSaves.delete(cacheKey);
    throw error;
  });
  pendingSaves.set(cacheKey, { expiresAt: now + IDEMPOTENCY_TTL_MS, promise });
  return promise;
}

function isModuleSlug(value: string): value is ModuleSlug {
  return moduleSlugs.includes(value as ModuleSlug);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { slug } = await context.params;

  if (!isModuleSlug(slug)) {
    return NextResponse.json({ error: "Modulo nao suportado." }, { status: 404 });
  }

  const catalogItem = getModuleBySlug(slug);
  if (catalogItem && !hasModuleAccess(session, catalogItem.module)) {
    return NextResponse.json({ error: "Sem permissao para este modulo." }, { status: 403 });
  }

  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 8), 50);
  const fromParam = url.searchParams.get("from");
  const toParam   = url.searchParams.get("to");
  const range = {
    from: fromParam ? new Date(fromParam) : undefined,
    to:   toParam   ? new Date(toParam)   : undefined,
  };
  const records = await listModuleRecords(session, slug, take, range);

  return NextResponse.json({ records });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { slug } = await context.params;

  if (!isModuleSlug(slug)) {
    return NextResponse.json({ error: "Modulo nao suportado." }, { status: 404 });
  }

  const catalogItem = getModuleBySlug(slug);
  if (catalogItem && !hasModuleAccess(session, catalogItem.module)) {
    return NextResponse.json({ error: "Sem permissao para este modulo." }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rawRequestKey = request.headers.get("x-idempotency-key");
    const requestKey =
      rawRequestKey && /^[a-zA-Z0-9-]{16,80}$/.test(rawRequestKey) ? rawRequestKey : null;
    await assertBusinessDayOpen(session, operationDate(payload));
    const result = await saveIdempotently(
      session,
      slug,
      payload,
      requestKey,
      catalogItem?.module ?? "CORE",
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SubmissionAlreadyReceivedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Envio invalido. Confira os dados informados." }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Confira os campos informados." },
        { status: 400 },
      );
    }
    if (error instanceof ModuleRecordValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("caixa deste dia já foi fechado")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(`[api/modules/${slug}/records] falha ao salvar:`, error);
    return NextResponse.json(
      { error: "Falha ao salvar. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
