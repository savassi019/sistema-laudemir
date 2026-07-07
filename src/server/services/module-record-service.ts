import type {
  BxReceiptStatus,
  ContractStatus,
  FinancialDirection,
  FinancialStatus,
  PaymentMethod,
  PersonalEntryType,
} from "@prisma/client";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { ClientListItem, SessionData } from "@/types/app";

export type ModuleSlug =
  | "carreta-kids"
  | "maquinas-de-pelucia"
  | "bilhar-pebolim"
  | "bx"
  | "h-caca-niquel"
  | "credito-financeiro"
  | "mercado-autonomo"
  | "marketing"
  | "plataforma-online"
  | "locacao"
  | "financas-pessoais";

export const moduleSlugs: ModuleSlug[] = [
  "carreta-kids",
  "maquinas-de-pelucia",
  "bilhar-pebolim",
  "bx",
  "h-caca-niquel",
  "credito-financeiro",
  "mercado-autonomo",
  "marketing",
  "plataforma-online",
  "locacao",
  "financas-pessoais",
];

export type ModuleRecordItem = {
  id: string;
  title: string;
  summary: string;
  details: string[];
  amount?: string;
  amountValue?: number;
  incomeValue?: number;
  expenseValue?: number;
  badge?: string;
  createdAt: string;
};

export type DateRange = { from?: Date; to?: Date };

type SaveResult = {
  record: ModuleRecordItem;
  source: "database" | "local";
};

type StoreMap = Map<string, ModuleRecordItem[]>;

const globalForModuleRecords = globalThis as unknown as {
  moduleRecordStore?: StoreMap;
};

const moduleRecordStore =
  globalForModuleRecords.moduleRecordStore ?? new Map<string, ModuleRecordItem[]>();

globalForModuleRecords.moduleRecordStore = moduleRecordStore;

const paymentMethodMap: Record<string, PaymentMethod> = {
  PIX: "PIX",
  DINHEIRO: "CASH",
  CARTAO: "CREDIT_CARD",
  ABERTO: "OTHER",
};

const contractStatusMap: Record<string, ContractStatus> = {
  DRAFT: "DRAFT",
  PENDING: "PENDING_SIGNATURE",
  OPEN: "PENDING_SIGNATURE",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
};

const marketDirectionMap: Record<string, FinancialDirection> = {
  ENTRADA: "INCOME",
  SAIDA: "EXPENSE",
};

const financialStatusMap: Record<string, FinancialStatus> = {
  PENDING: "PENDING",
  PAID: "PAID",
  POSTED: "PARTIAL",
};

const personalEntryTypeMap: Record<string, PersonalEntryType> = {
  RECEITA: "INCOME",
  DESPESA: "EXPENSE",
  CONTA_A_PAGAR: "PAYABLE",
  PAGO: "PAID",
};

const createCarretaSchema = z.object({
  localName: z.string(),
  serviceDate: z.string(),
  sheetName: z.string(),
  phone: z.string().optional(),
  minutesCharged: z.string(),
  paymentMethod: z.string(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  expenseAmount: z.number().optional(),
  notes: z.string().optional(),
});

const createPlushSchema = z.object({
  clientName: z.string(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  code: z.string(),
  name: z.string(),
  machineNumber: z.string(),
  noteNumber: z.string().optional(),
  noteiroFixed: z.string().optional(),
  coinPhotoRule: z.boolean().optional(),
  giftPhotoRule: z.boolean().optional(),
  active: z.boolean().optional(),
  collectionDate: z.string(),
  grossAmount: z.number(),
  commissionPercentage: z.number(),
  plushCountOut: z.number(),
  paymentMethod: z.string(),
  discountAmount: z.number().optional(),
  discountReason: z.string().optional(),
  ownerExpenseAmount: z.number().optional(),
  compensationStatus: z.enum(["WORTH_IT", "NOT_WORTH_IT"]),
  noteiro: z.string().optional(),
  notes: z.string().optional(),
  coinPhotoFileId: z.string().optional(),
  giftPhotoFileId: z.string().optional(),
});

const createBilliardSchema = z.object({
  clientName: z.string(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  pointCode: z.string().optional(),
  pointName: z.string(),
  phone: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  city: z.string(),
  neighborhood: z.string(),
  state: z.string(),
  tableModel: z.string(),
  chipValue: z.number(),
  collectionDate: z.string().optional(),
  fortnight: z.string().optional(),
  quantityOfChips: z.number(),
  accumulatedChips: z.number().optional(),
  percentage: z.number(),
  discountAmount: z.number().optional(),
  discountReason: z.string().optional(),
  roofDebt: z.number(),
  roofPaymentMethod: z.string(),
  contractType: z.string().optional(),
  contractStatus: z.string().optional(),
  structureCost: z.number().optional(),
  employeeCost: z.number(),
  installationCost: z.number(),
  maintenanceCost: z.number(),
  otherCost: z.number(),
  routeNumber: z.number(),
  partialRoute: z.string().optional(),
  maintenanceDate: z.string().optional(),
  nextMaintenanceDate: z.string().optional(),
  materials: z.string().optional(),
  photoNames: z.array(z.string()).optional(),
  photoFileIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const createBxSchema = z.object({
  clientName: z.string(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  collectNumber: z.string(),
  agentName: z.string(),
  receiverName: z.string(),
  occurredAt: z.string(),
  sentToAgentAmount: z.number(),
  deliveredAmount: z.number(),
  incomeAmount: z.number(),
  expenseAmount: z.number(),
  discountAmount: z.number(),
  paymentMethod: z.string().optional(),
  receiptStatus: z.string(),
  exceptionClient: z.boolean(),
  notes: z.string().optional(),
  screenPhotoFileId: z.string().optional(),
  paperPhotoFileId: z.string().optional(),
});

const createSlotSchema = z.object({
  uniqueMachineNumber: z.string(),
  newClient: z.boolean().optional(),
  clientName: z.string().optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  customerDebt: z.number().optional(),
  ppValue: z.number().optional(),
  initialAmount: z.number().optional(),
  initialAmountMode: z.enum(["NONE", "DEBT", "NEGATIVE"]),
  optionalGreedAmount: z.number().optional(),
  active: z.boolean().optional(),
  occurredAt: z.string(),
  currentIncome: z.number(),
  previousIncome: z.number(),
  currentExpense: z.number(),
  previousExpense: z.number(),
  percentageSplit: z.number(),
  conferenceCount: z.number(),
  negativeAmount: z.number().optional(),
  feedingNegativeAmount: z.number().optional(),
  customerDebtDiscounted: z.number().optional(),
  generatedDebtAmount: z.number().optional(),
  debtMode: z.enum(["NONE", "DEBT", "NEGATIVE"]),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const createMachineContractSchema = z.object({
  clientCode: z.string(),
  clientName: z.string(),
  amount: z.number(),
  contractDate: z.string(),
  year: z.number(),
  percentage: z.number().optional(),
  monthlyInterest: z.number().optional(),
  installmentFixed: z.boolean(),
  guaranteeEnabled: z.boolean(),
  signatureLink: z.string().optional(),
  signatureFileId: z.string().optional(),
  streetLoanAmount: z.number().optional(),
  monthlyInterestTotal: z.number().optional(),
  generalPercentageAvg: z.number().optional(),
  expenseAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

const createMarketSchema = z.object({
  movementDate: z.string(),
  description: z.string(),
  direction: z.string(),
  amount: z.number(),
  expenseAmount: z.number(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const createMarketingSchema = z.object({
  name: z.string(),
  personType: z.string(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  serviceType: z.string(),
  contractValue: z.number(),
  contractDate: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  signatureLink: z.string().optional(),
  signatureFileId: z.string().optional(),
  expenseAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  contractFileId: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

const createPlatformSchema = z.object({
  movementDate: z.string(),
  description: z.string(),
  direction: z.string(),
  status: z.string(),
  amount: z.number(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const createRentalSchema = z.object({
  clientName: z.string(),
  phone: z.string().optional(),
  localName: z.string(),
  document: z.string().optional(),
  eventDate: z.string(),
  totalAmount: z.number(),
  signalEnabled: z.boolean().optional(),
  signalPercentage: z.number(),
  expenseAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string(),
  contractNumber: z.string().optional(),
  notes: z.string().optional(),
});

const createPersonalFinanceSchema = z.object({
  title: z.string(),
  category: z.string(),
  type: z.string(),
  amount: z.number(),
  dueDate: z.string(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

function toDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`);
}

async function logFieldVisitForModuleRecord(params: {
  organizationId: string;
  createdById: string;
  targetId: string;
  visitType: "BILLIARD" | "PLUSH" | "BX" | "SLOT_H" | "CARRETA_KIDS" | "RENTAL";
  occurredAt: Date;
  incomeAmount: number;
  expenseAmount: number;
  clientName?: string | null;
  clientPhone?: string | null;
}) {
  await prisma.fieldVisit.create({
    data: {
      organizationId: params.organizationId,
      targetId: params.targetId,
      createdById: params.createdById,
      visitType: params.visitType,
      occurredAt: params.occurredAt,
      checkedItems: [],
      incomeAmount: params.incomeAmount,
      expenseAmount: params.expenseAmount,
      clientName: params.clientName ?? undefined,
      clientPhone: params.clientPhone ?? undefined,
    },
  });
}

function buildKey(session: SessionData, slug: ModuleSlug) {
  return `${session.organizationId}:${slug}`;
}

function listLocalRecords(session: SessionData, slug: ModuleSlug, take = 5) {
  const key = buildKey(session, slug);
  return (moduleRecordStore.get(key) ?? []).slice(0, take);
}

function mapPaymentMethod(value: string) {
  return paymentMethodMap[value] ?? "OTHER";
}

function mapContractStatus(value: string) {
  return contractStatusMap[value] ?? "DRAFT";
}

function mapDirection(value: string) {
  return marketDirectionMap[value] ?? "INCOME";
}

function mapFinancialStatus(value: string) {
  return financialStatusMap[value] ?? "PENDING";
}

function mapPersonalEntryType(value: string) {
  return personalEntryTypeMap[value] ?? "EXPENSE";
}

function buildBilliardPointCode(data: z.infer<typeof createBilliardSchema>) {
  if (data.pointCode?.trim()) {
    return data.pointCode.trim();
  }

  const normalizedPoint = data.pointName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 16)
    .toUpperCase();

  return `R${String(data.routeNumber).padStart(2, "0")}-${normalizedPoint || "PONTO"}`;
}

function buildBilliardNotes(data: z.infer<typeof createBilliardSchema>) {
  return [
    data.notes,
    data.discountAmount ? `Desconto: ${formatCurrency(data.discountAmount)} - ${data.discountReason ?? "sem motivo"}` : null,
    data.contractType && data.contractType !== "NENHUM"
      ? `Contrato: ${data.contractType} / ${data.contractStatus ?? "NAO_APLICA"}`
      : null,
    data.nextMaintenanceDate ? `Proxima manutencao: ${formatShortDate(data.nextMaintenanceDate)}` : null,
    data.photoNames?.length ? `Anexos: ${data.photoNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}


type SlotSplitInput = {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  percentageSplit: number;
  negativeAmount?: number;
  feedingNegativeAmount?: number;
  optionalGreedAmount?: number;
  customerDebtDiscounted?: number;
  generatedDebtAmount?: number;
};

function computeSlotSplit(data: SlotSplitInput) {
  const incomeDifference = data.currentIncome - data.previousIncome;
  const expenseDifference = data.currentExpense - data.previousExpense;
  const netRevenue = incomeDifference - expenseDifference;
  const totalNegative = (data.negativeAmount ?? 0) + (data.feedingNegativeAmount ?? 0);
  const adjustedTotal = netRevenue - totalNegative;
  const clientShareBase = adjustedTotal * (data.percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const greed = data.optionalGreedAmount ?? 0;
  const clientShareAfterGreed = clientShareBase - greed;
  const houseShareAfterGreed = houseShareBase + greed;
  const clientShareFinal = clientShareAfterGreed - (data.customerDebtDiscounted ?? 0);
  const houseAmount = houseShareAfterGreed - (data.generatedDebtAmount ?? 0);

  return { incomeDifference, expenseDifference, netRevenue, adjustedTotal, clientShareFinal, houseAmount };
}


async function saveWithPrisma(
  session: SessionData,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
): Promise<SaveResult> {
  switch (slug) {
    case "carreta-kids": {
      const data = createCarretaSchema.parse(payload);
      const basePrice = data.minutesCharged === "15" ? 20 : data.minutesCharged === "30" ? 30 : 40;
      const totalAmount = basePrice - (data.expenseAmount ?? 0);
      const record = await prisma.carretaKidsRecord.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          locationName: data.localName,
          serviceDate: toDate(data.serviceDate),
          sheetName: data.sheetName,
          phone: data.phone,
          minutesCharged: Number(data.minutesCharged),
          tablePrice: basePrice,
          totalAmount,
          paymentMethod: mapPaymentMethod(data.paymentMethod),
          entryTime: data.entryTime,
          exitTime: data.exitTime,
          expenseAmount: data.expenseAmount ?? 0,
          notes: data.notes,
        },
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.id,
        visitType: "CARRETA_KIDS",
        occurredAt: record.serviceDate,
        incomeAmount: basePrice,
        expenseAmount: data.expenseAmount ?? 0,
        clientPhone: data.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit carreta-kids falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.locationName,
          summary: `Ficha ${record.sheetName}`,
          details: [
            `Data: ${formatShortDate(record.serviceDate)}`,
            `Pagamento: ${data.paymentMethod}`,
            ...(record.entryTime ? [`Entrada: ${record.entryTime}`] : []),
            ...(record.exitTime ? [`Saida: ${record.exitTime}`] : []),
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          badge: `${record.minutesCharged} min`,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "maquinas-de-pelucia": {
      const data = createPlushSchema.parse(payload);
      const machine = await prisma.plushMachine.upsert({
        where: {
          organizationId_code: {
            organizationId: session.organizationId,
            code: data.code,
          },
        },
        create: {
          organizationId: session.organizationId,
          clientName: data.clientName,
          cpf: data.cpf,
          phone: data.phone,
          code: data.code,
          name: data.name,
          machineNumber: data.machineNumber,
          noteNumber: data.noteNumber,
          noteiroFixed: data.noteiroFixed,
          coinPhotoRule: data.coinPhotoRule ?? true,
          giftPhotoRule: data.giftPhotoRule ?? true,
          active: data.active ?? true,
        },
        update: {
          clientName: data.clientName,
          cpf: data.cpf,
          phone: data.phone,
          name: data.name,
          machineNumber: data.machineNumber,
          noteNumber: data.noteNumber,
          noteiroFixed: data.noteiroFixed,
          coinPhotoRule: data.coinPhotoRule ?? true,
          giftPhotoRule: data.giftPhotoRule ?? true,
          active: data.active ?? true,
        },
      });

      const clientAmount = data.grossAmount * (data.commissionPercentage / 100);
      const companyAmount =
        data.grossAmount - clientAmount - (data.discountAmount ?? 0) - (data.ownerExpenseAmount ?? 0);

      const record = await prisma.plushCollection.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          plushMachineId: machine.id,
          grossAmount: data.grossAmount,
          commissionPercentage: data.commissionPercentage,
          clientAmount,
          companyAmount,
          plushCountOut: data.plushCountOut,
          paymentMethod: mapPaymentMethod(data.paymentMethod),
          discountAmount: data.discountAmount ?? 0,
          discountReason: data.discountReason,
          ownerExpenseAmount: data.ownerExpenseAmount ?? 0,
          compensationStatus: data.compensationStatus,
          noteiro: data.noteiro,
          coinPhotoId: data.coinPhotoFileId,
          giftPhotoId: data.giftPhotoFileId,
        },
        include: {
          plushMachine: true,
        },
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.plushMachineId,
        visitType: "PLUSH",
        occurredAt: record.createdAt,
        incomeAmount: data.grossAmount,
        expenseAmount: data.ownerExpenseAmount ?? 0,
        clientName: record.plushMachine.clientName ?? null,
        clientPhone: record.plushMachine.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit pelucia falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.plushMachine.name,
          summary: `Maquina ${record.plushMachine.machineNumber}`,
          details: [
            `Cliente: ${record.plushMachine.clientName ?? "-"}`,
            `Codigo: ${record.plushMachine.code}`,
            `Fichas: ${record.plushCountOut}`,
            `Comissao: ${record.commissionPercentage}%`,
            `Compensacao: ${record.compensationStatus === "WORTH_IT" ? "Compensa" : "Nao compensa"}`,
          ],
          amount: formatCurrency(Number(record.companyAmount)),
          badge: record.plushMachine.active ? "Ativa" : "Inativa",
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "bilhar-pebolim": {
      const data = createBilliardSchema.parse(payload);
      const pointCode = buildBilliardPointCode(data);
      const accumulatedChips = (data.accumulatedChips ?? 0) + data.quantityOfChips;
      const existingPoint = await prisma.billiardPoint.findUnique({
        where: {
          organizationId_code: {
            organizationId: session.organizationId,
            code: pointCode,
          },
        },
        select: { id: true },
      });
      let registrationNumber: number | undefined;
      if (!existingPoint) {
        // Usa MAX atômico em vez de findFirst+1 para evitar race condition com múltiplos usuários simultâneos.
        const result = await prisma.$queryRaw<[{ next: number }]>`
          SELECT COALESCE(MAX("registrationNumber"), 0) + 1 AS next
          FROM "BilliardPoint"
          WHERE "organizationId" = ${session.organizationId}
        `;
        registrationNumber = result[0]?.next ?? 1;
      }
      const point = await prisma.billiardPoint.upsert({
        where: {
          organizationId_code: {
            organizationId: session.organizationId,
            code: pointCode,
          },
        },
        create: {
          organizationId: session.organizationId,
          createdById: session.userId,
          registrationNumber,
          code: pointCode,
          name: data.pointName,
          clientName: data.clientName,
          cep: data.cep,
          street: data.street,
          city: data.city,
          neighborhood: data.neighborhood,
          state: data.state,
          phone: data.phone,
          cpf: data.cpf,
          cnpj: data.cnpj,
          tableModel: data.tableModel,
          chipValue: data.chipValue,
          roofOpenDebt: data.roofDebt,
          routeNumber: data.routeNumber,
          partialRoute: data.partialRoute,
          accumulatedChips,
        },
        update: {
          name: data.pointName,
          clientName: data.clientName,
          cep: data.cep,
          street: data.street,
          city: data.city,
          neighborhood: data.neighborhood,
          state: data.state,
          phone: data.phone,
          cpf: data.cpf,
          cnpj: data.cnpj,
          tableModel: data.tableModel,
          chipValue: data.chipValue,
          roofOpenDebt: data.roofDebt,
          routeNumber: data.routeNumber,
          partialRoute: data.partialRoute,
          accumulatedChips,
        },
      });

      const grossAmount = data.quantityOfChips * data.chipValue;
      const collectionDate = data.collectionDate || data.maintenanceDate || new Date().toISOString();
      const installationTotal = data.installationCost + (data.structureCost ?? 0);
      const record = await prisma.billiardCollection.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          billiardPointId: point.id,
          collectionDate: toDate(collectionDate),
          quantityOfChips: data.quantityOfChips,
          grossAmount,
          percentage: data.percentage,
          discountAmount: data.discountAmount ?? 0,
          roofAmount: data.roofDebt,
          roofPaymentMethod: mapPaymentMethod(data.roofPaymentMethod),
          employeeCost: data.employeeCost,
          installationCost: installationTotal,
          maintenanceCost: data.maintenanceCost,
          otherCost: data.otherCost,
          registerNumber: pointCode,
        },
        include: { billiardPoint: true },
      });

      if (data.photoFileIds && data.photoFileIds.length > 0) {
        await prisma.fileAsset.updateMany({
          where: { id: { in: data.photoFileIds }, organizationId: session.organizationId },
          data: { entityType: "BILLIARD_COLLECTION", entityId: record.id },
        });
      }

      const maintenanceDate = data.maintenanceDate || data.nextMaintenanceDate;
      const maintenanceNotes = buildBilliardNotes(data);

      if (maintenanceDate || data.materials || maintenanceNotes) {
        await prisma.billiardMaintenance.create({
          data: {
            organizationId: session.organizationId,
            createdById: session.userId,
            billiardPointId: point.id,
            maintenanceDate: toDate(maintenanceDate || collectionDate),
            materials: data.materials,
            notes: maintenanceNotes,
            status: data.maintenanceDate ? "DONE" : "SCHEDULED",
          },
        });
      }

      const companyShare =
        grossAmount * (1 - data.percentage / 100) -
        data.employeeCost -
        installationTotal -
        data.maintenanceCost -
        data.otherCost -
        data.roofDebt -
        (data.discountAmount ?? 0);

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.billiardPointId,
        visitType: "BILLIARD",
        occurredAt: record.collectionDate,
        incomeAmount: grossAmount,
        expenseAmount: data.employeeCost + installationTotal + data.maintenanceCost + data.otherCost + data.roofDebt + (data.discountAmount ?? 0),
        clientName: record.billiardPoint.clientName ?? null,
        clientPhone: record.billiardPoint.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit bilhar falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.billiardPoint.name,
          summary: record.billiardPoint.tableModel ?? "Mesa de bilhar",
          details: [
            `Ponto nº: ${record.billiardPoint.registrationNumber ?? "-"}`,
            `Cidade: ${record.billiardPoint.city ?? "-"}`,
            `Rota: ${record.billiardPoint.routeNumber ?? "-"}`,
            `Fichas: ${record.quantityOfChips}`,
            `Acumulado: ${accumulatedChips}/1500`,
            `Manutencao: ${formatShortDate(record.collectionDate)}`,
          ],
          amount: formatCurrency(companyShare),
          badge: accumulatedChips >= 1500 ? "Trocar pano" : "OK",
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "bx": {
      const data = createBxSchema.parse(payload);
      const record = await prisma.bxTransaction.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          clientName: data.clientName,
          phone: data.phone,
          cpf: data.cpf,
          cep: data.cep,
          street: data.street,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          collectNumber: data.collectNumber,
          agentName: data.agentName,
          receiverName: data.receiverName,
          occurredAt: toDate(data.occurredAt),
          sentToAgentAmount: data.sentToAgentAmount,
          deliveredAmount: data.deliveredAmount,
          incomeAmount: data.incomeAmount,
          expenseAmount: data.expenseAmount,
          totalAmount: data.incomeAmount - data.expenseAmount - data.discountAmount,
          discountAmount: data.discountAmount,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          exceptionClient: data.exceptionClient,
          receiptStatus: data.receiptStatus as BxReceiptStatus,
          screenPhotoId: data.screenPhotoFileId,
          paperPhotoId: data.paperPhotoFileId,
        },
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.id,
        visitType: "BX",
        occurredAt: record.occurredAt,
        incomeAmount: Number(record.incomeAmount),
        expenseAmount: Number(record.expenseAmount),
        clientName: record.clientName ?? null,
        clientPhone: record.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit bx falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.clientName,
          summary: `Recolhe ${record.collectNumber ?? "-"}`,
          details: [
            `Agente: ${record.agentName ?? "-"}`,
            `Recebeu: ${record.receiverName ?? "-"}`,
            `Status: ${record.receiptStatus}`,
            data.exceptionClient ? "Cliente excecao" : "Fluxo padrao",
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          badge: record.receiptStatus === "RECEIVED" ? "Recebido" : "Nao recebido",
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "h-caca-niquel": {
      const data = createSlotSchema.parse(payload);
      const existingMachine = await prisma.slotMachine.findUnique({
        where: {
          organizationId_uniqueMachineNumber: {
            organizationId: session.organizationId,
            uniqueMachineNumber: data.uniqueMachineNumber,
          },
        },
      });

      const clientSequenceNumber = !existingMachine
        ? "1"
        : data.newClient
          ? String((Number(existingMachine.clientSequenceNumber) || 0) + 1)
          : existingMachine.clientSequenceNumber;

      const resetDebtForNewClient = !existingMachine || data.newClient;
      const baseDebt = resetDebtForNewClient
        ? data.initialAmountMode === "DEBT"
          ? data.initialAmount ?? 0
          : 0
        : data.customerDebt ?? 0;
      // P.P (pagamento pendente) abate do saldo permanente da divida, separado do desconto pos-split (customerDebtDiscounted).
      const customerDebt = Math.max(baseDebt - (data.ppValue ?? 0), 0);

      // Valor inicial em modo "Negativo" entra no negativo deste fechamento, igual um negativo manual.
      const initialNegativeBonus =
        resetDebtForNewClient && data.initialAmountMode === "NEGATIVE" ? data.initialAmount ?? 0 : 0;
      const effectiveNegativeAmount = (data.negativeAmount ?? 0) + initialNegativeBonus;

      // newClient force-clears cadastro fields not resent, so the old client's data never lingers under the new one.
      const clientFields = resetDebtForNewClient
        ? {
            clientName: data.clientName ?? "",
            phone: data.phone ?? "",
            cpf: data.cpf ?? "",
            cep: data.cep ?? "",
            street: data.street ?? "",
            neighborhood: data.neighborhood ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
          }
        : {
            clientName: data.clientName,
            phone: data.phone,
            cpf: data.cpf,
            cep: data.cep,
            street: data.street,
            neighborhood: data.neighborhood,
            city: data.city,
            state: data.state,
          };

      const machine = await prisma.slotMachine.upsert({
        where: {
          organizationId_uniqueMachineNumber: {
            organizationId: session.organizationId,
            uniqueMachineNumber: data.uniqueMachineNumber,
          },
        },
        create: {
          organizationId: session.organizationId,
          uniqueMachineNumber: data.uniqueMachineNumber,
          clientSequenceNumber,
          ...clientFields,
          customerDebt,
          ppValue: data.ppValue ?? 0,
          initialAmount: data.initialAmount ?? 0,
          initialAmountMode: data.initialAmountMode,
          optionalGreedAmount: data.optionalGreedAmount ?? 0,
          active: data.active ?? true,
        },
        update: {
          clientSequenceNumber,
          ...clientFields,
          customerDebt,
          ppValue: data.ppValue ?? 0,
          initialAmount: data.initialAmount ?? 0,
          initialAmountMode: data.initialAmountMode,
          optionalGreedAmount: data.optionalGreedAmount ?? 0,
          active: data.active ?? true,
        },
      });

      const record = await prisma.slotCollection.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          slotMachineId: machine.id,
          occurredAt: toDate(data.occurredAt),
          currentIncome: data.currentIncome,
          previousIncome: data.previousIncome,
          incomeDifference: data.currentIncome - data.previousIncome,
          currentExpense: data.currentExpense,
          previousExpense: data.previousExpense,
          expenseDifference: data.currentExpense - data.previousExpense,
          percentageSplit: data.percentageSplit,
          conferenceCount: data.conferenceCount,
          negativeAmount: effectiveNegativeAmount,
          feedingNegativeAmount: data.feedingNegativeAmount,
          customerDebtDiscounted: data.customerDebtDiscounted,
          generatedDebtAmount: data.generatedDebtAmount,
          debtMode: data.debtMode,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
        },
        include: { slotMachine: true },
      });

      const { houseAmount, clientShareFinal } = computeSlotSplit({
        ...data,
        negativeAmount: effectiveNegativeAmount,
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.slotMachineId,
        visitType: "SLOT_H",
        occurredAt: record.occurredAt,
        incomeAmount: Number(record.incomeDifference),
        expenseAmount: Number(record.expenseDifference),
        clientName: record.slotMachine.clientName ?? null,
        clientPhone: record.slotMachine.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit h-caca-niquel falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.slotMachine.uniqueMachineNumber,
          summary: `Cliente ${record.slotMachine.clientSequenceNumber}${data.clientName ? " - " + data.clientName : ""}`,
          details: [
            `Conferencias: ${record.conferenceCount}`,
            `Mode: ${record.debtMode}`,
            `Entrada: ${formatCurrency(Number(record.currentIncome))}`,
            `Cliente: ${formatCurrency(clientShareFinal)}`,
            `Casa: ${formatCurrency(houseAmount)}`,
          ],
          amount: formatCurrency(houseAmount),
          badge: record.slotMachine.active ? "Ativa" : "Inativa",
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "credito-financeiro": {
      const data = createMachineContractSchema.parse(payload);
      const record = await prisma.machineContract.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          clientCode: data.clientCode,
          clientName: data.clientName,
          amount: data.amount,
          contractDate: toDate(data.contractDate),
          year: data.year,
          percentage: data.percentage,
          monthlyInterest: data.monthlyInterest,
          installmentFixed: data.installmentFixed,
          guaranteeEnabled: data.guaranteeEnabled,
          signatureLink: data.signatureLink,
          signatureFileId: data.signatureFileId,
          streetLoanAmount: data.streetLoanAmount,
          monthlyInterestTotal: data.monthlyInterestTotal,
          generalPercentageAvg: data.generalPercentageAvg,
          expenseAmount: data.expenseAmount ?? 0,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          status: mapContractStatus(data.status),
          notes: data.notes,
        },
      });

      const netAmount = Number(record.amount) - Number(record.expenseAmount ?? 0);
      const signed = Boolean(record.signatureLink || record.signatureFileId);

      return {
        record: {
          id: record.id,
          title: record.clientName,
          summary: `Contrato ${record.clientCode}`,
          details: [
            `Ano: ${record.year}`,
            `Juros: ${record.monthlyInterest ?? 0}%`,
            `Garantia: ${record.guaranteeEnabled ? "Sim" : "Nao"}`,
            `Assinatura: ${signed ? "Sim" : "Pendente"}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(netAmount),
          badge: record.status,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "mercado-autonomo": {
      const data = createMarketSchema.parse(payload);
      const record = await prisma.condominiumMarketEntry.create({
        data: {
          organizationId: session.organizationId,
          movementDate: toDate(data.movementDate),
          description: data.description,
          direction: mapDirection(data.direction),
          amount: data.amount,
          expenseAmount: data.expenseAmount,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          notes: data.notes,
        },
      });

      const netAmount = data.direction === "SAIDA" ? -(data.amount + data.expenseAmount) : data.amount - data.expenseAmount;

      return {
        record: {
          id: record.id,
          title: record.description,
          summary: `Movimento ${data.direction}`,
          details: [
            `Data: ${formatShortDate(record.movementDate)}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
            `Saldo: ${formatCurrency(netAmount)}`,
          ],
          amount: formatCurrency(netAmount),
          badge: data.direction,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "marketing": {
      const data = createMarketingSchema.parse(payload);
      const record = await prisma.marketingContract.create({
        data: {
          organizationId: session.organizationId,
          name: data.name,
          personType: data.personType === "PJ" ? "COMPANY" : "INDIVIDUAL",
          cpf: data.cpf,
          cnpj: data.cnpj,
          serviceType: data.serviceType,
          contractValue: data.contractValue,
          contractDate: toDate(data.contractDate),
          address: data.address,
          phone: data.phone,
          email: data.email,
          signatureLink: data.signatureLink,
          signatureFileId: data.signatureFileId,
          expenseAmount: data.expenseAmount ?? 0,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          generatedFileId: data.contractFileId,
          status: mapContractStatus(data.status),
        },
      });

      const signed = Boolean(record.signatureLink || record.signatureFileId);
      const netAmount = data.contractValue - (data.expenseAmount ?? 0);

      return {
        record: {
          id: record.id,
          title: record.name,
          summary: record.serviceType,
          details: [
            `Tipo: ${data.personType}`,
            `Data: ${formatShortDate(record.contractDate)}`,
            `Assinatura: ${signed ? "Sim" : "Pendente"}`,
            `Status: ${record.status}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(netAmount),
          badge: record.status,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "plataforma-online": {
      const data = createPlatformSchema.parse(payload);
      const record = await prisma.brazilBetsEntry.create({
        data: {
          organizationId: session.organizationId,
          movementDate: toDate(data.movementDate),
          description: data.description,
          direction: mapDirection(data.direction),
          status: mapFinancialStatus(data.status),
          amount: data.amount,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          notes: data.notes,
        },
      });

      const netAmount = data.direction === "SAIDA" ? -data.amount : data.amount;

      return {
        record: {
          id: record.id,
          title: record.description,
          summary: `Movimento ${data.direction}`,
          details: [
            `Data: ${formatShortDate(record.movementDate)}`,
            `Status: ${record.status}`,
            `Liquido: ${formatCurrency(netAmount)}`,
          ],
          amount: formatCurrency(netAmount),
          badge: record.status,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "locacao": {
      const data = createRentalSchema.parse(payload);
      const signalAmount = data.signalEnabled ? data.totalAmount * (data.signalPercentage / 100) : 0;
      const balanceAmount = data.totalAmount - signalAmount - (data.expenseAmount ?? 0);

      const record = await prisma.rentalOrder.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          clientName: data.clientName,
          phone: data.phone,
          document: data.document,
          localName: data.localName,
          eventDate: toDate(data.eventDate),
          totalAmount: data.totalAmount,
          signalPercentage: data.signalEnabled ? data.signalPercentage : undefined,
          signalAmount,
          balanceAmount,
          expenseAmount: data.expenseAmount ?? 0,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          paymentStatus: data.paymentStatus as FinancialStatus,
          contractNumber: data.contractNumber,
          notes: data.notes,
        },
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.id,
        visitType: "RENTAL",
        occurredAt: record.eventDate,
        incomeAmount: Number(record.totalAmount),
        expenseAmount: Number(record.expenseAmount ?? 0),
        clientName: record.clientName ?? null,
        clientPhone: record.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit locacao falhou:", e));

      return {
        record: {
          id: record.id,
          title: data.clientName,
          summary: record.localName,
          details: [
            `Data: ${formatShortDate(record.eventDate)}`,
            `Sinal: ${formatCurrency(Number(record.signalAmount ?? 0))}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
            `Saldo: ${formatCurrency(Number(record.balanceAmount ?? 0))}`,
          ],
          amount: formatCurrency(Number(record.balanceAmount ?? record.totalAmount)),
          badge: record.paymentStatus,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "financas-pessoais": {
      const data = createPersonalFinanceSchema.parse(payload);
      const record = await prisma.personalFinanceRecord.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          title: data.title,
          type: mapPersonalEntryType(data.type),
          category: data.category,
          amount: data.amount,
          dueDate: toDate(data.dueDate),
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          notes: data.notes,
        },
      });

      const signedAmount = record.type === "INCOME" ? Number(record.amount) : -Number(record.amount);

      return {
        record: {
          id: record.id,
          title: record.title,
          summary: record.category,
          details: [
            `Tipo: ${record.type}`,
            `Data: ${formatShortDate(record.dueDate ?? record.createdAt)}`,
          ],
          amount: formatCurrency(signedAmount),
          badge: record.type,
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    default:
      throw new Error("Modulo nao suportado.");
  }
}

export async function saveModuleRecord(
  session: SessionData,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
) {
  return saveWithPrisma(session, slug, payload);
}

function buildDateWhere(range?: DateRange) {
  if (!range || (!range.from && !range.to)) {
    return {};
  }

  return {
    createdAt: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

export async function listModuleRecords(
  session: SessionData,
  slug: ModuleSlug,
  take = 5,
  range?: DateRange,
): Promise<ModuleRecordItem[]> {
  try {
    switch (slug) {
      case "carreta-kids": {
        const records = await prisma.carretaKidsRecord.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.locationName,
          summary: `Ficha ${record.sheetName}`,
          details: [
            `Data: ${formatShortDate(record.serviceDate)}`,
            `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ...(record.entryTime ? [`Entrada: ${record.entryTime}`] : []),
            ...(record.exitTime ? [`Saida: ${record.exitTime}`] : []),
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          amountValue: Number(record.totalAmount),
          incomeValue: Number(record.tablePrice ?? 0),
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: `${record.minutesCharged} min`,
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "maquinas-de-pelucia": {
        const records = await prisma.plushCollection.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
          include: { plushMachine: true },
        });

        return records.map((record) => ({
          id: record.id,
          title: record.plushMachine.name,
          summary: `Maquina ${record.plushMachine.machineNumber}`,
          details: [
            `Cliente: ${record.plushMachine.clientName ?? "-"}`,
            `Codigo: ${record.plushMachine.code}`,
            `Fichas: ${record.plushCountOut}`,
            `Comissao: ${record.commissionPercentage}%`,
            `Compensacao: ${record.compensationStatus === "WORTH_IT" ? "Compensa" : "Nao compensa"}`,
          ],
          amount: formatCurrency(Number(record.companyAmount)),
          amountValue: Number(record.companyAmount),
          incomeValue: Number(record.grossAmount),
          expenseValue: Number(record.grossAmount) - Number(record.companyAmount),
          badge: record.plushMachine.active ? "Ativa" : "Inativa",
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "bilhar-pebolim": {
        const records = await prisma.billiardCollection.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
          include: { billiardPoint: true },
        });

        return records.map((record) => {
          const grossAmount = Number(record.grossAmount);
          const percentage = Number(record.percentage ?? 0);
          const companyShare =
            grossAmount * (1 - percentage / 100) -
            Number(record.employeeCost ?? 0) -
            Number(record.installationCost ?? 0) -
            Number(record.maintenanceCost ?? 0) -
            Number(record.otherCost ?? 0) -
            Number(record.roofAmount ?? 0);

          return {
            id: record.id,
            title: record.billiardPoint.name,
            summary: record.billiardPoint.tableModel ?? "Mesa de bilhar",
            details: [
              `Cliente: ${record.billiardPoint.clientName ?? "-"}`,
              `Cidade: ${record.billiardPoint.city ?? "-"}`,
              `Rota: ${record.billiardPoint.routeNumber ?? "-"}`,
              `Fichas: ${record.quantityOfChips}`,
              `Manutencao: ${formatShortDate(record.collectionDate)}`,
            ],
            amount: formatCurrency(companyShare),
            amountValue: companyShare,
            incomeValue: grossAmount,
            expenseValue: grossAmount - companyShare,
            badge: record.quantityOfChips >= 1500 ? "Trocar pano" : "OK",
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "bx": {
        const records = await prisma.bxTransaction.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.clientName,
          summary: `Recolhe ${record.collectNumber ?? "-"}`,
          details: [
            `Agente: ${record.agentName ?? "-"}`,
            `Recebeu: ${record.receiverName ?? "-"}`,
            `Status: ${record.receiptStatus}`,
            `Entrada: ${formatCurrency(Number(record.incomeAmount ?? 0))}`,
            `Saida: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
            `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          amountValue: Number(record.totalAmount),
          incomeValue: Number(record.incomeAmount ?? 0),
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: record.receiptStatus === "RECEIVED" ? "Recebido" : "Nao recebido",
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "h-caca-niquel": {
        const records = await prisma.slotCollection.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
          include: { slotMachine: true },
        });

        return records.map((record) => {
          const currentIncome = Number(record.currentIncome);
          const { houseAmount, clientShareFinal } = computeSlotSplit({
            currentIncome,
            previousIncome: Number(record.previousIncome),
            currentExpense: Number(record.currentExpense),
            previousExpense: Number(record.previousExpense),
            percentageSplit: Number(record.percentageSplit ?? 0),
            negativeAmount: Number(record.negativeAmount ?? 0),
            feedingNegativeAmount: Number(record.feedingNegativeAmount ?? 0),
            customerDebtDiscounted: Number(record.customerDebtDiscounted ?? 0),
            generatedDebtAmount: Number(record.generatedDebtAmount ?? 0),
          });

          return {
            id: record.id,
            title: record.slotMachine.uniqueMachineNumber,
            summary: `Cliente ${record.slotMachine.clientSequenceNumber}${record.slotMachine.clientName ? " - " + record.slotMachine.clientName : ""}`,
            details: [
              `Conferencias: ${record.conferenceCount}`,
              `Mode: ${record.debtMode}`,
              `Entrada: ${formatCurrency(currentIncome)}`,
              `Cliente: ${formatCurrency(clientShareFinal)}`,
              `Casa: ${formatCurrency(houseAmount)}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(houseAmount),
            amountValue: houseAmount,
            incomeValue: clientShareFinal + houseAmount,
            expenseValue: Number(record.negativeAmount ?? 0) + Number(record.feedingNegativeAmount ?? 0),
            badge: record.slotMachine.active ? "Ativa" : "Inativa",
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "credito-financeiro": {
        const records = await prisma.machineContract.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const netAmount = Number(record.amount) - Number(record.expenseAmount ?? 0);
          const signed = Boolean(record.signatureLink || record.signatureFileId);

          return {
            id: record.id,
            title: record.clientName,
            summary: `Contrato ${record.clientCode}`,
            details: [
              `Ano: ${record.year}`,
              `Juros: ${record.monthlyInterest ?? 0}%`,
              `Garantia: ${record.guaranteeEnabled ? "Sim" : "Nao"}`,
              `Assinatura: ${signed ? "Sim" : "Pendente"}`,
              `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: Number(record.amount),
            expenseValue: Number(record.expenseAmount ?? 0),
            badge: record.status,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "mercado-autonomo": {
        const records = await prisma.condominiumMarketEntry.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const netAmount =
            record.direction === "EXPENSE"
              ? -(Number(record.amount) + Number(record.expenseAmount ?? 0))
              : Number(record.amount) - Number(record.expenseAmount ?? 0);

          return {
            id: record.id,
            title: record.description,
            summary: `Movimento ${record.direction}`,
            details: [
              `Data: ${formatShortDate(record.movementDate)}`,
              `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
              `Saldo: ${formatCurrency(netAmount)}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: record.direction === "EXPENSE" ? 0 : Number(record.amount),
            expenseValue:
              record.direction === "EXPENSE"
                ? Number(record.amount) + Number(record.expenseAmount ?? 0)
                : Number(record.expenseAmount ?? 0),
            badge: record.direction,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "marketing": {
        const records = await prisma.marketingContract.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const signed = Boolean(record.signatureLink || record.signatureFileId);
          const grossAmount = Number(record.contractValue);
          const netAmount = grossAmount - Number(record.expenseAmount ?? 0);

          return {
            id: record.id,
            title: record.name,
            summary: record.serviceType,
            details: [
              `Tipo: ${record.personType}`,
              `Data: ${formatShortDate(record.contractDate)}`,
              `Assinatura: ${signed ? "Sim" : "Pendente"}`,
              `Status: ${record.status}`,
              `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: grossAmount,
            expenseValue: Number(record.expenseAmount ?? 0),
            badge: record.status,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "plataforma-online": {
        const records = await prisma.brazilBetsEntry.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const netAmount = record.direction === "EXPENSE" ? -Number(record.amount) : Number(record.amount);

          return {
            id: record.id,
            title: record.description,
            summary: `Movimento ${record.direction}`,
            details: [
              `Data: ${formatShortDate(record.movementDate)}`,
              `Status: ${record.status}`,
              `Liquido: ${formatCurrency(netAmount)}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: record.direction === "EXPENSE" ? 0 : Number(record.amount),
            expenseValue: record.direction === "EXPENSE" ? Number(record.amount) : 0,
            badge: record.status,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "locacao": {
        const records = await prisma.rentalOrder.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.clientName ?? record.localName,
          summary: record.contractNumber ? `Contrato ${record.contractNumber}` : record.localName,
          details: [
            `Data: ${formatShortDate(record.eventDate)}`,
            `Sinal: ${formatCurrency(Number(record.signalAmount ?? 0))}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
            `Saldo: ${formatCurrency(Number(record.balanceAmount ?? 0))}`,
            `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
          ],
          amount: formatCurrency(Number(record.balanceAmount ?? record.totalAmount)),
          amountValue: Number(record.balanceAmount ?? record.totalAmount),
          incomeValue: Number(record.totalAmount),
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: record.paymentStatus,
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "financas-pessoais": {
        const records = await prisma.personalFinanceRecord.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const signedAmount = record.type === "INCOME" ? Number(record.amount) : -Number(record.amount);

          return {
            id: record.id,
            title: record.title,
            summary: record.category,
            details: [
              `Tipo: ${record.type}`,
              `Data: ${formatShortDate(record.dueDate ?? record.createdAt)}`,
              `Pagamento: ${record.paymentMethod ?? "NAO INFORMADO"}`,
            ],
            amount: formatCurrency(signedAmount),
            amountValue: signedAmount,
            incomeValue: record.type === "INCOME" ? Number(record.amount) : 0,
            expenseValue: record.type === "INCOME" ? 0 : Number(record.amount),
            badge: record.type,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      default:
        return [];
    }
  } catch (error) {
    console.error(`[module-record-service] listModuleRecords (${slug}) falhou, retornando dados locais:`, error);
    return listLocalRecords(session, slug, take);
  }
}

export type ModuleClientItem = {
  id: string;
  name: string;
  subtitle?: string;
  tags: string[];
  badge?: string;
  phone?: string;
};

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export async function listModuleClients(
  session: SessionData,
  slug: ModuleSlug,
  take = 30,
): Promise<ModuleClientItem[]> {
  try {
    switch (slug) {
      case "bilhar-pebolim": {
        const points = await prisma.billiardPoint.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { updatedAt: "desc" },
          take,
        });

        return points.map((point) => ({
          id: point.id,
          name: point.clientName || point.name,
          subtitle: `${point.name} - ${point.tableModel ?? "Mesa nao informada"}`,
          tags: [point.phone, point.cpf, point.cnpj, point.city].filter(Boolean) as string[],
          badge: `${formatCurrency(Number(point.chipValue ?? 0))}/ficha`,
          phone: point.phone ?? undefined,
        }));
      }
      case "bx": {
        const records = await prisma.bxTransaction.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });

        return dedupeByKey(records, (r) => r.clientName)
          .slice(0, take)
          .map((record) => ({
            id: record.id,
            name: record.clientName,
            subtitle: `Recolhe ${record.collectNumber ?? "-"}`,
            tags: [record.phone, record.cpf].filter(Boolean) as string[],
            badge: formatCurrency(Number(record.totalAmount)),
            phone: record.phone ?? undefined,
          }));
      }
      case "carreta-kids": {
        const records = await prisma.carretaKidsRecord.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });

        return dedupeByKey(records, (r) => `${r.sheetName}-${r.phone ?? ""}`)
          .slice(0, take)
          .map((record) => ({
            id: record.id,
            name: record.sheetName,
            subtitle: record.locationName,
            tags: [record.phone].filter(Boolean) as string[],
            badge: formatCurrency(Number(record.totalAmount)),
            phone: record.phone ?? undefined,
          }));
      }
      case "maquinas-de-pelucia": {
        const machines = await prisma.plushMachine.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { updatedAt: "desc" },
          take,
        });

        return machines.map((machine) => ({
          id: machine.id,
          name: machine.clientName || machine.name,
          subtitle: `${machine.name} - Maquina ${machine.machineNumber}`,
          tags: [machine.phone, machine.cpf, machine.code].filter(Boolean) as string[],
          badge: machine.active ? "Ativa" : "Inativa",
        }));
      }
      case "h-caca-niquel": {
        const machines = await prisma.slotMachine.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { updatedAt: "desc" },
          take,
        });

        return machines.map((machine) => ({
          id: machine.id,
          name: machine.clientName || `Maquina ${machine.uniqueMachineNumber}`,
          subtitle: `Maquina ${machine.uniqueMachineNumber} - Cliente ${machine.clientSequenceNumber}`,
          tags: [machine.phone, machine.cpf].filter(Boolean) as string[],
          badge: machine.active ? "Ativa" : "Inativa",
        }));
      }
      case "credito-financeiro": {
        const records = await prisma.machineContract.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });

        return dedupeByKey(records, (r) => r.clientCode)
          .slice(0, take)
          .map((record) => ({
            id: record.id,
            name: record.clientName,
            subtitle: `Codigo ${record.clientCode}`,
            tags: [record.status],
            badge: formatCurrency(Number(record.amount)),
          }));
      }
      case "marketing": {
        const records = await prisma.marketingContract.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });

        return dedupeByKey(records, (r) => `${r.name}-${r.cpf ?? r.cnpj ?? ""}`)
          .slice(0, take)
          .map((record) => ({
            id: record.id,
            name: record.name,
            subtitle: record.serviceType,
            tags: [record.cpf, record.cnpj, record.phone].filter(Boolean) as string[],
            badge: record.status,
          }));
      }
      case "locacao": {
        const records = await prisma.rentalOrder.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });

        return dedupeByKey(records, (r) => r.clientName ?? r.id)
          .slice(0, take)
          .map((record) => ({
            id: record.id,
            name: record.clientName ?? record.localName,
            subtitle: record.localName,
            tags: [record.phone, record.document].filter(Boolean) as string[],
            badge: record.paymentStatus,
            phone: record.phone ?? undefined,
          }));
      }
      default:
        return [];
    }
  } catch (error) {
    console.error(`[module-record-service] listModuleClients (${slug}) falhou:`, error);
    return [];
  }
}

export async function listModuleVisitTargets(
  session: SessionData,
  slug: ModuleSlug,
): Promise<ClientListItem[]> {
  const items = await listModuleClients(session, slug, 200);

  return items.map((item) => ({
    id: item.id,
    code: item.id.slice(0, 8),
    name: item.name,
    phone: item.phone ?? "",
    city: item.subtitle ?? "",
    status: item.badge === "Inativa" ? ("inativo" as const) : ("ativo" as const),
    balance: 0,
    updatedAt: new Date().toISOString(),
  }));
}
