"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MarketingPipelineStage, MarketingContentStatus } from "@prisma/client";

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
  status: MarketingContentStatus;
  notes?: string | null;
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
      status: cnt.status,
      notes: cnt.notes,
    })),
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

export async function addMarketingContentAction(
  contractId: string,
  title: string,
  contentDate: string,
  status: MarketingContentStatus,
  notes?: string,
): Promise<MarketingContentDetail> {
  const session = await requireSession();

  const content = await prisma.marketingContent.create({
    data: {
      organizationId: session.organizationId,
      contractId,
      title,
      contentDate: new Date(contentDate),
      status,
      notes: notes || null,
    },
  });

  return {
    id: content.id,
    title: content.title,
    contentDate: content.contentDate.toISOString(),
    status: content.status,
    notes: content.notes,
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
