import { readFile } from "fs/promises";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.fileAsset.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!asset) {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }

  try {
    const buffer = await readFile(resolveStoragePath(asset.storagePath));

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
        "Cache-Control": "private, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("[files] falha ao ler arquivo do disco:", error);
    return NextResponse.json({ error: "Arquivo indisponivel." }, { status: 404 });
  }
}
