"use server";

import { requireSession } from "@/lib/auth";
import {
  normalizarEmail,
  validarEmail,
  validarNome,
  validarSenha,
} from "@/lib/user-validation";
import {
  createStaff,
  resetStaffPassword,
  setStaffStatus,
  updateStaff,
} from "@/server/services/user-service";
import type { ModuleName, StaffMember } from "@/types/app";

export async function createStaffAction(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "STAFF" | "ADMIN";
  modules: ModuleName[];
}): Promise<StaffMember> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new Error("Sem permissão.");
  }

  // Server action e endpoint publico: revalidar aqui, nao confiar no form.
  const erro =
    validarNome(data.name) ??
    validarEmail(data.email) ??
    (validarSenha(data.password) ? `Senha: ${validarSenha(data.password)}` : null);
  if (erro) throw new Error(erro);

  if (!data.modules || data.modules.length === 0) {
    throw new Error("Selecione ao menos um módulo para este funcionário.");
  }

  return createStaff(session, {
    ...data,
    name: data.name.trim(),
    email: normalizarEmail(data.email),
  });
}

export async function updateStaffAction(
  userId: string,
  data: {
    name?: string;
    phone?: string | null;
    role?: "STAFF" | "ADMIN";
    modules?: ModuleName[];
  },
): Promise<StaffMember> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new Error("Sem permissão.");
  }

  if (data.name !== undefined) {
    const erroNome = validarNome(data.name);
    if (erroNome) throw new Error(erroNome);
  }
  if (data.modules && data.modules.length === 0) {
    throw new Error("Selecione ao menos um módulo para este funcionário.");
  }

  return updateStaff(session, userId, data);
}

export async function resetStaffPasswordAction(
  userId: string,
  newPassword: string,
): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
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
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
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
