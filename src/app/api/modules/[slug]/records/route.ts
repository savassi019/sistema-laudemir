import { NextResponse } from "next/server";

import { getSession, hasModuleAccess } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import {
  listModuleRecords,
  moduleSlugs,
  saveModuleRecord,
  type ModuleSlug,
} from "@/server/services/module-record-service";

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
  const take = Math.min(Number(url.searchParams.get("take") ?? 8), 30);
  const records = await listModuleRecords(session, slug, take);

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

  try {
    const result = await saveModuleRecord(session, slug, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(`[api/modules/${slug}/records] falha ao salvar:`, error);
    return NextResponse.json(
      { error: "Falha ao salvar. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
