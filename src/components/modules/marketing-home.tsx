"use client";

import { AlertTriangle, CalendarDays, ChevronRight, Megaphone, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  getMarketingClientsAction,
  type MarketingClientDetail,
} from "@/server/actions/marketing-actions";
import type { MarketingContentKind, MarketingPipelineStage } from "@prisma/client";

/** Funil enxuto: o card so mostra estagio que tem gente, senao vira ruido. */
const FUNIL: { key: MarketingPipelineStage; curto: string; cor: string }[] = [
  { key: "LEAD",              curto: "Lead",     cor: "text-[#9a958b]" },
  { key: "CONTACTED",         curto: "Contato",  cor: "text-[#60a5fa]" },
  { key: "MEETING_SCHEDULED", curto: "Reunião",  cor: "text-[#f3dfae]" },
  { key: "PROPOSAL_SENT",     curto: "Proposta", cor: "text-[#a89ee0]" },
  { key: "NEGOTIATION",       curto: "Negoc.",   cor: "text-[#fb923c]" },
  { key: "CLOSED",            curto: "Fechado",  cor: "text-[#86efac]" },
  { key: "ACTIVE_CLIENT",     curto: "Ativo",    cor: "text-[#4ade80]" },
];

const ICONE_TIPO: Record<MarketingContentKind, typeof Users> = {
  POST: Megaphone,
  MEETING: Users,
  TASK: CalendarDays,
};

const NOME_TIPO: Record<MarketingContentKind, string> = {
  POST: "Conteúdo",
  MEETING: "Reunião",
  TASK: "Tarefa",
};

type Props = {
  hideFinancials?: boolean;
  onAbrirCalendario: () => void;
  onAbrirClientes: () => void;
};

export function MarketingHome({ hideFinancials = false, onAbrirCalendario, onAbrirClientes }: Props) {
  const [clientes, setClientes] = useState<MarketingClientDetail[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getMarketingClientsAction()
      .then(setClientes)
      .catch(() => setClientes([]))
      .finally(() => setCarregando(false));
  }, []);

  const dados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + 7);

    const ativos = clientes.filter((c) => c.pipelineStage === "ACTIVE_CLIENT");
    // "Receita mensal" somava o valor do contrato de quem esta com o rotulo
    // Ativo -- o mesmo defeito do relatorio por cliente (projetava em vez de
    // mostrar o que entrou). Agora soma os Lancamentos de entrada JA
    // recebidos neste mes, de qualquer cliente, ativo ou nao.
    const receita = clientes.reduce((soma, c) => {
      const doMes = c.entries.reduce((s, e) => {
        if (e.direction !== "INCOME" || !e.paid) return s;
        const d = new Date(e.date);
        if (d.getFullYear() !== hoje.getFullYear() || d.getMonth() !== hoje.getMonth()) return s;
        return s + e.amount;
      }, 0);
      return soma + doMes;
    }, 0);

    const porEstagio = new Map<MarketingPipelineStage, number>();
    for (const c of clientes) porEstagio.set(c.pipelineStage, (porEstagio.get(c.pipelineStage) ?? 0) + 1);

    const atrasados: { id: string; titulo: string; cliente: string; kind: MarketingContentKind; dias: number }[] = [];
    const semana: { id: string; titulo: string; cliente: string; kind: MarketingContentKind; data: Date }[] = [];

    // Semana corrente de domingo a sabado, igual a grade do calendario, para
    // que "produzidos na semana" bata com o que se ve la.
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    let pendentes = 0;
    let aprovados = 0;
    let produzidosSemana = 0;

    for (const c of clientes) {
      for (const item of c.contents) {
        const dItem = new Date(item.contentDate);
        if (!Number.isNaN(dItem.getTime())) {
          const diaItem = new Date(dItem.getFullYear(), dItem.getMonth(), dItem.getDate());
          if (item.status === "PENDING") pendentes += 1;
          if (item.status === "APPROVED") aprovados += 1;
          // Aprovado pressupoe produzido, entao os dois contam aqui.
          if (
            (item.status === "PRODUCED" || item.status === "APPROVED") &&
            diaItem >= inicioSemana &&
            diaItem <= fimSemana
          ) {
            produzidosSemana += 1;
          }
        }
        if (item.status === "APPROVED") continue;
        const d = new Date(item.contentDate);
        if (Number.isNaN(d.getTime())) continue;
        const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (dia < hoje) {
          atrasados.push({
            id: item.id, titulo: item.title, cliente: c.name, kind: item.kind,
            dias: Math.round((hoje.getTime() - dia.getTime()) / 86_400_000),
          });
        } else if (dia <= limite) {
          semana.push({ id: item.id, titulo: item.title, cliente: c.name, kind: item.kind, data: dia });
        }
      }
    }

    atrasados.sort((a, b) => b.dias - a.dias);
    semana.sort((a, b) => a.data.getTime() - b.data.getTime());
    return {
      ativos: ativos.length, receita, porEstagio, atrasados, semana, hoje,
      pendentes, aprovados, produzidosSemana,
    };
  }, [clientes]);

  if (carregando) {
    return <p className="px-1 py-3 text-sm text-[#9a958b]">Carregando painel...</p>;
  }

  if (clientes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-7 text-center">
        <Megaphone className="mx-auto mb-2 size-6 text-[#5a544c]" />
        <p className="text-sm text-[#c9c2b4]">Nenhum cliente de marketing ainda</p>
        <p className="mt-1 text-xs text-[#5a544c]">
          Cadastre o primeiro contrato para acompanhar funil, conteúdos e reuniões.
        </p>
      </div>
    );
  }

  const estagiosComGente = FUNIL.filter((e) => (dados.porEstagio.get(e.key) ?? 0) > 0);

  return (
    <div className="space-y-2.5 md:space-y-4">
      {/*
        Numeros da agencia. "Atrasados" e "Na semana" saíram daqui: eram os
        mesmos numeros da faixa vermelha e da lista "Proximos 7 dias" logo
        abaixo, so que sem o detalhe -- contando a mesma coisa duas vezes e
        competindo com Clientes ativos/Receita mensal por atencao.
      */}
      <div className={cn("grid gap-2 md:gap-4", hideFinancials ? "grid-cols-1" : "grid-cols-2")}>
        <Cartao rotulo="Clientes ativos" valor={String(dados.ativos)} cor="text-[#4ade80]" />
        {!hideFinancials && (
          <Cartao rotulo="Receita mensal" valor={formatCurrency(dados.receita)} cor="text-[#f3dfae]" />
        )}
      </div>

      {/* Conteudo: rotulado como o Funil abaixo, para nao parecer uma fileira
          de numeros soltos. Pendentes/Aprovados/Produzidos nao repetem nada
          da tela -- sao a unica contagem desses tres. */}
      <button
        type="button"
        onClick={onAbrirCalendario}
        className="w-full rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 px-3 py-2.5 text-left transition active:bg-white/[0.04] md:px-4 md:py-3"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Conteúdo</p>
          <ChevronRight className="ml-auto size-3.5 text-[#5a544c]" />
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[#5a544c]">Pendentes</p>
            <p className={cn("text-lg font-semibold tabular-nums md:text-xl", dados.pendentes ? "text-[#f87171]" : "text-[#86efac]")}>
              {dados.pendentes}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[#5a544c]">Produzidos/sem.</p>
            <p className="text-lg font-semibold tabular-nums text-[#f3dfae] md:text-xl">{dados.produzidosSemana}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[#5a544c]">Aprovados</p>
            <p className="text-lg font-semibold tabular-nums text-[#4ade80] md:text-xl">{dados.aprovados}</p>
          </div>
        </div>
      </button>

      {/* Funil */}
      {estagiosComGente.length > 0 && (
        <button
          type="button"
          onClick={onAbrirClientes}
          className="w-full rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 px-3 py-2.5 text-left transition active:bg-white/[0.04]"
        >
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Funil</p>
            <ChevronRight className="ml-auto size-3.5 text-[#5a544c]" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {estagiosComGente.map((e) => (
              <span key={e.key} className="flex shrink-0 flex-col items-center rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                <b className={cn("text-sm leading-none", e.cor)}>{dados.porEstagio.get(e.key)}</b>
                <span className="mt-0.5 text-[10px] text-[#9a958b]">{e.curto}</span>
              </span>
            ))}
          </div>
        </button>
      )}

      {/* No desktop as duas listas convivem lado a lado; empilhadas no celular
          elas viravam uma faixa larga e vazia. */}
      <div className="grid gap-2.5 md:grid-cols-2 md:items-start md:gap-4">
      {/* Atrasados: o que dói primeiro */}
      {dados.atrasados.length > 0 && (
        <button
          type="button"
          onClick={onAbrirCalendario}
          className="w-full overflow-hidden rounded-2xl border border-[#f87171]/25 bg-[#190d0d] text-left"
        >
          <div className="flex items-center gap-2.5 bg-[#f87171]/12 px-3 py-2.5">
            <AlertTriangle className="size-4 shrink-0 text-[#f87171]" />
            <p className="flex-1 text-sm font-bold text-[#f87171]">
              {dados.atrasados.length} atrasado{dados.atrasados.length !== 1 ? "s" : ""}
            </p>
            <ChevronRight className="size-4 shrink-0 text-[#f87171]/60" />
          </div>
          <div className="divide-y divide-white/[0.04]">
            {dados.atrasados.slice(0, 3).map((a) => {
              const Icone = ICONE_TIPO[a.kind];
              return (
                <div key={a.id} className="flex min-h-12 items-center gap-2.5 px-3 py-2 md:px-4 md:py-3">
                  <Icone className="size-3.5 shrink-0 text-[#f87171]/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white md:text-sm">{a.titulo}</p>
                    <p className="truncate text-[11px] text-[#9a958b]">{a.cliente}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#f87171]/12 px-2 py-0.5 text-[11px] font-semibold text-[#f87171]">
                    {a.dias}d
                  </span>
                </div>
              );
            })}
          </div>
        </button>
      )}

      {/* Próximos 7 dias */}
      <button
        type="button"
        onClick={onAbrirCalendario}
        className="w-full overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 text-left"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <CalendarDays className="size-3.5 shrink-0 text-[#93c5fd]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Próximos 7 dias</p>
          <ChevronRight className="ml-auto size-3.5 text-[#5a544c]" />
        </div>
        {dados.semana.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-[#5a544c]">Nada marcado para esta semana.</p>
        ) : (
          <div className="divide-y divide-white/[0.04] border-t border-white/[0.05]">
            {dados.semana.slice(0, 4).map((s) => {
              const Icone = ICONE_TIPO[s.kind];
              const ehHoje = s.data.getTime() === dados.hoje.getTime();
              return (
                <div key={s.id} className="flex min-h-12 items-center gap-2.5 px-3 py-2 md:px-4 md:py-3">
                  <Icone className="size-3.5 shrink-0 text-[#93c5fd]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white md:text-sm">{s.titulo}</p>
                    <p className="truncate text-[11px] text-[#9a958b]">{NOME_TIPO[s.kind]} · {s.cliente}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold",
                      ehHoje ? "bg-[#7b6fc0]/15 text-[#c8bef5]" : "bg-white/[0.05] text-[#9a958b]",
                    )}
                  >
                    {ehHoje ? "hoje" : `${s.data.getDate()}/${String(s.data.getMonth() + 1).padStart(2, "0")}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </button>
      </div>
    </div>
  );
}

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0c100f]/80 px-3 py-3 md:px-5 md:py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a958b] md:text-[11px]">{rotulo}</p>
      <p className={cn("mt-1 text-base font-bold leading-tight md:mt-2 md:text-2xl", cor)}>{valor}</p>
    </div>
  );
}
