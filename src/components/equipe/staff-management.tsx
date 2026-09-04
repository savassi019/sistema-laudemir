"use client";

import { Activity, Check, Plus, Shield, User, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { fieldClass, labelClass, selectClass } from "@/components/modules/styles";
import { moduleCatalog } from "@/lib/module-catalog";
import {
  PASSWORD_MIN,
  REQUISITOS_SENHA,
  normalizarEmail,
  validarEmail,
  validarNome,
  validarSenha,
} from "@/lib/user-validation";
import { createStaffAction } from "@/server/actions/user-actions";
import type { ModuleName, StaffMember } from "@/types/app";

const assignableModules = moduleCatalog.filter((item) => item.group !== "core");

/** Senha legível: sem 0/O/1/l, que geram confusão ao ditar por telefone. */
function gerarSenha() {
  const letras = "abcdefghijkmnpqrstuvwxyz";
  const maius = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const todos = letras + maius + nums;
  const sorteia = (s: string) => s[Math.floor(Math.random() * s.length)];
  // Garante o que os requisitos pedem, depois completa até 10.
  const base = [sorteia(maius), sorteia(letras), sorteia(nums), sorteia(nums)];
  while (base.length < 10) base.push(sorteia(todos));
  return base.sort(() => Math.random() - 0.5).join("");
}

type VisitStats = Record<string, { count: number; lastVisitAt?: string }>;

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function StaffManagement({
  initialStaff,
  visitStats = {},
}: {
  initialStaff: StaffMember[];
  visitStats?: VisitStats;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [senhaDigitada, setSenhaDigitada] = useState("");
  const [emailDigitado, setEmailDigitado] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  function setAllModules(checked: boolean) {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="modules"]')
      .forEach((el) => {
        el.checked = checked;
      });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const fd = new FormData(event.currentTarget);
    const data = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      password: String(fd.get("password") ?? ""),
      role: (fd.get("role") ?? "STAFF") as "STAFF" | "ADMIN",
      modules: fd.getAll("modules") as ModuleName[],
    };

    const problema =
      validarNome(data.name) ??
      validarEmail(data.email) ??
      (validarSenha(data.password) ? `Senha: ${validarSenha(data.password)}` : null);
    if (problema) {
      setError(problema);
      return;
    }
    if (data.modules.length === 0) {
      setError("Selecione ao menos um módulo para este funcionário.");
      return;
    }
    data.email = normalizarEmail(data.email);

    setError(null);
    submittingRef.current = true;
    startTransition(async () => {
      try {
        const member = await createStaffAction(data);
        setStaff((prev) => [member, ...prev]);
        setMessage(`${member.name} adicionado. Login: ${member.email}`);
        setFormOpen(false);
        (event.target as HTMLFormElement).reset();
        setSenhaDigitada("");
        setEmailDigitado("");
        setMostrarSenha(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao criar funcionário.");
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Membros da equipe</h2>
        <button
          type="button"
          onClick={() => { setFormOpen((v) => !v); setError(null); }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 py-2 text-sm font-medium text-[#f3dfae] transition hover:bg-[#d1a04f]/18"
        >
          {formOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          {formOpen ? "Cancelar" : "Novo funcionário"}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-[#8aa17c]/25 bg-[#1d2e22]/70 p-3 text-sm text-[#dbe6d4]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-[#b46c5d]/30 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:p-5"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Novo funcionário</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className={labelClass}>Nome</span>
              <input name="name" required className={fieldClass} placeholder="Nome completo" />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>E-mail de acesso</span>
              <input
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={emailDigitado}
                onChange={(e) => setEmailDigitado(e.target.value)}
                className={fieldClass}
                placeholder="nome@empresa.com"
              />
              <span className="block text-[11px] text-[#5a544c]">
                É com este e-mail que a pessoa entra no sistema.
                {emailDigitado !== emailDigitado.toLowerCase() && (
                  <span className="text-[#fdba74]"> Será salvo em minúsculas.</span>
                )}
              </span>
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Telefone</span>
              <input name="phone" className={fieldClass} placeholder="(11) 99999-9999" />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Perfil</span>
              <select name="role" className={selectClass} defaultValue="STAFF">
                <option value="STAFF">Funcionário</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <div className="space-y-2 sm:col-span-2">
              <label className="block space-y-2">
                <span className={labelClass}>Senha inicial</span>
                <input
                  name="password"
                  type={mostrarSenha ? "text" : "password"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={PASSWORD_MIN}
                  value={senhaDigitada}
                  onChange={(e) => setSenhaDigitada(e.target.value)}
                  className={fieldClass}
                  placeholder="Crie uma senha"
                />
              </label>

              {/* Requisitos marcando ao vivo: erra menos do que descobrir no submit */}
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {REQUISITOS_SENHA.map((r) => {
                  const ok = r.ok(senhaDigitada);
                  return (
                    <li
                      key={r.id}
                      className={`flex items-center gap-1.5 text-[11px] ${
                        senhaDigitada.length === 0
                          ? "text-[#5a544c]"
                          : ok
                            ? "text-[#86efac]"
                            : "text-[#f0c9ad]"
                      }`}
                    >
                      {senhaDigitada.length > 0 && ok ? (
                        <Check className="size-3 shrink-0" />
                      ) : (
                        <span className="size-1 shrink-0 rounded-full bg-current" />
                      )}
                      {r.label}
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="text-[11px] font-medium text-[#d1a04f] hover:underline"
                >
                  {mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSenhaDigitada(gerarSenha());
                    setMostrarSenha(true);
                  }}
                  className="text-[11px] font-medium text-[#d1a04f] hover:underline"
                >
                  Gerar senha
                </button>
              </div>
              <p className="text-[11px] text-[#5a544c]">
                Anote e passe esta senha para a pessoa — ela não aparece depois.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Módulos liberados</span>
              <div className="flex gap-3 text-xs font-medium text-[#d1a04f]">
                <button type="button" onClick={() => setAllModules(true)} className="hover:underline">
                  Todos
                </button>
                <button type="button" onClick={() => setAllModules(false)} className="hover:underline">
                  Limpar
                </button>
              </div>
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f0e]/45 p-1.5">
              {assignableModules.map((item) => (
                <label
                  key={item.module}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-slate-200 active:bg-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    name="modules"
                    value={item.module}
                    className="size-4 shrink-0 accent-[#d1a04f]"
                  />
                  <span className="truncate">{item.title}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] disabled:opacity-60"
          >
            <Plus className="size-4" />
            {isPending ? "Salvando..." : "Adicionar à equipe"}
          </button>
        </form>
      ) : null}

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${formOpen ? "hidden" : ""}`}>
        {staff.map((member) => {
          const stats = visitStats[member.name];
          const days = daysSince(stats?.lastVisitAt);
          return (
            <article
              key={member.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/55"
            >
              <div className="h-[3px] w-full bg-[#d1a04f]/40" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] text-[#9a958b]">
                      {member.role === "ADMIN" ? (
                        <Shield className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{member.name}</p>
                      <p className="text-xs text-[#9a958b]">
                        {member.role === "ADMIN" ? "Administrador" : "Funcionário"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                      member.status === "ativo"
                        ? "bg-[#8aa17c]/12 text-[#8aa17c]"
                        : "bg-white/[0.05] text-[#5a544c]"
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[#9a958b]">
                  <p>{member.email}</p>
                  {member.phone ? <p>{member.phone}</p> : null}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
                  <Activity className="size-3.5 shrink-0 text-[#9a958b]" />
                  {stats ? (
                    <p className="text-xs text-[#c9c2b4]">
                      <span className="font-semibold text-white">{stats.count}</span>{" "}
                      {stats.count === 1 ? "visita" : "visitas"} ·{" "}
                      {days === null
                        ? "—"
                        : days === 0
                          ? "última hoje"
                          : days === 1
                            ? "última ontem"
                            : `última há ${days}d`}
                    </p>
                  ) : (
                    <p className="text-xs text-[#5a544c]">Sem visitas registradas</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {staff.length === 0 && !formOpen ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-[#9a958b]">Nenhum funcionário cadastrado.</p>
        </div>
      ) : null}
    </div>
  );
}
