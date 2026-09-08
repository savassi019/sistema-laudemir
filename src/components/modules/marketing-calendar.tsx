"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, Megaphone, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  addMarketingContentAction,
  getMarketingClientsAction,
  updateMarketingContentStatusAction,
  type MarketingClientDetail,
} from "@/server/actions/marketing-actions";
import type { MarketingContentKind, MarketingContentStatus } from "@prisma/client";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS: Record<MarketingContentStatus, { label: string; ponto: string; chip: string }> = {
  PENDING:  { label: "Pendente",  ponto: "bg-[#f87171]", chip: "border-[#f87171]/25 bg-[#f87171]/10 text-[#f87171]" },
  PRODUCED: { label: "Produzido", ponto: "bg-[#d1a04f]", chip: "border-[#d1a04f]/25 bg-[#d1a04f]/10 text-[#f3dfae]" },
  APPROVED: { label: "Aprovado",  ponto: "bg-[#4ade80]", chip: "border-[#4ade80]/25 bg-[#4ade80]/10 text-[#86efac]" },
};

/** Próximo status do ciclo — um toque avança Pendente → Produzido → Aprovado. */
const PROXIMO: Record<MarketingContentStatus, MarketingContentStatus> = {
  PENDING: "PRODUCED",
  PRODUCED: "APPROVED",
  APPROVED: "PENDING",
};

const TIPOS: Record<MarketingContentKind, { label: string; Icone: typeof Users; cor: string }> = {
  POST:    { label: "Conteúdo", Icone: Megaphone,    cor: "text-[#c4b5fd]" },
  MEETING: { label: "Reunião",  Icone: Users,        cor: "text-[#60a5fa]" },
  TASK:    { label: "Tarefa",   Icone: CalendarDays, cor: "text-[#f3dfae]" },
};

type Tarefa = {
  id: string;
  titulo: string;
  cliente: string;
  kind: MarketingContentKind;
  status: MarketingContentStatus;
  atrasado: boolean;
};

/** Chave local AAAA-M-D. Evita UTC, que joga o conteúdo pro dia anterior. */
function chaveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function MarketingCalendar() {
  const [clientes, setClientes] = useState<MarketingClientDetail[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState<string>(() => chaveDia(new Date()));
  const [novoAberto, setNovoAberto] = useState(false);

  async function carregar() {
    try {
      setClientes(await getMarketingClientsAction());
    } catch {
      setClientes([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  // Agrupa tudo por dia uma vez só; o calendário só consulta o mapa.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    for (const cliente of clientes) {
      for (const c of cliente.contents) {
        const d = new Date(c.contentDate);
        if (Number.isNaN(d.getTime())) continue;
        const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const k = chaveDia(dLocal);
        const item: Tarefa = {
          id: c.id,
          titulo: c.title,
          cliente: cliente.name,
          kind: c.kind,
          status: c.status,
          atrasado: c.status !== "APPROVED" && dLocal < hoje,
        };
        const atual = mapa.get(k);
        if (atual) atual.push(item);
        else mapa.set(k, [item]);
      }
    }
    return mapa;
  }, [clientes, hoje]);

  // Grade do mês começando no domingo, completando as semanas.
  const semanas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    const dias: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      dias.push(d);
    }
    // Corta a última semana se ela for inteira do mês seguinte.
    const linhas: Date[][] = [];
    for (let i = 0; i < 42; i += 7) linhas.push(dias.slice(i, i + 7));
    return linhas.filter((sem) => sem.some((d) => d.getMonth() === mes.getMonth()));
  }, [mes]);

  const doMes = useMemo(() => {
    let atrasados = 0, pendentes = 0, total = 0;
    for (const [k, itens] of porDia) {
      const [a, m] = k.split("-").map(Number);
      if (a !== mes.getFullYear() || m !== mes.getMonth()) continue;
      for (const i of itens) {
        total++;
        if (i.atrasado) atrasados++;
        else if (i.status !== "APPROVED") pendentes++;
      }
    }
    return { atrasados, pendentes, total };
  }, [porDia, mes]);

  const tarefasDoDia = porDia.get(diaSel) ?? [];

  async function avancar(t: Tarefa) {
    setSalvando(t.id);
    try {
      await updateMarketingContentStatusAction(t.id, PROXIMO[t.status]);
      await carregar();
    } finally {
      setSalvando(null);
    }
  }

  function mudarMes(delta: number) {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  if (carregando) {
    return <p className="px-1 py-4 text-sm text-[#9a958b]">Carregando calendário...</p>;
  }

  const [aSel, mSel, dSel] = diaSel.split("-").map(Number);
  const dataSel = new Date(aSel, mSel, dSel);

  return (
    <div className="space-y-2.5">
      {/* Mês + navegação */}
      <div className="flex items-center gap-2 md:justify-start">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#c9c2b4] transition active:bg-white/[0.08]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="flex-1 text-center text-sm font-semibold text-white md:flex-none md:min-w-[190px] md:text-left md:text-lg">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#c9c2b4] transition active:bg-white/[0.08]"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Resumo do mês */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-[#9a958b]">
        <span><b className="text-sm text-white">{doMes.total}</b> no mês</span>
        {doMes.atrasados > 0 && (
          <span className="rounded-full bg-[#f87171]/12 px-2 py-0.5 font-semibold text-[#f87171]">
            {doMes.atrasados} atrasado{doMes.atrasados !== 1 ? "s" : ""}
          </span>
        )}
        {doMes.pendentes > 0 && (
          <span className="rounded-full bg-[#d1a04f]/12 px-2 py-0.5 font-semibold text-[#f3dfae]">
            {doMes.pendentes} a fazer
          </span>
        )}
        {doMes.total > 0 && doMes.atrasados === 0 && doMes.pendentes === 0 && (
          <span className="rounded-full bg-[#4ade80]/12 px-2 py-0.5 font-semibold text-[#86efac]">
            tudo aprovado
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            const h = new Date();
            setMes(new Date(h.getFullYear(), h.getMonth(), 1));
            setDiaSel(chaveDia(h));
          }}
          className="ml-auto flex min-h-11 items-center rounded-full border border-white/10 px-3.5 font-medium text-[#c9c2b4] transition active:bg-white/[0.08]"
        >
          Hoje
        </button>
      </div>

      {/* No desktop a grade e o detalhe do dia convivem lado a lado. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-4">

      {/* Grade */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-2 md:p-3">
        <div className="mb-1 grid grid-cols-7">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i} className="text-center text-[11px] font-semibold text-[#5a544c]">{d}</span>
          ))}
        </div>

        <div className="space-y-1">
          {semanas.map((semana, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {semana.map((dia) => {
                const k = chaveDia(dia);
                const itens = porDia.get(k) ?? [];
                const foraDoMes = dia.getMonth() !== mes.getMonth();
                const ehHoje = k === chaveDia(hoje);
                const selecionado = k === diaSel;
                const temAtraso = itens.some((i) => i.atrasado);

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDiaSel(k)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition",
                      "md:aspect-auto md:min-h-[92px] md:items-stretch md:justify-start md:p-1.5",
                      foraDoMes ? "text-[#3a352f]" : "text-[#c9c2b4]",
                      selecionado ? "bg-[#d1a04f]/20 ring-1 ring-[#d1a04f]/50 text-white" : "active:bg-white/[0.06]",
                      !selecionado && ehHoje ? "ring-1 ring-white/20" : "",
                    )}
                  >
                    <span className={cn("md:self-start md:px-0.5", ehHoje && "font-bold text-white", temAtraso && !selecionado && "text-[#f87171]")}>
                      {dia.getDate()}
                    </span>
                    {/* Pontos por status; acima de 3 vira contagem pra não estourar a célula */}
                    {itens.length > 0 && (
                      <span className="flex h-1.5 items-center gap-0.5 md:hidden">
                        {itens.length <= 3 ? (
                          itens.map((it) => (
                            <span key={it.id} className={cn("size-1.5 rounded-full", it.atrasado ? "bg-[#f87171]" : STATUS[it.status].ponto)} />
                          ))
                        ) : (
                          <span className={cn("text-[9px] font-bold leading-none", temAtraso ? "text-[#f87171]" : "text-[#f3dfae]")}>
                            {itens.length}
                          </span>
                        )}
                      </span>
                    )}

                    {/* Desktop: mostra o que e, nao so que existe algo */}
                    {itens.length > 0 && (
                      <span className="mt-1 hidden w-full flex-col gap-0.5 md:flex">
                        {itens.slice(0, 2).map((it) => (
                          <span
                            key={it.id}
                            className={cn(
                              "truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight",
                              it.atrasado
                                ? "bg-[#f87171]/15 text-[#f87171]"
                                : it.status === "APPROVED"
                                  ? "bg-[#4ade80]/12 text-[#86efac]"
                                  : "bg-[#d1a04f]/12 text-[#f3dfae]",
                            )}
                          >
                            {it.titulo}
                          </span>
                        ))}
                        {itens.length > 2 && (
                          <span className="px-1 text-left text-[10px] text-[#5a544c]">
                            +{itens.length - 2}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tarefas do dia escolhido */}
      <div className="mt-2.5 space-y-1.5 md:mt-0 md:sticky md:top-4">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a958b]">
          {dataSel.getDate()} de {MESES[dataSel.getMonth()]}
          {tarefasDoDia.length > 0 && ` · ${tarefasDoDia.length} item${tarefasDoDia.length !== 1 ? "s" : ""}`}
        </p>

        {tarefasDoDia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
            <CalendarDays className="mx-auto mb-1.5 size-5 text-[#5a544c]" />
            <p className="text-xs text-[#5a544c]">Nada marcado para este dia.</p>
          </div>
        ) : (
          tarefasDoDia.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2.5 rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 px-3 py-2.5"
            >
              {(() => {
                const { Icone, cor, label } = TIPOS[t.kind];
                return <Icone className={cn("size-4 shrink-0", cor)} aria-label={label} />;
              })()}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">{t.titulo}</p>
                <p className="truncate text-[11px] text-[#9a958b]">
                  {TIPOS[t.kind].label} · {t.cliente}
                  {t.atrasado && <span className="text-[#f87171]"> · atrasado</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => avancar(t)}
                disabled={salvando === t.id}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-3.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-60",
                  STATUS[t.status].chip,
                )}
              >
                {salvando === t.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : t.status === "APPROVED" ? (
                  <Check className="size-3" />
                ) : null}
                {STATUS[t.status].label}
              </button>
            </div>
          ))
        )}
        {tarefasDoDia.length > 0 && (
          <p className="px-1 pt-0.5 text-[10px] text-[#5a544c]">
            Toque no status para avançar: Pendente → Produzido → Aprovado.
          </p>
        )}

        {/* Marcar reunião/tarefa no proprio dia que esta aberto */}
        {clientes.length === 0 ? (
          <p className="px-1 pt-1 text-[11px] text-[#5a544c]">
            Cadastre um cliente na aba Operação para marcar compromissos.
          </p>
        ) : novoAberto ? (
          <NovoCompromisso
            clientes={clientes}
            data={dataSel}
            onCriado={() => { setNovoAberto(false); carregar(); }}
            onCancelar={() => setNovoAberto(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 text-xs font-medium text-[#9a958b] transition active:border-[#d1a04f]/30 active:text-[#f3dfae]"
          >
            <Plus className="size-3.5" />
            Marcar neste dia
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

const campoCls =
  "w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-3 text-base text-white placeholder:text-[#5a544c] focus:border-[#d1a04f]/40 focus:outline-none md:text-sm";

/**
 * Sem <form> aqui: esta secao pode acabar dentro de outro formulario, e form
 * aninhado corrompe a submissao (o navegador dispara navegacao nativa).
 */
function NovoCompromisso({
  clientes,
  data,
  onCriado,
  onCancelar,
}: {
  clientes: MarketingClientDetail[];
  data: Date;
  onCriado: () => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<MarketingContentKind>("MEETING");
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!titulo.trim()) return setErro("Descreva o compromisso.");
    if (!clienteId) return setErro("Escolha o cliente.");

    setSalvando(true);
    try {
      // Data local para o compromisso cair no dia escolhido, e nao no anterior.
      const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
      await addMarketingContentAction(clienteId, titulo.trim(), iso, "PENDING", undefined, tipo);
      onCriado();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[#d1a04f]/20 bg-[#d1a04f]/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3dfae]">
        Marcar em {data.getDate()}/{String(data.getMonth() + 1).padStart(2, "0")}
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(TIPOS) as MarketingContentKind[]).map((k) => {
          const { label, Icone } = TIPOS[k];
          const ativo = tipo === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTipo(k)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-[11px] font-medium transition",
                ativo
                  ? "border-[#d1a04f]/45 bg-[#d1a04f]/15 text-[#f3dfae]"
                  : "border-white/10 bg-white/[0.03] text-[#9a958b]",
              )}
            >
              <Icone className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <input
        className={campoCls}
        placeholder={tipo === "MEETING" ? "Ex: Reunião de alinhamento" : "Descreva o que fazer"}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />

      <select className={campoCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {erro && <p className="text-xs text-[#f87171]">{erro}</p>}

      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-white/10 px-4 py-3 text-xs font-medium text-[#9a958b] transition active:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-xl bg-[#d1a04f] px-4 py-3 text-xs font-semibold text-[#0d0a05] transition active:scale-[0.98] disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Marcar"}
        </button>
      </div>
    </div>
  );
}
