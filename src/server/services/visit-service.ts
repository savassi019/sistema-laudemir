import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import type { ClientListItem, ClientVisitSummary, SessionData, VisitRecord } from "@/types/app";

const globalForVisits = globalThis as unknown as {
  localVisitStore?: Map<string, VisitRecord[]>;
};
const localVisitStore =
  globalForVisits.localVisitStore ?? new Map<string, VisitRecord[]>();
globalForVisits.localVisitStore = localVisitStore;

function getLocalVisits(session: SessionData): VisitRecord[] {
  return localVisitStore.get(session.organizationId) ?? [];
}

function pushLocalVisit(session: SessionData, visit: VisitRecord) {
  localVisitStore.set(session.organizationId, [
    visit,
    ...getLocalVisits(session),
  ]);
}

const visitTypeMap: Record<string, string> = {
  BILLIARD: "Bilhar / Pebolim",
  PLUSH: "Pelúcia / Grua",
  BX: "BX",
  SLOT_H: "H (Caça-níquel)",
  CARRETA_KIDS: "Carreta Kids",
  RENTAL: "Locação",
  GENERAL: "Geral",
};

function labelToKey(label: string): string {
  const entry = Object.entries(visitTypeMap).find(([, v]) => v === label);
  return entry ? entry[0] : "GENERAL";
}

export async function saveVisit(
  session: SessionData,
  data: Omit<VisitRecord, "id" | "createdAt">,
): Promise<VisitRecord> {
  const visit: VisitRecord = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  if (process.env.DEMO_MODE !== "false") {
    pushLocalVisit(session, visit);
    return visit;
  }

  try {
    const typeKey = labelToKey(data.visitType) as
      | "BILLIARD"
      | "PLUSH"
      | "BX"
      | "SLOT_H"
      | "CARRETA_KIDS"
      | "RENTAL"
      | "GENERAL";

    await prisma.fieldVisit.create({
      data: {
        id: visit.id,
        organizationId: session.organizationId,
        clientId: data.clientId || undefined,
        targetId: data.targetId || undefined,
        clientName: data.clientName || undefined,
        clientPhone: data.clientPhone || undefined,
        createdById: session.userId,
        visitType: typeKey,
        occurredAt: new Date(data.occurredAt),
        checkedItems: data.checkedItems,
        incomeAmount: data.incomeAmount,
        expenseAmount: data.expenseAmount,
        notes: data.notes || undefined,
      },
    });
  } catch (error) {
    console.error("[visit-service] saveVisit falhou, mantendo apenas em memoria local:", error);
    pushLocalVisit(session, visit);
  }

  return visit;
}

export async function listVisits(
  session: SessionData,
  limit = 50,
): Promise<VisitRecord[]> {
  if (process.env.DEMO_MODE !== "false") {
    return getLocalVisits(session).slice(0, limit);
  }

  try {
    const rows = await prisma.fieldVisit.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: { client: true, createdBy: true },
    });

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId ?? undefined,
      targetId: r.targetId ?? undefined,
      clientName: r.clientName ?? r.client?.name ?? "—",
      clientPhone: r.clientPhone ?? r.client?.phone ?? "",
      visitType: visitTypeMap[r.visitType] ?? r.visitType,
      occurredAt: r.occurredAt.toISOString(),
      checkedItems: r.checkedItems,
      incomeAmount: Number(r.incomeAmount),
      expenseAmount: Number(r.expenseAmount),
      notes: r.notes ?? undefined,
      createdBy: r.createdBy?.name ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[visit-service] listVisits falhou, retornando dados locais:", error);
    return getLocalVisits(session).slice(0, limit);
  }
}

export async function getClientVisits(
  session: SessionData,
  clientId: string,
): Promise<VisitRecord[]> {
  if (process.env.DEMO_MODE !== "false") {
    return getLocalVisits(session).filter((v) => v.clientId === clientId);
  }

  try {
    const rows = await prisma.fieldVisit.findMany({
      where: { organizationId: session.organizationId, clientId },
      orderBy: { occurredAt: "desc" },
      include: { createdBy: true },
    });

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId ?? undefined,
      clientName: "",
      clientPhone: "",
      visitType: visitTypeMap[r.visitType] ?? r.visitType,
      occurredAt: r.occurredAt.toISOString(),
      checkedItems: r.checkedItems,
      incomeAmount: Number(r.incomeAmount),
      expenseAmount: Number(r.expenseAmount),
      notes: r.notes ?? undefined,
      createdBy: r.createdBy?.name ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[visit-service] getClientVisits falhou, retornando dados locais:", error);
    return getLocalVisits(session).filter((v) => v.clientId === clientId);
  }
}

export async function updateVisit(
  session: SessionData,
  visitId: string,
  data: Pick<VisitRecord, "visitType" | "occurredAt" | "incomeAmount" | "expenseAmount" | "notes">,
): Promise<VisitRecord | null> {
  if (process.env.DEMO_MODE !== "false") {
    const all = getLocalVisits(session);
    const idx = all.findIndex((v) => v.id === visitId);
    if (idx === -1) return null;
    const updated: VisitRecord = { ...all[idx], ...data };
    const next = [...all];
    next[idx] = updated;
    localVisitStore.set(session.organizationId, next);
    return updated;
  }

  try {
    const owned = await prisma.fieldVisit.findFirst({
      where: { id: visitId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!owned) return null;

    const typeKey = labelToKey(data.visitType) as
      | "BILLIARD" | "PLUSH" | "BX" | "SLOT_H" | "CARRETA_KIDS" | "RENTAL" | "GENERAL";

    const row = await prisma.fieldVisit.update({
      where: { id: visitId },
      data: {
        visitType: typeKey,
        occurredAt: new Date(data.occurredAt),
        incomeAmount: data.incomeAmount,
        expenseAmount: data.expenseAmount,
        notes: data.notes || null,
      },
      include: { createdBy: true },
    });

    return {
      id: row.id,
      clientId: row.clientId ?? undefined,
      clientName: "",
      clientPhone: "",
      visitType: visitTypeMap[row.visitType] ?? row.visitType,
      occurredAt: row.occurredAt.toISOString(),
      checkedItems: row.checkedItems,
      incomeAmount: Number(row.incomeAmount),
      expenseAmount: Number(row.expenseAmount),
      notes: row.notes ?? undefined,
      createdBy: row.createdBy?.name ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  } catch (error) {
    console.error("[visit-service] updateVisit falhou:", error);
    return null;
  }
}

export async function deleteVisit(
  session: SessionData,
  visitId: string,
): Promise<boolean> {
  if (process.env.DEMO_MODE !== "false") {
    const all = getLocalVisits(session);
    localVisitStore.set(
      session.organizationId,
      all.filter((v) => v.id !== visitId),
    );
    return true;
  }

  try {
    const owned = await prisma.fieldVisit.findFirst({
      where: { id: visitId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!owned) return false;

    await prisma.fieldVisit.delete({ where: { id: visitId } });
    return true;
  } catch (error) {
    console.error("[visit-service] deleteVisit falhou:", error);
    return false;
  }
}

export async function getUnvisitedClients(
  session: SessionData,
  clients: ClientListItem[],
  thresholdDays = 15,
): Promise<ClientVisitSummary[]> {
  const visits = await listVisits(session, 1000);

  const lastVisitByClient = new Map<string, string>();
  for (const v of visits) {
    if (!v.clientId) continue;
    if (!lastVisitByClient.has(v.clientId)) {
      lastVisitByClient.set(v.clientId, v.occurredAt);
    }
  }

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  return clients
    .filter((c) => c.status === "ativo")
    .map((c) => {
      const lastVisitAt = lastVisitByClient.get(c.id);
      const daysSinceVisit = lastVisitAt
        ? Math.floor((now - new Date(lastVisitAt).getTime()) / MS_PER_DAY)
        : 999;
      return {
        clientId: c.id,
        clientName: c.name,
        clientPhone: c.phone,
        clientCode: c.code,
        city: c.city,
        lastVisitAt,
        daysSinceVisit,
      };
    })
    .filter((c) => c.daysSinceVisit >= thresholdDays)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
}

export async function getModuleUnvisitedTargets(
  session: SessionData,
  targets: ClientListItem[],
  thresholdDays = 15,
): Promise<ClientVisitSummary[]> {
  const visits = await listVisits(session, 1000);

  const lastVisitByTarget = new Map<string, string>();
  for (const v of visits) {
    if (!v.targetId) continue;
    if (!lastVisitByTarget.has(v.targetId)) {
      lastVisitByTarget.set(v.targetId, v.occurredAt);
    }
  }

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  return targets
    .filter((c) => c.status === "ativo")
    .map((c) => {
      const lastVisitAt = lastVisitByTarget.get(c.id);
      const daysSinceVisit = lastVisitAt
        ? Math.floor((now - new Date(lastVisitAt).getTime()) / MS_PER_DAY)
        : 999;
      return {
        clientId: c.id,
        clientName: c.name,
        clientPhone: c.phone,
        clientCode: c.code,
        city: c.city,
        lastVisitAt,
        daysSinceVisit,
      };
    })
    .filter((c) => c.daysSinceVisit >= thresholdDays)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
}

export async function getTodayVisitCount(session: SessionData): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (process.env.DEMO_MODE !== "false") {
    return getLocalVisits(session).filter(
      (v) => new Date(v.occurredAt) >= todayStart,
    ).length;
  }

  try {
    return await prisma.fieldVisit.count({
      where: {
        organizationId: session.organizationId,
        occurredAt: { gte: todayStart },
      },
    });
  } catch (error) {
    console.error("[visit-service] getTodayVisitCount falhou, retornando dados locais:", error);
    return getLocalVisits(session).filter(
      (v) => new Date(v.occurredAt) >= todayStart,
    ).length;
  }
}

export async function listVisitsInRange(
  session: SessionData,
  from: string,
  to: string,
): Promise<VisitRecord[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  if (process.env.DEMO_MODE !== "false") {
    return getLocalVisits(session).filter((v) => {
      const d = new Date(v.occurredAt);
      return d >= fromDate && d <= toDate;
    });
  }

  try {
    const rows = await prisma.fieldVisit.findMany({
      where: {
        organizationId: session.organizationId,
        occurredAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { occurredAt: "desc" },
      include: { client: true, createdBy: true },
    });

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId ?? undefined,
      targetId: r.targetId ?? undefined,
      clientName: r.clientName ?? r.client?.name ?? "—",
      clientPhone: r.clientPhone ?? r.client?.phone ?? "",
      visitType: visitTypeMap[r.visitType] ?? r.visitType,
      occurredAt: r.occurredAt.toISOString(),
      checkedItems: r.checkedItems,
      incomeAmount: Number(r.incomeAmount),
      expenseAmount: Number(r.expenseAmount),
      notes: r.notes ?? undefined,
      createdBy: r.createdBy?.name ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[visit-service] listVisitsInRange falhou, retornando dados locais:", error);
    return getLocalVisits(session).filter((v) => {
      const d = new Date(v.occurredAt);
      return d >= fromDate && d <= toDate;
    });
  }
}

export async function getRouteOfDay(
  session: SessionData,
  clients: ClientListItem[],
): Promise<ClientVisitSummary[]> {
  const visits = await listVisits(session, 1000);

  const lastVisitByClient = new Map<string, string>();
  for (const v of visits) {
    if (!v.clientId) continue;
    if (!lastVisitByClient.has(v.clientId)) {
      lastVisitByClient.set(v.clientId, v.occurredAt);
    }
  }

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  return clients
    .filter((c) => c.status === "ativo")
    .map((c) => {
      const lastVisitAt = lastVisitByClient.get(c.id);
      const daysSinceVisit = lastVisitAt
        ? Math.floor((now - new Date(lastVisitAt).getTime()) / MS_PER_DAY)
        : 999;
      return {
        clientId: c.id,
        clientName: c.name,
        clientPhone: c.phone,
        clientCode: c.code,
        city: c.city,
        lastVisitAt,
        daysSinceVisit,
      };
    })
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)
    .slice(0, 10);
}
