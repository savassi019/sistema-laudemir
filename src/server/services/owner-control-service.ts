import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { currentBusinessDate, currentBusinessDayRange } from "@/lib/business-date";
import { moduleCatalog } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/types/app";

export type OwnerException = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  count: number;
  href: string;
};

export type OwnerControlSnapshot = {
  businessDate: string;
  dayCloseStatus: "open" | "closed" | "reopened";
  watchdogStatus: "ok" | "degraded" | "stopped" | "unknown";
  auditActionsLastSevenDays: number;
  receiptsGeneratedToday: number;
  receiptsPendingShareToday: number;
  recentAudit: Array<{
    id: string;
    action: string;
    module: string;
    user: string;
    createdAt: string;
  }>;
  exceptions: OwnerException[];
};

const auditActionLabels: Record<string, string> = {
  CLIENT_CREATED: "Cliente cadastrado",
  MODULE_CLIENT_CREATED: "Cliente do módulo cadastrado",
  MODULE_OPERATION_CREATED: "Operação registrada",
  FINANCIAL_ENTRY_CREATED: "Lançamento financeiro criado",
  FINANCIAL_ENTRY_UPDATED: "Lançamento financeiro alterado",
  FINANCIAL_ENTRY_CANCELLED: "Lançamento financeiro cancelado",
  FINANCIAL_PAYMENT_REGISTERED: "Pagamento registrado",
  FINANCIAL_STATUS_UPDATED: "Situação financeira alterada",
  MODULE_OPERATION_CORRECTED: "Operação corrigida",
  MODULE_OPERATION_CANCELLED: "Operação cancelada",
  DAILY_CLOSE_COMPLETED: "Fechamento diário concluído",
  DAILY_CLOSE_REOPENED: "Fechamento diário reaberto",
};

function moduleLabel(module: string) {
  return moduleCatalog.find((item) => item.module === module)?.title ?? "Sistema";
}

function assertOwner(session: SessionData) {
  if (session.role !== "OWNER") {
    throw new Error("Somente o dono pode acessar a central de controle.");
  }
}

async function readWatchdogStatus(): Promise<OwnerControlSnapshot["watchdogStatus"]> {
  try {
    const raw = await readFile(join(process.cwd(), ".watchdog-status"), "utf8");
    const [state, timestamp] = raw.trim().split("|");
    const ageMinutes = timestamp
      ? (Date.now() - Number(timestamp) * 1000) / 60_000
      : Number.POSITIVE_INFINITY;

    if (!Number.isFinite(ageMinutes) || ageMinutes > 30) return "stopped";
    if (state === "ok") return "ok";
    if (state === "degradado") return "degraded";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function getOwnerControlSnapshot(
  session: SessionData,
): Promise<OwnerControlSnapshot> {
  assertOwner(session);

  const now = new Date();
  const businessDate = currentBusinessDate(now);
  const { from, to } = currentBusinessDayRange(now);
  const storedDate = new Date(`${businessDate}T12:00:00Z`);
  const staleSubmissionLimit = new Date(now.getTime() - 10 * 60_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [
    failedSubmissions,
    staleSubmissions,
    receiptEvents,
    dailyClose,
    auditActionsLastSevenDays,
    recentAuditRows,
    watchdogStatus,
  ] = await Promise.all([
    prisma.moduleSubmission.count({
      where: { organizationId: session.organizationId, status: "FAILED" },
    }),
    prisma.moduleSubmission.count({
      where: {
        organizationId: session.organizationId,
        status: "PROCESSING",
        updatedAt: { lt: staleSubmissionLimit },
      },
    }),
    prisma.receiptEvent.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: from, lte: to },
      },
      select: { slug: true, receiptId: true, event: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dailyClose.findUnique({
      where: {
        organizationId_businessDate: {
          organizationId: session.organizationId,
          businessDate: storedDate,
        },
      },
      select: { status: true },
    }),
    prisma.auditLog.count({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        action: true,
        module: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    readWatchdogStatus(),
  ]);

  const receipts = new Map<string, Set<string>>();
  for (const event of receiptEvents) {
    const key = `${event.slug}:${event.receiptId}`;
    const events = receipts.get(key) ?? new Set<string>();
    events.add(event.event);
    receipts.set(key, events);
  }
  const receiptsGeneratedToday = [...receipts.values()].filter((events) =>
    events.has("GENERATED"),
  ).length;
  const receiptsPendingShareToday = [...receipts.values()].filter(
    (events) =>
      events.has("GENERATED") &&
      !events.has("SHARED") &&
      !events.has("WHATSAPP_OPENED") &&
      !events.has("DOWNLOADED"),
  ).length;

  const dayCloseStatus =
    dailyClose?.status === "CLOSED"
      ? ("closed" as const)
      : dailyClose?.status === "REOPENED"
        ? ("reopened" as const)
        : ("open" as const);

  const exceptions: OwnerException[] = [];
  if (failedSubmissions > 0) {
    exceptions.push({
      id: "failed-submissions",
      level: "critical",
      title: "Envios com falha",
      detail: "Operações não confirmadas precisam ser conferidas antes de novo envio.",
      count: failedSubmissions,
      href: "/modulos",
    });
  }
  if (staleSubmissions > 0) {
    exceptions.push({
      id: "stale-submissions",
      level: "critical",
      title: "Envios presos",
      detail: "Operações estão aguardando confirmação há mais de 10 minutos.",
      count: staleSubmissions,
      href: "/modulos",
    });
  }
  if (receiptsPendingShareToday > 0) {
    exceptions.push({
      id: "pending-receipts",
      level: "warning",
      title: "Comprovantes sem saída registrada",
      detail: "Foram gerados hoje, mas ainda não há compartilhamento, WhatsApp ou download registrado.",
      count: receiptsPendingShareToday,
      href: "/modulos",
    });
  }
  if (dayCloseStatus !== "closed") {
    exceptions.push({
      id: "daily-close",
      level: dayCloseStatus === "reopened" ? "critical" : "warning",
      title: dayCloseStatus === "reopened" ? "Caixa do dia reaberto" : "Caixa do dia em aberto",
      detail: "Confira os valores e conclua o fechamento quando a operação terminar.",
      count: 1,
      href: "/financeiro",
    });
  }
  if (watchdogStatus !== "ok") {
    exceptions.push({
      id: "watchdog",
      level: "critical",
      title: watchdogStatus === "stopped" ? "Monitoramento parado" : "Proteção precisa de atenção",
      detail: "O vigia de banco, arquivos ou aplicação não confirmou estado saudável.",
      count: 1,
      href: "/painel",
    });
  }

  return {
    businessDate,
    dayCloseStatus,
    watchdogStatus,
    auditActionsLastSevenDays,
    receiptsGeneratedToday,
    receiptsPendingShareToday,
    recentAudit: recentAuditRows.map((row) => ({
      id: row.id,
      action: auditActionLabels[row.action] ?? "Alteração registrada",
      module: moduleLabel(row.module),
      user: row.user?.name ?? "Sistema",
      createdAt: row.createdAt.toISOString(),
    })),
    exceptions,
  };
}
