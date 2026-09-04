"use server";

import { requireSession } from "@/lib/auth";
import {
  normalizarEmail,
  validarEmail,
  validarNome,
  validarSenha,
} from "@/lib/user-validation";
import { createStaff } from "@/server/services/user-service";
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
