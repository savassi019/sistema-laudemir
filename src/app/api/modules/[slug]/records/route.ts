import { NextResponse } from "next/server";
import type { Prisma, SystemModule } from "@prisma/client";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import {
  listModuleRecords,
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
  if (!requestKey) return saveModuleRecord(session, slug, payload);

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

  const payload = (await request.json()) as Record<string, unknown>;
  const rawRequestKey = request.headers.get("x-idempotency-key");
  const requestKey =
    rawRequestKey && /^[a-zA-Z0-9-]{16,80}$/.test(rawRequestKey) ? rawRequestKey : null;

  try {
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
    console.error(`[api/modules/${slug}/records] falha ao salvar:`, error);
    return NextResponse.json(
      { error: "Falha ao salvar. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
