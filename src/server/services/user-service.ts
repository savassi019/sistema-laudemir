import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { normalizarUsuario, usuarioLegadoDoEmail } from "@/lib/user-validation";
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
        username: "funcionario",
        status: "ativo",
        role: "STAFF",
        createdAt: new Date().toISOString(),
        modules: ["BILLIARD"],
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
      include: { modulePermissions: { select: { module: true, canView: true } } },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username ?? usuarioLegadoDoEmail(u.email),
      phone: u.phone ?? undefined,
      status: u.status === "ACTIVE" ? "ativo" : "inativo",
      role: u.role as "STAFF" | "ADMIN",
      createdAt: u.createdAt.toISOString(),
      modules: u.modulePermissions
        .filter((p) => p.canView)
        .map((p) => p.module as ModuleName)
        .filter((m) => m !== "DASHBOARD"),
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
    username: string;
    phone?: string;
    password: string;
    role: "STAFF" | "ADMIN";
    modules: ModuleName[];
  },
): Promise<StaffMember> {
  const member: StaffMember = {
    id: randomUUID(),
    name: data.name,
    username: data.username,
    phone: data.phone,
    status: "ativo",
    role: data.role,
    createdAt: new Date().toISOString(),
    modules: data.modules,
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

    const username = normalizarUsuario(data.username);
    // O campo e-mail continua no banco apenas por compatibilidade estrutural.
    // Nenhum e-mail real é pedido nem mostrado para novas contas.
    const email = `${username}@login.erpinfinity.local`;

    const user = await prisma.user.create({
      data: {
        organizationId: session.organizationId,
        name: data.name,
        username,
        email,
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
      username: user.username ?? username,
      phone: user.phone ?? undefined,
      status: "ativo",
      role: user.role as "STAFF" | "ADMIN",
      createdAt: user.createdAt.toISOString(),
      modules: data.modules,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Usuário já cadastrado.");
    }

    console.error("[user-service] createStaff falhou ao gravar no banco:", error);
    throw new Error("Falha ao salvar o funcionario no banco. Tente novamente.");
  }
}

/**
 * Cartao do funcionario ate hoje so criava -- nada de editar, redefinir
 * senha ou desativar. "Excluir" de verdade nao existe de proposito: o
 * usuario pode ter criado registros (visitas, comprovantes) que ficariam
 * orfaos. Desativar bloqueia o login (authenticateUser ja rejeita
 * status != ACTIVE, ver src/lib/auth.ts) sem apagar nada.
 */
export async function updateStaff(
  session: SessionData,
  userId: string,
  data: {
    name?: string;
    username?: string;
    phone?: string | null;
    role?: "STAFF" | "ADMIN";
    modules?: ModuleName[];
  },
): Promise<StaffMember> {
  if (process.env.DEMO_MODE !== "false") {
    const list = getLocalStaff(session);
    const idx = list.findIndex((m) => m.id === userId);
    if (idx === -1) throw new Error("Funcionário não encontrado.");
    const atual = list[idx];
    const atualizado: StaffMember = {
      ...atual,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.username !== undefined && { username: normalizarUsuario(data.username) }),
      ...(data.phone !== undefined && { phone: data.phone ?? undefined }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.modules !== undefined && { modules: data.modules }),
    };
    const novaLista = [...list];
    novaLista[idx] = atualizado;
    localStaffStore.set(session.organizationId, novaLista);
    return atualizado;
  }

  const alvo = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
  });
  if (!alvo) throw new Error("Funcionário não encontrado.");
  if (alvo.role === "OWNER") throw new Error("Não é possível editar o Dono por aqui.");

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.username !== undefined && { username: normalizarUsuario(data.username) }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.role !== undefined && { role: data.role }),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Usuário já cadastrado.");
    }
    throw error;
  }

  let modulos = data.modules;
  if (data.modules) {
    const concedidos = Array.from(new Set<ModuleName>(["DASHBOARD", ...data.modules]));
    await prisma.$transaction([
      prisma.modulePermission.deleteMany({
        where: { userId, organizationId: session.organizationId, module: { notIn: concedidos } },
      }),
      ...concedidos.map((module) =>
        prisma.modulePermission.upsert({
          where: { userId_module: { userId, module } },
          create: { organizationId: session.organizationId, userId, module, canView: true, canCreate: true },
          // Uma permissao antiga pode existir com canView=false. Marcar o
          // modulo novamente na tela precisa reativa-la de verdade.
          update: { canView: true, canCreate: true },
        }),
      ),
    ]);
  } else {
    const permissoes = await prisma.modulePermission.findMany({
      where: { userId, organizationId: session.organizationId },
      select: { module: true, canView: true },
    });
    modulos = permissoes
      .filter((p) => p.canView)
      .map((p) => p.module as ModuleName)
      .filter((m) => m !== "DASHBOARD");
  }

  return {
    id: updated.id,
    name: updated.name,
    username: updated.username ?? usuarioLegadoDoEmail(updated.email),
    phone: updated.phone ?? undefined,
    status: updated.status === "ACTIVE" ? "ativo" : "inativo",
    role: updated.role as "STAFF" | "ADMIN",
    createdAt: updated.createdAt.toISOString(),
    modules: modulos,
  };
}

export async function resetStaffPassword(
  session: SessionData,
  userId: string,
  newPassword: string,
): Promise<void> {
  if (process.env.DEMO_MODE !== "false") return;

  const alvo = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
  });
  if (!alvo) throw new Error("Funcionário não encontrado.");
  if (alvo.role === "OWNER") throw new Error("Não é possível redefinir a senha do Dono por aqui.");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function setStaffStatus(
  session: SessionData,
  userId: string,
  status: "ativo" | "inativo",
): Promise<void> {
  if (process.env.DEMO_MODE !== "false") {
    const list = getLocalStaff(session);
    const idx = list.findIndex((m) => m.id === userId);
    if (idx === -1) throw new Error("Funcionário não encontrado.");
    const novaLista = [...list];
    novaLista[idx] = { ...novaLista[idx], status };
    localStaffStore.set(session.organizationId, novaLista);
    return;
  }

  if (userId === session.userId) {
    throw new Error("Não é possível desativar seu próprio usuário.");
  }

  const alvo = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
  });
  if (!alvo) throw new Error("Funcionário não encontrado.");
  if (alvo.role === "OWNER") throw new Error("Não é possível desativar o Dono.");

  await prisma.user.update({
    where: { id: userId },
    data: { status: status === "ativo" ? "ACTIVE" : "INACTIVE" },
  });
}
