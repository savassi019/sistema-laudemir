"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { moduleCatalog } from "@/lib/module-catalog";
import type { ClientListItem, DelinquencyInfo, ModuleName } from "@/types/app";
import { fieldClass, labelClass, selectClass, textareaClass } from "@/components/modules/styles";

const clientModuleOptions = moduleCatalog
  .filter((item) =>
    [
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
    ].includes(item.module),
  )
  .map((item) => ({
    value: item.module,
    label: item.title,
  }));

type SaveResponse = {
  client: ClientListItem;
  source: "database" | "local";
};

export function ClientManagement({
  initialClients,
  visitMap = {},
  delinquencyMap = {},
}: {
  initialClients: ClientListItem[];
  visitMap?: Record<string, { daysSinceVisit: number; lastVisitAt: string }>;
  delinquencyMap?: Record<string, DelinquencyInfo>;
}) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleName | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const activeModules = useMemo(() => {
    const modSet = new Set<ModuleName>();
    for (const c of clients) {
      for (const m of c.modules ?? []) modSet.add(m);
    }
    return Array.from(modSet);
  }, [clients]);

  const filteredClients = useMemo(() => {
    let result = clients;
    const normalized = query.trim().toLowerCase();
    if (normalized) {
      result = result.filter((client) =>
        [
          client.code,
          client.name,
          client.phone,
          client.email,
          client.document,
          client.city,
          client.neighborhood,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      );
    }
    if (moduleFilter !== "todos") {
      result = result.filter((c) => c.modules?.includes(moduleFilter));
    }
    return result;
  }, [clients, query, moduleFilter]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!name || !phone) {
      setError("Informe pelo menos nome e telefone do cliente.");
      return;
    }

    const payload = {
      code: String(formData.get("code") ?? "").trim(),
      name,
      personType: String(formData.get("personType") ?? "INDIVIDUAL"),
      phone,
      email: String(formData.get("email") ?? "").trim(),
      document: String(formData.get("document") ?? "").trim(),
      street: String(formData.get("street") ?? "").trim(),
      neighborhood: String(formData.get("neighborhood") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim().toUpperCase(),
      postalCode: String(formData.get("postalCode") ?? "").trim(),
      status: String(formData.get("status") ?? "ativo"),
      notes: String(formData.get("notes") ?? "").trim(),
      modules: formData.getAll("modules").map(String),
    };

    submittingRef.current = true;
    startTransition(async () => {
      try {
        const response = await fetch("/api/clients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Não foi possível salvar o cliente.");
        }

        const result = (await response.json()) as SaveResponse;
        setClients((current) => [result.client, ...current]);
        setMessage(
          result.source === "database"
            ? "Cliente salvo no banco."
            : "Cliente salvo no modo demo local.",
        );
        form.reset();
        setSelectedType("INDIVIDUAL");
        setFormOpen(false);
      } catch {
        setError("Falha ao salvar cliente. Verifique os dados e tente novamente.");
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(80,111,96,0.12))] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">
              Cadastro completo
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Clientes com documento, endereço, módulo e histórico.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9c2b4]">
              Base única para bilhar, pelúcias, locação, financeiro, contratos e
              operações de campo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] sm:w-auto"
          >
            {formOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {formOpen ? "Fechar cadastro" : "Novo cliente"}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f0e]/70 px-4 py-3">
          <Search className="size-4 shrink-0 text-[#9a958b]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-base md:text-sm text-white outline-none placeholder:text-[#7e786d]"
            placeholder="Buscar por nome, telefone, documento, cidade..."
          />
        </div>

        {activeModules.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setModuleFilter("todos")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                moduleFilter === "todos"
                  ? "bg-[#d1a04f]/20 text-[#f3dfae] border border-[#d1a04f]/35"
                  : "border border-white/10 bg-white/[0.03] text-[#9a958b] hover:bg-white/[0.06]"
              }`}
            >
              Todos
            </button>
            {activeModules.map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setModuleFilter(mod === moduleFilter ? "todos" : mod)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  moduleFilter === mod
                    ? "bg-[#d1a04f]/20 text-[#f3dfae] border border-[#d1a04f]/35"
                    : "border border-white/10 bg-white/[0.03] text-[#9a958b] hover:bg-white/[0.06]"
                }`}
              >
                {getModuleLabel(mod)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

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
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:p-5"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#d1a04f]/24 bg-[#d1a04f]/10 text-[#f3dfae]">
              {selectedType === "COMPANY" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Novo cliente</h2>
              <p className="text-sm leading-5 text-[#9a958b]">
                Dados principais, endereço, observações e módulos vinculados.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <select
                name="personType"
                className={selectClass}
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value as "INDIVIDUAL" | "COMPANY")
                }
              >
                <option value="INDIVIDUAL">Pessoa física</option>
                <option value="COMPANY">Empresa</option>
              </select>
            </Field>
            <Field label="Código">
              <input name="code" className={fieldClass} placeholder="Automático se vazio" />
            </Field>
            <Field label={selectedType === "COMPANY" ? "Razão/Nome fantasia" : "Nome completo"}>
              <input name="name" className={fieldClass} />
            </Field>
            <Field label={selectedType === "COMPANY" ? "CNPJ" : "CPF"}>
              <input name="document" className={fieldClass} />
            </Field>
            <Field label="Telefone">
              <input name="phone" className={fieldClass} inputMode="tel" />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" className={fieldClass} />
            </Field>
            <Field label="Endereço">
              <input name="street" className={fieldClass} />
            </Field>
            <Field label="Bairro">
              <input name="neighborhood" className={fieldClass} />
            </Field>
            <Field label="Cidade">
              <input name="city" className={fieldClass} />
            </Field>
            <Field label="Estado">
              <input name="state" className={fieldClass} maxLength={2} placeholder="SP" />
            </Field>
            <Field label="CEP">
              <input name="postalCode" className={fieldClass} />
            </Field>
            <Field label="Status">
              <select name="status" className={selectClass} defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="inadimplente">Inadimplente</option>
                <option value="excecao">Exceção</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <p className={labelClass}>Módulos vinculados</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clientModuleOptions.map((module) => (
                <label
                  key={module.value}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-[#c9c2b4]"
                >
                  <input
                    name="modules"
                    type="checkbox"
                    value={module.value}
                    className="size-4 accent-[#d1a04f]"
                  />
                  {module.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Field label="Observações">
              <textarea
                name="notes"
                className={textareaClass}
                placeholder="Pendências, preferências, regras especiais, contato alternativo..."
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
          >
            <Check className="size-4" />
            {isPending ? "Salvando..." : "Salvar cliente completo"}
          </button>
        </form>
      ) : null}

      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Base de clientes</h2>
            <p className="text-sm text-[#c9c2b4]">
              {filteredClients.length} cliente(s) encontrados.
            </p>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              visitInfo={visitMap[client.id]}
              delinquency={delinquencyMap[client.id]}
            />
          ))}
        </div>

        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
            <Users className="mb-3 size-8 text-[#5a544c]" />
            <p className="text-sm text-[#9a958b]">Nenhum cliente encontrado.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function VisitBadge({ info }: { info?: { daysSinceVisit: number; lastVisitAt: string } }) {
  if (!info) {
    return (
      <span className="rounded-lg bg-[#3a3530]/60 px-2 py-0.5 text-[11px] text-[#5a544c]">
        sem visita
      </span>
    );
  }
  const d = info.daysSinceVisit;
  const color =
    d >= 15
      ? "bg-[#f87171]/10 text-[#f87171]"
      : d >= 7
        ? "bg-[#fbbf24]/10 text-[#fbbf24]"
        : "bg-[#8aa17c]/12 text-[#8aa17c]";
  const label = d === 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`;
  return (
    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${color}`}>{label}</span>
  );
}

function ClientCard({
  client,
  visitInfo,
  delinquency,
}: {
  client: ClientListItem;
  visitInfo?: { daysSinceVisit: number; lastVisitAt: string };
  delinquency?: DelinquencyInfo;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/55">
      <div className="h-[3px] w-full bg-[#d1a04f]/40" />
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9a958b]">
            {client.code}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-white">{client.name}</h3>
          {client.phone && client.phone !== "-" ? (
            <a
              href={`tel:${client.phone.replace(/\D/g, "")}`}
              className="mt-1 block text-sm text-[#c9c2b4] transition hover:text-[#f3dfae]"
              onClick={(e) => e.stopPropagation()}
            >
              {client.phone}
            </a>
          ) : (
            <p className="mt-1 text-sm text-[#c9c2b4]">—</p>
          )}
        </div>
        <StatusBadge label={client.status} />
      </div>

      {delinquency ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {delinquency.hasNotPaid ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f87171]/12 px-2 py-1 text-[11px] font-medium text-[#f87171]">
              <AlertTriangle className="size-3" />
              Não pagou
            </span>
          ) : null}
          {delinquency.hasPartialPayment ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#d1a04f]/12 px-2 py-1 text-[11px] font-medium text-[#f3dfae]">
              <AlertTriangle className="size-3" />
              Pagamento parcial
            </span>
          ) : null}
          {delinquency.hasDebtAccumulation ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f87171]/15 px-2 py-1 text-[11px] font-semibold text-[#f87171]">
              <AlertTriangle className="size-3" />
              Acúmulo · {formatCurrency(delinquency.totalDebtAmount)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <InfoItem icon={<FileText className="size-3.5" />} label="Documento" value={client.document || "-"} />
        <InfoItem icon={<MapPin className="size-3.5" />} label="Cidade" value={client.city || "-"} />
        <InfoItem label="Saldo" value={formatCurrency(client.balance)} />
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-[11px] text-[#9a958b]">Última visita</p>
          <div className="mt-1.5"><VisitBadge info={visitInfo} /></div>
        </div>
      </div>

      {client.street || client.neighborhood || client.state ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs leading-5 text-[#9a958b]">
          {[client.street, client.neighborhood, client.city, client.state].filter(Boolean).join(" - ")}
        </p>
      ) : null}

      {client.modules?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {client.modules.slice(0, 4).map((module) => (
            <span
              key={module}
              className="rounded-full border border-[#d1a04f]/24 bg-[#d1a04f]/10 px-2.5 py-1 text-[11px] font-medium text-[#f3dfae]"
            >
              {getModuleLabel(module)}
            </span>
          ))}
        </div>
      ) : null}

      {client.notes ? (
        <p className="mt-3 text-xs leading-5 text-[#9a958b]">{client.notes}</p>
      ) : null}

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <Link
          href={`/clientes/${client.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-medium text-[#c9c2b4] transition hover:bg-white/[0.06]"
        >
          Ver histórico e visitas
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-[#9a958b]">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function getModuleLabel(module: ModuleName) {
  return moduleCatalog.find((item) => item.module === module)?.title ?? module;
}
