"use server";

import type { EntityType } from "@prisma/client";
import { z } from "zod";

import { hasModuleAccess, requireSession } from "@/lib/auth";
import { getModuleBySlug } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import {
  getClientPrefillData,
  getSlotClientMachines,
  listBxPrizeRecords,
  listModuleClientRecords,
  listModuleRecords,
  moduleSlugs,
  registerModuleClient,
  registerSlotClient,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import {
  listModuleReceipts,
  receiptModuleSlugs,
} from "@/server/services/module-receipt-service";

function assertSlugAccess(session: Awaited<ReturnType<typeof requireSession>>, slug: string) {
  if (!moduleSlugs.includes(slug as ModuleSlug)) {
    throw new Error("Modulo invalido.");
  }
  const item = getModuleBySlug(slug);
  if (!item || !hasModuleAccess(session, item.module)) {
    throw new Error("Sem permissao para este modulo.");
  }
}

const reviewSchema = z.object({
  status: z.enum(["CORRECTED", "CANCELLED"]),
  reason: z.string().trim().min(5, "Informe um motivo com pelo menos 5 caracteres.").max(300),
  correctedIncome: z.number().nonnegative().nullable().optional(),
  correctedExpense: z.number().nonnegative().nullable().optional(),
  correctedResult: z.number().nullable().optional(),
});

const reviewEntityType: Partial<Record<ModuleSlug, EntityType>> = {
  "carreta-kids": "CARRETA_KIDS",
  "locacao": "RENTAL",
  "maquinas-de-pelucia": "PLUSH_COLLECTION",
  "bilhar-pebolim": "BILLIARD_COLLECTION",
  bx: "BX_TRANSACTION",
  "h-caca-niquel": "SLOT_COLLECTION",
  "credito-financeiro": "MACHINE_CONTRACT",
  marketing: "MARKETING_CONTRACT",
};

export async function listModuleClientRecordsAction(
  slug: string,
  clientId: string,
  clientName: string,
) {
  const session = await requireSession();

  assertSlugAccess(session, slug);

  return listModuleClientRecords(session, slug as ModuleSlug, clientId, clientName);
}

export async function getClientPrefillDataAction(slug: string, id: string) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  return getClientPrefillData(session, slug as ModuleSlug, id);
}

export async function registerModuleClientAction(
  slug: string,
  payload: Record<string, unknown>,
) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  return registerModuleClient(session, slug as ModuleSlug, payload);
}

export async function listModuleRecordsAction(
  slug: string,
  from?: string,
  to?: string,
  take = 30,
) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  return listModuleRecords(session, slug as ModuleSlug, take, {
    from: from ? new Date(`${from}T00:00:00-03:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999-03:00`) : undefined,
  });
}

export async function listModuleReceiptsAction(slug: string) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  if (session.role === "STAFF") {
    throw new Error("Sem permissao para acessar valores de comprovantes.");
  }
  if (!receiptModuleSlugs.includes(slug as ModuleSlug)) return [];
  return listModuleReceipts(session, slug as ModuleSlug);
}

export async function reviewModuleOperationAction(
  slug: string,
  entityId: string,
  payload: unknown,
) {
  const session = await requireSession();
  assertSlugAccess(session, slug);
  if (session.role === "STAFF") {
    throw new Error("Somente o dono ou gestor pode corrigir uma operacao.");
  }

  const data = reviewSchema.parse(payload);
  const moduleSlug = slug as ModuleSlug;
  const moduleItem = getModuleBySlug(slug);
  if (!moduleItem) throw new Error("Modulo nao encontrado.");

  const record = (await listModuleRecords(session, moduleSlug, 5000)).find(
    (item) => item.id === entityId,
  );
  if (!record) throw new Error("Operacao nao encontrada neste modulo.");

  const previous = await prisma.moduleOperationReview.findUnique({
    where: {
      organizationId_slug_entityId: {
        organizationId: session.organizationId,
        slug,
        entityId,
      },
    },
  });

  const review = await prisma.$transaction(async (tx) => {
    const saved = await tx.moduleOperationReview.upsert({
      where: {
        organizationId_slug_entityId: {
          organizationId: session.organizationId,
          slug,
          entityId,
        },
      },
      create: {
        organizationId: session.organizationId,
        userId: session.userId,
        module: moduleItem.module,
        slug,
        entityId,
        status: data.status,
        reason: data.reason,
        correctedIncome: data.status === "CORRECTED" ? data.correctedIncome : null,
        correctedExpense: data.status === "CORRECTED" ? data.correctedExpense : null,
        correctedResult: data.status === "CORRECTED" ? data.correctedResult : null,
      },
      update: {
        userId: session.userId,
        module: moduleItem.module,
        status: data.status,
        reason: data.reason,
        correctedIncome: data.status === "CORRECTED" ? data.correctedIncome : null,
        correctedExpense: data.status === "CORRECTED" ? data.correctedExpense : null,
        correctedResult: data.status === "CORRECTED" ? data.correctedResult : null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module: moduleItem.module,
        action: data.status === "CANCELLED" ? "MODULE_OPERATION_CANCELLED" : "MODULE_OPERATION_CORRECTED",
        entityType: reviewEntityType[moduleSlug] ?? "OTHER",
        entityId,
        oldData: previous
          ? {
              status: previous.status,
              reason: previous.reason,
              correctedIncome: previous.correctedIncome?.toString() ?? null,
              correctedExpense: previous.correctedExpense?.toString() ?? null,
              correctedResult: previous.correctedResult?.toString() ?? null,
            }
          : undefined,
        newData: {
          status: data.status,
          reason: data.reason,
          correctedIncome: data.correctedIncome ?? null,
          correctedExpense: data.correctedExpense ?? null,
          correctedResult: data.correctedResult ?? null,
        },
      },
    });
    return saved;
  });

  return { id: review.id, status: review.status };
}

export async function listBxPrizeRecordsAction() {
  const session = await requireSession("BX");
  if (session.role === "STAFF") {
    throw new Error("Sem permissao para acessar valores de premios.");
  }
  return listBxPrizeRecords(session);
}

export async function registerSlotClientAction(payload: Record<string, unknown>) {
  const session = await requireSession("SLOT_H");
  return registerSlotClient(session, payload);
}

export async function getSlotClientMachinesAction(clientName: string) {
  const session = await requireSession("SLOT_H");
  return getSlotClientMachines(session, clientName);
}
