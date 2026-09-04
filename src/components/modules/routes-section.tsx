"use client";

import { ChevronRight, Plus, Route as RouteIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createRoutePlanAction,
  listRoutesOverviewAction,
} from "@/server/actions/billiard-route-actions";
import type { BilliardPointItem, RouteOverviewItem } from "@/server/services/billiard-route-service";

const statusChip: Record<string, string> = {
  "Trocar pano": "border-[#f87171]/25 bg-[#f87171]/12 text-[#f87171]",
  "Telhado aberto": "border-[#fb923c]/25 bg-[#fb923c]/12 text-[#fdba74]",
  Coletado: "border-[#4ade80]/20 bg-[#4ade80]/10 text-[#86efac]",
  Pendente: "border-white/10 bg-white/[0.04] text-[#9a958b]",
};

type Props = {
  hideFinancials?: boolean;
  /** Abre o fechamento direto no ponto — evita voltar e caçar o ponto na Visita. */
  onAbrirPonto?: (point: BilliardPointItem) => void;
};

export function RoutesSection({ onAbrirPonto }: Props) {
  const [routes, setRoutes] = useState<RouteOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<number | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [soAlertas, setSoAlertas] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      setRoutes(await listRoutesOverviewAction());
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const totalPontos = routes.reduce((s, r) => s + r.totalPoints, 0);
  const totalAlertas = routes.reduce((s, r) => s + r.needsClothChange + r.roofOpen, 0);

  // Com o filtro ligado, some a rota que nao tem nada pendente.
  const visiveis = useMemo(
    () => (soAlertas ? routes.filter((r) => r.needsClothChange + r.roofOpen > 0) : routes),
    [routes, soAlertas],
  );

  // Uma rota so: nao faz sentido obrigar a abrir.
  useEffect(() => {
    if (routes.length === 1) setAberta(routes[0].routeNumber);
  }, [routes]);

  if (loading) {
    return <p className="px-1 py-4 text-sm text-[#9a958b]">Carregando rotas...</p>;
  }

  return (
    <div className="space-y-2.5">
      {/* Resumo em uma tira só — no celular altura é o recurso escasso */}
      {routes.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
          <span className="text-xs text-[#9a958b]">
            <b className="text-sm text-white">{routes.length}</b> rota{routes.length !== 1 ? "s" : ""}
          </span>
          <span className="text-white/10">·</span>
          <span className="text-xs text-[#9a958b]">
            <b className="text-sm text-white">{totalPontos}</b> ponto{totalPontos !== 1 ? "s" : ""}
          </span>
          {totalAlertas > 0 && (
            <button
              type="button"
              onClick={() => setSoAlertas((v) => !v)}
              className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                soAlertas
                  ? "border-[#f87171]/40 bg-[#f87171]/20 text-[#f87171]"
                  : "border-[#f87171]/20 bg-[#f87171]/10 text-[#f87171]"
              }`}
            >
              {soAlertas ? `Ver todas` : `${totalAlertas} pendente${totalAlertas !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
          <RouteIcon className="mx-auto mb-2 size-6 text-[#5a544c]" />
          <p className="text-sm text-[#c9c2b4]">Nenhuma rota ainda</p>
          <p className="mt-1 text-xs text-[#5a544c]">
            Crie uma rota para agrupar os pontos visitados juntos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visiveis.map((rota) => {
            const aberto = aberta === rota.routeNumber;
            const pontos = soAlertas
              ? rota.points.filter(
                  (p) => p.status === "Trocar pano" || p.status === "Telhado aberto",
                )
              : rota.points;

            return (
              <div
                key={rota.routeNumber}
                className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35"
              >
                <button
                  type="button"
                  onClick={() => setAberta(aberto ? null : rota.routeNumber)}
                  className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition active:bg-white/[0.04]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/15 text-[11px] font-bold text-[#c4b5fd]">
                    {String(rota.routeNumber).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {rota.name ?? `Rota ${String(rota.routeNumber).padStart(2, "0")}`}
                    </span>
                    <span className="block text-[11px] text-[#9a958b]">
                      {rota.totalPoints} ponto{rota.totalPoints !== 1 ? "s" : ""}
                    </span>
                  </span>

                  {/* Diz o que esta pendente, nao so quantos */}
                  <span className="flex shrink-0 items-center gap-1">
                    {rota.needsClothChange > 0 && (
                      <span className="rounded-full bg-[#f87171]/12 px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">
                        {rota.needsClothChange} pano
                      </span>
                    )}
                    {rota.roofOpen > 0 && (
                      <span className="rounded-full bg-[#fb923c]/12 px-2 py-0.5 text-[10px] font-semibold text-[#fdba74]">
                        {rota.roofOpen} telhado
                      </span>
                    )}
                  </span>

                  <ChevronRight
                    className={`size-4 shrink-0 text-[#5a544c] transition-transform ${aberto ? "rotate-90" : ""}`}
                  />
                </button>

                {aberto && (
                  <div className="border-t border-white/[0.05]">
                    {pontos.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-[#5a544c]">
                        {rota.totalPoints === 0
                          ? "Esta rota ainda não tem pontos."
                          : "Nenhum ponto pendente nesta rota."}
                      </p>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {pontos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onAbrirPonto?.(p)}
                            disabled={!onAbrirPonto}
                            className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition active:bg-white/[0.05] disabled:active:bg-transparent"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] text-white">
                                {p.registrationNumber && (
                                  <span className="text-[#d1a04f]">
                                    #{String(p.registrationNumber).padStart(3, "0")}{" "}
                                  </span>
                                )}
                                {p.name}
                              </span>
                              <span className="block truncate text-[11px] text-[#9a958b]">
                                {p.accumulatedChips} fichas
                                {p.city ? ` · ${p.city}` : ""}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                statusChip[p.status] ?? statusChip.Pendente
                              }`}
                            >
                              {p.status}
                            </span>
                            {onAbrirPonto && (
                              <ChevronRight className="size-3.5 shrink-0 text-[#5a544c]" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novaAberta ? (
        <NovaRotaForm
          onCriada={() => {
            setNovaAberta(false);
            carregar();
          }}
          onCancelar={() => setNovaAberta(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setNovaAberta(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-2.5 text-[11px] font-medium text-[#9a958b] transition active:border-[#a78bfa]/30 active:text-[#c4b5fd]"
        >
          <Plus className="size-3.5" />
          Nova rota
        </button>
      )}
    </div>
  );
}

const campoClass =
  "w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-3 text-base text-white placeholder:text-[#5a544c] focus:border-[#a78bfa]/40 focus:outline-none md:text-sm";

/**
 * Sem <form> aqui de proposito: esta secao pode acabar dentro de outro
 * formulario, e form aninhado corrompe a submissao (o navegador dispara uma
 * navegacao GET nativa e o estado React se perde).
 */
function NovaRotaForm({ onCriada, onCancelar }: { onCriada: () => void; onCancelar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const n = Number(numero);
    if (!nome.trim()) return setErro("Dê um nome para a rota.");
    if (!Number.isFinite(n) || n < 1) return setErro("Informe o número da rota.");

    setSalvando(true);
    try {
      await createRoutePlanAction({
        code: codigo.trim() || `R${String(n).padStart(2, "0")}`,
        name: nome.trim(),
        routeNumber: n,
      });
      onCriada();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[#a78bfa]/20 bg-[#a78bfa]/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">
        Nova rota
      </p>
      <div className="grid grid-cols-3 gap-2">
        <input
          className={campoClass}
          placeholder="Nº"
          inputMode="numeric"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <input
          className={`${campoClass} col-span-2`}
          placeholder="Nome (ex: Zona Norte)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <input
        className={campoClass}
        placeholder="Código (opcional)"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
      />
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
          className="rounded-xl bg-[#a78bfa] px-4 py-3 text-xs font-semibold text-[#14101f] transition active:scale-[0.98] disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Criar rota"}
        </button>
      </div>
    </div>
  );
}
