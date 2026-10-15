"use client";

import { Activity, Check, KeyRound, LoaderCircle, Pencil, Plus, Power, Shield, User, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { fieldClass, labelClass, selectClass } from "@/components/modules/styles";
import { moduleCatalog } from "@/lib/module-catalog";
import {
  PASSWORD_MIN,
  REQUISITOS_SENHA,
  USERNAME_MAX,
  USERNAME_MIN,
  normalizarUsuario,
  validarNome,
  validarSenha,
  validarUsuario,
} from "@/lib/user-validation";
import {
  createStaffAction,
  resetStaffPasswordAction,
  setStaffStatusAction,
  updateStaffAction,
} from "@/server/actions/user-actions";
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
  const [usuarioDigitado, setUsuarioDigitado] = useState("");
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
      username: String(fd.get("username") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      password: String(fd.get("password") ?? ""),
      role: (fd.get("role") ?? "STAFF") as "STAFF" | "ADMIN",
      modules: fd.getAll("modules") as ModuleName[],
    };

    const problema =
      validarNome(data.name) ??
      validarUsuario(data.username) ??
      (validarSenha(data.password) ? `Senha: ${validarSenha(data.password)}` : null);
    if (problema) {
      setError(problema);
      return;
    }
    if (data.modules.length === 0) {
      setError("Selecione ao menos um módulo para este funcionário.");
      return;
    }
    data.username = normalizarUsuario(data.username);

    setError(null);
    submittingRef.current = true;
    startTransition(async () => {
      try {
        const member = await createStaffAction(data);
        setStaff((prev) => [member, ...prev]);
        setMessage(`${member.name} adicionado. Usuário: ${member.username}`);
        setFormOpen(false);
        (event.target as HTMLFormElement).reset();
        setSenhaDigitada("");
        setUsuarioDigitado("");
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
              <span className={labelClass}>Usuário de acesso</span>
              <input
                name="username"
                type="text"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                value={usuarioDigitado}
                onChange={(e) => setUsuarioDigitado(e.target.value)}
                className={fieldClass}
                placeholder="Ex.: joao"
              />
              <span className="block text-[11px] text-[#5a544c]">
                É com este usuário que a pessoa entra no sistema, sem e-mail.
                {usuarioDigitado !== normalizarUsuario(usuarioDigitado) && (
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
                <option value="STAFF">Funcionário de campo — sem totais</option>
                <option value="ADMIN">Gestor — financeiro somente do dia</option>
              </select>
              <span className="block text-[11px] leading-4 text-[#9a958b]">
                Funcionário registra clientes e operações, mas não vê somatórios. Gestor vê somente o financeiro de hoje nos módulos marcados.
              </span>
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
                  className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-slate-200 active:bg-white/[0.05]"
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
        {staff.map((member) => (
          <StaffCard
            key={member.id}
            member={member}
            stats={visitStats[member.name]}
            onUpdate={(patch) =>
              setStaff((prev) => prev.map((m) => (m.id === member.id ? { ...m, ...patch } : m)))
            }
          />
        ))}
      </div>

      {staff.length === 0 && !formOpen ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-[#9a958b]">Nenhum funcionário cadastrado.</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── StaffCard: ver, editar, redefinir senha, ativar/desativar ────────────────

function StaffCard({
  member,
  stats,
  onUpdate,
}: {
  member: StaffMember;
  stats?: { count: number; lastVisitAt?: string };
  onUpdate: (patch: Partial<StaffMember>) => void;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "senha" | "status">("ver");
  const days = daysSince(stats?.lastVisitAt);

  if (modo === "senha") {
    return (
      <ResetPasswordForm
        member={member}
        onDone={() => setModo("ver")}
        onCancel={() => setModo("ver")}
      />
    );
  }

  if (modo === "status") {
    return (
      <ConfirmStatusChange
        member={member}
        onDone={(patch) => { onUpdate(patch); setModo("ver"); }}
        onCancel={() => setModo("ver")}
      />
    );
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/55">
      <div className={cn("h-[3px] w-full", member.status === "ativo" ? "bg-[#d1a04f]/40" : "bg-white/10")} />
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
                {member.role === "ADMIN" ? "Gestor — financeiro de hoje" : "Funcionário de campo"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium",
              member.status === "ativo" ? "bg-[#8aa17c]/12 text-[#8aa17c]" : "bg-white/[0.05] text-[#5a544c]",
            )}
          >
            {member.status === "ativo" ? "Ativo" : "Inativo"}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-xs text-[#9a958b]">
          <p>Usuário: <span className="font-medium text-[#c9c2b4]">{member.username}</span></p>
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

        {/* Antes o card so mostrava dado -- nao dava pra corrigir nome,
            telefone e modulos, redefinir senha nem tirar o acesso de quem
            saiu, sem mexer direto no banco. */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setModo("editar")}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-[#c9c2b4] transition active:bg-white/[0.07]"
          >
            <Pencil className="size-3" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setModo("senha")}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-[#c9c2b4] transition active:bg-white/[0.07]"
          >
            <KeyRound className="size-3" />
            Senha
          </button>
          <button
            type="button"
            onClick={() => setModo("status")}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-medium transition active:scale-[0.98]",
              member.status === "ativo"
                ? "border-[#f87171]/25 bg-[#f87171]/10 text-[#fca5a5]"
                : "border-[#8aa17c]/25 bg-[#8aa17c]/10 text-[#8aa17c]",
            )}
          >
            <Power className="size-3" />
            {member.status === "ativo" ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>
      </article>
      {modo === "editar" ? (
        <EditStaffForm
          member={member}
          onSaved={(patch) => { onUpdate(patch); setModo("ver"); }}
          onCancel={() => setModo("ver")}
        />
      ) : null}
    </>
  );
}

function EditStaffForm({
  member,
  onSaved,
  onCancel,
}: {
  member: StaffMember;
  onSaved: (patch: Partial<StaffMember>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [username, setUsername] = useState(member.username);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [role, setRole] = useState<"STAFF" | "ADMIN">(member.role);
  const [modules, setModules] = useState<Set<ModuleName>>(new Set(member.modules ?? []));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = `edit-staff-${member.id}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, saving]);

  function toggleModule(m: ModuleName) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  async function salvar() {
    const problema = validarNome(name) ?? validarUsuario(username);
    if (problema) return setErro(problema);
    if (modules.size === 0) return setErro("Selecione ao menos um módulo para este funcionário.");

    setSaving(true);
    setErro(null);
    try {
      const atualizado = await updateStaffAction(member.id, {
        name: name.trim(),
        username: normalizarUsuario(username),
        phone: phone.trim() || null,
        role,
        modules: Array.from(modules),
      });
      onSaved(atualizado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar edição"
        onClick={onCancel}
        disabled={saving}
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d1a04f]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-[#d1a04f]/25 bg-[#0b0f0e] shadow-[0_28px_100px_rgba(0,0,0,0.65)] sm:max-h-[90dvh] sm:rounded-[28px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d1a04f]">
              Acesso do funcionário
            </p>
            <h2 id={titleId} className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">
              Editar {member.name}
            </h2>
            <p className="mt-1 text-xs text-[#9a958b]">
              Dados pessoais, perfil e módulos em um só lugar.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar edição"
            onClick={onCancel}
            disabled={saving}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#9a958b] transition-colors active:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1a04f] disabled:opacity-40"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Dados de acesso</h3>
                <p className="mt-1 text-xs text-[#9a958b]">Identificação usada no login e no histórico.</p>
              </div>

              <label className="block space-y-1.5">
                <span className={labelClass}>Nome</span>
                <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Usuário de acesso</span>
                <input
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={USERNAME_MIN}
                  maxLength={USERNAME_MAX}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Telefone</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClass}
                  placeholder="Ex.: (11) 99999-9999"
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Perfil</span>
                <select name="role" value={role} onChange={(e) => setRole(e.target.value as "STAFF" | "ADMIN")} className={selectClass}>
                  <option value="STAFF">Funcionário de campo — sem totais</option>
                  <option value="ADMIN">Gestor — financeiro somente do dia</option>
                </select>
                <span className="block text-xs leading-5 text-[#9a958b]">
                  O gestor vê apenas o financeiro diário dos módulos marcados. O funcionário não vê totais.
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Módulos liberados</h3>
                  <p className="mt-1 text-xs text-[#9a958b]">{modules.size} selecionado{modules.size === 1 ? "" : "s"}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModules(new Set(assignableModules.map((item) => item.module)))}
                    className="min-h-11 rounded-xl border border-[#d1a04f]/25 px-3 text-xs font-semibold text-[#f3dfae] active:bg-[#d1a04f]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1a04f]"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setModules(new Set())}
                    className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#9a958b] active:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1a04f]"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                {assignableModules.map((item) => {
                  const checked = modules.has(item.module);
                  return (
                    <label
                      key={item.module}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        checked
                          ? "border-[#d1a04f]/35 bg-[#d1a04f]/10 text-[#f3dfae]"
                          : "border-white/10 bg-white/[0.025] text-slate-300 active:bg-white/[0.06]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModule(item.module)}
                        className="size-5 shrink-0 accent-[#d1a04f]"
                      />
                      <span className="min-w-0 break-words">{item.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {erro ? (
            <p aria-live="polite" className="mt-4 rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2.5 text-sm font-medium text-[#fca5a5]">
              {erro}
            </p>
          ) : null}
        </div>

        <footer className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-white/10 bg-[#0b0f0e] p-4 sm:px-6">
          <button
            type="button"
            onClick={salvar}
            disabled={saving}
            className="flex min-h-12 items-center justify-center rounded-xl bg-[#d1a04f] px-5 text-sm font-semibold text-[#0d0a05] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3dfae] disabled:opacity-60"
          >
            {saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-12 rounded-xl border border-white/10 px-4 text-sm text-[#c9c2b4] transition-colors active:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1a04f] disabled:opacity-40"
          >
            Cancelar
          </button>
        </footer>
      </section>
    </div>
  );
}

function ResetPasswordForm({
  member,
  onDone,
  onCancel,
}: {
  member: StaffMember;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function confirmar() {
    const problema = validarSenha(senha);
    if (problema) return setErro(`Senha: ${problema}`);

    setSaving(true);
    setErro(null);
    try {
      await resetStaffPasswordAction(member.id, senha);
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao redefinir a senha.");
      setSaving(false);
    }
  }

  if (ok) {
    return (
      <article className="overflow-hidden rounded-2xl border border-[#8aa17c]/25 bg-[#0b0f0e]/70 p-4">
        <p className="text-sm font-semibold text-white">Senha de {member.name} redefinida</p>
        <p className="mt-1 text-xs text-[#9a958b]">Anote e passe esta senha para a pessoa — ela não aparece depois.</p>
        <p className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-[#f3dfae]">
          {senha}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 w-full rounded-xl bg-[#d1a04f] py-2.5 text-xs font-semibold text-[#0d0a05] transition active:scale-[0.98]"
        >
          Concluído
        </button>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#d1a04f]/25 bg-[#0b0f0e]/70 p-4">
      <p className="mb-3 text-sm font-semibold text-white">Redefinir senha de {member.name}</p>

      <label className="block space-y-1.5">
        <span className={labelClass}>Nova senha</span>
        <input
          type={mostrar ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={PASSWORD_MIN}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={fieldClass}
          placeholder="Crie uma senha"
        />
      </label>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {REQUISITOS_SENHA.map((r) => {
          const okReq = r.ok(senha);
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                senha.length === 0 ? "text-[#5a544c]" : okReq ? "text-[#86efac]" : "text-[#f0c9ad]",
              )}
            >
              {senha.length > 0 && okReq ? <Check className="size-3 shrink-0" /> : <span className="size-1 shrink-0 rounded-full bg-current" />}
              {r.label}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMostrar((v) => !v)} className="text-[11px] font-medium text-[#d1a04f] hover:underline">
          {mostrar ? "Ocultar senha" : "Mostrar senha"}
        </button>
        <button
          type="button"
          onClick={() => { setSenha(gerarSenha()); setMostrar(true); }}
          className="text-[11px] font-medium text-[#d1a04f] hover:underline"
        >
          Gerar senha
        </button>
      </div>

      {erro ? (
        <p className="mt-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fca5a5]">
          {erro}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={saving}
          className="flex-1 rounded-xl bg-[#d1a04f] py-2.5 text-xs font-semibold text-[#0d0a05] transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : "Redefinir"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-[#9a958b] transition active:text-white"
        >
          Cancelar
        </button>
      </div>
    </article>
  );
}

function ConfirmStatusChange({
  member,
  onDone,
  onCancel,
}: {
  member: StaffMember;
  onDone: (patch: Partial<StaffMember>) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vaiDesativar = member.status === "ativo";

  async function confirmar() {
    setSaving(true);
    setErro(null);
    try {
      const novoStatus = vaiDesativar ? "inativo" : "ativo";
      await setStaffStatusAction(member.id, novoStatus);
      onDone({ status: novoStatus });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao atualizar.");
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/70 p-4">
      <p className="text-sm font-semibold text-white">
        {vaiDesativar ? `Desativar ${member.name}?` : `Reativar ${member.name}?`}
      </p>
      <p className="mt-1 text-xs text-[#9a958b]">
        {vaiDesativar
          ? "A pessoa não consegue mais entrar no sistema. Nada do que ela já registrou é apagado."
          : "A pessoa volta a conseguir entrar no sistema com a mesma senha de antes."}
      </p>

      {erro ? (
        <p className="mt-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fca5a5]">
          {erro}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={saving}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60",
            vaiDesativar ? "bg-[#f87171] text-[#1a0a0a]" : "bg-[#8aa17c] text-[#0d160f]",
          )}
        >
          {saving ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : vaiDesativar ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-[#9a958b] transition active:text-white"
        >
          Cancelar
        </button>
      </div>
    </article>
  );
}
