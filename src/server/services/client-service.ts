import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import { demoClients } from "@/data/demo";
import { prisma } from "@/lib/prisma";
import type { ClientListItem, ModuleName, SessionData } from "@/types/app";

const createClientSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2),
  personType: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  document: z.string().optional(),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["ativo", "inativo", "inadimplente", "excecao"]).default("ativo"),
  modules: z.array(z.string()).optional(),
});

type CreateClientInput = z.infer<typeof createClientSchema>;

type CreateClientResult = {
  client: ClientListItem;
  source: "database" | "local";
};

const globalForClients = globalThis as unknown as {
  localClientStore?: Map<string, ClientListItem[]>;
};

const localClientStore = globalForClients.localClientStore ?? new Map<string, ClientListItem[]>();
globalForClients.localClientStore = localClientStore;

const statusToPrisma = {
  ativo: "ACTIVE",
  inativo: "INACTIVE",
  inadimplente: "DELINQUENT",
  excecao: "EXCEPTION",
} as const;

const statusFromPrisma = {
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  DELINQUENT: "inadimplente",
  EXCEPTION: "excecao",
} as const;

const allowedModuleNames: ModuleName[] = [
  "CARRETA_KIDS",
  "RENTAL",
  "PLUSH",
  "BILLIARD",
  "BRASIL_BETS",
  "MACHINE",
  "CONDOMINIUM_MARKET",
  "MARKETING",
  "PERSONAL_FINANCE",
  "BX",
  "SLOT_H",
];

function getLocalClients(session: SessionData) {
  return localClientStore.get(session.organizationId) ?? [];
}

function pushLocalClient(session: SessionData, client: ClientListItem) {
  localClientStore.set(session.organizationId, [client, ...getLocalClients(session)]);
}

function normalizeDocument(document?: string) {
  return document?.replace(/\D/g, "") ?? "";
}

function getDocumentFields(input: CreateClientInput) {
  const normalized = normalizeDocument(input.document);

  if (!normalized) {
    return {
      cpf: undefined,
      cnpj: undefined,
      document: undefined,
    };
  }

  return {
    cpf: input.personType === "INDIVIDUAL" ? input.document : undefined,
    cnpj: input.personType === "COMPANY" ? input.document : undefined,
    document: input.document,
  };
}

function getSelectedModules(modules?: string[]) {
  return (modules ?? []).filter((module): module is ModuleName =>
    allowedModuleNames.includes(module as ModuleName),
  );
}

function buildLocalCode(session: SessionData, inputCode?: string) {
  if (inputCode?.trim()) {
    return inputCode.trim().toUpperCase();
  }

  const count = demoClients.length + getLocalClients(session).length + 1;
  return `CLI-${String(count).padStart(4, "0")}`;
}

function mapClientFromPrisma(client: {
  id: string;
  code: string;
  name: string;
  personType: "INDIVIDUAL" | "COMPANY";
  phone: string | null;
  email: string | null;
  document: string | null;
  cpf: string | null;
  cnpj: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
  status: keyof typeof statusFromPrisma;
  updatedAt: Date;
  financialItems?: Array<{ remainingAmount: Prisma.Decimal }>;
  moduleClients?: Array<{ module: ModuleName }>;
}): ClientListItem {
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    personType: client.personType,
    phone: client.phone ?? "-",
    email: client.email ?? undefined,
    document: client.document ?? client.cpf ?? client.cnpj ?? undefined,
    street: client.street ?? undefined,
    neighborhood: client.neighborhood ?? undefined,
    city: client.city ?? "-",
    state: client.state ?? undefined,
    postalCode: client.postalCode ?? undefined,
    notes: client.notes ?? undefined,
    modules: client.moduleClients?.map((item) => item.module),
    status: statusFromPrisma[client.status],
    balance:
      client.financialItems?.reduce(
        (sum, item) => sum + Number(item.remainingAmount),
        0,
      ) ?? 0,
    updatedAt: client.updatedAt.toISOString(),
  };
}

export async function listClients(session: SessionData): Promise<ClientListItem[]> {
  if (process.env.DEMO_MODE !== "false") {
    return [...getLocalClients(session), ...demoClients];
  }

  try {
    const clients = await prisma.client.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        moduleClients: true,
        financialItems: {
          where: {
            status: {
              in: ["PENDING", "PARTIAL", "OVERDUE"],
            },
          },
        },
      },
    });

    return clients.map(mapClientFromPrisma);
  } catch (error) {
    console.error("[client-service] listClients falhou, retornando dados locais/demo:", error);
    return [...getLocalClients(session), ...demoClients];
  }
}

export async function createClient(
  session: SessionData,
  payload: Record<string, unknown>,
): Promise<CreateClientResult> {
  const input = createClientSchema.parse(payload);
  const modules = getSelectedModules(input.modules);
  const documentFields = getDocumentFields(input);

  if (process.env.DEMO_MODE !== "false") {
    const client: ClientListItem = {
      id: randomUUID(),
      code: buildLocalCode(session, input.code),
      name: input.name,
      personType: input.personType,
      phone: input.phone || "-",
      email: input.email || undefined,
      document: input.document || undefined,
      street: input.street || undefined,
      neighborhood: input.neighborhood || undefined,
      city: input.city || "-",
      state: input.state || undefined,
      postalCode: input.postalCode || undefined,
      notes: input.notes || undefined,
      modules,
      status: input.status,
      balance: 0,
      updatedAt: new Date().toISOString(),
    };

    pushLocalClient(session, client);

    return {
      client,
      source: "local",
    };
  }

  const clientsCount = await prisma.client.count({
    where: { organizationId: session.organizationId },
  });
  const code = input.code?.trim().toUpperCase() || `CLI-${String(clientsCount + 1).padStart(4, "0")}`;

  const client = await prisma.client.create({
    data: {
      organizationId: session.organizationId,
      createdById: session.userId,
      code,
      name: input.name,
      personType: input.personType,
      phone: input.phone || undefined,
      email: input.email || undefined,
      cpf: documentFields.cpf,
      cnpj: documentFields.cnpj,
      document: documentFields.document,
      street: input.street || undefined,
      neighborhood: input.neighborhood || undefined,
      city: input.city || undefined,
      state: input.state || undefined,
      postalCode: input.postalCode || undefined,
      notes: input.notes || undefined,
      status: statusToPrisma[input.status],
      moduleClients: modules.length
        ? {
            create: modules.map((module) => ({
              organizationId: session.organizationId,
              module,
              createdById: session.userId,
              notes: "Vinculo criado pelo cadastro completo de clientes.",
            })),
          }
        : undefined,
    },
    include: {
      moduleClients: true,
      financialItems: true,
    },
  });

  return {
    client: mapClientFromPrisma(client),
    source: "database",
  };
}

