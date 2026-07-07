import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrgUploadDir, sanitizeFileName, validateUpload } from "@/lib/storage";

const ALLOWED_CATEGORIES = new Set([
  "CLIENT_DOCUMENT",
  "PROOF",
  "PHOTO",
  "CONTRACT",
  "GUARANTEE",
  "RECEIPT",
  "OTHER",
]);

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const categoryInput = String(formData.get("category") ?? "OTHER");
  const category = ALLOWED_CATEGORIES.has(categoryInput) ? categoryInput : "OTHER";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo nao informado." }, { status: 400 });
  }

  const validationError = validateUpload(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const dir = await ensureOrgUploadDir(session.organizationId);
  const fileName = `${randomUUID()}-${sanitizeFileName(file.name || "arquivo")}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await writeFile(path.join(dir, fileName), buffer);

    const asset = await prisma.fileAsset.create({
      data: {
        organizationId: session.organizationId,
        uploadedById: session.userId,
        category: category as never,
        originalName: file.name,
        fileName,
        mimeType: file.type,
        size: file.size,
        storagePath: `${session.organizationId}/${fileName}`,
      },
    });

    return NextResponse.json({ id: asset.id, fileName: asset.originalName }, { status: 201 });
  } catch (error) {
    console.error("[upload] falha ao salvar arquivo:", error);
    return NextResponse.json({ error: "Falha ao salvar o arquivo." }, { status: 500 });
  }
}
