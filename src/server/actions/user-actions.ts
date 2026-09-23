"use server";

import { requireSession } from "@/lib/auth";
import { moduleCatalog } from "@/lib/module-catalog";
import {
  validarNome,
  validarSenha,
  normalizarUsuario,
  validarUsuario,
} from "@/lib/user-validation";
import {
  createStaff,
  resetStaffPassword,
  setStaffStatus,
  updateStaff,
} from "@/server/services/user-service";
import type { ModuleName, StaffMember } from "@/types/app";

const ASSIGNABLE_MODULES = new Set(
  moduleCatalog.filter((item) => item.group !== "core").map((item) => item.module),
);

function validateAccessSelection(role: unknown, modules: unknown): asserts modules is ModuleName[] {
  if (role !== "STAFF" && role !== "ADMIN") {
    throw new Error("Perfil de acesso invalido.");
  }
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error("Selecione ao menos um modulo para este funcionario.");
  }
  if (modules.some((module) => !ASSIGNABLE_MODULES.has(module as ModuleName))) {
    throw new Error("Um dos modulos selecionados nao pode ser liberado por esta tela.");
  }
}

export async function createStaffAction(data: {
  name: string;
  username: string;
  phone?: string;
  password: string;
  role: "STAFF" | "ADMIN";
  modules: ModuleName[];
}): Promise<StaffMember> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    throw new Error("Sem permissão.");
  }

  // Server action e endpoint publico: revalidar aqui, nao confiar no form.
  const erro =
    validarNome(data.name) ??
    validarUsuario(data.username) ??
    (validarSenha(data.password) ? `Senha: ${validarSenha(data.password)}` : null);
  if (erro) throw new Error(erro);

  validateAccessSelection(data.role, data.modules);

  return createStaff(session, {
    ...data,
    name: data.name.trim(),
    username: normalizarUsuario(data.username),
  });
}

export async function updateStaffAction(
  userId: string,
  data: {
    name?: string;
    username?: string;
    phone?: string | null;
    role?: "STAFF" | "ADMIN";
    modules?: ModuleName[];
  },
): Promise<StaffMember> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    throw new Error("Sem permissão.");
  }

  if (data.name !== undefined) {
    const erroNome = validarNome(data.name);
    if (erroNome) throw new Error(erroNome);
  }
  if (data.username !== undefined) {
    const erroUsuario = validarUsuario(data.username);
    if (erroUsuario) throw new Error(erroUsuario);
    data.username = normalizarUsuario(data.username);
  }
  if (data.role !== undefined && data.role !== "STAFF" && data.role !== "ADMIN") {
    throw new Error("Perfil de acesso invalido.");
  }
  if (data.modules !== undefined) {
    validateAccessSelection(data.role ?? "STAFF", data.modules);
  }

  return updateStaff(session, userId, data);
}

export async function resetStaffPasswordAction(
  userId: string,
  newPassword: string,
): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    throw new Error("Sem permissão.");
  }

  const erro = validarSenha(newPassword);
  if (erro) throw new Error(`Senha: ${erro}`);

  await resetStaffPassword(session, userId, newPassword);
}

export async function setStaffStatusAction(
  userId: string,
  status: "ativo" | "inativo",
): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER") {
    throw new Error("Sem permissão.");
  }

  await setStaffStatus(session, userId, status);
}

/**
 * Nome de quem esta logado agora. Usado onde o formulario precisa mostrar
 * "quem esta fazendo a operacao" sem pedir pra digitar -- essa informacao
 * ja vem do login.
 */
export async function getCurrentUserNameAction(): Promise<string> {
  const session = await requireSession();
  return session.name;
}
