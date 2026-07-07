"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  LoaderCircle,
  MapPinned,
  ReceiptText,
  Route,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCnpj, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCnpj, isValidCpf } from "@/lib/validators";
import {
  createRoutePlanAction,
  listBilliardPointHistoryAction,
  listBilliardPointsAction,
  listRoutePlansAction,
} from "@/server/actions/billiard-route-actions";
import type {
  BilliardPointHistoryEntry,
  BilliardPointItem,
} from "@/server/services/billiard-route-service";
import { BilliardPointHistoryList } from "./billiard-point-history-list";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const CLOTH_LIMIT = 1500;

const schema = z
  .object({
    clientName: z.string().min(2, "Informe o cliente."),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    phone: z.string().min(8, "Informe um telefone valido."),
    cep: z.string().optional(),
    street: z.string().optional(),
    city: z.string().min(2, "Informe a cidade."),
    neighborhood: z.string().min(2, "Informe o bairro."),
    state: z.string().min(2, "Informe o estado."),
    pointCode: z.string().optional(),
    pointName: z.string().min(2, "Informe o ponto."),
    tableModel: z.string().min(2, "Informe o modelo da mesa."),
    chipValue: z.coerce.number().min(0.01, "Informe o valor da ficha."),
    routeNumber: z.coerce.number().min(1, "Informe a rota."),
    partialRoute: z.string().optional(),
    collectionDate: z.string().min(1, "Informe a data do fechamento."),
    fortnight: z.enum(["PRIMEIRA", "SEGUNDA"]),
    quantityOfChips: z.coerce.number().min(0, "Informe as fichas."),
    accumulatedChips: z.coerce.number().min(0),
    percentage: z.coerce.number().min(0).max(100),
    discountAmount: z.coerce.number().min(0),
    discountReason: z.string().optional(),
    roofDebt: z.coerce.number().min(0),
    roofPaymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    contractType: z.enum(["NENHUM", "ALUGUEL", "VENDA"]),
    contractStatus: z.enum(["NAO_APLICA", "PENDENTE", "ATIVO", "QUITADO"]),
    structureCost: z.coerce.number().min(0),
    employeeCost: z.coerce.number().min(0),
    installationCost: z.coerce.number().min(0),
    maintenanceCost: z.coerce.number().min(0),
    otherCost: z.coerce.number().min(0),
    maintenanceDate: z.string().optional(),
    nextMaintenanceDate: z.string().optional(),
    materials: z.string().optional(),
    photo: z.any().optional(),
    contractFile: z.any().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.discountAmount === 0 || Boolean(data.discountReason?.trim()),
    {
      message: "Explique o motivo do desconto.",
      path: ["discountReason"],
    },
  )
  .refine((data) => !data.cpf?.trim() || isValidCpf(data.cpf), {
    message: "CPF invalido.",
    path: ["cpf"],
  })
  .refine((data) => !data.cnpj?.trim() || isValidCnpj(data.cnpj), {
    message: "CNPJ invalido.",
    path: ["cnpj"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
type StepKey = "rota" | "ponto" | "fotos" | "resumo";

type RoutePlanOption = {
  id: string;
  code: string;
  name: string;
  routeNumber: number;
};

type HistoryItem = {
  id: string;
  title: string;
  helper: string;
  badge: string;
  amount?: string;
};

type ReceiptState = {
  clientName: string;
  phone: string;
  pointName: string;
  tableModel: string;
  grossAmount: number;
  clientShare: number;
  companyShare: number;
  totalCosts: number;
  finalValue: number;
  quantityOfChips: number;
  accumulatedChips: number;
  collectionDate: string;
  routeNumber: number;
  fortnight: string;
  photoNames: string[];
  photoFileIds: string[];
  source: string;
};

const steps = [
  { key: "rota", label: "Rota", icon: Route },
  { key: "ponto", label: "Ponto", icon: MapPinned },
  { key: "fotos", label: "Fotos", icon: Camera },
  { key: "resumo", label: "Resumo", icon: ClipboardList },
] as const;

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getFile(value: unknown) {
  const file = Array.isArray(value) ? value[0] : (value as FileList | undefined)?.[0];

  return file instanceof File ? file : undefined;
}

function getFileName(value: unknown) {
  return getFile(value)?.name;
}

async function uploadFile(file: File, category: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

function buildPointCode(routeNumber: number, pointName: string) {
  const route = String(routeNumber || 1).padStart(2, "0");
  const slug = pointName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 16)
    .toUpperCase();

  return `R${route}-${slug || "PONTO"}`;
}

function formatFortnight(value: string) {
  return value === "PRIMEIRA" ? "1ª quinzena" : "2ª quinzena";
}

function getNextCollectionDate(lastCollectionAt: string): string {
  const last = new Date(lastCollectionAt);
  const day = last.getDate();
  const next =
    day <= 15
      ? new Date(last.getFullYear(), last.getMonth(), 28)
      : new Date(last.getFullYear(), last.getMonth() + 1, 15);
  return next.toLocaleDateString("pt-BR");
}

function getStatusColor(status: string) {
  if (status === "Trocar pano") {
    return "border-[#d1a04f]/30 bg-[#3a2b18]/68 text-[#f3dfae]";
  }

  if (status === "Coletado") {
    return "border-[#8aa17c]/28 bg-[#1d2e22]/70 text-[#dbe6d4]";
  }

  if (status === "Telhado aberto") {
    return "border-[#9d6b50]/30 bg-[#2b1e19]/70 text-[#f0c9ad]";
  }

  return "border-white/10 bg-white/[0.035] text-[#c9c2b4]";
}

export function BilliardForm({
  hideFinancials = false,
  startAtRegistration = false,
}: { hideFinancials?: boolean; startAtRegistration?: boolean } = {}) {
  const [activeStep, setActiveStep] = useState<StepKey>(startAtRegistration ? "ponto" : "rota");
  const [routePoints, setRoutePoints] = useState<BilliardPointItem[]>([]);
  const [routePlans, setRoutePlans] = useState<RoutePlanOption[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [loadedPoint, setLoadedPoint] = useState<BilliardPointItem | null>(null);
  const [pointHistory, setPointHistory] = useState<BilliardPointHistoryEntry[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [loadingPointHistory, setLoadingPointHistory] = useState(false);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function refreshRouteData() {
    setLoadingPoints(true);
    try {
      const [points, plans] = await Promise.all([
        listBilliardPointsAction(),
        listRoutePlansAction(),
      ]);
      setRoutePoints(points);
      setRoutePlans(plans);
    } catch {
      setSaveError("Nao foi possivel carregar os pontos da rota.");
    } finally {
      setLoadingPoints(false);
    }
  }

  useEffect(() => {
    refreshRouteData();
  }, []);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: "",
      cpf: "",
      cnpj: "",
      phone: "",
      cep: "",
      street: "",
      city: "",
      neighborhood: "",
      state: "SP",
      pointCode: "",
      pointName: "",
      tableModel: "",
      chipValue: 1,
      routeNumber: 3,
      partialRoute: "",
      collectionDate: getTodayInputValue(),
      fortnight: "PRIMEIRA",
      quantityOfChips: 0,
      accumulatedChips: 0,
      percentage: 25,
      discountAmount: 0,
      discountReason: "",
      roofDebt: 0,
      roofPaymentMethod: "ABERTO",
      contractType: "NENHUM",
      contractStatus: "NAO_APLICA",
      structureCost: 0,
      employeeCost: 0,
      installationCost: 0,
      maintenanceCost: 0,
      otherCost: 0,
      maintenanceDate: "",
      nextMaintenanceDate: "",
      materials: "",
      notes: "",
    },
  });

  const watched = useWatch({ control: form.control });
  const quantityOfChips = Number(watched.quantityOfChips ?? 0);
  const accumulatedChips = Number(watched.accumulatedChips ?? 0);
  const chipValue = Number(watched.chipValue ?? 0);
  const percentage = Number(watched.percentage ?? 0);
  const discountAmount = Number(watched.discountAmount ?? 0);
  const roofDebt = Number(watched.roofDebt ?? 0);
  const employeeCost = Number(watched.employeeCost ?? 0);
  const installationCost = Number(watched.installationCost ?? 0);
  const maintenanceCost = Number(watched.maintenanceCost ?? 0);
  const otherCost = Number(watched.otherCost ?? 0);
  const structureCost = Number(watched.structureCost ?? 0);
  const routeNumber = Number(watched.routeNumber ?? 0);
  const pointName = String(watched.pointName ?? "");
  const collectionDate = String(watched.collectionDate ?? "");
  const fortnight = String(watched.fortnight ?? "PRIMEIRA");

  const historyTotals = useMemo(() => {
    const collections = pointHistory.filter(
      (e): e is Extract<BilliardPointHistoryEntry, { type: "collection" }> => e.type === "collection",
    );
    return {
      count: collections.length,
      totalChips: collections.reduce((s, c) => s + c.quantityOfChips, 0),
      totalGross: collections.reduce((s, c) => s + c.grossAmount, 0),
      totalClientShare: collections.reduce((s, c) => s + c.grossAmount * (c.percentage / 100), 0),
      totalFinal: collections.reduce((s, c) => s + c.finalValue, 0),
      totalRoof: collections.reduce((s, c) => s + c.roofAmount, 0),
      openRoofEntries: collections.filter((c) => c.roofAmount > 0 && c.roofPaymentMethod === "ABERTO"),
    };
  }, [pointHistory]);

  const totals = useMemo(() => {
    const grossAmount = quantityOfChips * chipValue;
    const clientShare = grossAmount * (percentage / 100);
    const companyShare = grossAmount - clientShare;
    const totalCosts =
      employeeCost +
      installationCost +
      maintenanceCost +
      otherCost +
      structureCost +
      roofDebt +
      discountAmount;
    const finalValue = companyShare - totalCosts;
    const clothTotal = accumulatedChips + quantityOfChips;

    return {
      grossAmount,
      clientShare,
      companyShare,
      totalCosts,
      finalValue,
      clothTotal,
      clothRemaining: Math.max(CLOTH_LIMIT - clothTotal, 0),
      clothWarning: clothTotal >= CLOTH_LIMIT,
    };
  }, [
    accumulatedChips,
    chipValue,
    discountAmount,
    employeeCost,
    installationCost,
    maintenanceCost,
    otherCost,
    percentage,
    quantityOfChips,
    roofDebt,
    structureCost,
  ]);

  async function handleCepLookup() {
    const cep = String(form.getValues("cep") ?? "");
    setCepError(null);
    setCepLoading(true);
    const address = await fetchAddressByCep(cep);
    setCepLoading(false);

    if (!address) {
      setCepError("CEP nao encontrado.");
      return;
    }

    form.setValue("street", address.street, { shouldDirty: true });
    form.setValue("neighborhood", address.neighborhood, { shouldDirty: true });
    form.setValue("city", address.city, { shouldDirty: true });
    form.setValue("state", address.state, { shouldDirty: true });
  }

  const mapsLink = buildMapsLink({
    street: watched.street,
    neighborhood: watched.neighborhood,
    city: watched.city,
    state: watched.state,
  });

  const currentPointCode =
    String(watched.pointCode ?? "").trim() || buildPointCode(routeNumber, pointName);

  function loadRoutePoint(point: BilliardPointItem) {
    form.setValue("pointCode", point.code);
    form.setValue("pointName", point.name);
    form.setValue("clientName", point.clientName ?? "");
    form.setValue("phone", point.phone ?? "");
    form.setValue("cpf", point.cpf ?? "");
    form.setValue("cnpj", point.cnpj ?? "");
    form.setValue("cep", point.cep ?? "");
    form.setValue("street", point.street ?? "");
    form.setValue("neighborhood", point.neighborhood ?? "");
    form.setValue("city", point.city ?? "");
    form.setValue("state", point.state ?? "");
    form.setValue("tableModel", point.tableModel ?? "");
    form.setValue("chipValue", point.chipValue);
    form.setValue("routeNumber", point.routeNumber ?? 1);
    form.setValue("partialRoute", point.partialRoute ?? "");
    form.setValue("roofDebt", point.roofOpenDebt);
    form.setValue("accumulatedChips", point.accumulatedChips);
    setLoadedPoint(point);
    setShowPointHistory(false);
    setActiveStep("ponto");

    setLoadingPointHistory(true);
    listBilliardPointHistoryAction(point.id)
      .then(setPointHistory)
      .catch(() => setPointHistory([]))
      .finally(() => setLoadingPointHistory(false));
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const photoNames = [
      getFileName(values.photo),
      getFileName(values.contractFile),
    ].filter(Boolean) as string[];

    const filesToUpload: Array<{ file: File; category: string }> = [];
    const photoFile = getFile(values.photo);
    const contractFile = getFile(values.contractFile);
    if (photoFile) filesToUpload.push({ file: photoFile, category: "PHOTO" });
    if (contractFile) filesToUpload.push({ file: contractFile, category: "CONTRACT" });

    const uploadedIds = await Promise.all(
      filesToUpload.map(({ file, category }) => uploadFile(file, category)),
    );
    const photoFileIds = uploadedIds.filter((id): id is string => Boolean(id));

    const payload = {
      ...values,
      pointCode: values.pointCode?.trim() || buildPointCode(values.routeNumber, values.pointName),
      photoNames,
      photoFileIds,
    };

    let source = "local";

    try {
      const response = await fetch("/api/modules/bilhar-pebolim/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o fechamento.");
      }

      const result = (await response.json()) as { source?: string };
      source = result.source ?? "local";
      if (source === "database") {
        refreshRouteData();
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    const newStatus = totals.clothWarning
      ? "Trocar pano"
      : values.roofDebt > 0
        ? "Telhado aberto"
        : "Coletado";
    const pointCode = payload.pointCode;

    setRoutePoints((current) => [
      {
        id: loadedPoint?.id ?? pointCode,
        registrationNumber: loadedPoint?.registrationNumber ?? null,
        code: pointCode,
        name: values.pointName,
        clientName: values.clientName,
        phone: values.phone,
        cpf: values.cpf ?? null,
        cnpj: values.cnpj ?? null,
        cep: values.cep ?? null,
        street: values.street ?? null,
        neighborhood: values.neighborhood,
        city: values.city,
        state: values.state,
        tableModel: values.tableModel,
        chipValue: values.chipValue,
        routeNumber: values.routeNumber,
        partialRoute: values.partialRoute ?? null,
        accumulatedChips: totals.clothTotal,
        clothChangeAlertAt: loadedPoint?.clothChangeAlertAt ?? CLOTH_LIMIT,
        roofOpenDebt: values.roofDebt,
        status: newStatus,
        lastCollectionAt: values.collectionDate,
        lastResultAmount: totals.finalValue,
      },
      ...current.filter((point) => point.code !== pointCode),
    ]);

    setHistory((current) => [
      {
        id: `${pointCode}-${Date.now()}`,
        title: values.pointName,
        helper: `${formatFortnight(values.fortnight)} - ${quantityOfChips} fichas - Rota ${values.routeNumber}`,
        badge: newStatus,
        amount: formatCurrency(totals.finalValue),
      },
      ...current,
    ]);

    setReceipt({
      clientName: values.clientName,
      phone: values.phone,
      pointName: values.pointName,
      tableModel: values.tableModel,
      grossAmount: totals.grossAmount,
      clientShare: totals.clientShare,
      companyShare: totals.companyShare,
      totalCosts: totals.totalCosts,
      finalValue: totals.finalValue,
      quantityOfChips: Number(values.quantityOfChips),
      accumulatedChips: totals.clothTotal,
      collectionDate: values.collectionDate,
      routeNumber: Number(values.routeNumber),
      fortnight: values.fortnight,
      photoNames,
      photoFileIds,
      source,
    });

    setActiveStep("resumo");
    setLoading(false);
    submittingRef.current = false;
  });

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="grid min-w-0 max-w-full gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {steps.map((step) => {
              const Icon = step.icon;
              const active = activeStep === step.key;

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(step.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-[#d1a04f]/36 bg-[#d1a04f]/14 text-[#f3dfae]"
                      : "border-white/10 bg-white/[0.025] text-[#aaa396]",
                  )}
                >
                  <Icon className="size-3.5" />
                  {step.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {activeStep === "rota" ? (
              <StepPanel
                icon={<Route className="size-4" />}
                title="Rota de campo"
                helper="Abra o ponto da rota e lance somente o fechamento necessário."
              >
                {routePlans.length > 0 ? (
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {routePlans.map((plan) => (
                      <span
                        key={plan.id}
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#c9c2b4]"
                      >
                        Rota {String(plan.routeNumber).padStart(2, "0")} - {plan.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                {loadingPoints ? (
                  <p className={hintClass}>Carregando pontos da rota...</p>
                ) : routePoints.length === 0 ? (
                  <p className={hintClass}>
                    Nenhum ponto cadastrado ainda. Toque em &quot;Novo ponto&quot; para começar.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {routePoints.map((point) => (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => loadRoutePoint(point)}
                        className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-[#d1a04f]/28"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {point.registrationNumber ? (
                                <span className="text-[#d1a04f]">
                                  #{String(point.registrationNumber).padStart(3, "0")}{" "}
                                </span>
                              ) : null}
                              {point.name}
                            </p>
                            <p className="mt-1 text-xs text-[#9a958b]">
                              {point.code} - Rota {String(point.routeNumber ?? 0).padStart(2, "0")} -{" "}
                              {point.accumulatedChips} fichas
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
                              getStatusColor(point.status),
                            )}
                          >
                            {point.status}
                          </span>
                        </div>
                        {point.lastResultAmount && point.lastResultAmount > 0 && !hideFinancials ? (
                          <p className="mt-2 text-xs text-[#dbe6d4]">
                            Último resultado: {formatCurrency(point.lastResultAmount)}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}

                {newRouteOpen ? (
                  <NewRouteForm
                    onCreated={() => {
                      setNewRouteOpen(false);
                      refreshRouteData();
                    }}
                    onCancel={() => setNewRouteOpen(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewRouteOpen(true)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-[#9a958b]"
                  >
                    + Nova rota
                  </button>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoadedPoint(null);
                      setPointHistory([]);
                      setShowPointHistory(false);
                      setActiveStep("ponto");
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-4 py-3 text-sm font-semibold text-[#f3dfae]"
                  >
                    Novo ponto
                    <ArrowRight className="size-4" />
                  </button>
                  <Link
                    href="/visita-rapida"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#4ade80]/20 bg-[#4ade80]/8 px-4 py-3 text-sm font-semibold text-[#86efac]"
                  >
                    <ClipboardCheck className="size-4" />
                    Registrar visita
                  </Link>
                </div>
              </StepPanel>
            ) : null}

            {activeStep === "ponto" ? (
              <StepPanel
                icon={<MapPinned className="size-4" />}
                title="Cadastro do ponto"
                helper="Cadastro completo do cliente, mesa e endereço. Depois o funcionário só fecha fichas."
              >
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-3 py-1 text-xs font-semibold text-[#f3dfae]">
                  {loadedPoint?.registrationNumber
                    ? `Ponto #${String(loadedPoint.registrationNumber).padStart(3, "0")}`
                    : "Novo ponto - número atribuído ao salvar"}
                </span>

                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                  Cadastro de cliente
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome" error={form.formState.errors.clientName?.message}>
                    <input className={fieldClass} {...form.register("clientName")} />
                  </Field>
                  <Field label="Telefone" error={form.formState.errors.phone?.message}>
                    <input
                      className={fieldClass}
                      inputMode="tel"
                      maxLength={15}
                      {...withMask(form.register("phone"), maskPhone)}
                    />
                  </Field>
                  <Field label="CPF" error={form.formState.errors.cpf?.message}>
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      maxLength={14}
                      {...withMask(form.register("cpf"), maskCpf)}
                    />
                  </Field>
                  <Field label="CNPJ" error={form.formState.errors.cnpj?.message}>
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      maxLength={18}
                      {...withMask(form.register("cnpj"), maskCnpj)}
                    />
                  </Field>
                  <Field label="CEP" error={cepError ?? undefined}>
                    <div className="flex gap-2">
                      <input
                        className={fieldClass}
                        inputMode="numeric"
                        placeholder="00000-000"
                        maxLength={9}
                        {...withMask(form.register("cep"), maskCep)}
                        onBlur={handleCepLookup}
                      />
                      <button
                        type="button"
                        onClick={handleCepLookup}
                        disabled={cepLoading}
                        className="shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] disabled:opacity-60"
                      >
                        {cepLoading ? "..." : "Buscar"}
                      </button>
                    </div>
                  </Field>
                  <Field label="Rua" error={form.formState.errors.street?.message}>
                    <input className={fieldClass} {...form.register("street")} />
                  </Field>
                  <Field label="Bairro" error={form.formState.errors.neighborhood?.message}>
                    <input className={fieldClass} {...form.register("neighborhood")} />
                  </Field>
                  <Field label="Cidade" error={form.formState.errors.city?.message}>
                    <input className={fieldClass} {...form.register("city")} />
                  </Field>
                  <Field label="Estado" error={form.formState.errors.state?.message}>
                    <input className={fieldClass} maxLength={2} {...form.register("state")} />
                  </Field>
                </div>
                {mapsLink ? (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 hover:underline"
                  >
                    <MapPinned className="size-3.5" />
                    Ver no mapa
                  </a>
                ) : null}

                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                  Mesa e rota
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Código do ponto">
                    <input
                      className={fieldClass}
                      placeholder={currentPointCode}
                      {...form.register("pointCode")}
                    />
                  </Field>
                  <Field label="Nome do ponto" error={form.formState.errors.pointName?.message}>
                    <input className={fieldClass} {...form.register("pointName")} />
                  </Field>
                  <Field label="Modelo da mesa" error={form.formState.errors.tableModel?.message}>
                    <input className={fieldClass} {...form.register("tableModel")} />
                  </Field>
                  <Field label="Valor da ficha" error={form.formState.errors.chipValue?.message}>
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("chipValue")}
                    />
                  </Field>
                  <Field label="Rota" error={form.formState.errors.routeNumber?.message}>
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      type="number"
                      min="1"
                      {...form.register("routeNumber")}
                    />
                  </Field>
                  <Field label="Rota parcial">
                    <input
                      className={fieldClass}
                      placeholder="Ex: Rota 03 - parte B"
                      {...form.register("partialRoute")}
                    />
                  </Field>
                </div>

                {loadedPoint ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPointHistory((current) => !current)}
                      className="mt-4 inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.05]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ClipboardList className="size-4" />
                        Histórico deste ponto
                      </span>
                      <span className="text-xs text-[#9a958b]">
                        {loadingPointHistory ? "Carregando..." : showPointHistory ? "Ocultar" : "Mostrar"}
                      </span>
                    </button>

                    {showPointHistory ? (
                      <div className="mt-3">
                        <BilliardPointHistoryList entries={pointHistory} hideFinancials={hideFinancials} />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </StepPanel>
            ) : null}

            {activeStep === "fotos" ? (
              <StepPanel
                icon={<Camera className="size-4" />}
                title="Fotos e comprovantes"
                helper="Tire foto do ponto ou equipamento."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Foto">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className={fieldClass}
                      {...form.register("photo")}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Observações">
                      <textarea
                        className={textareaClass}
                        placeholder="Pendências, combinados, manutenção futura..."
                        {...form.register("notes")}
                      />
                    </Field>
                  </div>
                </div>
              </StepPanel>
            ) : null}

            {activeStep === "resumo" ? (
              <StepPanel
                icon={<ReceiptText className="size-4" />}
                title={loadedPoint ? "Ficha do cliente" : "Novo ponto"}
                helper={
                  loadedPoint
                    ? "Pendências, próxima coleta, totais e histórico completo."
                    : "Confira os dados antes de cadastrar."
                }
              >
                {/* Confirmação pós-salvar */}
                {receipt ? (
                  <div className="mb-3 rounded-2xl border border-[#8aa17c]/25 bg-[#1d2e22]/70 p-3 text-sm text-[#dbe6d4]">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="size-4" />
                      Cadastro salvo
                    </div>
                    <p className="mt-1 text-xs leading-5">
                      {receipt.pointName} —{" "}
                      {receipt.source === "database" ? "gravado no servidor" : "salvo localmente"}
                    </p>
                    {receipt.photoFileIds.length > 0 ? (
                      <p className="mt-2 flex flex-wrap gap-2 text-xs">
                        {receipt.photoFileIds.map((id, index) => (
                          <a
                            key={id}
                            href={`/api/files/${id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-white"
                          >
                            {receipt.photoNames[index] ?? `arquivo-${index + 1}`}
                          </a>
                        ))}
                      </p>
                    ) : receipt.photoNames.length > 0 ? (
                      <p className="mt-1 text-xs text-[#f0c9ad]">
                        Anexos selecionados mas o envio falhou: {receipt.photoNames.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Novo ponto: só dados do cadastro */}
                {!loadedPoint ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SummaryLine label="Ponto" value={pointName || "Não informado"} />
                    <SummaryLine label="Código" value={currentPointCode} />
                    <SummaryLine label="Rota" value={`Rota ${routeNumber || "-"}`} />
                    <SummaryLine label="Cliente" value={String(watched.clientName || "-")} />
                    <SummaryLine label="Telefone" value={String(watched.phone || "-")} />
                    <SummaryLine label="Cidade" value={String(watched.city || "-")} />
                    <SummaryLine label="Modelo da mesa" value={String(watched.tableModel || "-")} />
                  </div>
                ) : (
                  <>
                    {/* 1. Cabeçalho do ponto */}
                    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {loadedPoint.registrationNumber ? (
                              <span className="text-[#d1a04f]">
                                #{String(loadedPoint.registrationNumber).padStart(3, "0")}{" "}
                              </span>
                            ) : null}
                            {loadedPoint.name}
                          </p>
                          <p className="text-xs text-[#9a958b]">
                            {loadedPoint.code} · Rota {loadedPoint.routeNumber}
                            {loadedPoint.tableModel ? ` · ${loadedPoint.tableModel}` : ""}
                          </p>
                          {loadedPoint.clientName ? (
                            <p className="mt-1 text-xs font-medium text-[#c9c2b4]">
                              {loadedPoint.clientName}
                            </p>
                          ) : null}
                          {loadedPoint.phone ? (
                            <p className="text-xs text-[#9a958b]">{loadedPoint.phone}</p>
                          ) : null}
                          {loadedPoint.city ? (
                            <p className="text-xs text-[#9a958b]">{loadedPoint.city}</p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
                            getStatusColor(loadedPoint.status),
                          )}
                        >
                          {loadedPoint.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-[#9a958b]">
                        <span>
                          Fichas acumuladas:{" "}
                          <span
                            className={
                              loadedPoint.accumulatedChips >= CLOTH_LIMIT
                                ? "font-semibold text-[#f3dfae]"
                                : "text-[#c9c2b4]"
                            }
                          >
                            {loadedPoint.accumulatedChips}/{CLOTH_LIMIT}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* 2. Pendências */}
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                      Pendências
                    </p>

                    {loadedPoint.roofOpenDebt > 0 ? (
                      <div className="mb-2 rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#f0c9ad]">Telhado em aberto</p>
                          <p className="text-sm font-bold text-[#f0c9ad]">
                            {formatCurrency(loadedPoint.roofOpenDebt)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#9d6b50]">Cobrar na próxima visita</p>
                        {historyTotals.openRoofEntries.length > 0 ? (
                          <div className="mt-2 space-y-1 border-t border-[#9d6b50]/20 pt-2">
                            {historyTotals.openRoofEntries.map((e) => (
                              <div
                                key={e.id}
                                className="flex items-center justify-between text-xs text-[#f0c9ad]/70"
                              >
                                <span>{formatShortDate(e.date)}</span>
                                <span>{formatCurrency(e.roofAmount)} — em aberto</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {loadedPoint.accumulatedChips >= CLOTH_LIMIT ? (
                      <div className="mb-2 rounded-2xl border border-[#d1a04f]/30 bg-[#3a2b18]/68 p-3 text-sm text-[#f3dfae]">
                        <div className="flex items-center gap-2 font-semibold">
                          <TriangleAlert className="size-4" />
                          Troca de pano pendente
                        </div>
                        <p className="mt-1 text-xs">
                          {loadedPoint.accumulatedChips} fichas acumuladas (limite {CLOTH_LIMIT})
                        </p>
                      </div>
                    ) : null}

                    {loadedPoint.roofOpenDebt === 0 && loadedPoint.accumulatedChips < CLOTH_LIMIT ? (
                      <div className="mb-3 rounded-2xl border border-[#8aa17c]/25 bg-[#1d2e22]/70 p-3 text-sm text-[#dbe6d4]">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="size-4" />
                          Sem pendências
                        </div>
                        <p className="mt-1 text-xs">
                          Telhado quitado · {loadedPoint.accumulatedChips}/{CLOTH_LIMIT} fichas
                        </p>
                      </div>
                    ) : null}

                    {/* 3. Próxima coleta */}
                    {loadedPoint.lastCollectionAt ? (
                      <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#9a958b]">Última coleta</span>
                          <span className="text-[#c9c2b4]">
                            {formatShortDate(loadedPoint.lastCollectionAt)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="text-[#9a958b]">Próxima coleta esperada</span>
                          <span className="font-semibold text-[#dbe6d4]">
                            {getNextCollectionDate(loadedPoint.lastCollectionAt)}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* 4. Totais financeiros */}
                    {!hideFinancials && historyTotals.count > 0 ? (
                      <div className="mb-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                          Totais acumulados ({historyTotals.count} coletas)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <SummaryLine
                            label="Total fichas"
                            value={String(historyTotals.totalChips)}
                          />
                          <SummaryLine
                            label="Bruto total"
                            value={formatCurrency(historyTotals.totalGross)}
                          />
                          <SummaryLine
                            label="Repassado ao cliente"
                            value={formatCurrency(historyTotals.totalClientShare)}
                          />
                          <SummaryLine
                            label="Resultado empresa"
                            value={formatCurrency(historyTotals.totalFinal)}
                            highlight
                          />
                          {historyTotals.totalRoof > 0 ? (
                            <SummaryLine
                              label="Telhado cobrado (total)"
                              value={formatCurrency(historyTotals.totalRoof)}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {/* 5. Histórico completo */}
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                      Histórico completo
                    </p>
                    {loadingPointHistory ? (
                      <p className={hintClass}>Carregando histórico...</p>
                    ) : (
                      <BilliardPointHistoryList
                        entries={pointHistory}
                        hideFinancials={hideFinancials}
                      />
                    )}
                  </>
                )}
              </StepPanel>
            ) : null}

            {saveError ? (
              <div className="rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
                {saveError}
              </div>
            ) : null}

            <div className="sticky bottom-20 z-10 rounded-2xl border border-white/10 bg-[#090d0c]/92 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur md:static md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const index = steps.findIndex((step) => step.key === activeStep);
                    setActiveStep(steps[Math.max(index - 1, 0)].key);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-[#c9c2b4]"
                >
                  Voltar
                </button>
                {activeStep === "resumo" ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
                  >
                    {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    Salvar ponto
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const index = steps.findIndex((step) => step.key === activeStep);
                      setActiveStep(steps[Math.min(index + 1, steps.length - 1)].key);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855]"
                  >
                    Próximo
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl border border-white/10 bg-[#0b0f0e]/62 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a958b]">
                  Ponto selecionado
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {totals.clothTotal}/{CLOTH_LIMIT} fichas
                </h3>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  totals.clothWarning
                    ? "border-[#d1a04f]/30 bg-[#3a2b18]/68 text-[#f3dfae]"
                    : "border-[#8aa17c]/25 bg-[#1d2e22]/70 text-[#dbe6d4]",
                )}
              >
                {totals.clothWarning ? "Trocar pano" : "OK"}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0b0f0e]/62 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Histórico do ponto</h3>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-[#c9c2b4]">
                {history.length}
              </span>
            </div>

            {history.length > 0 ? (
              <div className="mt-3 space-y-2">
                {history.slice(0, 5).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#9a958b]">{item.helper}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
                          getStatusColor(item.badge),
                        )}
                      >
                        {item.badge}
                      </span>
                    </div>
                    {item.amount && !hideFinancials ? (
                      <p className="mt-2 text-xs font-semibold text-[#dbe6d4]">{item.amount}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={cn(hintClass, "mt-3")}>
                O histórico aparece aqui após salvar um fechamento.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function NewRouteForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [routeNumberInput, setRouteNumberInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function handleCreate() {
    if (submittingRef.current) return;

    const routeNumber = Number(routeNumberInput);
    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!trimmedCode || !trimmedName || !routeNumber) {
      setError("Preencha codigo, nome e numero da rota.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await createRoutePlanAction({ code: trimmedCode, name: trimmedName, routeNumber });
      onCreated();
    } catch {
      setError("Falha ao criar a rota. Verifique se o codigo ja existe.");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Codigo (ex: R05)"
          className={fieldClass}
        />
        <input
          value={routeNumberInput}
          onChange={(event) => setRouteNumberInput(event.target.value)}
          type="number"
          min="1"
          placeholder="Numero"
          className={fieldClass}
        />
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome da rota (ex: Zona Norte)"
        className={fieldClass}
      />
      {error ? <p className="text-xs text-[#f0c9ad]">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#c9c2b4]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] disabled:opacity-70"
        >
          {saving ? "Salvando..." : "Criar rota"}
        </button>
      </div>
    </div>
  );
}

function StepPanel({
  icon,
  title,
  helper,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0f0e]/45 p-3 sm:p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#d1a04f]/24 bg-[#d1a04f]/10 text-[#f3dfae]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[#9a958b]">{helper}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <span className="block text-xs text-[#f0c9ad]">{error}</span> : null}
    </label>
  );
}


function SummaryLine({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight
          ? "border-[#d1a04f]/28 bg-[#3a2b18]/60"
          : "border-white/10 bg-white/[0.025]",
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9a958b]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
