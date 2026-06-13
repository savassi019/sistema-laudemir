import type {
  BxReceiptStatus,
  ContractStatus,
  FinancialDirection,
  FinancialStatus,
  MachineCompensationStatus,
  PaymentMethod,
  SlotDebtMode,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/types/app";

export type ModuleSlug =
  | "carreta-kids"
  | "maquinas-de-pelucia"
  | "bilhar-pebolim"
  | "bx"
  | "h-caca-niquel"
  | "credito-financeiro"
  | "mercado-autonomo"
  | "marketing"
  | "plataforma-online";

export type ModuleRecordItem = {
  id: string;
  title: string;
  summary: string;
  details: string[];
  amount?: string;
  badge?: string;
  createdAt: string;
};

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

const debtModeMap: Record<string, SlotDebtMode> = {
  NONE: "NONE",
  MANUAL: "DEBT",
  AUTO: "NEGATIVE",
};

const compensationMap: Record<string, MachineCompensationStatus> = {
  DRAFT: "WORTH_IT",
  OPEN: "WORTH_IT",
  CLOSED: "NOT_WORTH_IT",
};

const createCarretaSchema = z.object({
  localName: z.string(),
  serviceDate: z.string(),
  sheetName: z.string(),
  phone: z.string().optional(),
  minutesCharged: z.string(),
  paymentMethod: z.string(),
  entryAmount: z.number(),
  exitAmount: z.number(),
  notes: z.string().optional(),
});

const createPlushSchema = z.object({
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
  compensationStatus: z.string(),
  noteiro: z.string().optional(),
  notes: z.string().optional(),
});

const createBilliardSchema = z.object({
  clientName: z.string(),
  pointName: z.string(),
  phone: z.string().optional(),
  city: z.string(),
  neighborhood: z.string(),
  state: z.string(),
  tableModel: z.string(),
  chipValue: z.number(),
  quantityOfChips: z.number(),
  percentage: z.number(),
  roofDebt: z.number(),
  roofPaymentMethod: z.string(),
  employeeCost: z.number(),
  installationCost: z.number(),
  maintenanceCost: z.number(),
  otherCost: z.number(),
  routeNumber: z.number(),
  partialRoute: z.string().optional(),
  maintenanceDate: z.string(),
  notes: z.string().optional(),
});

const createBxSchema = z.object({
  clientName: z.string(),
  collectNumber: z.string(),
  agentName: z.string(),
  receiverName: z.string(),
  occurredAt: z.string(),
  sentToAgentAmount: z.number(),
  deliveredAmount: z.number(),
  incomeAmount: z.number(),
  expenseAmount: z.number(),
  discountAmount: z.number(),
  receiptStatus: z.string(),
  exceptionClient: z.boolean(),
  notes: z.string().optional(),
  screenPhotoName: z.string().optional(),
  paperPhotoName: z.string().optional(),
});

const createSlotSchema = z.object({
  uniqueMachineNumber: z.string(),
  clientSequenceNumber: z.string(),
  customerDebt: z.number().optional(),
  ppValue: z.number().optional(),
  initialAmount: z.number().optional(),
  initialAmountMode: z.string(),
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
  debtMode: z.string(),
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
  digitalSignature: z.boolean(),
  streetLoanAmount: z.number().optional(),
  monthlyInterestTotal: z.number().optional(),
  generalPercentageAvg: z.number().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

const createMarketSchema = z.object({
  movementDate: z.string(),
  description: z.string(),
  direction: z.string(),
  amount: z.number(),
  expenseAmount: z.number(),
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
  digitalSignature: z.boolean(),
  status: z.string(),
  notes: z.string().optional(),
});

const createPlatformSchema = z.object({
  movementDate: z.string(),
  description: z.string(),
  direction: z.string(),
  status: z.string(),
  amount: z.number(),
  notes: z.string().optional(),
});

function toDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`);
}

function buildKey(session: SessionData, slug: ModuleSlug) {
  return `${session.organizationId}:${slug}`;
}

function pushLocalRecord(session: SessionData, slug: ModuleSlug, record: ModuleRecordItem) {
  const key = buildKey(session, slug);
  const existing = moduleRecordStore.get(key) ?? [];
  moduleRecordStore.set(key, [record, ...existing].slice(0, 20));
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

function mapDebtMode(value: string) {
  return debtModeMap[value] ?? "NONE";
}

function mapCompensationStatus(value: string) {
  return compensationMap[value] ?? "WORTH_IT";
}

function buildCarretaRecord(data: z.infer<typeof createCarretaSchema>): ModuleRecordItem {
  const total = data.entryAmount - data.exitAmount + (data.minutesCharged === "15" ? 20 : data.minutesCharged === "30" ? 30 : 40);

  return {
    id: randomUUID(),
    title: data.localName,
    summary: `Ficha ${data.sheetName}`,
    details: [
      `Data: ${formatShortDate(data.serviceDate)}`,
      `Pagamento: ${data.paymentMethod}`,
      `Entrada: ${formatCurrency(data.entryAmount)}`,
      `Saida: ${formatCurrency(data.exitAmount)}`,
    ],
    amount: formatCurrency(total),
    badge: `${data.minutesCharged} min`,
    createdAt: new Date().toISOString(),
  };
}

function buildPlushRecord(data: z.infer<typeof createPlushSchema>): ModuleRecordItem {
  const grossAmount = data.grossAmount;
  const clientAmount = grossAmount * (data.commissionPercentage / 100);
  const companyAmount = grossAmount - clientAmount - (data.discountAmount ?? 0) - (data.ownerExpenseAmount ?? 0);

  return {
    id: randomUUID(),
    title: data.name,
    summary: `Maquina ${data.machineNumber}`,
    details: [
      `Codigo: ${data.code}`,
      `Fichas: ${data.plushCountOut}`,
      `Comissao: ${data.commissionPercentage}%`,
      `Compensacao: ${data.compensationStatus}`,
    ],
    amount: formatCurrency(companyAmount),
    badge: data.active ? "Ativa" : "Inativa",
    createdAt: new Date().toISOString(),
  };
}

function buildBilliardRecord(data: z.infer<typeof createBilliardSchema>): ModuleRecordItem {
  const grossAmount = data.quantityOfChips * data.chipValue;
  const clientShare = grossAmount * (data.percentage / 100);
  const companyShare =
    grossAmount -
    clientShare -
    data.employeeCost -
    data.installationCost -
    data.maintenanceCost -
    data.otherCost -
    data.roofDebt;

  return {
    id: randomUUID(),
    title: data.pointName,
    summary: data.tableModel,
    details: [
      `Cidade: ${data.city}`,
      `Rota: ${data.routeNumber}`,
      `Fichas: ${data.quantityOfChips}`,
      `Manutencao: ${formatShortDate(data.maintenanceDate)}`,
    ],
    amount: formatCurrency(companyShare),
    badge: data.quantityOfChips >= 1500 ? "Trocar pano" : "OK",
    createdAt: new Date().toISOString(),
  };
}

function buildBxRecord(data: z.infer<typeof createBxSchema>): ModuleRecordItem {
  const netAmount = data.incomeAmount - data.expenseAmount - data.discountAmount;

  return {
    id: randomUUID(),
    title: data.clientName,
    summary: `Recolhe ${data.collectNumber}`,
    details: [
      `Agente: ${data.agentName}`,
      `Recebeu: ${data.receiverName}`,
      `Status: ${data.receiptStatus}`,
      data.exceptionClient ? "Cliente excecao" : "Fluxo padrao",
    ],
    amount: formatCurrency(netAmount),
    badge: data.receiptStatus === "RECEIVED" ? "Recebido" : "Nao recebido",
    createdAt: new Date().toISOString(),
  };
}

function buildSlotRecord(data: z.infer<typeof createSlotSchema>): ModuleRecordItem {
  const splitAmount = data.currentIncome * (data.percentageSplit / 100);
  const houseAmount =
    data.currentIncome -
    splitAmount -
    (data.negativeAmount ?? 0) -
    (data.feedingNegativeAmount ?? 0) -
    (data.customerDebtDiscounted ?? 0) +
    (data.generatedDebtAmount ?? 0);

  return {
    id: randomUUID(),
    title: data.uniqueMachineNumber,
    summary: `Cliente ${data.clientSequenceNumber}`,
    details: [
      `Conferencias: ${data.conferenceCount}`,
      `Mode: ${data.debtMode}`,
      `Entrada: ${formatCurrency(data.currentIncome)}`,
      `Casa: ${formatCurrency(houseAmount)}`,
    ],
    amount: formatCurrency(houseAmount),
    badge: data.active ? "Ativa" : "Inativa",
    createdAt: new Date().toISOString(),
  };
}

function buildMachineContractRecord(
  data: z.infer<typeof createMachineContractSchema>,
): ModuleRecordItem {
  const monthlyCharge = data.amount * ((data.monthlyInterest ?? 0) / 100);

  return {
    id: randomUUID(),
    title: data.clientName,
    summary: `Contrato ${data.clientCode}`,
    details: [
      `Ano: ${data.year}`,
      `Juros: ${data.monthlyInterest ?? 0}%`,
      `Garantia: ${data.guaranteeEnabled ? "Sim" : "Nao"}`,
      `Assinatura: ${data.digitalSignature ? "Sim" : "Nao"}`,
    ],
    amount: formatCurrency(monthlyCharge),
    badge: data.status,
    createdAt: new Date().toISOString(),
  };
}

function buildMarketRecord(data: z.infer<typeof createMarketSchema>): ModuleRecordItem {
  const netAmount = data.direction === "SAIDA" ? -(data.amount + data.expenseAmount) : data.amount - data.expenseAmount;

  return {
    id: randomUUID(),
    title: data.description,
    summary: `Movimento ${data.direction}`,
    details: [
      `Data: ${formatShortDate(data.movementDate)}`,
      `Despesa: ${formatCurrency(data.expenseAmount)}`,
      `Saldo: ${formatCurrency(netAmount)}`,
    ],
    amount: formatCurrency(netAmount),
    badge: data.direction,
    createdAt: new Date().toISOString(),
  };
}

function buildMarketingRecord(data: z.infer<typeof createMarketingSchema>): ModuleRecordItem {
  const signedAmount = data.digitalSignature ? data.contractValue * 0.95 : data.contractValue;

  return {
    id: randomUUID(),
    title: data.name,
    summary: data.serviceType,
    details: [
      `Tipo: ${data.personType}`,
      `Data: ${formatShortDate(data.contractDate)}`,
      `Assinatura: ${data.digitalSignature ? "Sim" : "Nao"}`,
      `Status: ${data.status}`,
    ],
    amount: formatCurrency(signedAmount),
    badge: data.status,
    createdAt: new Date().toISOString(),
  };
}

function buildPlatformRecord(data: z.infer<typeof createPlatformSchema>): ModuleRecordItem {
  const netAmount = data.direction === "SAIDA" ? -data.amount : data.amount;

  return {
    id: randomUUID(),
    title: data.description,
    summary: `Movimento ${data.direction}`,
    details: [
      `Data: ${formatShortDate(data.movementDate)}`,
      `Status: ${data.status}`,
      `Liquido: ${formatCurrency(netAmount)}`,
    ],
    amount: formatCurrency(netAmount),
    badge: data.status,
    createdAt: new Date().toISOString(),
  };
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
          totalAmount: basePrice + data.entryAmount - data.exitAmount,
          paymentMethod: mapPaymentMethod(data.paymentMethod),
          entryAmount: data.entryAmount,
          exitAmount: data.exitAmount,
          notes: data.notes,
        },
      });

      return {
        record: {
          id: record.id,
          title: record.locationName,
          summary: `Ficha ${record.sheetName}`,
          details: [
            `Data: ${formatShortDate(record.serviceDate)}`,
            `Pagamento: ${data.paymentMethod}`,
            `Entrada: ${formatCurrency(Number(record.entryAmount ?? 0))}`,
            `Saida: ${formatCurrency(Number(record.exitAmount ?? 0))}`,
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
          compensationStatus: mapCompensationStatus(data.compensationStatus),
          noteiro: data.noteiro,
        },
        include: {
          plushMachine: true,
        },
      });

      return {
        record: {
          id: record.id,
          title: record.plushMachine.name,
          summary: `Maquina ${record.plushMachine.machineNumber}`,
          details: [
            `Codigo: ${record.plushMachine.code}`,
            `Fichas: ${record.plushCountOut}`,
            `Comissao: ${record.commissionPercentage}%`,
            `Compensacao: ${record.compensationStatus}`,
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
      const point = await prisma.billiardPoint.upsert({
        where: {
          organizationId_code: {
            organizationId: session.organizationId,
            code: `P${data.routeNumber}`,
          },
        },
        create: {
          organizationId: session.organizationId,
          createdById: session.userId,
          code: `P${data.routeNumber}`,
          name: data.pointName,
          city: data.city,
          neighborhood: data.neighborhood,
          state: data.state,
          phone: data.phone,
          tableModel: data.tableModel,
          chipValue: data.chipValue,
          roofOpenDebt: data.roofDebt,
          routeNumber: data.routeNumber,
          partialRoute: data.partialRoute,
        },
        update: {
          name: data.pointName,
          city: data.city,
          neighborhood: data.neighborhood,
          state: data.state,
          phone: data.phone,
          tableModel: data.tableModel,
          chipValue: data.chipValue,
          roofOpenDebt: data.roofDebt,
          routeNumber: data.routeNumber,
          partialRoute: data.partialRoute,
        },
      });

      const grossAmount = data.quantityOfChips * data.chipValue;
      const record = await prisma.billiardCollection.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          billiardPointId: point.id,
          collectionDate: toDate(data.maintenanceDate),
          quantityOfChips: data.quantityOfChips,
          grossAmount,
          percentage: data.percentage,
          roofAmount: data.roofDebt,
          roofPaymentMethod: mapPaymentMethod(data.roofPaymentMethod),
          employeeCost: data.employeeCost,
          installationCost: data.installationCost,
          maintenanceCost: data.maintenanceCost,
          otherCost: data.otherCost,
          registerNumber: String(data.routeNumber),
        },
        include: { billiardPoint: true },
      });

      await prisma.billiardMaintenance.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          billiardPointId: point.id,
          maintenanceDate: toDate(data.maintenanceDate),
          notes: data.notes,
          status: "SCHEDULED",
        },
      });

      const companyShare =
        grossAmount * (1 - data.percentage / 100) -
        data.employeeCost -
        data.installationCost -
        data.maintenanceCost -
        data.otherCost -
        data.roofDebt;

      return {
        record: {
          id: record.id,
          title: record.billiardPoint.name,
          summary: record.billiardPoint.tableModel ?? "Mesa de bilhar",
          details: [
            `Cidade: ${record.billiardPoint.city ?? "-"}`,
            `Rota: ${record.billiardPoint.routeNumber ?? "-"}`,
            `Fichas: ${record.quantityOfChips}`,
            `Manutencao: ${formatShortDate(record.collectionDate)}`,
          ],
          amount: formatCurrency(companyShare),
          badge: record.quantityOfChips >= 1500 ? "Trocar pano" : "OK",
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
          collectNumber: data.collectNumber,
          occurredAt: toDate(data.occurredAt),
          sentToAgentAmount: data.sentToAgentAmount,
          deliveredAmount: data.deliveredAmount,
          incomeAmount: data.incomeAmount,
          expenseAmount: data.expenseAmount,
          totalAmount: data.incomeAmount - data.expenseAmount - data.discountAmount,
          discountAmount: data.discountAmount,
          exceptionClient: data.exceptionClient,
          receiptStatus: data.receiptStatus as BxReceiptStatus,
        },
      });

      return {
        record: {
          id: record.id,
          title: record.clientName,
          summary: `Recolhe ${record.collectNumber ?? "-"}`,
          details: [
            `Agente: ${data.agentName}`,
            `Recebeu: ${data.receiverName}`,
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
          clientSequenceNumber: data.clientSequenceNumber,
          customerDebt: data.customerDebt ?? 0,
          ppValue: data.ppValue ?? 0,
          initialAmount: data.initialAmount ?? 0,
          initialAmountMode: mapDebtMode(data.initialAmountMode),
          optionalGreedAmount: data.optionalGreedAmount ?? 0,
          active: data.active ?? true,
        },
        update: {
          clientSequenceNumber: data.clientSequenceNumber,
          customerDebt: data.customerDebt ?? 0,
          ppValue: data.ppValue ?? 0,
          initialAmount: data.initialAmount ?? 0,
          initialAmountMode: mapDebtMode(data.initialAmountMode),
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
          negativeAmount: data.negativeAmount,
          feedingNegativeAmount: data.feedingNegativeAmount,
          customerDebtDiscounted: data.customerDebtDiscounted,
          generatedDebtAmount: data.generatedDebtAmount,
          debtMode: mapDebtMode(data.debtMode),
        },
        include: { slotMachine: true },
      });

      const splitAmount = data.currentIncome * (data.percentageSplit / 100);
      const houseAmount =
        data.currentIncome -
        splitAmount -
        (data.negativeAmount ?? 0) -
        (data.feedingNegativeAmount ?? 0) -
        (data.customerDebtDiscounted ?? 0) +
        (data.generatedDebtAmount ?? 0);

      return {
        record: {
          id: record.id,
          title: record.slotMachine.uniqueMachineNumber,
          summary: `Cliente ${record.slotMachine.clientSequenceNumber}`,
          details: [
            `Conferencias: ${record.conferenceCount}`,
            `Mode: ${record.debtMode}`,
            `Entrada: ${formatCurrency(Number(record.currentIncome))}`,
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
          digitalSignature: data.digitalSignature,
          streetLoanAmount: data.streetLoanAmount,
          monthlyInterestTotal: data.monthlyInterestTotal,
          generalPercentageAvg: data.generalPercentageAvg,
          status: mapContractStatus(data.status),
          notes: data.notes,
        },
      });

      return {
        record: {
          id: record.id,
          title: record.clientName,
          summary: `Contrato ${record.clientCode}`,
          details: [
            `Ano: ${record.year}`,
            `Juros: ${record.monthlyInterest ?? 0}%`,
            `Garantia: ${record.guaranteeEnabled ? "Sim" : "Nao"}`,
            `Assinatura: ${record.digitalSignature ? "Sim" : "Nao"}`,
          ],
          amount: formatCurrency(Number(record.amount)),
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
          digitalSignature: data.digitalSignature,
          status: mapContractStatus(data.status),
        },
      });

      const signedAmount = data.digitalSignature ? data.contractValue * 0.95 : data.contractValue;

      return {
        record: {
          id: record.id,
          title: record.name,
          summary: record.serviceType,
          details: [
            `Tipo: ${data.personType}`,
            `Data: ${formatShortDate(record.contractDate)}`,
            `Assinatura: ${record.digitalSignature ? "Sim" : "Nao"}`,
            `Status: ${record.status}`,
          ],
          amount: formatCurrency(signedAmount),
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
    default:
      throw new Error("Modulo nao suportado.");
  }
}

export async function saveModuleRecord(
  session: SessionData,
  slug: ModuleSlug,
  payload: Record<string, unknown>,
) {
  try {
    return await saveWithPrisma(session, slug, payload);
  } catch {
    let record: ModuleRecordItem;

    switch (slug) {
      case "carreta-kids":
        record = buildCarretaRecord(createCarretaSchema.parse(payload));
        break;
      case "maquinas-de-pelucia":
        record = buildPlushRecord(createPlushSchema.parse(payload));
        break;
      case "bilhar-pebolim":
        record = buildBilliardRecord(createBilliardSchema.parse(payload));
        break;
      case "bx":
        record = buildBxRecord(createBxSchema.parse(payload));
        break;
      case "h-caca-niquel":
        record = buildSlotRecord(createSlotSchema.parse(payload));
        break;
      case "credito-financeiro":
        record = buildMachineContractRecord(createMachineContractSchema.parse(payload));
        break;
      case "mercado-autonomo":
        record = buildMarketRecord(createMarketSchema.parse(payload));
        break;
      case "marketing":
        record = buildMarketingRecord(createMarketingSchema.parse(payload));
        break;
      case "plataforma-online":
        record = buildPlatformRecord(createPlatformSchema.parse(payload));
        break;
      default:
        throw new Error("Modulo nao suportado.");
    }

    pushLocalRecord(session, slug, record);

    return {
      record,
      source: "local" as const,
    };
  }
}

export async function listModuleRecords(
  session: SessionData,
  slug: ModuleSlug,
  take = 5,
): Promise<ModuleRecordItem[]> {
  try {
    switch (slug) {
      case "carreta-kids": {
        const records = await prisma.carretaKidsRecord.findMany({
          where: { organizationId: session.organizationId },
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
            `Entrada: ${formatCurrency(Number(record.entryAmount ?? 0))}`,
            `Saida: ${formatCurrency(Number(record.exitAmount ?? 0))}`,
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          badge: `${record.minutesCharged} min`,
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "maquinas-de-pelucia": {
        const records = await prisma.plushCollection.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take,
          include: { plushMachine: true },
        });

        return records.map((record) => ({
          id: record.id,
          title: record.plushMachine.name,
          summary: `Maquina ${record.plushMachine.machineNumber}`,
          details: [
            `Codigo: ${record.plushMachine.code}`,
            `Fichas: ${record.plushCountOut}`,
            `Comissao: ${record.commissionPercentage}%`,
            `Compensacao: ${record.compensationStatus}`,
          ],
          amount: formatCurrency(Number(record.companyAmount)),
          badge: record.plushMachine.active ? "Ativa" : "Inativa",
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "bilhar-pebolim": {
        const records = await prisma.billiardCollection.findMany({
          where: { organizationId: session.organizationId },
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
              `Cidade: ${record.billiardPoint.city ?? "-"}`,
              `Rota: ${record.billiardPoint.routeNumber ?? "-"}`,
              `Fichas: ${record.quantityOfChips}`,
              `Manutencao: ${formatShortDate(record.collectionDate)}`,
            ],
            amount: formatCurrency(companyShare),
            badge: record.quantityOfChips >= 1500 ? "Trocar pano" : "OK",
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "bx": {
        const records = await prisma.bxTransaction.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.clientName,
          summary: `Recolhe ${record.collectNumber ?? "-"}`,
          details: [
            `Status: ${record.receiptStatus}`,
            `Entrada: ${formatCurrency(Number(record.incomeAmount ?? 0))}`,
            `Saida: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          badge: record.receiptStatus === "RECEIVED" ? "Recebido" : "Nao recebido",
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "h-caca-niquel": {
        const records = await prisma.slotCollection.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take,
          include: { slotMachine: true },
        });

        return records.map((record) => {
          const currentIncome = Number(record.currentIncome);
          const splitAmount = currentIncome * (Number(record.percentageSplit ?? 0) / 100);
          const houseAmount =
            currentIncome -
            splitAmount -
            Number(record.negativeAmount ?? 0) -
            Number(record.feedingNegativeAmount ?? 0) -
            Number(record.customerDebtDiscounted ?? 0) +
            Number(record.generatedDebtAmount ?? 0);

          return {
            id: record.id,
            title: record.slotMachine.uniqueMachineNumber,
            summary: `Cliente ${record.slotMachine.clientSequenceNumber}`,
            details: [
              `Conferencias: ${record.conferenceCount}`,
              `Mode: ${record.debtMode}`,
              `Entrada: ${formatCurrency(currentIncome)}`,
              `Casa: ${formatCurrency(houseAmount)}`,
            ],
            amount: formatCurrency(houseAmount),
            badge: record.slotMachine.active ? "Ativa" : "Inativa",
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "credito-financeiro": {
        const records = await prisma.machineContract.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.clientName,
          summary: `Contrato ${record.clientCode}`,
          details: [
            `Ano: ${record.year}`,
            `Juros: ${record.monthlyInterest ?? 0}%`,
            `Garantia: ${record.guaranteeEnabled ? "Sim" : "Nao"}`,
            `Assinatura: ${record.digitalSignature ? "Sim" : "Nao"}`,
          ],
          amount: formatCurrency(Number(record.amount)),
          badge: record.status,
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "mercado-autonomo": {
        const records = await prisma.condominiumMarketEntry.findMany({
          where: { organizationId: session.organizationId },
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
            ],
            amount: formatCurrency(netAmount),
            badge: record.direction,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "marketing": {
        const records = await prisma.marketingContract.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => ({
          id: record.id,
          title: record.name,
          summary: record.serviceType,
          details: [
            `Tipo: ${record.personType}`,
            `Data: ${formatShortDate(record.contractDate)}`,
            `Assinatura: ${record.digitalSignature ? "Sim" : "Nao"}`,
            `Status: ${record.status}`,
          ],
          amount: formatCurrency(Number(record.contractValue)),
          badge: record.status,
          createdAt: record.createdAt.toISOString(),
        }));
      }
      case "plataforma-online": {
        const records = await prisma.brazilBetsEntry.findMany({
          where: { organizationId: session.organizationId },
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
            ],
            amount: formatCurrency(netAmount),
            badge: record.status,
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      default:
        return [];
    }
  } catch {
    return listLocalRecords(session, slug, take);
  }
}
