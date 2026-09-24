"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
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
import { useIdempotentSubmission } from "@/hooks/use-idempotent-submission";
import { calculateBilliardRoofBalance } from "@/lib/module-calculations";
import { postJsonWithOfflineQueue } from "@/lib/offline-submission-queue";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCnpj, maskCpf, maskPhone, withMask } from "@/lib/masks";
import {
  formatClosingReceiptId,
  type SavedModuleRecordResponse,
} from "@/lib/receipt";
import { isValidCnpj, isValidCpf } from "@/lib/validators";
import {
  PAYMENT_METHOD_LABEL,
  ROOF_CHARGE_TYPE_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
import {
  createRoutePlanAction,
  getBilliardPointAction,
  listBilliardPointHistoryAction,
  listBilliardPointsAction,
  listRoutePlansAction,
} from "@/server/actions/billiard-route-actions";
import type {
  BilliardPointHistoryEntry,
  BilliardPointItem,
} from "@/server/services/billiard-route-service";
import { BilliardPointHistoryList } from "./billiard-point-history-list";
import { PhotoCaptureInput } from "./photo-capture-input";
import { SaveStatusBanner, type SaveStatus } from "./save-status-banner";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const CLOTH_LIMIT = 1500;

const schema = z
  .object({
    clientName: z.string().min(2, "Informe o cliente."),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    phone: z.string().optional(),
    cep: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    neighborhood: z.string().optional(),
    state: z.string().optional(),
    pointCode: z.string().optional(),
    pointName: z.string().min(2, "Informe o ponto."),
    tableModel: z.string().optional(),
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
    roofChargeType: z.enum(["FIXED", "NEGOTIATED"]),
    roofInstallmentAmount: z.coerce.number().min(0),
    roofPaidAmount: z.coerce.number().min(0),
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
  .refine(
    (data) => data.roofPaidAmount === 0 || data.roofPaymentMethod !== "ABERTO",
    {
      message: "Informe como o valor do telhado foi pago.",
      path: ["roofPaymentMethod"],
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
  receiptId?: string;
  closedAt?: string;
  clientName: string;
  phone: string;
  pointName: string;
  tableModel: string;
  grossAmount: number;
  clientShare: number;
  companyShare: number;
  totalCosts: number;
  finalValue: number;
  roofChargeType: "FIXED" | "NEGOTIATED";
  roofPreviousBalance: number;
  roofInstallmentAmount: number;
  roofPaidAmount: number;
  roofBalanceAfter: number;
  roofPaymentMethod: string;
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
  initialClientId,
}: { hideFinancials?: boolean; startAtRegistration?: boolean; initialClientId?: string; initialClientName?: string; initialPhone?: string } = {}) {
  const [activeStep, setActiveStep] = useState<StepKey>(
    startAtRegistration || initialClientId ? "ponto" : "rota",
  );
  const visibleSteps = initialClientId ? steps.filter((s) => s.key !== "rota") : steps;
  const [routePoints, setRoutePoints] = useState<BilliardPointItem[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<number | null>(null);
  const [routePlans, setRoutePlans] = useState<RoutePlanOption[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [loadedPoint, setLoadedPoint] = useState<BilliardPointItem | null>(null);
  const [pointHistory, setPointHistory] = useState<BilliardPointHistoryEntry[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [loadingPointHistory, setLoadingPointHistory] = useState(false);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [showOptionalCosts, setShowOptionalCosts] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [stepError, setStepError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const savedSubmissionRef = useRef(false);
  const submission = useIdempotentSubmission();

  async function refreshRouteData() {
    setLoadingPoints(true);
    try {
      if (initialClientId) {
        // Busca direta pelo ponto pré-selecionado — mais rápido e sem carregar a lista inteira
        const point = await getBilliardPointAction(initialClientId);
        if (point) {
          loadRoutePoint(point);
        } else {
          setSaveError("Ponto não encontrado. Volte e selecione novamente.");
        }
      } else {
        const [points, plans] = await Promise.all([
          listBilliardPointsAction(),
          listRoutePlansAction(),
        ]);
        setRoutePoints(points);
        setRoutePlans(plans);
      }
    } catch (err) {
      console.error("[BilliardForm] refreshRouteData ERRO:", err);
      setSaveError(`Erro ao carregar pontos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingPoints(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshRouteData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      roofChargeType: "FIXED",
      roofInstallmentAmount: 0,
      roofPaidAmount: 0,
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
  const roofInstallmentAmount = Number(watched.roofInstallmentAmount ?? 0);
  const roofPaidAmount = Number(watched.roofPaidAmount ?? 0);
  const roofPreviousBalance = loadedPoint?.roofOpenDebt ?? 0;
  const roofBalance = calculateBilliardRoofBalance({
    previousBalance: roofPreviousBalance,
    installmentAmount: roofInstallmentAmount,
    paidAmount: roofPaidAmount,
  });
  const employeeCost = Number(watched.employeeCost ?? 0);
  const installationCost = Number(watched.installationCost ?? 0);
  const maintenanceCost = Number(watched.maintenanceCost ?? 0);
  const otherCost = Number(watched.otherCost ?? 0);
  const structureCost = Number(watched.structureCost ?? 0);
  const hasOptionalCosts = employeeCost + installationCost + maintenanceCost + otherCost > 0;
  const routeNumber = Number(watched.routeNumber ?? 0);
  const pointName = String(watched.pointName ?? "");

  const historyTotals = useMemo(() => {
    const collections = pointHistory.filter(
      (e): e is Extract<BilliardPointHistoryEntry, { type: "collection" }> => e.type === "collection",
    );
    const latestStructuredRoofEntry = collections.find((c) => c.roofBalanceAfter !== null);
    return {
      count: collections.length,
      totalChips: collections.reduce((s, c) => s + c.quantityOfChips, 0),
      totalGross: collections.reduce((s, c) => s + c.grossAmount, 0),
      totalClientShare: collections.reduce((s, c) => s + c.grossAmount * (c.percentage / 100), 0),
      totalFinal: collections.reduce((s, c) => s + c.finalValue, 0),
      totalRoof: collections.reduce((s, c) => s + c.roofAmount, 0),
      totalRoofPaid: collections.reduce((s, c) => s + (c.roofPaidAmount ?? 0), 0),
      openRoofEntries: latestStructuredRoofEntry
        ? latestStructuredRoofEntry.roofBalanceAfter! > 0
          ? [latestStructuredRoofEntry]
          : []
        : collections.filter((c) => c.roofAmount > 0 && c.roofPaymentMethod === "ABERTO"),
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
      discountAmount;
    const finalValue = companyShare + roofPaidAmount - totalCosts;
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
    roofPaidAmount,
    structureCost,
  ]);

  // As rotas saem dos proprios pontos, nao do RoutePlan: um ponto pode ter
  // numero de rota sem que a rota tenha sido cadastrada, e nesse caso ele
  // precisa continuar aparecendo no filtro.
  const rotasDisponiveis = useMemo(() => {
    const contagem = new Map<number, number>();
    for (const p of routePoints) {
      const n = p.routeNumber ?? 0;
      contagem.set(n, (contagem.get(n) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([numero, total]) => ({
        numero,
        total,
        nome: routePlans.find((pl) => pl.routeNumber === numero)?.name ?? null,
      }))
      .sort((a, b) => a.numero - b.numero);
  }, [routePoints, routePlans]);

  const pontosVisiveis = useMemo(
    () =>
      rotaSelecionada === null
        ? routePoints
        : routePoints.filter((p) => (p.routeNumber ?? 0) === rotaSelecionada),
    [routePoints, rotaSelecionada],
  );

  function validateCurrentStep(): string | null {
    if (activeStep === "rota") {
      if (!loadedPoint) return "Selecione um ponto da rota para continuar.";
    }
    if (activeStep === "ponto") {
      if (loadedPoint) {
        if (!watched.collectionDate) return "Informe a data do fechamento.";
        if (
          !hideFinancials &&
          roofPaidAmount > roofPreviousBalance + roofInstallmentAmount
        ) {
          return "O valor pago não pode ser maior que o saldo do telhado.";
        }
        if (roofPaidAmount > 0 && watched.roofPaymentMethod === "ABERTO") {
          return "Informe a forma de pagamento do telhado.";
        }
      } else {
        if (String(watched.clientName ?? "").trim().length < 2) return "Informe o nome do cliente.";
        if (String(watched.pointName ?? "").trim().length < 2) return "Informe o nome do ponto.";
        if (Number(watched.chipValue) <= 0) return "Informe o valor da ficha.";
        if (Number(watched.routeNumber) < 1) return "Informe o número da rota.";
      }
    }
    if (activeStep === "fotos") {
      if (!getFile(watched.photo)) return "Tire uma foto do ponto antes de continuar.";
    }
    return null;
  }

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
    form.setValue("roofChargeType", "FIXED");
    form.setValue("roofInstallmentAmount", point.roofFixedInstallment);
    form.setValue("roofPaidAmount", 0);
    form.setValue("roofPaymentMethod", "ABERTO");
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
    if (
      !hideFinancials &&
      values.roofPaidAmount > roofPreviousBalance + values.roofInstallmentAmount
    ) {
      form.setError("roofPaidAmount", {
        message: "O valor pago não pode ser maior que o saldo do telhado.",
      });
      setActiveStep("ponto");
      return;
    }

    // O resumo continua dentro do mesmo <form>. Depois da primeira gravacao,
    // qualquer novo submit dessa instancia e repetido e nao uma nova visita.
    // O ref fecha tambem a pequena janela entre atualizar o ponto e renderizar
    // o comprovante, que podia gerar uma segunda coleta com outra chave.
    if (submittingRef.current || savedSubmissionRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);
    setSaveStatus("saving");

    const photoNames = [
      getFileName(values.photo),
      getFileName(values.contractFile),
    ].filter(Boolean) as string[];

    const filesToUpload: Array<{ file: File; category: string }> = [];
    const photoFile = getFile(values.photo);
    const contractFile = getFile(values.contractFile);
    if (photoFile) filesToUpload.push({ file: photoFile, category: "PHOTO" });
    if (contractFile) filesToUpload.push({ file: contractFile, category: "CONTRACT" });

    const uploadedIds = navigator.onLine
      ? await Promise.all(filesToUpload.map(({ file, category }) => uploadFile(file, category)))
      : [];
    const photoFileIds = uploadedIds.filter((id): id is string => Boolean(id));

    const payload = {
      ...values,
      pointCode: values.pointCode?.trim() || buildPointCode(values.routeNumber, values.pointName),
      photoNames,
      photoFileIds,
    };

    let source = "local";
    let savedRecord: SavedModuleRecordResponse["record"];

    try {
      const result = await postJsonWithOfflineQueue<SavedModuleRecordResponse>({
        endpoint: "/api/modules/bilhar-pebolim/records",
        payload,
        requestKey: submission.key(),
        label: `Fechamento de ${values.pointName}`,
        files: navigator.onLine
          ? undefined
          : filesToUpload.map(({ file, category }, index) => ({
              file,
              category,
              payloadPath: `photoFileIds.${index}`,
            })),
      });
      submission.complete();
      if (result.queued) {
        savedSubmissionRef.current = true;
        setSaveStatus("queued");
        return;
      }
      savedSubmissionRef.current = true;
      source = result.data.source ?? "local";
      savedRecord = result.data.record;
      setSaveStatus("saved");
      if (source === "database") {
        // Aguarda a atualizacao do ponto antes de abrir o comprovante. Quando
        // esta chamada ficava solta, loadRoutePoint terminava depois e levava
        // a tela de volta para a primeira etapa do fechamento.
        await refreshRouteData();
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
      setSaveStatus("error");
      return;
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }

    const newStatus = totals.clothWarning
      ? "Trocar pano"
      : roofBalance.balanceAfter > 0
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
        phone: values.phone ?? null,
        cpf: values.cpf ?? null,
        cnpj: values.cnpj ?? null,
        cep: values.cep ?? null,
        street: values.street ?? null,
        neighborhood: values.neighborhood ?? null,
        city: values.city ?? null,
        state: values.state ?? null,
        tableModel: values.tableModel ?? null,
        chipValue: values.chipValue,
        routeNumber: values.routeNumber,
        partialRoute: values.partialRoute ?? null,
        accumulatedChips: totals.clothTotal,
        clothChangeAlertAt: loadedPoint?.clothChangeAlertAt ?? CLOTH_LIMIT,
        roofOpenDebt: roofBalance.balanceAfter,
        roofFixedInstallment:
          values.roofChargeType === "FIXED" && values.roofInstallmentAmount > 0
            ? values.roofInstallmentAmount
            : loadedPoint?.roofFixedInstallment ?? 0,
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
      receiptId: savedRecord?.id,
      closedAt: savedRecord?.createdAt,
      clientName: values.clientName,
      // Campos opcionais: sem o fallback viram `undefined` no comprovante.
      phone: values.phone ?? "",
      pointName: values.pointName,
      tableModel: values.tableModel ?? "",
      grossAmount: totals.grossAmount,
      clientShare: totals.clientShare,
      companyShare: totals.companyShare,
      totalCosts: totals.totalCosts,
      finalValue: totals.finalValue,
      roofChargeType: values.roofChargeType,
      roofPreviousBalance: roofBalance.previousBalance,
      roofInstallmentAmount: roofBalance.installmentAmount,
      roofPaidAmount: roofBalance.paidAmount,
      roofBalanceAfter: roofBalance.balanceAfter,
      roofPaymentMethod: values.roofPaymentMethod,
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
  });

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="grid min-w-0 max-w-full gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              {visibleSteps.map((step, idx) => {
                const active = activeStep === step.key;
                const activeIdx = visibleSteps.findIndex((s) => s.key === activeStep);
                const done = activeIdx > idx;

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => {
                      const activeIdx = visibleSteps.findIndex((s) => s.key === activeStep);
                      const targetIdx = visibleSteps.findIndex((s) => s.key === step.key);
                      if (targetIdx > activeIdx) {
                        const err = validateCurrentStep();
                        if (err) { setStepError(err); return; }
                      }
                      setStepError(null);
                      setActiveStep(step.key);
                    }}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 text-[10px] font-semibold transition-all active:scale-95",
                      active
                        ? "border-[#d1a04f]/45 bg-[#d1a04f]/14 text-[#f3dfae]"
                        : done
                          ? "border-[#4ade80]/25 bg-[#4ade80]/8 text-[#86efac]"
                          : "border-[rgba(245,241,232,0.09)] bg-white/[0.02] text-[#9a958b]",
                    )}
                  >
                    <span className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold leading-none",
                      active ? "bg-[#d1a04f]/30 text-[#f3dfae]" : done ? "bg-[#4ade80]/20 text-[#86efac]" : "bg-white/[0.06] text-[#9a958b]",
                    )}>
                      {done ? "✓" : idx + 1}
                    </span>
                    <span className="leading-tight">{step.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Barra de progresso */}
            <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#d1a04f] transition-all duration-500"
                style={{ width: `${((visibleSteps.findIndex((s) => s.key === activeStep) + 1) / visibleSteps.length) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {activeStep === "rota" ? (
              <StepPanel
                icon={<Route className="size-4" />}
                title="Rota de campo"
                helper="Abra o ponto da rota e lance somente o fechamento necessário."
              >
                {rotasDisponiveis.length > 0 ? (
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setRotaSelecionada(null)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                        rotaSelecionada === null
                          ? "border-[#d1a04f]/40 bg-[#d1a04f]/15 text-[#f3dfae]"
                          : "border-white/10 bg-white/[0.03] text-[#c9c2b4]",
                      )}
                    >
                      Todas ({routePoints.length})
                    </button>
                    {rotasDisponiveis.map((r) => (
                      <button
                        key={r.numero}
                        type="button"
                        onClick={() => setRotaSelecionada(r.numero)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                          rotaSelecionada === r.numero
                            ? "border-[#d1a04f]/40 bg-[#d1a04f]/15 text-[#f3dfae]"
                            : "border-white/10 bg-white/[0.03] text-[#c9c2b4]",
                        )}
                      >
                        Rota {String(r.numero).padStart(2, "0")}
                        {r.nome ? ` - ${r.nome}` : ""} ({r.total})
                      </button>
                    ))}
                  </div>
                ) : null}

                {loadingPoints ? (
                  <p className={hintClass}>Carregando pontos da rota...</p>
                ) : routePoints.length === 0 ? (
                  <p className={hintClass}>
                    Nenhum ponto cadastrado ainda. Toque em &quot;Novo ponto&quot; para começar.
                  </p>
                ) : pontosVisiveis.length === 0 ? (
                  <p className={hintClass}>Nenhum ponto nesta rota.</p>
                ) : (
                  <div className="grid gap-2">
                    {pontosVisiveis.map((point) => (
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
              loadedPoint ? (
                /* ── FECHAMENTO de ponto existente ── */
                <StepPanel
                  icon={<ClipboardCheck className="size-4" />}
                  title="Fechamento"
                  helper="Registre as fichas coletadas e os dados financeiros deste ponto."
                >
                  {/* Cabeçalho do ponto (read-only) */}
                  <div className="mb-4 rounded-xl border border-[#d1a04f]/20 bg-[#d1a04f]/6 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {loadedPoint.registrationNumber ? (
                            <span className="mr-1 text-[#d1a04f]">
                              #{String(loadedPoint.registrationNumber).padStart(3, "0")}
                            </span>
                          ) : null}
                          {loadedPoint.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#9a958b]">
                          {loadedPoint.clientName} · Rota {loadedPoint.routeNumber}
                          {loadedPoint.tableModel ? ` · ${loadedPoint.tableModel}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-[#9a958b]">
                          {formatCurrency(loadedPoint.chipValue)}/ficha · Fichas acumuladas: {loadedPoint.accumulatedChips}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium", getStatusColor(loadedPoint.status))}>
                        {loadedPoint.status}
                      </span>
                    </div>
                  </div>

                  {/* Campos de coleta */}
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Coleta</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Data do fechamento" error={form.formState.errors.collectionDate?.message}>
                      <input className={fieldClass} type="date" {...form.register("collectionDate")} />
                    </Field>
                    <Field label="Quinzena">
                      <select className={selectClass} {...form.register("fortnight")}>
                        <option value="PRIMEIRA">1ª quinzena</option>
                        <option value="SEGUNDA">2ª quinzena</option>
                      </select>
                    </Field>
                    <Field label="Fichas coletadas" error={form.formState.errors.quantityOfChips?.message}>
                      <input
                        className={fieldClass}
                        inputMode="numeric"
                        type="number"
                        min="0"
                        {...form.register("quantityOfChips")}
                      />
                    </Field>
                    <Field label="Percentual empresa (%)">
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        {...form.register("percentage")}
                      />
                    </Field>
                  </div>

                  {/* Desconto */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Desconto (R$)">
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        {...form.register("discountAmount")}
                      />
                    </Field>
                    {Number(watched.discountAmount) > 0 ? (
                      <Field label="Motivo do desconto" error={form.formState.errors.discountReason?.message}>
                        <input className={fieldClass} {...form.register("discountReason")} />
                      </Field>
                    ) : null}
                  </div>

                  {/* Custos */}
                  {!hideFinancials ? (
                    <>
                      <button
                        type="button"
                        aria-expanded={showOptionalCosts}
                        onClick={() => setShowOptionalCosts((current) => !current)}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left text-sm font-medium text-[#c9c2b4] transition active:bg-white/[0.06]"
                      >
                        <span>Custos opcionais</span>
                        <span className="inline-flex items-center gap-2 text-xs text-[#9a958b]">
                          {showOptionalCosts ? "Ocultar" : hasOptionalCosts ? "Revisar custos" : "Adicionar custos"}
                          <ChevronDown
                            className={cn("size-4 transition-transform", showOptionalCosts && "rotate-180")}
                          />
                        </span>
                      </button>
                      {showOptionalCosts ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label="Empregado (R$)">
                            <input className={fieldClass} inputMode="decimal" type="number" min="0" step="0.01" {...form.register("employeeCost")} />
                          </Field>
                          <Field label="Instalação (R$)">
                            <input className={fieldClass} inputMode="decimal" type="number" min="0" step="0.01" {...form.register("installationCost")} />
                          </Field>
                          <Field label="Manutenção (R$)">
                            <input className={fieldClass} inputMode="decimal" type="number" min="0" step="0.01" {...form.register("maintenanceCost")} />
                          </Field>
                          <Field label="Outros (R$)">
                            <input className={fieldClass} inputMode="decimal" type="number" min="0" step="0.01" {...form.register("otherCost")} />
                          </Field>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {/* Acerto do telhado: parcela e pagamento sao separados para manter saldo parcial. */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#d1a04f]/20 bg-[#11130f] shadow-[0_14px_35px_rgba(0,0,0,0.16)]">
                    <div className="flex flex-wrap items-start gap-3 border-b border-white/8 px-4 py-4">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d1a04f]/20 bg-[#d1a04f]/10 text-[#e2b35e]">
                        <ReceiptText className="size-5" />
                      </span>
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-semibold text-white">Acerto do telhado</p>
                        <p className="mt-1 text-xs leading-5 text-[#9a958b]">
                          Informe a cobrança desta visita e o valor que o cliente pagou.
                        </p>
                      </div>
                      {!hideFinancials ? (
                        <span
                          className={cn(
                            "ml-[52px] shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:ml-0",
                            roofPreviousBalance > 0
                              ? "border-[#d1a04f]/30 bg-[#d1a04f]/8 text-[#f0c979]"
                              : "border-[#86efac]/20 bg-[#86efac]/8 text-[#86efac]",
                          )}
                        >
                          {roofPreviousBalance > 0 ? "Há saldo anterior" : "Sem dívida anterior"}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3 p-3 sm:p-4">
                      <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#d1a04f]/12 text-xs font-bold text-[#e2b35e]">
                            1
                          </span>
                          <p className="text-sm font-semibold text-[#e8e2d8]">Cobrança desta visita</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Como será cobrado?">
                            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de cobrança do telhado">
                              <button
                                type="button"
                                role="radio"
                                aria-checked={watched.roofChargeType === "FIXED"}
                                onClick={() => form.setValue("roofChargeType", "FIXED", { shouldDirty: true })}
                                className={cn(
                                  "min-h-11 rounded-xl border px-3 py-2.5 text-left text-sm transition active:scale-[0.99]",
                                  watched.roofChargeType === "FIXED"
                                    ? "border-[#d1a04f]/60 bg-[#d1a04f]/10 font-semibold text-[#f5d99d]"
                                    : "border-white/10 bg-[#090d0c]/60 text-[#aaa397]",
                                )}
                              >
                                Parcela fixa da Infinity
                              </button>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={watched.roofChargeType === "NEGOTIATED"}
                                onClick={() => form.setValue("roofChargeType", "NEGOTIATED", { shouldDirty: true })}
                                className={cn(
                                  "min-h-11 rounded-xl border px-3 py-2.5 text-left text-sm transition active:scale-[0.99]",
                                  watched.roofChargeType === "NEGOTIATED"
                                    ? "border-[#d1a04f]/60 bg-[#d1a04f]/10 font-semibold text-[#f5d99d]"
                                    : "border-white/10 bg-[#090d0c]/60 text-[#aaa397]",
                                )}
                              >
                                Negociado no local
                              </button>
                            </div>
                          </Field>
                          <Field label="Valor da parcela desta visita (R$)">
                            <input
                              className={cn(fieldClass, "font-semibold")}
                              inputMode="decimal"
                              type="number"
                              min="0"
                              step="0.01"
                              {...form.register("roofInstallmentAmount")}
                            />
                            <span className="block text-[11px] leading-4 text-[#777167]">
                              Esse valor será somado ao saldo do telhado.
                            </span>
                          </Field>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#86efac]/10 text-xs font-bold text-[#86efac]">
                            2
                          </span>
                          <p className="text-sm font-semibold text-[#e8e2d8]">Pagamento recebido</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Quanto o cliente pagou agora? (R$)"
                            error={form.formState.errors.roofPaidAmount?.message}
                          >
                            <input
                              className={cn(fieldClass, "font-semibold")}
                              inputMode="decimal"
                              type="number"
                              min="0"
                              step="0.01"
                              {...form.register("roofPaidAmount")}
                            />
                          </Field>
                          {roofPaidAmount > 0 ? (
                            <Field
                              label="Como o cliente pagou?"
                              error={form.formState.errors.roofPaymentMethod?.message}
                            >
                              <select className={selectClass} {...form.register("roofPaymentMethod")}>
                                <option value="ABERTO" disabled>Selecione a forma de pagamento</option>
                                <option value="PIX">PIX</option>
                                <option value="DINHEIRO">Dinheiro</option>
                                <option value="CARTAO">Cartão</option>
                              </select>
                            </Field>
                          ) : (
                            <div className="flex min-h-20 items-center rounded-xl border border-dashed border-white/10 bg-[#090d0c]/45 px-3 py-3 text-xs leading-5 text-[#777167]">
                              Nenhum pagamento informado nesta visita.
                            </div>
                          )}
                        </div>
                      </section>

                      {!hideFinancials ? (
                        <section
                          className={cn(
                            "rounded-2xl border p-3.5",
                            roofBalance.balanceAfter > 0
                              ? "border-[#d1a04f]/25 bg-[#d1a04f]/7"
                              : "border-[#86efac]/20 bg-[#86efac]/6",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
                                  roofBalance.balanceAfter > 0
                                    ? "bg-[#d1a04f]/12 text-[#e2b35e]"
                                    : "bg-[#86efac]/10 text-[#86efac]",
                                )}
                              >
                                3
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-[#e8e2d8]">Resultado do acerto</p>
                                <p className="mt-0.5 text-[11px] text-[#8e887e]">
                                  {roofBalance.balanceAfter > 0 ? "Saldo que continuará pendente" : "Telhado quitado"}
                                </p>
                              </div>
                            </div>
                            <p
                              className={cn(
                                "text-lg font-bold tabular-nums",
                                roofBalance.balanceAfter > 0 ? "text-[#f0c979]" : "text-[#86efac]",
                              )}
                            >
                              {formatCurrency(roofBalance.balanceAfter)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 border-t border-white/8 pt-3 text-center">
                            <RoofEquationValue label="Anterior" value={roofBalance.previousBalance} />
                            <span className="text-[#777167]">+</span>
                            <RoofEquationValue label="Parcela" value={roofBalance.installmentAmount} />
                            <span className="text-[#777167]">−</span>
                            <RoofEquationValue label="Recebido" value={roofBalance.paidAmount} positive />
                          </div>
                        </section>
                      ) : null}
                    </div>
                  </div>

                  {/* Histórico */}
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
                </StepPanel>
              ) : initialClientId ? (
                /* Ponto pré-selecionado ainda carregando */
                <StepPanel icon={<LoaderCircle className="size-4 animate-spin" />} title="Carregando ponto..." helper="">
                  <p className={hintClass}>Buscando dados do ponto selecionado...</p>
                </StepPanel>
              ) : (
                /* ── CADASTRO de novo ponto ── */
                <StepPanel
                  icon={<MapPinned className="size-4" />}
                  title="Cadastro do ponto"
                  helper="Cadastro completo do cliente, mesa e endereço. Depois o funcionário só fecha fichas."
                >
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-3 py-1 text-xs font-semibold text-[#f3dfae]">
                    Novo ponto - número atribuído ao salvar
                  </span>

                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                    Cadastro de cliente
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome" error={form.formState.errors.clientName?.message}>
                      <input className={fieldClass} {...form.register("clientName")} />
                    </Field>
                    <Field label="Telefone" error={form.formState.errors.phone?.message}>
                      <input className={fieldClass} inputMode="tel" maxLength={15} {...withMask(form.register("phone"), maskPhone)} />
                    </Field>
                    <Field label="CPF" error={form.formState.errors.cpf?.message}>
                      <input className={fieldClass} inputMode="numeric" maxLength={14} {...withMask(form.register("cpf"), maskCpf)} />
                    </Field>
                    <Field label="CNPJ" error={form.formState.errors.cnpj?.message}>
                      <input className={fieldClass} inputMode="numeric" maxLength={18} {...withMask(form.register("cnpj"), maskCnpj)} />
                    </Field>
                    <Field label="CEP" error={cepError ?? undefined}>
                      <div className="flex gap-2">
                        <input className={fieldClass} inputMode="numeric" placeholder="00000-000" maxLength={9} {...withMask(form.register("cep"), maskCep)} onBlur={handleCepLookup} />
                        <button type="button" onClick={handleCepLookup} disabled={cepLoading} className="shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] disabled:opacity-60">
                          {cepLoading ? "..." : "Buscar"}
                        </button>
                      </div>
                    </Field>
                    <Field label="Rua"><input className={fieldClass} {...form.register("street")} /></Field>
                    <Field label="Bairro" error={form.formState.errors.neighborhood?.message}>
                      <input className={fieldClass} {...form.register("neighborhood")} />
                    </Field>
                    <Field label="Cidade" error={form.formState.errors.city?.message}>
                      <input className={fieldClass} {...form.register("city")} />
                    </Field>
                    <Field label="Estado"><input className={fieldClass} maxLength={2} {...form.register("state")} /></Field>
                  </div>
                  {mapsLink ? (
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 hover:underline">
                      <MapPinned className="size-3.5" />Ver no mapa
                    </a>
                  ) : null}

                  <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Mesa e rota</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Código do ponto">
                      <input className={fieldClass} placeholder={currentPointCode} {...form.register("pointCode")} />
                    </Field>
                    <Field label="Nome do ponto" error={form.formState.errors.pointName?.message}>
                      <input className={fieldClass} {...form.register("pointName")} />
                    </Field>
                    <Field label="Modelo da mesa" error={form.formState.errors.tableModel?.message}>
                      <input className={fieldClass} {...form.register("tableModel")} />
                    </Field>
                    <Field label="Valor da ficha" error={form.formState.errors.chipValue?.message}>
                      <input className={fieldClass} inputMode="decimal" type="number" step="0.01" min="0" {...form.register("chipValue")} />
                    </Field>
                    <Field label="Rota" error={form.formState.errors.routeNumber?.message}>
                      <input className={fieldClass} inputMode="numeric" type="number" min="1" {...form.register("routeNumber")} />
                    </Field>
                    <Field label="Rota parcial">
                      <input className={fieldClass} placeholder="Ex: Rota 03 - parte B" {...form.register("partialRoute")} />
                    </Field>
                  </div>
                </StepPanel>
              )
            ) : null}

            {activeStep === "fotos" ? (
              <StepPanel
                icon={<Camera className="size-4" />}
                title="Fotos e comprovantes"
                helper="Tire foto do ponto ou equipamento."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <PhotoCaptureInput
                      registration={form.register("photo")}
                      label="Foto do ponto"
                      hint="Tire foto da mesa, equipamento ou local"
                    />
                  </div>
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
                  <div className="mb-3 space-y-3">
                    <div className="rounded-2xl border border-[#8aa17c]/25 bg-[#1d2e22]/70 p-3 text-sm text-[#dbe6d4]">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="size-4" />
                        {receipt.source === "database"
                          ? "Cadastro salvo"
                          : "Salvo só neste aparelho — ainda não foi pro servidor"}
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
                    <WhatsAppReceiptButton
                      autoOpen={!saveError && !!receipt.phone}
                      defaultPhone={receipt.phone}
                      closedAt={receipt.closedAt}
                      title="Via do cliente — WhatsApp e PDF"
                      documentLabel="Via do cliente"
                      pdfButtonLabel="Gerar via do cliente em PDF"
                      message={[
                        "*Fechamento Bilhar / Pebolim*",
                        ...(receipt.receiptId
                          ? [`Comprovante: ${formatClosingReceiptId(receipt.receiptId, receipt.collectionDate)}`]
                          : []),
                        `Cliente: ${receipt.clientName}`,
                        `Ponto: ${receipt.pointName}`,
                        `Data: ${formatShortDate(receipt.collectionDate)}`,
                        `Fichas: ${receipt.quantityOfChips}`,
                        ...(receipt.roofInstallmentAmount > 0 || receipt.roofPaidAmount > 0
                          ? [
                              `Telhado: ${rotuloDeStatus(receipt.roofChargeType, ROOF_CHARGE_TYPE_LABEL)}`,
                              `Parcela cobrada: ${formatCurrency(receipt.roofInstallmentAmount)}`,
                              `Pago agora: ${formatCurrency(receipt.roofPaidAmount)}`,
                              `Pagamento: ${
                                receipt.roofPaidAmount > 0
                                  ? rotuloDeStatus(receipt.roofPaymentMethod, PAYMENT_METHOD_LABEL)
                                  : "Não houve pagamento"
                              }`,
                              ...(!hideFinancials
                                ? [
                                    `Saldo anterior do telhado: ${formatCurrency(receipt.roofPreviousBalance)}`,
                                    `Saldo restante do telhado: ${formatCurrency(receipt.roofBalanceAfter)}`,
                                  ]
                                : []),
                            ]
                          : []),
                        ...(!hideFinancials
                          ? [
                              `*Repasse ao cliente: ${formatCurrency(receipt.clientShare)}*`,
                              `*Resultado Infinity: ${formatCurrency(receipt.finalValue)}*`,
                            ]
                          : []),
                        `Situação: ${saveError ? "Não salvo — confira a conexão" : "Fechamento concluído"}`,
                      ].join("\n")}
                    />
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
                                <span>
                                  {formatCurrency(
                                    e.roofBalanceAfter ?? e.roofAmount,
                                  )} — em aberto
                                </span>
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
                          {historyTotals.totalRoofPaid > 0 ? (
                            <SummaryLine
                              label="Telhado recebido (total)"
                              value={formatCurrency(historyTotals.totalRoofPaid)}
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

            <SaveStatusBanner status={saveStatus} />

            <div className="sticky bottom-20 z-10 rounded-2xl border border-white/10 bg-[#090d0c]/92 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur md:static md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
              {stepError ? (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 px-3 py-2 text-xs font-medium text-[#f0c9ad]">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  {stepError}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStepError(null);
                    const index = visibleSteps.findIndex((step) => step.key === activeStep);
                    setActiveStep(visibleSteps[Math.max(index - 1, 0)].key);
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
                      const err = validateCurrentStep();
                      if (err) { setStepError(err); return; }
                      setStepError(null);
                      const index = visibleSteps.findIndex((step) => step.key === activeStep);
                      setActiveStep(visibleSteps[Math.min(index + 1, visibleSteps.length - 1)].key);
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

function RoofEquationValue({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-[#777167]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-[11px] font-semibold tabular-nums sm:text-xs",
          positive && value > 0 ? "text-[#86efac]" : "text-[#c9c2b4]",
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
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
