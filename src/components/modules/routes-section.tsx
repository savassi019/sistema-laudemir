"use client";

import { AlertTriangle, ChevronRight, MapPin, Plus, Route as RouteIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createRoutePlanAction,
  listRoutesOverviewAction,
} from "@/server/actions/billiard-route-actions";
import type { RouteOverviewItem } from "@/server/services/billiard-route-service";

const statusColor: Record<string, string> = {
  "Trocar pano": "border-[#f87171]/25 bg-[#f87171]/10 text-[#f87171]",
  "Telhado aberto": "border-[#fb923c]/25 bg-[#fb923c]/10 text-[#fdba74]",
  Coletado: "border-[#4ade80]/25 bg-[#4ade80]/10 text-[#86efac]",
  Pendente: "border-white/10 bg-white/[0.04] text-[#9a958b]",
};

export function RoutesSection({ hideFinancials = false }: { hideFinancials?: boolean }) {
  const [routes, setRoutes] = useState<RouteOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<number | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

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

  if (loading) {
    return <p className="px-1 text-sm text-[#9a958b]">Carregando rotas...</p>;
  }

  const totalPontos = routes.reduce((s, r) => s + r.totalPoints, 0);
  const totalAlertas = routes.reduce((s, r) => s + r.needsClothChange + r.roofOpen, 0);

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { valor: String(routes.length), rotulo: "rotas", cor: "text-[#c4b5fd]" },
          { valor: String(totalPontos), rotulo: "pontos", cor: "text-[#93c5fd]" },
          {
            valor: String(totalAlertas),
            rotulo: "precisam atenção",
            cor: totalAlertas > 0 ? "text-[#f87171]" : "text-[#86efac]",
          },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-xl bg-white/[0.04] p-3 text-center">
            <p className={`text-lg font-bold leading-none ${c.cor}`}>{c.valor}</p>
            <p className="mt-1 text-[10px] text-[#9a958b]">{c.rotulo}</p>
          </div>
        ))}
      </div>

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
          <RouteIcon className="mx-auto mb-2 size-6 text-[#5a544c]" />
          <p className="text-sm text-[#c9c2b4]">Nenhuma rota ainda</p>
          <p className="mt-1 text-xs text-[#5a544c]">
            Crie uma rota para agrupar os pontos que são visitados juntos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {routes.map((rota) => {
            const alertas = rota.needsClothChange + rota.roofOpen;
            const aberto = aberta === rota.routeNumber;
            return (
              <div
                key={rota.routeNumber}
                className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35"
              >
                <button
                  type="button"
                  onClick={() => setAberta(aberto ? null : rota.routeNumber)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#a78bfa]/15">
                    <span className="text-xs font-bold text-[#c4b5fd]">
                      {String(rota.routeNumber).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {rota.name ?? `Rota ${String(rota.routeNumber).padStart(2, "0")}`}
                    </p>
                    <p className="text-xs text-[#9a958b]">
                      {rota.totalPoints} ponto{rota.totalPoints !== 1 ? "s" : ""}
                      {!rota.registered && " · sem cadastro"}
                    </p>
                  </div>
                  {alertas > 0 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f87171]/12 px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">
                      <AlertTriangle className="size-3" />
                      {alertas}
                    </span>
                  )}
                  <ChevronRight
                    className={`size-4 shrink-0 text-[#5a544c] transition-transform ${aberto ? "rotate-90" : ""}`}
                  />
                </button>

                {aberto && (
                  <div className="border-t border-white/[0.05]">
                    {rota.points.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-[#5a544c]">
                        Esta rota ainda não tem pontos.
                      </p>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {rota.points.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                            <MapPin className="size-3.5 shrink-0 text-[#5a544c]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">
                                {p.registrationNumber && (
                                  <span className="text-[#d1a04f]">
                                    #{String(p.registrationNumber).padStart(3, "0")}{" "}
                                  </span>
                                )}
                                {p.name}
                              </p>
                              <p className="text-xs text-[#9a958b]">
                                {p.accumulatedChips} fichas
                                {p.city ? ` · ${p.city}` : ""}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                statusColor[p.status] ?? statusColor.Pendente
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs font-medium text-[#9a958b] transition hover:border-[#a78bfa]/30 hover:text-[#c4b5fd]"
        >
          <Plus className="size-3.5" />
          Nova rota
        </button>
      )}
    </div>
  );
}

const campoClass =
  "w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-[#5a544c] focus:border-[#a78bfa]/40 focus:outline-none";

/**
 * Sem <form> aqui de proposito: esta secao pode ser renderizada dentro de outro
 * formulario, e form aninhado corrompe a submissao (o navegador dispara uma
 * navegacao GET e o estado React se perde).
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">Nova rota</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={campoClass}
          placeholder="Número (ex: 3)"
          inputMode="numeric"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <input
          className={campoClass}
          placeholder="Código (opcional)"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </div>
      <input
        className={campoClass}
        placeholder="Nome (ex: Zona Norte)"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      {erro && <p className="text-xs text-[#f87171]">{erro}</p>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-[#9a958b] transition hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-xl bg-[#a78bfa] px-4 py-2.5 text-xs font-semibold text-[#14101f] transition active:scale-[0.98] disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Criar rota"}
        </button>
      </div>
    </div>
  );
}
