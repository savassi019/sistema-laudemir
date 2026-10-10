import type { Prisma, SystemModule } from "@prisma/client";

import { auditActionLabel, auditModuleLabel } from "@/lib/audit-labels";
import { formatCurrency } from "@/lib/format";
import { moduleCatalog } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/types/app";

const PAGE_SIZE = 50;
const allowedModules = new Set([
  "CORE",
  "CLIENTS",
  "FINANCE",
  "SETTINGS",
  ...moduleCatalog.map((item) => item.module),
]);

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : null;
}

function roleLabel(value: unknown) {
  if (value === "OWNER") return "Dono";
  if (value === "ADMIN") return "Gestor";
  if (value === "STAFF") return "Funcionário";
  return null;
}

function statusLabel(value: unknown) {
  if (value === "ACTIVE") return "Ativo";
  if (value === "INACTIVE") return "Inativo";
  if (value === "PAID") return "Pago";
  if (value === "PARTIAL") return "Parcial";
  if (value === "PENDING") return "Pendente";
  if (value === "CANCELLED") return "Cancelado";
  if (value === "CLOSED") return "Fechado";
  if (value === "REOPENED") return "Reaberto";
  return null;
}

function auditDetails(
  action: string,
  oldData: Prisma.JsonValue | null,
  newData: Prisma.JsonValue | null,
) {
  const before = asRecord(oldData);
  const after = asRecord(newData);

  if (action === "USER_PASSWORD_RESET") {
    return "Senha redefinida; o valor da senha não é armazenado no histórico.";
  }
  if (action === "CONTACT_PHONES_UPDATED") return "Contatos de WhatsApp atualizados.";
  if (action === "USER_CREATED" || action === "USER_UPDATED") {
    const name = String(after.name ?? before.name ?? "Usuário");
    const role = roleLabel(after.role ?? before.role);
    const modules = Array.isArray(after.modules) ? after.modules.length : null;
    return [name, role, modules !== null ? `${modules} modulo(s) liberado(s)` : null]
      .filter(Boolean)
      .join(" · ");
  }
  if (action === "USER_STATUS_CHANGED") {
    return `Situação: ${statusLabel(before.status) ?? "anterior"} para ${statusLabel(after.status) ?? "nova"}.`;
  }
  if (action.startsWith("FINANCIAL_")) {
    const value = asMoney(after.amount ?? after.totalAmount);
    const situation = statusLabel(after.status);
    return [value ? `Valor ${value}` : null, situation ? `Situação ${situation}` : null]
      .filter(Boolean)
      .join(" · ") || "Alteração financeira registrada com os valores anteriores preservados.";
  }
  if (action.startsWith("VISIT_")) {
    const client = String(after.clientName ?? before.clientName ?? "").trim();
    const occurredAt = String(after.occurredAt ?? before.occurredAt ?? "").slice(0, 10);
    return [client || null, occurredAt ? `Data ${occurredAt.split("-").reverse().join("/")}` : null]
      .filter(Boolean)
      .join(" · ") || "Alteração da visita registrada.";
  }
  if (action === "DAILY_CLOSE_REOPENED") {
    return `Motivo: ${String(after.reason ?? "nao informado")}`;
  }
  if (action === "DAILY_CLOSE_COMPLETED") {
    return `Data ${String(after.businessDate ?? "").split("-").reverse().join("/")}`;
  }
  if (action.endsWith("CORRECTED") || action.endsWith("CANCELLED")) {
    const reason = after.reason ?? after.reviewReason;
    return reason ? `Motivo: ${String(reason)}` : "Revisão registrada sem apagar o original.";
  }
  return "Registro anterior e novo preservados para conferencia.";
}

export type AuditTrailItem = {
  id: string;
  action: string;
  module: string;
  entityId: string;
  user: string;
  details: string;
  createdAt: string;
};

export async function listAuditTrail(
  session: SessionData,
  filters: {
    from?: string;
    to?: string;
    module?: string;
    user?: string;
    page?: number;
  } = {},
) {
  if (session.role !== "OWNER") {
    throw new Error("Somente o dono pode acessar o historico completo.");
  }

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const moduleFilter = filters.module && allowedModules.has(filters.module)
    ? (filters.module as SystemModule)
    : undefined;
  const where: Prisma.AuditLogWhereInput = {
    organizationId: session.organizationId,
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(filters.user?.trim()
      ? { user: { name: { contains: filters.user.trim(), mode: "insensitive" } } }
      : {}),
    ...((filters.from || filters.to)
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00-03:00`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999-03:00`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map<AuditTrailItem>((row) => ({
      id: row.id,
      action: auditActionLabel(row.action),
      module: auditModuleLabel(row.module),
      entityId: row.entityId,
      user: row.user?.name ?? "Sistema",
      details: auditDetails(row.action, row.oldData, row.newData),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
