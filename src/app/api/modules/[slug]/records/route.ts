import { NextResponse } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
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

function saveIdempotently(
  session: SessionData,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
  requestKey: string | null,
) {
  if (!requestKey) return saveModuleRecord(session, slug, payload);

  const now = Date.now();
  for (const [key, value] of pendingSaves) {
    if (value.expiresAt <= now) pendingSaves.delete(key);
  }

  const cacheKey = `${session.organizationId}:${session.userId}:${slug}:${requestKey}`;
  const existing = pendingSaves.get(cacheKey);
  if (existing && existing.expiresAt > now) return existing.promise;

  const promise = saveModuleRecord(session, slug, payload).catch((error) => {
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
    const result = await saveIdempotently(session, slug, payload, requestKey);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(`[api/modules/${slug}/records] falha ao salvar:`, error);
    return NextResponse.json(
      { error: "Falha ao salvar. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
