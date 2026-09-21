import {
  Prisma,
  type ContractStatus,
  type FinancialDirection,
  type FinancialStatus,
  type PaymentMethod,
  type PersonalEntryType,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_STATUS_LABEL,
  DIRECTION_LABEL,
  FINANCIAL_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PERSON_TYPE_LABEL,
  PERSONAL_ENTRY_TYPE_LABEL,
  RECEIPT_STATUS_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
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
  operatorName?: string;
  paymentMethod?: string | null;
  financialBreakdown?: ModuleFinancialBreakdownItem[];
  attachments?: { id: string; label: string }[];
  badge?: string;
  createdAt: string;
};

export type ModuleFinancialBreakdownItem = {
  direction: "INCOME" | "EXPENSE";
  category: string;
  categoryLabel: string;
  amount: number;
  status?: "PENDING" | "PAID";
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
  coinPhotoFileId: z.string().nullish(),
  giftPhotoFileId: z.string().nullish(),
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

const createBxSchema = z
  .object({
    clientName: z.string(),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    cep: z.string().optional(),
    street: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    // Quem fez a operacao passou a vir do login (session.name), nao mais de
    // um numero digitado -- opcional so pra nao quebrar quem ainda manda.
    // O funcionario responsavel e quem entregou ao cliente sao a mesma pessoa que fez o
    // fechamento -- tambem vem do login, o form nao manda mais esses campos.
    collectNumber: z.string().optional(),
    occurredAt: z.string(),
    sentToAgentAmount: z.number(),
    deliveredAmount: z.number(),
    incomeAmount: z.number(),
    expenseAmount: z.number(),
    discountAmount: z.number(),
    customerDebt: z.number().optional(),
    generatedDebtAmount: z.number().optional(),
    paymentMethod: z.string().optional(),
    receiptStatus: z.enum(["RECEIVED", "NOT_RECEIVED", "DELIVERED", "PRIZE"]),
    exceptionClient: z.boolean(),
    notes: z.string().optional(),
    screenPhotoFileId: z.string().nullish(),
    paperPhotoFileId: z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.receiptStatus === "DELIVERED" || data.receiptStatus === "PRIZE") &&
      data.deliveredAmount <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveredAmount"],
        message: "Informe o valor do premio.",
      });
    }
  });

const createSlotSchema = z.object({
  // Presente so quando volta numa maquina ja existente (veio do
  // initialClientId, que e o id real da SlotMachine). Ausente = maquina
  // nova, numero pro cliente e gerado pelo servidor.
  machineId: z.string().optional(),
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
  negativeAmount: z.number().optional(),
  feedingNegativeAmount: z.number().optional(),
  customerDebtDiscounted: z.number().optional(),
  generatedDebtAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  screenPhotoFileId: z.string().nullish(),
  notes: z.string().optional(),
});

const slotMoneySchema = z.number().finite().min(0).max(999_999_999_999.99);

const slotVisitMachineSchema = z.object({
  machineId: z.string().min(1),
  previousIncome: slotMoneySchema,
  currentIncome: slotMoneySchema,
  previousExpense: slotMoneySchema,
  currentExpense: slotMoneySchema,
  percentageSplit: z.number().finite().min(0).max(100),
  optionalGreedAmount: slotMoneySchema,
  previousMachineDebt: slotMoneySchema,
  finalMachineDebt: slotMoneySchema,
  feedingNegativeAmount: slotMoneySchema,
  previousCustomerDebt: slotMoneySchema,
  customerDebtDiscounted: slotMoneySchema,
  generatedDebtAmount: slotMoneySchema,
  screenPhotoFileId: z.string().min(1, "A foto da tela e obrigatoria."),
  notes: z.string().max(2_000).optional(),
});

const createSlotVisitSchema = z
  .object({
    visitKey: z.string().uuid("Identificador da visita invalido."),
    clientName: z.string().min(1, "Cliente nao informado."),
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida."),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    machines: z.array(slotVisitMachineSchema).min(1).max(200),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    data.machines.forEach((machine, index) => {
      if (ids.has(machine.machineId)) {
        ctx.addIssue({
          code: "custom",
          path: ["machines", index, "machineId"],
          message: "A mesma maquina foi enviada duas vezes.",
        });
      }
      ids.add(machine.machineId);
    });
  });

export class SlotVisitConflictError extends Error {}

export type SlotVisitMachineResult = {
  recordId: string;
  clientMachineNumber: number;
  clientShareFinal?: number;
  houseAmount?: number;
  previousMachineDebt?: number;
  finalMachineDebt?: number;
  previousCustomerDebt?: number;
  finalCustomerDebt?: number;
};

export type SlotVisitSaveResult = {
  visitKey: string;
  duplicate: boolean;
  clientName: string;
  results: SlotVisitMachineResult[];
};

const registerSlotClientSchema = z.object({
  clientName: z.string().min(1, "Informe o cliente."),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  machineCount: z.number().int().min(1).max(999),
});

/**
 * Cadastro do H: a quantidade de maquinas do cliente e decidida aqui, nao
 * uma por uma depois -- cria todas de uma vez, vazias, numeradas 1..N (ou
 * continuando de onde parou, se o cliente ja tinha maquinas). O fechamento
 * de cada uma acontece na visita, nao aqui.
 */
export async function registerSlotClient(
  session: SessionData,
  payload: Record<string, unknown>,
): Promise<{ clientName: string; created: number }> {
  const data = registerSlotClientSchema.parse(payload);
  const existentes = await prisma.slotMachine.count({
    where: { organizationId: session.organizationId, clientName: data.clientName },
  });

  await prisma.slotMachine.createMany({
    data: Array.from({ length: data.machineCount }, (_, i) => ({
      organizationId: session.organizationId,
      uniqueMachineNumber: randomUUID(),
      clientMachineNumber: existentes + i + 1,
      clientSequenceNumber: "1",
      clientName: data.clientName,
      phone: data.phone,
      cpf: data.cpf,
      cep: data.cep,
      street: data.street,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      customerDebt: 0,
      machineDebt: 0,
      ppValue: 0,
      initialAmount: 0,
      initialAmountMode: "NONE" as const,
      optionalGreedAmount: 0,
      active: true,
    })),
  });

  return { clientName: data.clientName, created: data.machineCount };
}

export type SlotClientMachine = {
  id: string;
  clientMachineNumber: number;
  previousIncome: number;
  previousExpense: number;
  percentageSplit: number;
  customerDebt: number;
  machineDebt: number;
  optionalGreedAmount: number;
  active: boolean;
};

/**
 * Todas as maquinas de um cliente do H, prontas pra visita em bloco --
 * cada uma ja vem com o "anterior" puxado sozinho do ultimo fechamento
 * dela. Ver [[project_slot_machine_per_client_numbering]].
 */
export async function getSlotClientMachines(
  session: SessionData,
  clientName: string,
): Promise<{ clientName: string; phone: string; machines: SlotClientMachine[] }> {
  const machines = await prisma.slotMachine.findMany({
    where: { organizationId: session.organizationId, clientName },
    orderBy: { clientMachineNumber: "asc" },
  });

  const results = await Promise.all(
    machines.map(async (m) => {
      const ultima = await prisma.slotCollection.findFirst({
        where: { slotMachineId: m.id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        select: { currentIncome: true, currentExpense: true, percentageSplit: true },
      });
      return {
        id: m.id,
        clientMachineNumber: m.clientMachineNumber,
        previousIncome: Number(ultima?.currentIncome ?? 0),
        previousExpense: Number(ultima?.currentExpense ?? 0),
        percentageSplit: Number(ultima?.percentageSplit ?? 50),
        customerDebt: Number(m.customerDebt ?? 0),
        machineDebt: Number(m.machineDebt ?? 0),
        optionalGreedAmount: Number(m.optionalGreedAmount ?? 0),
        active: m.active,
      };
    }),
  );

  return {
    clientName,
    phone: machines[0]?.phone ?? "",
    machines: results,
  };
}

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
  signatureFileId: z.string().nullish(),
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
  signatureFileId: z.string().nullish(),
  expenseAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  contractFileId: z.string().nullish(),
  status: z.string(),
  notes: z.string().optional(),
});

const createPlatformSchema = z.object({
  movementDate: z.string(),
  description: z.string(),
  direction: z.string(),
  status: z.string(),
  amount: z.number(),
  expenseAmount: z.number().optional(),
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
  return new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
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
  previousMachineDebt?: number;
  finalMachineDebt?: number;
  /** Registros antigos guardavam o saldo final neste campo. */
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
  const finalMachineDebt = data.finalMachineDebt ?? data.negativeAmount ?? 0;
  const machineDebtChange = finalMachineDebt - (data.previousMachineDebt ?? 0);
  // O saldo anterior nao pode ser descontado de novo a cada visita. Somente
  // a variacao do saldo pertence a esta conferencia.
  const totalNegative = machineDebtChange + (data.feedingNegativeAmount ?? 0);
  const adjustedTotal = netRevenue - totalNegative;
  const clientShareBase = adjustedTotal * (data.percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const greed = data.optionalGreedAmount ?? 0;
  const clientShareAfterGreed = clientShareBase - greed;
  const houseShareAfterGreed = houseShareBase + greed;
  const clientShareFinal = clientShareAfterGreed - (data.customerDebtDiscounted ?? 0);
  // Divida descontada sai do repasse do cliente e entra na Infinity. Antes o
  // valor era tirado do cliente, mas nao era somado a lugar nenhum.
  const houseAmount =
    houseShareAfterGreed +
    (data.customerDebtDiscounted ?? 0) -
    (data.generatedDebtAmount ?? 0);

  return {
    incomeDifference,
    expenseDifference,
    netRevenue,
    machineDebtChange,
    adjustedTotal,
    clientShareFinal,
    houseAmount,
  };
}

type SlotCollectionWithMachine = Prisma.SlotCollectionGetPayload<{
  include: { slotMachine: true };
}>;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sameMoney(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function mapSlotVisitMachineResult(
  session: SessionData,
  record: SlotCollectionWithMachine,
): SlotVisitMachineResult {
  const previousMachineDebt = Number(record.previousMachineDebt ?? 0);
  const finalMachineDebt = Number(record.negativeAmount ?? 0);
  const previousCustomerDebt = Number(record.previousCustomerDebt ?? 0);
  const finalCustomerDebt = Number(
    record.finalCustomerDebt ??
      Math.max(
        previousCustomerDebt +
          Number(record.generatedDebtAmount ?? 0) -
          Number(record.customerDebtDiscounted ?? 0),
        0,
      ),
  );
  const split = computeSlotSplit({
    currentIncome: Number(record.currentIncome),
    previousIncome: Number(record.previousIncome),
    currentExpense: Number(record.currentExpense),
    previousExpense: Number(record.previousExpense),
    percentageSplit: Number(record.percentageSplit),
    previousMachineDebt,
    finalMachineDebt,
    feedingNegativeAmount: Number(record.feedingNegativeAmount ?? 0),
    optionalGreedAmount: Number(record.optionalGreedAmount ?? 0),
    customerDebtDiscounted: Number(record.customerDebtDiscounted ?? 0),
    generatedDebtAmount: Number(record.generatedDebtAmount ?? 0),
  });
  const financials =
    session.role === "STAFF"
      ? {}
      : {
          clientShareFinal: split.clientShareFinal,
          houseAmount: split.houseAmount,
          previousMachineDebt,
          finalMachineDebt,
          previousCustomerDebt,
          finalCustomerDebt,
        };

  return {
    recordId: record.id,
    clientMachineNumber: record.slotMachine.clientMachineNumber,
    ...financials,
  };
}

function mapSlotCollectionRecord(
  session: SessionData,
  record: SlotCollectionWithMachine,
  operatorName: string,
): ModuleRecordItem {
  const previousMachineDebt = Number(record.previousMachineDebt ?? 0);
  const finalMachineDebt = Number(record.negativeAmount ?? 0);
  const previousCustomerDebt = Number(record.previousCustomerDebt ?? 0);
  const generatedDebt = Number(record.generatedDebtAmount ?? 0);
  const discountedDebt = Number(record.customerDebtDiscounted ?? 0);
  const finalCustomerDebt = Number(
    record.finalCustomerDebt ??
      Math.max(previousCustomerDebt + generatedDebt - discountedDebt, 0),
  );
  const currentIncome = Number(record.currentIncome);
  const previousIncome = Number(record.previousIncome);
  const currentExpense = Number(record.currentExpense);
  const previousExpense = Number(record.previousExpense);
  const split = computeSlotSplit({
    currentIncome,
    previousIncome,
    currentExpense,
    previousExpense,
    percentageSplit: Number(record.percentageSplit ?? 0),
    optionalGreedAmount: Number(record.optionalGreedAmount ?? 0),
    previousMachineDebt,
    finalMachineDebt,
    feedingNegativeAmount: Number(record.feedingNegativeAmount ?? 0),
    customerDebtDiscounted: discountedDebt,
    generatedDebtAmount: generatedDebt,
  });
  const paymentLabel = record.paymentMethod
    ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL)
    : "Não informado";
  const commonDetails = [
    `Conferência: ${record.conferenceCount}`,
    `Funcionário: ${operatorName}`,
    `Pagamento: ${paymentLabel}`,
    record.screenPhotoId ? "Foto da tela: anexada" : "Foto da tela: não anexada",
  ];
  const financialDetails = [
    `Leitura da entrada: ${formatCurrency(previousIncome)} → ${formatCurrency(currentIncome)}`,
    `Movimento da entrada: ${formatCurrency(split.incomeDifference)}`,
    `Leitura da saída: ${formatCurrency(previousExpense)} → ${formatCurrency(currentExpense)}`,
    `Movimento da saída: ${formatCurrency(split.expenseDifference)}`,
    `Débito da máquina: ${formatCurrency(previousMachineDebt)} → ${formatCurrency(finalMachineDebt)}`,
    `Movimento do débito: ${formatCurrency(split.machineDebtChange)}`,
    `Negativo de alimentação: ${formatCurrency(Number(record.feedingNegativeAmount ?? 0))}`,
    `Dívida do cliente: ${formatCurrency(previousCustomerDebt)} → ${formatCurrency(finalCustomerDebt)}`,
    `Dívida gerada: ${formatCurrency(generatedDebt)}`,
    `Dívida descontada: ${formatCurrency(discountedDebt)}`,
    `Repasse do cliente: ${formatCurrency(split.clientShareFinal)}`,
    `Resultado da Infinity: ${formatCurrency(split.houseAmount)}`,
  ];
  const financialBreakdown: ModuleFinancialBreakdownItem[] =
    split.houseAmount >= 0
      ? [
          {
            direction: "INCOME",
            category: "SLOT_INFINITY_RESULT",
            categoryLabel: "Resultado da Infinity",
            amount: split.houseAmount,
            status: record.paymentMethod === "OTHER" ? "PENDING" : "PAID",
          },
        ]
      : [
          {
            direction: "EXPENSE",
            category: "SLOT_NEGATIVE_RESULT",
            categoryLabel: "Resultado negativo da máquina",
            amount: Math.abs(split.houseAmount),
            status: "PAID",
          },
        ];
  const financialData =
    session.role === "STAFF"
      ? {}
      : {
          amount: formatCurrency(split.houseAmount),
          amountValue: split.houseAmount,
          incomeValue: Math.max(split.houseAmount, 0),
          expenseValue: Math.max(-split.houseAmount, 0),
          financialBreakdown,
        };

  return {
    id: record.id,
    title: record.slotMachine.clientName || `Máquina ${record.slotMachine.clientMachineNumber}`,
    summary: `Máquina ${record.slotMachine.clientMachineNumber}`,
    details:
      session.role === "STAFF" ? commonDetails : [...commonDetails, ...financialDetails],
    operatorName,
    paymentMethod: record.paymentMethod,
    attachments: record.screenPhotoId
      ? [{ id: record.screenPhotoId, label: "Foto da tela da máquina" }]
      : [],
    badge: `Máquina ${record.slotMachine.clientMachineNumber}`,
    createdAt: record.occurredAt.toISOString(),
    ...financialData,
  };
}

/**
 * Fecha todas as maquinas selecionadas em uma unica transacao. A visitKey e
 * persistida em cada coleta: se o celular repetir a requisicao, devolvemos o
 * mesmo resultado sem criar outro fechamento.
 */
export async function saveSlotVisit(
  session: SessionData,
  payload: Record<string, unknown>,
): Promise<SlotVisitSaveResult> {
  const data = createSlotVisitSchema.parse(payload);
  const machineIds = data.machines.map((machine) => machine.machineId);
  const sortedMachineIds = [...machineIds].sort();

  return prisma.$transaction(
    async (tx) => {
      const visitLockKey = `slot-visit-key:${session.organizationId}:${data.visitKey}`;
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${visitLockKey}))::text AS "lock"`,
      );
      // Serializa qualquer fechamento que envolva a mesma maquina. Assim duas
      // abas/celulares nao conseguem usar a mesma leitura anterior ao mesmo tempo.
      for (const machineId of sortedMachineIds) {
        const lockKey = `slot-visit:${session.organizationId}:${machineId}`;
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
        );
      }

      const alreadySaved = await tx.slotCollection.findMany({
        where: {
          organizationId: session.organizationId,
          visitKey: data.visitKey,
        },
        include: { slotMachine: true },
      });
      if (alreadySaved.length > 0) {
        const savedIds = new Set(alreadySaved.map((record) => record.slotMachineId));
        const sameVisit =
          alreadySaved.length === machineIds.length &&
          machineIds.every((machineId) => savedIds.has(machineId));
        if (!sameVisit) {
          throw new SlotVisitConflictError(
            "Este identificador de visita ja foi usado em outro fechamento.",
          );
        }
        const byMachine = new Map(
          alreadySaved.map((record) => [record.slotMachineId, record]),
        );
        return {
          visitKey: data.visitKey,
          duplicate: true,
          clientName: alreadySaved[0]?.slotMachine.clientName ?? data.clientName,
          results: machineIds.map((machineId) =>
            mapSlotVisitMachineResult(session, byMachine.get(machineId)!),
          ),
        };
      }

      const machines = await tx.slotMachine.findMany({
        where: {
          organizationId: session.organizationId,
          id: { in: machineIds },
        },
      });
      if (machines.length !== machineIds.length) {
        throw new SlotVisitConflictError(
          "Uma ou mais maquinas nao existem ou nao pertencem a esta empresa.",
        );
      }

      const machineById = new Map(machines.map((machine) => [machine.id, machine]));
      for (const machine of machines) {
        if ((machine.clientName ?? "") !== data.clientName) {
          throw new SlotVisitConflictError(
            "As maquinas selecionadas nao pertencem ao mesmo cliente.",
          );
        }
        if (!machine.active) {
          throw new SlotVisitConflictError(
            `A maquina ${machine.clientMachineNumber} esta inativa e nao pode ser fechada.`,
          );
        }
      }

      const photoIds = data.machines.map((machine) => machine.screenPhotoFileId);
      if (new Set(photoIds).size !== photoIds.length) {
        throw new SlotVisitConflictError("Cada maquina precisa ter sua propria foto da tela.");
      }
      const photos = await tx.fileAsset.findMany({
        where: {
          organizationId: session.organizationId,
          id: { in: photoIds },
          category: "PHOTO",
          uploadedById: session.userId,
          entityId: null,
        },
        select: { id: true },
      });
      if (photos.length !== photoIds.length) {
        throw new SlotVisitConflictError(
          "Uma das fotos nao foi encontrada. Tire as fotos novamente e tente salvar.",
        );
      }

      const occurredAt = toDate(data.occurredAt);
      const dayStart = new Date(occurredAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(occurredAt);
      dayEnd.setHours(23, 59, 59, 999);
      const persisted: SlotCollectionWithMachine[] = [];

      for (const input of data.machines) {
        const machine = machineById.get(input.machineId)!;
        const latest = await tx.slotCollection.findFirst({
          where: { slotMachineId: machine.id },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: { currentIncome: true, currentExpense: true },
        });
        const expectedPreviousIncome = Number(latest?.currentIncome ?? 0);
        const expectedPreviousExpense = Number(latest?.currentExpense ?? 0);
        const previousMachineDebt = Number(machine.machineDebt ?? 0);
        const previousCustomerDebt = Number(machine.customerDebt ?? 0);

        if (
          !sameMoney(input.previousIncome, expectedPreviousIncome) ||
          !sameMoney(input.previousExpense, expectedPreviousExpense) ||
          !sameMoney(input.previousMachineDebt, previousMachineDebt) ||
          !sameMoney(input.previousCustomerDebt, previousCustomerDebt)
        ) {
          throw new SlotVisitConflictError(
            `A maquina ${machine.clientMachineNumber} recebeu outro fechamento enquanto esta tela estava aberta. Volte e abra a visita novamente.`,
          );
        }
        if (input.currentIncome < expectedPreviousIncome) {
          throw new SlotVisitConflictError(
            `Na maquina ${machine.clientMachineNumber}, a entrada atual nao pode ser menor que a anterior.`,
          );
        }
        if (input.currentExpense < expectedPreviousExpense) {
          throw new SlotVisitConflictError(
            `Na maquina ${machine.clientMachineNumber}, a saida atual nao pode ser menor que a anterior.`,
          );
        }

        const debtAvailable = roundMoney(
          previousCustomerDebt + input.generatedDebtAmount,
        );
        if (input.customerDebtDiscounted > debtAvailable) {
          throw new SlotVisitConflictError(
            `Na maquina ${machine.clientMachineNumber}, a divida descontada supera o saldo disponivel.`,
          );
        }
        const finalCustomerDebt = roundMoney(
          debtAvailable - input.customerDebtDiscounted,
        );
        const finalMachineDebt = roundMoney(input.finalMachineDebt);

        const conferenceCount =
          (await tx.slotCollection.count({
            where: {
              slotMachineId: machine.id,
              occurredAt: { gte: dayStart, lte: dayEnd },
            },
          })) + 1;

        await tx.slotMachine.update({
          where: { id: machine.id },
          data: {
            customerDebt: finalCustomerDebt,
            machineDebt: finalMachineDebt,
            optionalGreedAmount: input.optionalGreedAmount,
          },
        });

        const record = await tx.slotCollection.create({
          data: {
            organizationId: session.organizationId,
            createdById: session.userId,
            slotMachineId: machine.id,
            visitKey: data.visitKey,
            occurredAt,
            currentIncome: input.currentIncome,
            previousIncome: expectedPreviousIncome,
            incomeDifference: roundMoney(input.currentIncome - expectedPreviousIncome),
            currentExpense: input.currentExpense,
            previousExpense: expectedPreviousExpense,
            expenseDifference: roundMoney(input.currentExpense - expectedPreviousExpense),
            percentageSplit: input.percentageSplit,
            optionalGreedAmount: input.optionalGreedAmount,
            conferenceCount,
            previousMachineDebt,
            negativeAmount: finalMachineDebt,
            feedingNegativeAmount: input.feedingNegativeAmount,
            previousCustomerDebt,
            customerDebtDiscounted: input.customerDebtDiscounted,
            generatedDebtAmount: input.generatedDebtAmount,
            finalCustomerDebt,
            paymentMethod: mapPaymentMethod(data.paymentMethod),
            screenPhotoId: input.screenPhotoFileId,
            notes: input.notes,
          },
          include: { slotMachine: true },
        });

        const split = computeSlotSplit({
          currentIncome: input.currentIncome,
          previousIncome: expectedPreviousIncome,
          currentExpense: input.currentExpense,
          previousExpense: expectedPreviousExpense,
          percentageSplit: input.percentageSplit,
          previousMachineDebt,
          finalMachineDebt,
          feedingNegativeAmount: input.feedingNegativeAmount,
          optionalGreedAmount: input.optionalGreedAmount,
          customerDebtDiscounted: input.customerDebtDiscounted,
          generatedDebtAmount: input.generatedDebtAmount,
        });

        await tx.fieldVisit.create({
          data: {
            organizationId: session.organizationId,
            targetId: machine.id,
            createdById: session.userId,
            visitType: "SLOT_H",
            occurredAt,
            checkedItems: [],
            incomeAmount: Math.max(split.houseAmount, 0),
            expenseAmount: split.houseAmount < 0 ? Math.abs(split.houseAmount) : 0,
            clientName: machine.clientName ?? undefined,
            clientPhone: machine.phone ?? undefined,
          },
        });
        await tx.fileAsset.updateMany({
          where: {
            id: input.screenPhotoFileId,
            organizationId: session.organizationId,
          },
          data: { entityType: "SLOT_COLLECTION", entityId: record.id },
        });
        persisted.push(record);
      }

      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.userId,
          module: "SLOT_H",
          action: "SLOT_VISIT_CREATED",
          entityType: "SLOT_COLLECTION",
          entityId: data.visitKey,
          newData: {
            clientName: data.clientName,
            occurredAt: data.occurredAt,
            machineIds,
            collectionIds: persisted.map((record) => record.id),
          },
        },
      });

      return {
        visitKey: data.visitKey,
        duplicate: false,
        clientName: data.clientName,
        results: persisted.map((record) => mapSlotVisitMachineResult(session, record)),
      };
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
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
      const totalAmount = Math.max(0, basePrice - (data.expenseAmount ?? 0));
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
            `Pagamento: ${rotuloDeStatus(data.paymentMethod, PAYMENT_METHOD_LABEL)}`,
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
          notes: data.notes,
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
            `Compensacao: ${record.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa"}`,
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
      // DELIVERED fica como codigo canonico do premio; PRIZE continua aceito para
      // compatibilidade com formularios/rascunhos antigos.
      const receiptStatus = data.receiptStatus === "PRIZE" ? "DELIVERED" : data.receiptStatus;
      const prizeExpenseAmount = receiptStatus === "DELIVERED" ? data.deliveredAmount : 0;
      const totalExpenseAmount = data.expenseAmount + prizeExpenseAmount;
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
          // O funcionario responsavel e quem entregou ao cliente sao sempre quem fez o
          // fechamento -- ver [[project_bx_operator_from_login]].
          agentName: session.name,
          receiverName: session.name,
          occurredAt: toDate(data.occurredAt),
          sentToAgentAmount: data.sentToAgentAmount,
          deliveredAmount: data.deliveredAmount,
          incomeAmount: data.incomeAmount,
          expenseAmount: data.expenseAmount,
          totalAmount: data.incomeAmount - totalExpenseAmount - data.discountAmount,
          discountAmount: data.discountAmount,
          customerDebt: data.customerDebt ?? 0,
          generatedDebtAmount:
            receiptStatus === "NOT_RECEIVED" ? (data.generatedDebtAmount ?? 0) : 0,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          exceptionClient: data.exceptionClient,
          receiptStatus,
          screenPhotoId: data.screenPhotoFileId,
          paperPhotoId: data.paperPhotoFileId,
          notes: data.notes,
        },
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.id,
        visitType: "BX",
        occurredAt: record.occurredAt,
        incomeAmount: Number(record.incomeAmount),
        expenseAmount: totalExpenseAmount,
        clientName: record.clientName ?? null,
        clientPhone: record.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit bx falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.clientName,
          // Quem fez a operacao vem do login, nao de um numero digitado --
          // aqui e a propria criacao, entao o nome ja esta na sessao.
          summary: `Funcionário: ${session.name}`,
          details: [
            `Funcionário responsável: ${record.agentName ?? record.receiverName ?? "-"}`,
            `Status: ${rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL)}`,
            data.exceptionClient ? "Cliente excecao" : "Fluxo padrao",
          ],
          amount: formatCurrency(Number(record.totalAmount)),
          badge: rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL),
          createdAt: record.createdAt.toISOString(),
        },
        source: "database",
      };
    }
    case "h-caca-niquel": {
      const data = createSlotSchema.parse(payload);
      const existingMachine = data.machineId
        ? await prisma.slotMachine.findFirst({
            where: { id: data.machineId, organizationId: session.organizationId },
          })
        : null;

      const clientSequenceNumber = !existingMachine
        ? "1"
        : data.newClient
          ? String((Number(existingMachine.clientSequenceNumber) || 0) + 1)
          : existingMachine.clientSequenceNumber;

      const resetDebtForNewClient = !existingMachine || data.newClient;

      // Numero da maquina PARA O CLIENTE (1, 2, 3...) -- conta quantas
      // maquinas esse cliente ja tem e usa a proxima. So recalcula quando a
      // maquina e nova ou trocou de cliente (newClient); senao mantem o
      // numero que ja tinha.
      let clientMachineNumber = existingMachine?.clientMachineNumber ?? 1;
      if (resetDebtForNewClient) {
        const outrasMaquinasDoCliente = await prisma.slotMachine.count({
          where: {
            organizationId: session.organizationId,
            clientName: data.clientName ?? "",
            ...(existingMachine ? { id: { not: existingMachine.id } } : {}),
          },
        });
        clientMachineNumber = outrasMaquinasDoCliente + 1;
      }
      const baseDebt = resetDebtForNewClient
        ? data.initialAmountMode === "DEBT"
          ? data.initialAmount ?? 0
          : 0
        : data.customerDebt ?? 0;
      // P.P (pagamento pendente) abate do saldo permanente da divida, separado do desconto pos-split (customerDebtDiscounted).
      const previousCustomerDebt = Math.max(baseDebt - (data.ppValue ?? 0), 0);
      const customerDebt = Math.max(
        previousCustomerDebt +
          (data.generatedDebtAmount ?? 0) -
          (data.customerDebtDiscounted ?? 0),
        0,
      );

      // Valor inicial em modo "Negativo" entra no negativo deste fechamento, igual um negativo manual.
      const initialNegativeBonus =
        resetDebtForNewClient && data.initialAmountMode === "NEGATIVE" ? data.initialAmount ?? 0 : 0;
      const effectiveNegativeAmount = (data.negativeAmount ?? 0) + initialNegativeBonus;
      const previousMachineDebt = resetDebtForNewClient
        ? 0
        : Number(existingMachine?.machineDebt ?? 0);
      // "Negativo" agora e um saldo lembrado (igual a divida do cliente): o
      // valor enviado pelo funcionario JA E o novo saldo da maquina, nao um
      // lancamento avulso que se perde no fim do fechamento.
      const machineDebt = effectiveNegativeAmount;

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

      // Antes era upsert por um numero digitado pelo funcionario -- agora a
      // maquina existente e sempre achada pelo id real (machineId, que veio
      // do initialClientId da tela), nunca por um numero que ele digitou.
      const machine = existingMachine
        ? await prisma.slotMachine.update({
            where: { id: existingMachine.id },
            data: {
              clientSequenceNumber,
              clientMachineNumber,
              ...clientFields,
              customerDebt,
              machineDebt,
              ppValue: data.ppValue ?? 0,
              initialAmount: data.initialAmount ?? 0,
              initialAmountMode: data.initialAmountMode,
              optionalGreedAmount: data.optionalGreedAmount ?? 0,
              active: data.active ?? true,
            },
          })
        : await prisma.slotMachine.create({
            data: {
              organizationId: session.organizationId,
              uniqueMachineNumber: randomUUID(),
              clientSequenceNumber,
              clientMachineNumber,
              ...clientFields,
              customerDebt,
              machineDebt,
              ppValue: data.ppValue ?? 0,
              initialAmount: data.initialAmount ?? 0,
              initialAmountMode: data.initialAmountMode,
              optionalGreedAmount: data.optionalGreedAmount ?? 0,
              active: data.active ?? true,
            },
      });

      // "Conferencias" = quantos fechamentos essa maquina ja teve HOJE --
      // automatico, nao e mais digitado pelo funcionario. Se essa e a 2a
      // vez que fecha a mesma maquina no mesmo dia, vira "2" sozinho.
      const occurredAtDate = toDate(data.occurredAt);
      const dayStart = new Date(occurredAtDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(occurredAtDate);
      dayEnd.setHours(23, 59, 59, 999);
      const conferenceCount =
        (await prisma.slotCollection.count({
          where: { slotMachineId: machine.id, occurredAt: { gte: dayStart, lte: dayEnd } },
        })) + 1;

      const record = await prisma.slotCollection.create({
        data: {
          organizationId: session.organizationId,
          createdById: session.userId,
          slotMachineId: machine.id,
          occurredAt: occurredAtDate,
          currentIncome: data.currentIncome,
          previousIncome: data.previousIncome,
          incomeDifference: data.currentIncome - data.previousIncome,
          currentExpense: data.currentExpense,
          previousExpense: data.previousExpense,
          expenseDifference: data.currentExpense - data.previousExpense,
          percentageSplit: data.percentageSplit,
          optionalGreedAmount: data.optionalGreedAmount,
          conferenceCount,
          previousMachineDebt,
          negativeAmount: effectiveNegativeAmount,
          feedingNegativeAmount: data.feedingNegativeAmount,
          previousCustomerDebt,
          customerDebtDiscounted: data.customerDebtDiscounted,
          generatedDebtAmount: data.generatedDebtAmount,
          finalCustomerDebt: customerDebt,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          screenPhotoId: data.screenPhotoFileId,
          notes: data.notes,
        },
        include: { slotMachine: true },
      });

      const { houseAmount, clientShareFinal } = computeSlotSplit({
        ...data,
        previousMachineDebt,
        finalMachineDebt: effectiveNegativeAmount,
      });

      await logFieldVisitForModuleRecord({
        organizationId: session.organizationId,
        createdById: session.userId,
        targetId: record.slotMachineId,
        visitType: "SLOT_H",
        occurredAt: record.occurredAt,
        incomeAmount: Math.max(houseAmount, 0),
        expenseAmount: Math.max(-houseAmount, 0),
        clientName: record.slotMachine.clientName ?? null,
        clientPhone: record.slotMachine.phone ?? null,
      }).catch((e) => console.error("[module-record-service] logFieldVisit h-caca-niquel falhou:", e));

      return {
        record: {
          id: record.id,
          title: record.slotMachine.clientName || `Máquina ${record.slotMachine.clientMachineNumber}`,
          summary: record.slotMachine.clientName
            ? `${record.slotMachine.clientName} · Máquina ${record.slotMachine.clientMachineNumber}`
            : `Máquina ${record.slotMachine.clientMachineNumber}`,
          details: [
            `Conferencias: ${record.conferenceCount}`,
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
          badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
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
          badge: rotuloDeStatus(data.direction, DIRECTION_LABEL),
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
          pipelineStage: "LEAD",
          onboardingChecklist: {
            contractSigned: false,
            paymentConfirmed: false,
            strategicDiagnosis: false,
            logoReceived: false,
            photosVideosReceived: false,
            socialMediaAccess: false,
            competitorsDefined: false,
            objectivesDefined: false,
            contentInspirations: false,
          },
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
            `Tipo: ${rotuloDeStatus(data.personType, PERSON_TYPE_LABEL)}`,
            `Data: ${formatShortDate(record.contractDate)}`,
            `Assinatura: ${signed ? "Sim" : "Pendente"}`,
            `Status: ${rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL)}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
          ],
          amount: formatCurrency(netAmount),
          badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
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
          expenseAmount: data.expenseAmount ?? 0,
          paymentMethod: data.paymentMethod ? mapPaymentMethod(data.paymentMethod) : undefined,
          notes: data.notes,
        },
      });

      const expenseAmount = Number(record.expenseAmount ?? 0);
      const netAmount =
        data.direction === "SAIDA" ? -(data.amount + expenseAmount) : data.amount - expenseAmount;

      return {
        record: {
          id: record.id,
          title: record.description,
          summary: `Movimento ${data.direction}`,
          details: [
            `Data: ${formatShortDate(record.movementDate)}`,
            `Status: ${rotuloDeStatus(record.status, FINANCIAL_STATUS_LABEL)}`,
            `Despesa: ${formatCurrency(expenseAmount)}`,
            `Liquido: ${formatCurrency(netAmount)}`,
          ],
          amount: formatCurrency(netAmount),
          badge: rotuloDeStatus(record.status, FINANCIAL_STATUS_LABEL),
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
          badge: rotuloDeStatus(record.paymentStatus, FINANCIAL_STATUS_LABEL),
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
            `Tipo: ${rotuloDeStatus(record.type, PERSONAL_ENTRY_TYPE_LABEL)}`,
            `Data: ${formatShortDate(record.dueDate ?? record.createdAt)}`,
          ],
          amount: formatCurrency(signedAmount),
          badge: rotuloDeStatus(record.type, PERSONAL_ENTRY_TYPE_LABEL),
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

/**
 * Nome de quem criou o registro (createdById -- string solta, sem relacao
 * formal no Prisma). Usado no BX para mostrar "quem fez a operacao": isso
 * ja era salvo pelo login em todo registro, so nunca tinha sido lido de
 * volta pra tela -- ver [[project_bx_operator_from_login]].
 */
async function resolveCreatorNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unicos.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true },
  });
  return new Map(usuarios.map((u) => [u.id, u.name]));
}

function getBxFinancialAmounts(record: {
  receiptStatus: string;
  incomeAmount: unknown;
  expenseAmount: unknown;
  deliveredAmount: unknown;
  discountAmount: unknown;
}) {
  const incomeAmount = Number(record.incomeAmount ?? 0);
  const operatingExpenseAmount = Number(record.expenseAmount ?? 0);
  const prizeExpenseAmount =
    record.receiptStatus === "DELIVERED" || record.receiptStatus === "PRIZE"
      ? Number(record.deliveredAmount ?? 0)
      : 0;
  const expenseAmount = operatingExpenseAmount + prizeExpenseAmount;
  const discountAmount = Number(record.discountAmount ?? 0);

  return {
    incomeAmount,
    operatingExpenseAmount,
    prizeExpenseAmount,
    expenseAmount,
    discountAmount,
    netAmount: incomeAmount - expenseAmount - discountAmount,
  };
}

/**
 * Saldo devedor atual de um cliente do BX: pega a ultima operacao dele
 * (por clientName, BX nao tem cadastro de cliente compartilhado) e calcula
 * o que sobrou depois do desconto dela, mais a divida nova que ela gerou.
 * So operacao "Nao recebido" gera divida nova -- decisao do dono do projeto.
 */
async function resolveBxClientDebt(organizationId: string, clientName: string): Promise<number> {
  const anterior = await prisma.bxTransaction.findFirst({
    where: { organizationId, clientName },
    orderBy: { createdAt: "desc" },
    select: {
      customerDebt: true,
      discountAmount: true,
      generatedDebtAmount: true,
      receiptStatus: true,
    },
  });
  if (!anterior) return 0;
  const saldoRestante = Math.max(
    Number(anterior.customerDebt ?? 0) - Number(anterior.discountAmount ?? 0),
    0,
  );
  const dividaGerada =
    anterior.receiptStatus === "NOT_RECEIVED"
      ? Number(anterior.generatedDebtAmount ?? 0)
      : 0;
  return saldoRestante + dividaGerada;
}

export type BxPrizeItem = {
  id: string;
  clientName: string;
  location: string;
  amount: number;
  paymentMethod: string | null;
  occurredAt: string;
  operatorName: string;
};

/**
 * Lista premios da maquina. Os dois status internos entram
 * porque agora representam a mesma operacao; novos registros usam DELIVERED.
 * A aba Premio mostra o fechamento normal, nao um lancamento separado.
 */
export async function listBxPrizeRecords(session: SessionData): Promise<BxPrizeItem[]> {
  const records = await prisma.bxTransaction.findMany({
    where: {
      organizationId: session.organizationId,
      receiptStatus: { in: ["DELIVERED", "PRIZE"] },
    },
    select: {
      id: true,
      clientName: true,
      street: true,
      neighborhood: true,
      city: true,
      deliveredAmount: true,
      expenseAmount: true,
      totalAmount: true,
      paymentMethod: true,
      occurredAt: true,
      createdById: true,
    },
    orderBy: { occurredAt: "desc" },
  });
  const nomes = await resolveCreatorNames(records.map((r) => r.createdById));

  return records.map((r) => {
    const deliveredAmount = Number(r.deliveredAmount ?? 0);
    const expenseAmount = Number(r.expenseAmount ?? 0);
    const amount =
      deliveredAmount > 0
        ? deliveredAmount
        : expenseAmount > 0
          ? expenseAmount
          : Math.abs(Number(r.totalAmount ?? 0));
    return {
      id: r.id,
      clientName: r.clientName,
      location: [r.street, r.neighborhood, r.city].filter(Boolean).join(", "),
      amount: session.role === "STAFF" ? 0 : amount,
      paymentMethod: r.paymentMethod,
      occurredAt: r.occurredAt.toISOString(),
      operatorName: r.createdById ? (nomes.get(r.createdById) ?? "-") : "-",
    };
  });
}

function buildDateWhere(range?: DateRange, campo: string = "createdAt") {
  if (!range || (!range.from && !range.to)) {
    return {};
  }

  return {
    [campo]: {
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
            `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
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
            `Compensacao: ${record.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa"}`,
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
            Number(record.roofAmount ?? 0) -
            Number(record.discountAmount ?? 0);

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
        const nomePorCriador = await resolveCreatorNames(records.map((r) => r.createdById));
        const debtClientsSeen = new Set<string>();

        return records.map((record) => {
          const amounts = getBxFinancialAmounts(record);
          const operatorName = record.createdById
            ? (nomePorCriador.get(record.createdById) ?? "-")
            : "-";
          const financialBreakdown: ModuleFinancialBreakdownItem[] = [];

          if (amounts.incomeAmount > 0) {
            financialBreakdown.push({
              direction: "INCOME",
              category: "OPERATION_INCOME",
              categoryLabel: "Entrada da operação",
              amount: amounts.incomeAmount,
            });
          }
          if (amounts.operatingExpenseAmount > 0) {
            financialBreakdown.push({
              direction: "EXPENSE",
              category: "OPERATING_EXPENSE",
              categoryLabel: "Outras despesas",
              amount: amounts.operatingExpenseAmount,
            });
          }
          if (amounts.prizeExpenseAmount > 0) {
            financialBreakdown.push({
              direction: "EXPENSE",
              category: "PRIZE",
              categoryLabel: "Prêmio",
              amount: amounts.prizeExpenseAmount,
            });
          }
          if (amounts.discountAmount > 0) {
            financialBreakdown.push({
              direction: "EXPENSE",
              category: "DISCOUNT",
              categoryLabel: "Desconto",
              amount: amounts.discountAmount,
            });
          }
          const debtKey = record.clientName.trim().toLocaleLowerCase("pt-BR");
          const isLatestClientRecord = !debtClientsSeen.has(debtKey);
          debtClientsSeen.add(debtKey);
          const generatedDebtAmount = record.receiptStatus === "NOT_RECEIVED"
            ? Number(record.generatedDebtAmount ?? 0)
            : 0;
          const currentDebtAmount = isLatestClientRecord
            ? Math.max(Number(record.customerDebt ?? 0) - amounts.discountAmount, 0) +
              generatedDebtAmount
            : 0;
          if (currentDebtAmount > 0) {
            financialBreakdown.push({
              direction: "INCOME",
              category: "DEBT_RECEIVABLE",
              categoryLabel: "Saldo devedor a receber",
              amount: currentDebtAmount,
              status: "PENDING",
            });
          }

          return {
            id: record.id,
            title: record.clientName,
            summary: `Funcionário: ${operatorName}`,
            details: [
              `Funcionário responsável: ${record.agentName ?? record.receiverName ?? "-"}`,
              `Status: ${rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL)}`,
              `Entrada: ${formatCurrency(amounts.incomeAmount)}`,
              `Despesas: ${formatCurrency(amounts.operatingExpenseAmount)}`,
              ...(amounts.prizeExpenseAmount > 0
                ? [`Prêmio da máquina: ${formatCurrency(amounts.prizeExpenseAmount)}`]
                : []),
              ...(currentDebtAmount > 0
                ? [`Saldo devedor atual: ${formatCurrency(currentDebtAmount)}`]
                : []),
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            amount: formatCurrency(amounts.netAmount),
            amountValue: amounts.netAmount,
            incomeValue: amounts.incomeAmount,
            expenseValue: amounts.expenseAmount + amounts.discountAmount,
            operatorName,
            paymentMethod: record.paymentMethod,
            financialBreakdown,
            badge: rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL),
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "h-caca-niquel": {
        const records = await prisma.slotCollection.findMany({
          where: {
            organizationId: session.organizationId,
            ...buildDateWhere(range, "occurredAt"),
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take,
          include: { slotMachine: true },
        });
        const creatorNames = await resolveCreatorNames(records.map((record) => record.createdById));
        return records.map((record) =>
          mapSlotCollectionRecord(
            session,
            record,
            record.createdById ? (creatorNames.get(record.createdById) ?? "-") : "-",
          ),
        );
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
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: Number(record.amount),
            expenseValue: Number(record.expenseAmount ?? 0),
            badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
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
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: record.direction === "EXPENSE" ? 0 : Number(record.amount),
            expenseValue:
              record.direction === "EXPENSE"
                ? Number(record.amount) + Number(record.expenseAmount ?? 0)
                : Number(record.expenseAmount ?? 0),
            badge: rotuloDeStatus(record.direction, DIRECTION_LABEL),
            createdAt: record.createdAt.toISOString(),
          };
        });
      }
      case "marketing": {
        // O relatorio geral (resumo por modulo / semanal) somava o valor do
        // CONTRATO como se fosse dinheiro que entrou -- o mesmo defeito ja
        // corrigido no relatorio de cada cliente (ver marketing-crm-view),
        // so que nunca chegou ate aqui. Contrato assinado nao e um evento de
        // caixa; os Lancamentos (FinancialEntry) sao. Alem disso, despesas
        // da agencia (sem cliente vinculado, criadas em Contas) nao tinham
        // NENHUMA linha aqui -- ficavam invisiveis em qualquer relatorio.
        //
        // Agora cada contrato entra so como evento de cadastro (0 no
        // financeiro) e cada Lancamento real entra como sua propria linha,
        // filtrada pela data em que o dinheiro de fato se moveu (issueDate),
        // nao pela data de assinatura do contrato.
        const [contracts, entries] = await Promise.all([
          prisma.marketingContract.findMany({
            where: { organizationId: session.organizationId, ...buildDateWhere(range) },
            orderBy: { createdAt: "desc" },
            take,
          }),
          prisma.financialEntry.findMany({
            where: {
              organizationId: session.organizationId,
              module: "MARKETING",
              ...buildDateWhere(range, "issueDate"),
            },
            orderBy: { issueDate: "desc" },
            take,
          }),
        ]);

        const idsReferenciados = [
          ...new Set(entries.map((e) => e.sourceEntityId).filter((id): id is string => Boolean(id))),
        ];
        const contratosReferenciados = idsReferenciados.length
          ? await prisma.marketingContract.findMany({
              where: { id: { in: idsReferenciados } },
              select: { id: true, name: true },
            })
          : [];
        const nomePorId = new Map(contratosReferenciados.map((c) => [c.id, c.name]));

        const linhasContrato: ModuleRecordItem[] = contracts.map((record) => {
          const signed = Boolean(record.signatureLink || record.signatureFileId);
          return {
            id: record.id,
            title: record.name,
            summary: record.serviceType,
            details: [
              `Tipo: ${rotuloDeStatus(record.personType, PERSON_TYPE_LABEL)}`,
              `Data: ${formatShortDate(record.contractDate)}`,
              `Assinatura: ${signed ? "Sim" : "Pendente"}`,
              `Status: ${rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL)}`,
              `Valor do contrato: ${formatCurrency(Number(record.contractValue))}`,
              `Despesa do contrato: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            // Cadastro, nao movimento de dinheiro -- quem soma o financeiro
            // sao os Lancamentos, abaixo.
            amountValue: 0,
            incomeValue: 0,
            expenseValue: 0,
            badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
            createdAt: record.createdAt.toISOString(),
          };
        });

        const linhasLancamento: ModuleRecordItem[] = entries.map((e) => {
          const valor = Number(e.totalAmount);
          const receita = e.direction !== "EXPENSE";
          const pago = e.status === "PAID";
          // Mesma regra conservadora do relatorio por cliente: receita so
          // conta quando recebida; custo conta assim que lancado.
          const contaNoFinanceiro = receita ? pago : true;
          const cliente = e.sourceEntityId ? (nomePorId.get(e.sourceEntityId) ?? "Cliente removido") : "Despesa da agência";

          return {
            id: e.id,
            title: e.description,
            summary: cliente,
            details: [
              `Data: ${formatShortDate(e.issueDate)}`,
              `Status: ${pago ? "Pago" : "Em aberto"}`,
            ],
            amount: formatCurrency(receita ? valor : -valor),
            amountValue: contaNoFinanceiro ? (receita ? valor : -valor) : 0,
            incomeValue: receita && contaNoFinanceiro ? valor : 0,
            expenseValue: !receita ? valor : 0,
            badge: pago ? "Pago" : "Em aberto",
            createdAt: e.issueDate.toISOString(),
          };
        });

        return [...linhasLancamento, ...linhasContrato].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }
      case "plataforma-online": {
        const records = await prisma.brazilBetsEntry.findMany({
          where: { organizationId: session.organizationId, ...buildDateWhere(range) },
          orderBy: { createdAt: "desc" },
          take,
        });

        return records.map((record) => {
          const expenseAmount = Number(record.expenseAmount ?? 0);
          const netAmount =
            record.direction === "EXPENSE"
              ? -(Number(record.amount) + expenseAmount)
              : Number(record.amount) - expenseAmount;

          return {
            id: record.id,
            title: record.description,
            summary: `Movimento ${record.direction}`,
            details: [
              `Data: ${formatShortDate(record.movementDate)}`,
              `Status: ${rotuloDeStatus(record.status, FINANCIAL_STATUS_LABEL)}`,
              `Despesa: ${formatCurrency(expenseAmount)}`,
              `Liquido: ${formatCurrency(netAmount)}`,
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            amount: formatCurrency(netAmount),
            amountValue: netAmount,
            incomeValue: record.direction === "EXPENSE" ? 0 : Number(record.amount),
            expenseValue: (record.direction === "EXPENSE" ? Number(record.amount) : 0) + expenseAmount,
            badge: rotuloDeStatus(record.status, FINANCIAL_STATUS_LABEL),
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
            `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
          ],
          amount: formatCurrency(Number(record.balanceAmount ?? record.totalAmount)),
          amountValue: Number(record.balanceAmount ?? record.totalAmount),
          incomeValue: Number(record.totalAmount),
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: rotuloDeStatus(record.paymentStatus, FINANCIAL_STATUS_LABEL),
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
              `Tipo: ${rotuloDeStatus(record.type, PERSONAL_ENTRY_TYPE_LABEL)}`,
              `Data: ${formatShortDate(record.dueDate ?? record.createdAt)}`,
              `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
            ],
            amount: formatCurrency(signedAmount),
            amountValue: signedAmount,
            incomeValue: record.type === "INCOME" ? Number(record.amount) : 0,
            expenseValue: record.type === "INCOME" ? 0 : Number(record.amount),
            badge: rotuloDeStatus(record.type, PERSONAL_ENTRY_TYPE_LABEL),
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
  /** So o Bilhar usa rota hoje; os demais modulos deixam indefinido. */
  routeNumber?: number | null;
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
          name: point.clientName
            ? `${point.name} · ${point.clientName}`
            : point.name,
          subtitle: point.tableModel ?? "Mesa não informada",
          tags: [point.phone, point.cpf, point.cnpj, point.city].filter(Boolean) as string[],
          badge: `${formatCurrency(Number(point.chipValue ?? 0))}/ficha`,
          phone: point.phone ?? undefined,
          routeNumber: point.routeNumber,
        }));
      }
      case "bx": {
        const records = await prisma.bxTransaction.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          take: take * 5,
        });
        const nomePorCriadorBx = await resolveCreatorNames(records.map((r) => r.createdById));

        return dedupeByKey(records, (r) => r.clientName)
          .slice(0, take)
          .map((record) => {
            const amounts = getBxFinancialAmounts(record);
            return {
              id: record.id,
              name: record.clientName,
              subtitle: `Funcionário: ${record.createdById ? (nomePorCriadorBx.get(record.createdById) ?? "-") : "-"}`,
              tags: [record.phone, record.cpf].filter(Boolean) as string[],
              badge: formatCurrency(amounts.netAmount),
              phone: record.phone ?? undefined,
            };
          });
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
          orderBy: [{ clientName: "asc" }, { clientMachineNumber: "asc" }],
          take: Math.max(take * 20, 500),
        });
        const grouped = new Map<string, typeof machines>();
        for (const machine of machines) {
          const key = machine.clientName?.trim() || machine.id;
          grouped.set(key, [...(grouped.get(key) ?? []), machine]);
        }

        return [...grouped.values()].slice(0, take).map((clientMachines) => {
          const first = clientMachines[0]!;
          const activeCount = clientMachines.filter((machine) => machine.active).length;
          return {
            id: first.id,
            name: first.clientName || `Máquina ${first.clientMachineNumber}`,
            subtitle: `${clientMachines.length} máquina${clientMachines.length === 1 ? "" : "s"} · ${activeCount} ativa${activeCount === 1 ? "" : "s"}`,
            tags: [first.phone, first.cpf].filter(Boolean) as string[],
            badge: activeCount > 0 ? "Ativo" : "Inativo",
            phone: first.phone ?? undefined,
          };
        });
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
            badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
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
            badge: rotuloDeStatus(record.paymentStatus, FINANCIAL_STATUS_LABEL),
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

export async function listModuleClientRecords(
  session: SessionData,
  slug: ModuleSlug,
  clientId: string,
  clientName: string,
): Promise<ModuleRecordItem[]> {
  const org = session.organizationId;

  switch (slug) {
    case "maquinas-de-pelucia": {
      const records = await prisma.plushCollection.findMany({
        where: { organizationId: org, plushMachineId: clientId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { plushMachine: true },
      });
      return records.map((record) => ({
        id: record.id,
        title: record.plushMachine.name,
        summary: `Maquina ${record.plushMachine.machineNumber}`,
        details: [
          `Cliente: ${record.plushMachine.clientName ?? "-"}`,
          `Fichas: ${record.plushCountOut}`,
          `Comissao: ${record.commissionPercentage}%`,
          `Compensacao: ${record.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa"}`,
        ],
        amount: formatCurrency(Number(record.companyAmount)),
        amountValue: Number(record.companyAmount),
        incomeValue: Number(record.grossAmount),
        expenseValue: Number(record.grossAmount) - Number(record.companyAmount),
        badge: record.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa",
        createdAt: record.createdAt.toISOString(),
      }));
    }

    case "h-caca-niquel": {
      const records = await prisma.slotCollection.findMany({
        where: {
          organizationId: org,
          slotMachine: clientName
            ? { clientName }
            : { id: clientId },
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: { slotMachine: true },
      });
      const creatorNames = await resolveCreatorNames(records.map((record) => record.createdById));
      return records.map((record) =>
        mapSlotCollectionRecord(
          session,
          record,
          record.createdById ? (creatorNames.get(record.createdById) ?? "-") : "-",
        ),
      );
    }

    case "bx": {
      const records = await prisma.bxTransaction.findMany({
        where: { organizationId: org, clientName },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      const nomePorCriadorBxCliente = await resolveCreatorNames(records.map((r) => r.createdById));
      return records.map((record) => {
        const amounts = getBxFinancialAmounts(record);
        return {
          id: record.id,
          title: record.clientName,
          summary: `Funcionário: ${record.createdById ? (nomePorCriadorBxCliente.get(record.createdById) ?? "-") : "-"}`,
          details: [
            `Funcionário responsável: ${record.agentName ?? record.receiverName ?? "-"}`,
            `Status: ${rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL)}`,
            `Entrada: ${formatCurrency(amounts.incomeAmount)}`,
            `Despesas: ${formatCurrency(amounts.operatingExpenseAmount)}`,
            ...(amounts.prizeExpenseAmount > 0
              ? [`Prêmio da máquina: ${formatCurrency(amounts.prizeExpenseAmount)}`]
              : []),
            `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
          ],
          amount: formatCurrency(amounts.netAmount),
          amountValue: amounts.netAmount,
          incomeValue: amounts.incomeAmount,
          expenseValue: amounts.expenseAmount,
          badge: rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL),
          createdAt: record.createdAt.toISOString(),
        };
      });
    }

    case "carreta-kids": {
      const records = await prisma.carretaKidsRecord.findMany({
        where: { organizationId: org, sheetName: clientName },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return records.map((record) => ({
        id: record.id,
        title: record.locationName,
        summary: `Ficha ${record.sheetName}`,
        details: [
          `Data: ${formatShortDate(record.serviceDate)}`,
          `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
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

    case "locacao": {
      const records = await prisma.rentalOrder.findMany({
        where: { organizationId: org, clientName },
        orderBy: { createdAt: "desc" },
        take: 30,
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
          `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
        ],
        amount: formatCurrency(Number(record.balanceAmount ?? record.totalAmount)),
        amountValue: Number(record.balanceAmount ?? record.totalAmount),
        incomeValue: Number(record.totalAmount),
        expenseValue: Number(record.expenseAmount ?? 0),
        badge: rotuloDeStatus(record.paymentStatus, FINANCIAL_STATUS_LABEL),
        createdAt: record.createdAt.toISOString(),
      }));
    }

    case "marketing": {
      const records = await prisma.marketingContract.findMany({
        where: { organizationId: org, name: clientName },
        orderBy: { createdAt: "desc" },
        take: 30,
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
            `Tipo: ${rotuloDeStatus(record.personType, PERSON_TYPE_LABEL)}`,
            `Data: ${formatShortDate(record.contractDate)}`,
            `Assinatura: ${signed ? "Sim" : "Pendente"}`,
            `Status: ${rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL)}`,
            `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
            `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
          ],
          amount: formatCurrency(netAmount),
          amountValue: netAmount,
          incomeValue: grossAmount,
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
          createdAt: record.createdAt.toISOString(),
        };
      });
    }

    case "credito-financeiro": {
      const records = await prisma.machineContract.findMany({
        where: { organizationId: org, clientName },
        orderBy: { createdAt: "desc" },
        take: 30,
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
            `Pagamento: ${record.paymentMethod ? rotuloDeStatus(record.paymentMethod, PAYMENT_METHOD_LABEL) : "Não informado"}`,
          ],
          amount: formatCurrency(netAmount),
          amountValue: netAmount,
          incomeValue: Number(record.amount),
          expenseValue: Number(record.expenseAmount ?? 0),
          badge: rotuloDeStatus(record.status, CONTRACT_STATUS_LABEL),
          createdAt: record.createdAt.toISOString(),
        };
      });
    }

    default:
      return [];
  }
}

export async function listModuleVisitTargets(
  session: SessionData,
  slug: ModuleSlug,
): Promise<ClientListItem[]> {
  if (slug === "h-caca-niquel") {
    // A visita fecha TODAS as maquinas do cliente de uma vez (ver
    // SlotVisitForm), entao o seletor tem que listar um item por CLIENTE,
    // nao um por maquina -- senao "Bar do Chico" aparece repetido 5x na
    // lista e escolher qualquer uma delas parecia abrir so aquela maquina.
    const machines = await prisma.slotMachine.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ clientName: "asc" }, { clientMachineNumber: "asc" }],
      take: 500,
    });
    const porCliente = new Map<string, typeof machines>();
    for (const m of machines) {
      const chave = m.clientName || m.id;
      porCliente.set(chave, [...(porCliente.get(chave) ?? []), m]);
    }
    return [...porCliente.values()].map((clientMachines) => {
      const m = clientMachines.find((machine) => machine.active) ?? clientMachines[0]!;
      const hasActiveMachine = clientMachines.some((machine) => machine.active);
      return {
      id: m.id,
      code: m.id.slice(0, 8),
      name: m.clientName || `Máquina ${m.clientMachineNumber}`,
      phone: m.phone ?? "",
      city: "",
      status: hasActiveMachine ? ("ativo" as const) : ("inativo" as const),
      balance: 0,
      updatedAt: new Date().toISOString(),
      routeNumber: undefined,
    };
    });
  }

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
    routeNumber: item.routeNumber,
  }));
}

export type ClientPrefillData =
  | { kind: "plush-machine"; clientName: string; phone: string; cpf: string; code: string; name: string; machineNumber: string; noteNumber: string; noteiroFixed: string; coinPhotoRule: boolean; giftPhotoRule: boolean; active: boolean }
  | { kind: "slot-machine"; clientName: string; phone: string; cpf: string; cep: string; street: string; neighborhood: string; city: string; state: string; clientMachineNumber: number; customerDebt: number; ppValue: number; initialAmount: number; initialAmountMode: string; optionalGreedAmount: number; active: boolean; previousIncome: number; previousExpense: number }
  | { kind: "bx-transaction"; clientName: string; phone: string; cpf: string; cep: string; street: string; neighborhood: string; city: string; state: string; exceptionClient: boolean; debt: number }
  | { kind: "carreta-kids-record"; localName: string; sheetName: string; phone: string }
  | { kind: "rental-order"; clientName: string; phone: string; localName: string; document: string };

export async function getClientPrefillData(
  session: SessionData,
  slug: ModuleSlug,
  id: string,
): Promise<ClientPrefillData | null> {
  const org = session.organizationId;

  switch (slug) {
    case "maquinas-de-pelucia": {
      const m = await prisma.plushMachine.findFirst({ where: { id, organizationId: org } });
      if (!m) return null;
      return { kind: "plush-machine", clientName: m.clientName ?? "", phone: m.phone ?? "", cpf: m.cpf ?? "", code: m.code, name: m.name, machineNumber: m.machineNumber, noteNumber: m.noteNumber ?? "", noteiroFixed: m.noteiroFixed ?? "01", coinPhotoRule: m.coinPhotoRule, giftPhotoRule: m.giftPhotoRule, active: m.active };
    }
    case "h-caca-niquel": {
      const m = await prisma.slotMachine.findFirst({ where: { id, organizationId: org } });
      if (!m) return null;
      // Entrada/saida anterior vem sozinha do ultimo fechamento dessa
      // maquina -- o "atual" de ontem e o "anterior" de hoje, funcionario
      // nao precisa lembrar/digitar de novo.
      const ultimaColeta = await prisma.slotCollection.findFirst({
        where: { slotMachineId: m.id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        select: { currentIncome: true, currentExpense: true },
      });
      return { kind: "slot-machine", clientName: m.clientName ?? "", phone: m.phone ?? "", cpf: m.cpf ?? "", cep: m.cep ?? "", street: m.street ?? "", neighborhood: m.neighborhood ?? "", city: m.city ?? "", state: m.state ?? "", clientMachineNumber: m.clientMachineNumber, customerDebt: Number(m.customerDebt ?? 0), ppValue: Number(m.ppValue ?? 0), initialAmount: Number(m.initialAmount ?? 0), initialAmountMode: m.initialAmountMode, optionalGreedAmount: Number(m.optionalGreedAmount ?? 0), active: m.active, previousIncome: Number(ultimaColeta?.currentIncome ?? 0), previousExpense: Number(ultimaColeta?.currentExpense ?? 0) };
    }
    case "bx": {
      const r = await prisma.bxTransaction.findFirst({ where: { id, organizationId: org } });
      if (!r) return null;
      const debt = await resolveBxClientDebt(org, r.clientName);
      return { kind: "bx-transaction", clientName: r.clientName, phone: r.phone ?? "", cpf: r.cpf ?? "", cep: r.cep ?? "", street: r.street ?? "", neighborhood: r.neighborhood ?? "", city: r.city ?? "", state: r.state ?? "", exceptionClient: r.exceptionClient, debt };
    }
    case "carreta-kids": {
      const r = await prisma.carretaKidsRecord.findFirst({ where: { id, organizationId: org } });
      if (!r) return null;
      return { kind: "carreta-kids-record", localName: r.locationName, sheetName: r.sheetName, phone: r.phone ?? "" };
    }
    case "locacao": {
      const r = await prisma.rentalOrder.findFirst({ where: { id, organizationId: org } });
      if (!r) return null;
      return { kind: "rental-order", clientName: r.clientName ?? "", phone: r.phone ?? "", localName: r.localName, document: r.document ?? "" };
    }
    default:
      return null;
  }
}
