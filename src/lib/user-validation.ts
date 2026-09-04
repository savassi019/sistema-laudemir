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

/**
 * O login busca por email.toLowerCase(), entao o cadastro precisa gravar
 * normalizado — senao um e-mail com maiuscula nunca casa e o funcionario
 * fica trancado do lado de fora sem entender por que.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarEmail(email: string): string | null {
  const e = normalizarEmail(email);
  if (!e) return "Informe o e-mail de acesso.";
  if (!EMAIL_RE.test(e)) return "E-mail inválido. Use o formato nome@dominio.com";
  return null;
}

export function validarNome(nome: string): string | null {
  const n = nome.trim();
  if (n.length < 2) return "Informe o nome completo.";
  return null;
}
