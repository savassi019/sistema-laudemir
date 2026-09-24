import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { currentBusinessDayRange } from "@/lib/business-date";
import type { SessionData } from "@/types/app";

export type RoutePlanItem = {
  id: string;
  code: string;
  name: string;
  routeNumber: number;
  description: string | null;
};

export type BilliardPointItem = {
  id: string;
  registrationNumber: number | null;
  code: string;
  name: string;
  clientName: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  cep: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  tableModel: string | null;
  chipValue: number;
  routeNumber: number | null;
  partialRoute: string | null;
  accumulatedChips: number;
  clothChangeAlertAt: number;
  roofOpenDebt: number;
  roofFixedInstallment: number;
  status: "Trocar pano" | "Telhado aberto" | "Coletado" | "Pendente";
  lastCollectionAt: string | null;
  lastResultAmount: number | null;
};

const createRoutePlanSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  routeNumber: z.coerce.number().min(1),
  description: z.string().optional(),
});

export async function listRoutePlans(session: SessionData): Promise<RoutePlanItem[]> {
  const routes = await prisma.routePlan.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { routeNumber: "asc" },
  });

  return routes.map((route) => ({
    id: route.id,
    code: route.code,
    name: route.name,
    routeNumber: route.routeNumber,
    description: route.description,
  }));
}

export async function createRoutePlan(
  session: SessionData,
  payload: { code: string; name: string; routeNumber: number; description?: string },
): Promise<RoutePlanItem> {
  const data = createRoutePlanSchema.parse(payload);

  const route = await prisma.routePlan.create({
    data: {
      organizationId: session.organizationId,
      createdById: session.userId,
      code: data.code,
      name: data.name,
      routeNumber: data.routeNumber,
      description: data.description,
    },
  });

  return {
    id: route.id,
    code: route.code,
    name: route.name,
    routeNumber: route.routeNumber,
    description: route.description,
  };
}

export async function listBilliardPoints(
  session: SessionData,
  routeNumber?: number,
): Promise<BilliardPointItem[]> {
  const points = await prisma.billiardPoint.findMany({
    where: {
      organizationId: session.organizationId,
      ...(routeNumber ? { routeNumber } : {}),
    },
    include: {
      collections: {
        orderBy: { collectionDate: "desc" },
        take: 1,
      },
    },
    orderBy: [
      { routeNumber: "asc" },
      { registrationNumber: "asc" },
      { createdAt: "asc" },
      { code: "asc" },
    ],
  });

  return points.map((point) => {
    const lastCollection = point.collections[0];
    const roofOpenDebt = Number(point.roofOpenDebt ?? 0);
    const adminDay = session.role === "ADMIN" ? currentBusinessDayRange() : null;

    let status: BilliardPointItem["status"] = "Pendente";
    if (point.accumulatedChips >= point.clothChangeAlertAt) {
      status = "Trocar pano";
    } else if (roofOpenDebt > 0) {
      status = "Telhado aberto";
    } else if (lastCollection) {
      status = "Coletado";
    }

    let lastResultAmount: number | null = null;
    if (lastCollection) {
      const grossAmount = Number(lastCollection.grossAmount);
      const percentage = Number(lastCollection.percentage ?? 0);
      const isLegacyRoofEntry = lastCollection.roofPaidAmount === null;
      lastResultAmount =
        grossAmount * (1 - percentage / 100) -
        Number(lastCollection.employeeCost ?? 0) -
        Number(lastCollection.installationCost ?? 0) -
        Number(lastCollection.maintenanceCost ?? 0) -
        Number(lastCollection.otherCost ?? 0) -
        Number(lastCollection.discountAmount ?? 0) -
        (isLegacyRoofEntry ? Number(lastCollection.roofAmount ?? 0) : 0) +
        (isLegacyRoofEntry ? 0 : Number(lastCollection.roofPaidAmount ?? 0));
    }

    const canReturnLastResult =
      session.role === "OWNER" ||
      (session.role === "ADMIN" &&
        lastCollection &&
        adminDay &&
        lastCollection.collectionDate >= adminDay.from &&
        lastCollection.collectionDate <= adminDay.to);

    return {
      id: point.id,
      registrationNumber: point.registrationNumber,
      code: point.code,
      name: point.name,
      clientName: point.clientName,
      phone: point.phone,
      cpf: point.cpf,
      cnpj: point.cnpj,
      cep: point.cep,
      street: point.street,
      neighborhood: point.neighborhood,
      city: point.city,
      state: point.state,
      tableModel: point.tableModel,
      chipValue: Number(point.chipValue ?? 0),
      routeNumber: point.routeNumber,
      partialRoute: point.partialRoute,
      accumulatedChips: point.accumulatedChips,
      clothChangeAlertAt: point.clothChangeAlertAt,
      roofOpenDebt: session.role === "STAFF" ? 0 : roofOpenDebt,
      roofFixedInstallment: Number(point.roofFixedInstallment ?? 0),
      status,
      lastCollectionAt: lastCollection ? lastCollection.collectionDate.toISOString() : null,
      lastResultAmount: canReturnLastResult ? lastResultAmount : null,
    };
  });
}

export type RouteOverviewItem = {
  routeNumber: number;
  name: string | null;
  code: string | null;
  description: string | null;
  registered: boolean;
  totalPoints: number;
  needsClothChange: number;
  roofOpen: number;
  collected: number;
  pending: number;
  points: BilliardPointItem[];
};

/**
 * Junta as rotas cadastradas (RoutePlan) com os pontos que carregam aquele
 * numero de rota. Um ponto pode apontar pra uma rota que nunca foi cadastrada
 * — nesse caso ela aparece mesmo assim, marcada como nao registrada, senao o
 * ponto sumiria da tela.
 */
export async function listRoutesOverview(session: SessionData): Promise<RouteOverviewItem[]> {
  const [plans, points] = await Promise.all([
    listRoutePlans(session),
    listBilliardPoints(session),
  ]);

  const porNumero = new Map<number, BilliardPointItem[]>();
  for (const point of points) {
    const n = point.routeNumber ?? 0;
    const atual = porNumero.get(n);
    if (atual) atual.push(point);
    else porNumero.set(n, [point]);
  }

  const numeros = new Set<number>([
    ...plans.map((p) => p.routeNumber),
    ...porNumero.keys(),
  ]);

  return [...numeros]
    .sort((a, b) => a - b)
    .map((routeNumber) => {
      const plan = plans.find((p) => p.routeNumber === routeNumber);
      const doGrupo = porNumero.get(routeNumber) ?? [];
      return {
        routeNumber,
        name: plan?.name ?? null,
        code: plan?.code ?? null,
        description: plan?.description ?? null,
        registered: Boolean(plan),
        totalPoints: doGrupo.length,
        needsClothChange: doGrupo.filter((p) => p.status === "Trocar pano").length,
        roofOpen: doGrupo.filter((p) => p.status === "Telhado aberto").length,
        collected: doGrupo.filter((p) => p.status === "Coletado").length,
        pending: doGrupo.filter((p) => p.status === "Pendente").length,
        points: doGrupo,
      };
    });
}

export async function getBilliardPoint(
  session: SessionData,
  pointId: string,
): Promise<BilliardPointItem | null> {
  const point = await prisma.billiardPoint.findFirst({
    where: { id: pointId, organizationId: session.organizationId },
    include: {
      collections: {
        orderBy: { collectionDate: "desc" },
        take: 1,
      },
    },
  });

  if (!point) return null;

  const lastCollection = point.collections[0];
  const roofOpenDebt = Number(point.roofOpenDebt ?? 0);

  let status: BilliardPointItem["status"] = "Pendente";
  if (point.accumulatedChips >= point.clothChangeAlertAt) {
    status = "Trocar pano";
  } else if (roofOpenDebt > 0) {
    status = "Telhado aberto";
  } else if (lastCollection) {
    status = "Coletado";
  }

  return {
    id: point.id,
    registrationNumber: point.registrationNumber,
    code: point.code,
    name: point.name,
    clientName: point.clientName,
    phone: point.phone,
    cpf: point.cpf,
    cnpj: point.cnpj,
    cep: point.cep,
    street: point.street,
    neighborhood: point.neighborhood,
    city: point.city,
    state: point.state,
    tableModel: point.tableModel,
    chipValue: Number(point.chipValue ?? 0),
    routeNumber: point.routeNumber,
    partialRoute: point.partialRoute,
    accumulatedChips: point.accumulatedChips,
    clothChangeAlertAt: point.clothChangeAlertAt,
    roofOpenDebt: session.role === "STAFF" ? 0 : roofOpenDebt,
    roofFixedInstallment: Number(point.roofFixedInstallment ?? 0),
    status,
    lastCollectionAt: lastCollection ? lastCollection.collectionDate.toISOString() : null,
    lastResultAmount: null,
  };
}

export type BilliardClientOverviewItem = {
  id: string;
  registrationNumber: number | null;
  code: string;
  name: string;
  clientName: string | null;
  phone: string | null;
  roofOpenDebt: number;
  accountsPayable: number;
  lastCollectionAt: string | null;
};

export async function listBilliardClientsOverview(
  session: SessionData,
): Promise<BilliardClientOverviewItem[]> {
  const adminDay = session.role === "ADMIN" ? currentBusinessDayRange() : null;
  const points = await prisma.billiardPoint.findMany({
    where: { organizationId: session.organizationId },
    include: {
      collections: {
        ...(adminDay
          ? { where: { collectionDate: { gte: adminDay.from, lte: adminDay.to } } }
          : {}),
        select: {
          collectionDate: true,
          employeeCost: true,
          installationCost: true,
          maintenanceCost: true,
          otherCost: true,
        },
        orderBy: { collectionDate: "desc" },
      },
    },
    orderBy: [{ registrationNumber: "asc" }, { code: "asc" }],
  });

  return points.map((point) => {
    const accountsPayable = session.role === "STAFF" ? 0 : point.collections.reduce(
      (total, c) =>
        total +
        Number(c.employeeCost ?? 0) +
        Number(c.installationCost ?? 0) +
        Number(c.maintenanceCost ?? 0) +
        Number(c.otherCost ?? 0),
      0,
    );

    return {
      id: point.id,
      registrationNumber: point.registrationNumber,
      code: point.code,
      name: point.name,
      clientName: point.clientName,
      phone: point.phone,
      roofOpenDebt: session.role === "OWNER" ? Number(point.roofOpenDebt ?? 0) : 0,
      accountsPayable,
      lastCollectionAt: point.collections[0]?.collectionDate.toISOString() ?? null,
    };
  });
}

export type BilliardPointHistoryEntry =
  | {
      type: "collection";
      id: string;
      date: string;
      quantityOfChips: number;
      grossAmount: number;
      percentage: number;
      discountAmount: number;
      roofAmount: number;
      roofChargeType: string | null;
      roofPreviousBalance: number | null;
      roofPaidAmount: number | null;
      roofBalanceAfter: number | null;
      roofPaymentMethod: string | null;
      employeeCost: number;
      installationCost: number;
      maintenanceCost: number;
      otherCost: number;
      finalValue: number;
      registerNumber: string | null;
      photos: { id: string; name: string }[];
      createdByName: string | null;
    }
  | {
      type: "maintenance";
      id: string;
      date: string;
      materials: string | null;
      notes: string | null;
      status: string;
      createdByName: string | null;
    };

export async function listBilliardPointHistory(
  session: SessionData,
  pointId: string,
): Promise<BilliardPointHistoryEntry[]> {
  const adminDay = session.role === "ADMIN" ? currentBusinessDayRange() : null;
  const [collections, maintenances] = await Promise.all([
    prisma.billiardCollection.findMany({
      where: {
        organizationId: session.organizationId,
        billiardPointId: pointId,
        ...(adminDay
          ? { collectionDate: { gte: adminDay.from, lte: adminDay.to } }
          : {}),
      },
      orderBy: { collectionDate: "desc" },
    }),
    prisma.billiardMaintenance.findMany({
      where: { organizationId: session.organizationId, billiardPointId: pointId },
      orderBy: { maintenanceDate: "desc" },
    }),
  ]);

  const photos = collections.length
    ? await prisma.fileAsset.findMany({
        where: {
          organizationId: session.organizationId,
          entityType: "BILLIARD_COLLECTION",
          entityId: { in: collections.map((c) => c.id) },
        },
        select: { id: true, originalName: true, entityId: true },
      })
    : [];

  const createdByIds = [
    ...collections.map((c) => c.createdById),
    ...maintenances.map((m) => m.createdById),
  ].filter((id): id is string => Boolean(id));

  const users = createdByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: createdByIds } },
        select: { id: true, name: true },
      })
    : [];
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const collectionEntries: BilliardPointHistoryEntry[] = collections.map((c) => {
    const showFinancials = session.role !== "STAFF";
    const grossAmount = Number(c.grossAmount);
    const percentage = Number(c.percentage ?? 0);
    const discountAmount = Number(c.discountAmount ?? 0);
    const roofAmount = Number(c.roofAmount ?? 0);
    const isLegacyRoofEntry = c.roofPaidAmount === null;
    const roofPreviousBalance = c.roofPreviousBalance === null ? null : Number(c.roofPreviousBalance);
    const roofPaidAmount = c.roofPaidAmount === null ? null : Number(c.roofPaidAmount);
    const roofBalanceAfter = c.roofBalanceAfter === null ? null : Number(c.roofBalanceAfter);
    const employeeCost = Number(c.employeeCost ?? 0);
    const installationCost = Number(c.installationCost ?? 0);
    const maintenanceCost = Number(c.maintenanceCost ?? 0);
    const otherCost = Number(c.otherCost ?? 0);
    const finalValue =
      grossAmount * (1 - percentage / 100) -
      employeeCost -
      installationCost -
      maintenanceCost -
      otherCost -
      discountAmount -
      (isLegacyRoofEntry ? roofAmount : 0) +
      (roofPaidAmount ?? 0);

    return {
      type: "collection",
      id: c.id,
      date: c.collectionDate.toISOString(),
      quantityOfChips: c.quantityOfChips,
      grossAmount: showFinancials ? grossAmount : 0,
      percentage: showFinancials ? percentage : 0,
      discountAmount: showFinancials ? discountAmount : 0,
      roofAmount: showFinancials ? roofAmount : 0,
      roofChargeType: showFinancials ? c.roofChargeType : null,
      roofPreviousBalance: showFinancials ? roofPreviousBalance : null,
      roofPaidAmount: showFinancials ? roofPaidAmount : null,
      roofBalanceAfter: showFinancials ? roofBalanceAfter : null,
      roofPaymentMethod: showFinancials ? c.roofPaymentMethod : null,
      employeeCost: showFinancials ? employeeCost : 0,
      installationCost: showFinancials ? installationCost : 0,
      maintenanceCost: showFinancials ? maintenanceCost : 0,
      otherCost: showFinancials ? otherCost : 0,
      finalValue: showFinancials ? finalValue : 0,
      registerNumber: c.registerNumber,
      photos: photos
        .filter((p) => p.entityId === c.id)
        .map((p) => ({ id: p.id, name: p.originalName })),
      createdByName: c.createdById ? userNameById.get(c.createdById) ?? null : null,
    };
  });

  const maintenanceEntries: BilliardPointHistoryEntry[] = maintenances.map((m) => ({
    type: "maintenance",
    id: m.id,
    date: m.maintenanceDate.toISOString(),
    materials: m.materials,
    notes: m.notes,
    status: m.status,
    createdByName: m.createdById ? userNameById.get(m.createdById) ?? null : null,
  }));

  return [...collectionEntries, ...maintenanceEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
