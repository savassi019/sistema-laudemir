import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { ModuleName, SessionData, StaffMember } from "@/types/app";

const globalForUsers = globalThis as unknown as {
  localStaffStore?: Map<string, StaffMember[]>;
};
const localStaffStore =
  globalForUsers.localStaffStore ?? new Map<string, StaffMember[]>();
globalForUsers.localStaffStore = localStaffStore;

function getLocalStaff(session: SessionData): StaffMember[] {
  return localStaffStore.get(session.organizationId) ?? [];
}

export async function listStaff(session: SessionData): Promise<StaffMember[]> {
  if (process.env.DEMO_MODE !== "false") {
    return [
      {
        id: "demo-user-2",
        name: "Equipe Campo Demo",
        email: "funcionario@svs-demo.local",
        status: "ativo",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
      ...getLocalStaff(session),
    ];
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: { in: ["STAFF", "ADMIN"] },
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? undefined,
      status: u.status === "ACTIVE" ? "ativo" : "inativo",
      role: u.role as "STAFF" | "ADMIN",
      createdAt: u.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[user-service] listStaff falhou, retornando dados locais:", error);
    return getLocalStaff(session);
  }
}

export async function createStaff(
  session: SessionData,
  data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: "STAFF" | "ADMIN";
    modules: ModuleName[];
  },
): Promise<StaffMember> {
  const member: StaffMember = {
    id: randomUUID(),
    name: data.name,
    email: data.email,
    phone: data.phone,
    status: "ativo",
    role: data.role,
    createdAt: new Date().toISOString(),
  };

  if (process.env.DEMO_MODE !== "false") {
    localStaffStore.set(session.organizationId, [
      member,
      ...getLocalStaff(session),
    ]);
    return member;
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const grantedModules = Array.from(new Set<ModuleName>(["DASHBOARD", ...data.modules]));

    const user = await prisma.user.create({
      data: {
        organizationId: session.organizationId,
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        passwordHash,
        role: data.role,
        modulePermissions: {
          create: grantedModules.map((module) => ({
            organizationId: session.organizationId,
            module,
            canView: true,
            canCreate: true,
          })),
        },
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
      status: "ativo",
      role: user.role as "STAFF" | "ADMIN",
      createdAt: user.createdAt.toISOString(),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Email já cadastrado.");
    }

    console.error("[user-service] createStaff falhou ao gravar no banco:", error);
    throw new Error("Falha ao salvar o funcionario no banco. Tente novamente.");
  }
}
