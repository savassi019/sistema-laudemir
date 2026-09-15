"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  MarketingPipelineStage,
  MarketingContentStatus,
  MarketingContentKind,
} from "@prisma/client";

export type OnboardingChecklist = {
  contractSigned: boolean;
  paymentConfirmed: boolean;
  strategicDiagnosis: boolean;
  logoReceived: boolean;
  photosVideosReceived: boolean;
  socialMediaAccess: boolean;
  competitorsDefined: boolean;
  objectivesDefined: boolean;
  contentInspirations: boolean;
};

const DEFAULT_CHECKLIST: OnboardingChecklist = {
  contractSigned: false,
  paymentConfirmed: false,
  strategicDiagnosis: false,
  logoReceived: false,
  photosVideosReceived: false,
  socialMediaAccess: false,
  competitorsDefined: false,
  objectivesDefined: false,
  contentInspirations: false,
};

export type MarketingContentDetail = {
  id: string;
  title: string;
  contentDate: string;
  kind: MarketingContentKind;
  status: MarketingContentStatus;
  notes?: string | null;
  fileId?: string | null;
};

export type MarketingClientDetail = {
  id: string;
  name: string;
  phone?: string | null;
  serviceType: string;
  contractValue: number;
  expenseAmount: number;
  pipelineStage: MarketingPipelineStage;
  status: string;
  onboardingChecklist: OnboardingChecklist;
  contents: MarketingContentDetail[];
  entries: MarketingEntryDetail[];
  contractDate: string;
  createdAt: string;
};

export async function getMarketingClientsAction(): Promise<MarketingClientDetail[]> {
  const session = await requireSession();

  const contracts = await prisma.marketingContract.findMany({
    where: { organizationId: session.organizationId },
    include: { contents: { orderBy: { contentDate: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  // Uma consulta para todos os lancamentos da organizacao e agrupamento em
  // memoria -- uma consulta por cliente seria N+1 e pesa com a carteira cheia.
  const lancamentos = await prisma.financialEntry.findMany({
    where: {
      organizationId: session.organizationId,
      module: "MARKETING",
      sourceEntityType: "MARKETING_CONTRACT",
      sourceEntityId: { in: contracts.map((c) => c.id) },
    },
    orderBy: { issueDate: "desc" },
  });

  const porContrato = new Map<string, MarketingEntryDetail[]>();
  for (const e of lancamentos) {
    if (!e.sourceEntityId) continue;
    const lista = porContrato.get(e.sourceEntityId) ?? [];
    lista.push(mapEntry(e));
    porContrato.set(e.sourceEntityId, lista);
  }

  return contracts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    serviceType: c.serviceType,
    contractValue: Number(c.contractValue),
    expenseAmount: Number(c.expenseAmount ?? 0),
    pipelineStage: c.pipelineStage,
    status: c.status,
    onboardingChecklist: (c.onboardingChecklist as OnboardingChecklist | null) ?? {
      ...DEFAULT_CHECKLIST,
    },
    contents: c.contents.map((cnt) => ({
      id: cnt.id,
      title: cnt.title,
      contentDate: cnt.contentDate.toISOString(),
      kind: cnt.kind,
      status: cnt.status,
      notes: cnt.notes,
      fileId: cnt.fileId,
    })),
    entries: porContrato.get(c.id) ?? [],
    contractDate: c.contractDate.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function updateMarketingPipelineAction(
  id: string,
  pipelineStage: MarketingPipelineStage,
) {
  const session = await requireSession();
  await prisma.marketingContract.update({
    where: { id, organizationId: session.organizationId },
    data: { pipelineStage },
  });
}

export async function updateMarketingChecklistAction(
  id: string,
  checklist: OnboardingChecklist,
) {
  const session = await requireSession();
  await prisma.marketingContract.update({
    where: { id, organizationId: session.organizationId },
    data: { onboardingChecklist: checklist },
  });
}

/**
 * Data sem hora (AAAA-MM-DD) vira meio-dia UTC, nao meia-noite.
 * `new Date("2026-09-08")` e meia-noite UTC = dia 7 as 21h no Brasil, entao
 * o compromisso aparecia no dia anterior no calendario. Meio-dia mantem o
 * mesmo dia do calendario de UTC-11 a UTC+12.
 */
function dataDoCompromisso(valor: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00Z`) : new Date(valor);
}

export async function addMarketingContentAction(
  contractId: string,
  title: string,
  contentDate: string,
  status: MarketingContentStatus,
  notes?: string,
  kind: MarketingContentKind = "POST",
  fileId?: string | null,
): Promise<MarketingContentDetail> {
  const session = await requireSession();

  const contract = await prisma.marketingContract.findFirst({
    where: { id: contractId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!contract) throw new Error("Contrato não encontrado.");

  const content = await prisma.marketingContent.create({
    data: {
      organizationId: session.organizationId,
      contractId,
      title,
      contentDate: dataDoCompromisso(contentDate),
      kind,
      status,
      notes: notes || null,
      fileId: fileId || null,
    },
  });

  return {
    id: content.id,
    title: content.title,
    contentDate: content.contentDate.toISOString(),
    kind: content.kind,
    status: content.status,
    notes: content.notes,
    fileId: content.fileId,
  };
}

export async function updateMarketingContentStatusAction(
  contentId: string,
  status: MarketingContentStatus,
) {
  const session = await requireSession();
  await prisma.marketingContent.update({
    where: { id: contentId, organizationId: session.organizationId },
    data: { status },
  });
}

/**
 * Corrigir titulo/data/tipo/observacao de um compromisso ja criado. Antes so
 * dava para apagar e recriar -- se alguem errasse a data (o mesmo erro de
 * fuso que ja confundiu o usuario uma vez, ver dataDoCompromisso acima),
 * tinha que reconstruir o compromisso do zero perdendo o criativo anexado.
 */
export async function updateMarketingContentAction(
  contentId: string,
  data: {
    title: string;
    contentDate: string;
    kind: MarketingContentKind;
    notes?: string | null;
  },
): Promise<MarketingContentDetail> {
  const session = await requireSession();

  const titulo = data.title.trim();
  if (!titulo) throw new Error("Descreva o compromisso.");

  const content = await prisma.marketingContent.update({
    where: { id: contentId, organizationId: session.organizationId },
    data: {
      title: titulo,
      contentDate: dataDoCompromisso(data.contentDate),
      kind: data.kind,
      notes: data.notes || null,
    },
  });

  return {
    id: content.id,
    title: content.title,
    contentDate: content.contentDate.toISOString(),
    kind: content.kind,
    status: content.status,
    notes: content.notes,
    fileId: content.fileId,
  };
}

export async function setMarketingContentFileAction(contentId: string, fileId: string | null) {
  const session = await requireSession();
  await prisma.marketingContent.update({
    where: { id: contentId, organizationId: session.organizationId },
    data: { fileId },
  });
}

export async function deleteMarketingContentAction(contentId: string) {
  const session = await requireSession();
  await prisma.marketingContent.delete({
    where: { id: contentId, organizationId: session.organizationId },
  });
}

export async function updateMarketingClientAction(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    serviceType?: string;
    contractValue?: number;
    expenseAmount?: number;
  },
) {
  const session = await requireSession();
  await prisma.marketingContract.update({
    where: { id, organizationId: session.organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.serviceType !== undefined && { serviceType: data.serviceType }),
      ...(data.contractValue !== undefined && { contractValue: data.contractValue }),
      ...(data.expenseAmount !== undefined && { expenseAmount: data.expenseAmount }),
    },
  });
}

/**
 * Antes um cliente cadastrado errado ou de teste ficava preso para sempre --
 * so dava para apagar conteudo e lancamento, um a um, nunca o cadastro.
 *
 * Os conteudos (MarketingContent) tem onDelete: Cascade no schema e somem
 * sozinhos. Os Lancamentos (FinancialEntry) NAO tem relacao formal --
 * apagados aqui explicitamente, ou ficariam orfaos: invisiveis em qualquer
 * tela (a consulta de lancamentos so busca pelos contratos que existem) mas
 * ainda somando nos totais gerais da organizacao. As duas exclusoes na
 * mesma transacao: ou as duas acontecem, ou nenhuma.
 */
export async function deleteMarketingClientAction(contractId: string): Promise<void> {
  const session = await requireSession();

  const contract = await prisma.marketingContract.findFirst({
    where: { id: contractId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!contract) throw new Error("Cliente não encontrado.");

  await prisma.$transaction([
    prisma.financialEntry.deleteMany({
      where: {
        organizationId: session.organizationId,
        module: "MARKETING",
        sourceEntityType: "MARKETING_CONTRACT",
        sourceEntityId: contractId,
      },
    }),
    prisma.marketingContract.delete({ where: { id: contractId } }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Lancamentos reais do cliente (o que entrou e o que saiu de verdade)
 *
 * Antes o relatorio mensal repetia o valor do contrato em todos os meses
 * desde a assinatura. Um cliente que pagou 2 de 7 meses aparecia com os 7
 * recebidos. Agora cada recebimento e cada custo e um lancamento com data,
 * e o relatorio soma o que existe -- nao o que deveria existir.
 *
 * Reaproveita FinancialEntry (module MARKETING + sourceEntityId = contrato)
 * em vez de criar tabela nova: o banco de producao nao muda de forma.
 * ------------------------------------------------------------------ */

export type MarketingEntryDetail = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  amount: number;
  /** Mes de competencia do lancamento. */
  date: string;
  paid: boolean;
};

/** Data sem hora vira meio-dia UTC pelo mesmo motivo do calendario. */
function dataDoLancamento(valor: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00Z`) : new Date(valor);
}

function mapEntry(e: {
  id: string;
  description: string;
  direction: string;
  totalAmount: unknown;
  issueDate: Date;
  status: string;
}): MarketingEntryDetail {
  return {
    id: e.id,
    description: e.description,
    direction: e.direction === "EXPENSE" ? "EXPENSE" : "INCOME",
    amount: Number(e.totalAmount),
    date: e.issueDate.toISOString(),
    paid: e.status === "PAID",
  };
}

export async function addMarketingEntryAction(
  contractId: string,
  input: {
    description: string;
    direction: "INCOME" | "EXPENSE";
    amount: number;
    date: string;
    paid: boolean;
  },
): Promise<MarketingEntryDetail> {
  const session = await requireSession();

  const contract = await prisma.marketingContract.findFirst({
    where: { id: contractId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!contract) throw new Error("Cliente não encontrado.");

  const descricao = input.description.trim();
  if (!descricao) throw new Error("Descreva o lançamento.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  const quando = dataDoLancamento(input.date);
  if (Number.isNaN(quando.getTime())) throw new Error("Data inválida.");

  const entry = await prisma.financialEntry.create({
    data: {
      organizationId: session.organizationId,
      module: "MARKETING",
      kind: input.direction === "EXPENSE" ? "EXPENSE" : "REVENUE",
      direction: input.direction,
      status: input.paid ? "PAID" : "PENDING",
      description: descricao,
      sourceEntityType: "MARKETING_CONTRACT",
      sourceEntityId: contractId,
      issueDate: quando,
      paidAt: input.paid ? quando : undefined,
      totalAmount: input.amount,
      paidAmount: input.paid ? input.amount : 0,
      remainingAmount: input.paid ? 0 : input.amount,
      createdById: session.userId,
    },
  });

  return mapEntry(entry);
}

export async function setMarketingEntryPaidAction(
  entryId: string,
  paid: boolean,
): Promise<void> {
  const session = await requireSession();

  const entry = await prisma.financialEntry.findFirst({
    where: {
      id: entryId,
      organizationId: session.organizationId,
      module: "MARKETING",
      sourceEntityType: "MARKETING_CONTRACT",
    },
    select: { id: true, totalAmount: true, issueDate: true },
  });
  if (!entry) throw new Error("Lançamento não encontrado.");

  await prisma.financialEntry.update({
    where: { id: entryId },
    data: {
      status: paid ? "PAID" : "PENDING",
      paidAt: paid ? entry.issueDate : null,
      paidAmount: paid ? entry.totalAmount : 0,
      remainingAmount: paid ? 0 : entry.totalAmount,
    },
  });
}

export async function deleteMarketingEntryAction(entryId: string): Promise<void> {
  const session = await requireSession();

  const entry = await prisma.financialEntry.findFirst({
    where: {
      id: entryId,
      organizationId: session.organizationId,
      module: "MARKETING",
      sourceEntityType: "MARKETING_CONTRACT",
    },
    select: { id: true },
  });
  if (!entry) throw new Error("Lançamento não encontrado.");

  await prisma.financialEntry.delete({ where: { id: entryId } });
}
