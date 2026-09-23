/**
 * Regras de login e senha, num lugar só, usadas pelo formulário e pelo
 * servidor. O formulário sozinho não protege nada: server action é endpoint
 * público e pode ser chamada direto.
 */

export const PASSWORD_MIN = 8;

export type Requisito = {
  id: string;
  label: string;
  ok: (senha: string) => boolean;
};

/** Exigências pensadas pra quem digita no celular: sem símbolo obrigatório. */
export const REQUISITOS_SENHA: Requisito[] = [
  {
    id: "tamanho",
    label: `Pelo menos ${PASSWORD_MIN} caracteres`,
    ok: (s) => s.length >= PASSWORD_MIN,
  },
  {
    id: "letra",
    label: "Pelo menos uma letra",
    ok: (s) => /\p{L}/u.test(s),
  },
  {
    id: "numero",
    label: "Pelo menos um número",
    ok: (s) => /\d/.test(s),
  },
  {
    id: "sem-espaco",
    label: "Sem espaços",
    ok: (s) => s.length > 0 && !/\s/.test(s),
  },
];

/** Retorna a primeira regra quebrada, ou null se a senha passa. */
export function validarSenha(senha: string): string | null {
  const falhou = REQUISITOS_SENHA.find((r) => !r.ok(senha));
  return falhou ? falhou.label : null;
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

/** O usuário de acesso é sempre sem espaços e sem diferença entre maiúsculas/minúsculas. */
export function normalizarUsuario(username: string): string {
  return username.trim().toLowerCase();
}

export function validarUsuario(username: string): string | null {
  const value = normalizarUsuario(username);
  if (!value) return "Informe o usuário de acesso.";
  if (value.length < USERNAME_MIN) return `O usuário precisa ter pelo menos ${USERNAME_MIN} caracteres.`;
  if (value.length > USERNAME_MAX) return `O usuário pode ter no máximo ${USERNAME_MAX} caracteres.`;
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(value)) {
    return "Use somente letras sem acento, números, ponto, traço ou sublinhado.";
  }
  return null;
}

/** Compatibilidade para contas antigas até todas receberem um username próprio. */
export function usuarioLegadoDoEmail(email: string): string {
  return normalizarUsuario(email.split("@")[0] ?? email);
}

export function validarNome(nome: string): string | null {
  const n = nome.trim();
  if (n.length < 2) return "Informe o nome completo.";
  return null;
}
