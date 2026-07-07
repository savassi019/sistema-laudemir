"use client";

import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { saveVisitAction } from "@/server/actions/visit-actions";
import { listBilliardPointsAction } from "@/server/actions/billiard-route-actions";
import type { BilliardPointItem } from "@/server/services/billiard-route-service";
import { WhatsAppReceiptButton } from "@/components/modules/whatsapp-receipt-button";
import { formatCurrency } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "@/components/modules/styles";
import type { ClientListItem } from "@/types/app";

const VISIT_TYPES = [
  { value: "BILLIARD", label: "Bilhar / Pebolim" },
  { value: "PLUSH", label: "Pelúcia / Grua" },
  { value: "BX", label: "BX" },
  { value: "SLOT_H", label: "H (Caça-níquel)" },
  { value: "CARRETA_KIDS", label: "Carreta Kids" },
  { value: "RENTAL", label: "Locação" },
  { value: "GENERAL", label: "Geral" },
];

const MODULE_TO_VISIT_TYPE: Record<string, string> = {
  BILLIARD: "BILLIARD",
  PLUSH: "PLUSH",
  BX: "BX",
  SLOT_H: "SLOT_H",
  CARRETA_KIDS: "CARRETA_KIDS",
  RENTAL: "RENTAL",
};

const CARRETA_PRICE_TABLE: Record<string, number> = { "15": 20, "30": 30, "60": 40 };

function inferVisitType(client: ClientListItem): string {
  for (const mod of client.modules ?? []) {
    const vt = MODULE_TO_VISIT_TYPE[mod];
    if (vt) return vt;
  }
  return "GENERAL";
}

type VisitReceipt = {
  clientName: string;
  clientPhone: string;
  visitType: string;
  occurredAt: string;
  checkedItems: string[];
  incomeAmount: number;
  expenseAmount: number;
  photo1Name?: string;
  photo2Name?: string;
  notes?: string;
  billiard?: {
    quantityOfChips: number;
    chipValue: number;
    percentage: number;
    discountAmount: number;
    grossAmount: number;
    clientShare: number;
  };
  plush?: {
    grossAmount: number;
    commissionPercentage: number;
    discountAmount: number;
    ownerExpenseAmount: number;
    clientAmount: number;
    companyAmount: number;
  };
  slotH?: {
    incomeDifference: number;
    expenseDifference: number;
    percentageSplit: number;
    netRevenue: number;
    clientShare: number;
    houseAmount: number;
    discountAmount: number;
  };
  bx?: {
    incomeAmount: number;
    expenseAmount: number;
    discountAmount: number;
  };
  carretaKids?: {
    minutesCharged: string;
    baseValue: number;
    expenseAmount: number;
    discountAmount: number;
  };
  rental?: {
    totalAmount: number;
    signalEnabled: boolean;
    signalPercentage: number;
    signalAmount: number;
    expenseAmount: number;
    discountAmount: number;
  };
};

export function QuickVisitForm({
  clients,
  initialClientId,
  initialVisitType,
  useModuleTarget = false,
}: {
  clients: ClientListItem[];
  initialClientId?: string;
  initialVisitType?: string;
  useModuleTarget?: boolean;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientListItem | null>(null);
  const [showList, setShowList] = useState(false);
  const [visitType, setVisitType] = useState(initialVisitType ?? "GENERAL");
  const [photo1Label, setPhoto1Label] = useState<string | null>(null);
  const [photo2Label, setPhoto2Label] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialized = useRef(false);
  const submittingRef = useRef(false);

  const isBilliardModule = useModuleTarget && initialVisitType === "BILLIARD";
  const isPlushModule = useModuleTarget && initialVisitType === "PLUSH";
  const isSlotModule = useModuleTarget && initialVisitType === "SLOT_H";
  const isBxModule = useModuleTarget && initialVisitType === "BX";
  const isCarretaModule = useModuleTarget && initialVisitType === "CARRETA_KIDS";
  const isRentalModule = useModuleTarget && initialVisitType === "RENTAL";

  // Bilhar
  const [accumulatedChips, setAccumulatedChips] = useState(0);
  const [quantityOfChips, setQuantityOfChips] = useState(0);
  const [chipValue, setChipValue] = useState(1);
  const [percentage, setPercentage] = useState(25);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [billiardPoints, setBilliardPoints] = useState<BilliardPointItem[]>([]);

  useEffect(() => {
    if (!isBilliardModule) return;
    listBilliardPointsAction()
      .then(setBilliardPoints)
      .catch(() => setBilliardPoints([]));
  }, [isBilliardModule]);

  const selectedBilliardPoint = useMemo(
    () => billiardPoints.find((p) => p.id === selectedClient?.id) ?? null,
    [billiardPoints, selectedClient],
  );

  useEffect(() => {
    if (!selectedBilliardPoint) return;
    setAccumulatedChips(selectedBilliardPoint.accumulatedChips);
    setChipValue(selectedBilliardPoint.chipValue);
  }, [selectedBilliardPoint]);

  // Pelúcia
  const [plushGrossAmount, setPlushGrossAmount] = useState(0);
  const [plushCommissionPercentage, setPlushCommissionPercentage] = useState(25);
  const [plushDiscountAmount, setPlushDiscountAmount] = useState(0);
  const [plushOwnerExpenseAmount, setPlushOwnerExpenseAmount] = useState(0);

  // H / Caça-níquel
  const [slotCurrentIncome, setSlotCurrentIncome] = useState(0);
  const [slotPreviousIncome, setSlotPreviousIncome] = useState(0);
  const [slotCurrentExpense, setSlotCurrentExpense] = useState(0);
  const [slotPreviousExpense, setSlotPreviousExpense] = useState(0);
  const [slotPercentageSplit, setSlotPercentageSplit] = useState(50);
  const [slotDiscountAmount, setSlotDiscountAmount] = useState(0);

  // BX
  const [bxIncomeAmount, setBxIncomeAmount] = useState(0);
  const [bxExpenseAmount, setBxExpenseAmount] = useState(0);
  const [bxDiscountAmount, setBxDiscountAmount] = useState(0);

  // Carreta Kids
  const [carretaMinutesCharged, setCarretaMinutesCharged] = useState<"15" | "30" | "60">("15");
  const [carretaExpenseAmount, setCarretaExpenseAmount] = useState(0);
  const [carretaDiscountAmount, setCarretaDiscountAmount] = useState(0);

  // Locação
  const [rentalTotalAmount, setRentalTotalAmount] = useState(0);
  const [rentalSignalEnabled, setRentalSignalEnabled] = useState(true);
  const [rentalSignalPercentage, setRentalSignalPercentage] = useState(30);
  const [rentalExpenseAmount, setRentalExpenseAmount] = useState(0);
  const [rentalDiscountAmount, setRentalDiscountAmount] = useState(0);

  const billiardTotals = useMemo(() => {
    const grossAmount = quantityOfChips * chipValue;
    const clientShare = grossAmount * (percentage / 100);
    const companyShare = grossAmount - clientShare;
    const resultAmount = companyShare - discountAmount;
    return { grossAmount, clientShare, companyShare, resultAmount };
  }, [quantityOfChips, chipValue, percentage, discountAmount]);

  const plushTotals = useMemo(() => {
    const clientAmount = plushGrossAmount * (plushCommissionPercentage / 100);
    const companyAmount = plushGrossAmount - clientAmount;
    const netAmount = companyAmount - plushDiscountAmount - plushOwnerExpenseAmount;
    return { clientAmount, companyAmount, netAmount };
  }, [plushGrossAmount, plushCommissionPercentage, plushDiscountAmount, plushOwnerExpenseAmount]);

  const slotTotals = useMemo(() => {
    const incomeDifference = slotCurrentIncome - slotPreviousIncome;
    const expenseDifference = slotCurrentExpense - slotPreviousExpense;
    const netRevenue = incomeDifference - expenseDifference;
    const clientShare = netRevenue * (slotPercentageSplit / 100);
    const houseAmount = netRevenue - clientShare - slotDiscountAmount;
    return { incomeDifference, expenseDifference, netRevenue, clientShare, houseAmount };
  }, [slotCurrentIncome, slotPreviousIncome, slotCurrentExpense, slotPreviousExpense, slotPercentageSplit, slotDiscountAmount]);

  const bxTotals = useMemo(() => {
    const netAmount = bxIncomeAmount - bxExpenseAmount - bxDiscountAmount;
    return { netAmount };
  }, [bxIncomeAmount, bxExpenseAmount, bxDiscountAmount]);

  const carretaTotals = useMemo(() => {
    const baseValue = CARRETA_PRICE_TABLE[carretaMinutesCharged] ?? 0;
    const totalValue = baseValue - carretaExpenseAmount - carretaDiscountAmount;
    return { baseValue, totalValue };
  }, [carretaMinutesCharged, carretaExpenseAmount, carretaDiscountAmount]);

  const rentalTotals = useMemo(() => {
    const signalAmount = rentalSignalEnabled ? rentalTotalAmount * (rentalSignalPercentage / 100) : 0;
    const balanceAmount = rentalTotalAmount - signalAmount - rentalExpenseAmount - rentalDiscountAmount;
    return { signalAmount, balanceAmount };
  }, [rentalTotalAmount, rentalSignalEnabled, rentalSignalPercentage, rentalExpenseAmount, rentalDiscountAmount]);

  useEffect(() => {
    if (initialized.current || !initialClientId) return;
    initialized.current = true;
    const client = clients.find((c) => c.id === initialClientId);
    if (client) {
      setSelectedClient(client);
      setClientSearch(client.name);
      if (!useModuleTarget) {
        setVisitType(inferVisitType(client));
      }
    }
  }, [clients, initialClientId, useModuleTarget]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q || !showList) return [];
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)),
      )
      .slice(0, 7);
  }, [clients, clientSearch, showList]);

  function pickClient(client: ClientListItem) {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowList(false);
    if (!useModuleTarget) {
      setVisitType(inferVisitType(client));
    }
  }

  function clearClient() {
    setSelectedClient(null);
    setClientSearch("");
  }

  function handleVisitTypeChange(newType: string) {
    setVisitType(newType);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;

    const fd = new FormData(event.currentTarget);
    const photo1 = fd.get("photo1") as File | null;
    const photo2 = fd.get("photo2") as File | null;
    const visitLabel =
      VISIT_TYPES.find((t) => t.value === visitType)?.label ?? "Geral";

    let incomeAmount = Number(fd.get("incomeAmount") ?? 0);
    let expenseAmount = Number(fd.get("expenseAmount") ?? 0);

    if (isBilliardModule) {
      incomeAmount = billiardTotals.companyShare;
      expenseAmount = discountAmount;
    } else if (isPlushModule) {
      incomeAmount = plushTotals.companyAmount;
      expenseAmount = plushDiscountAmount + plushOwnerExpenseAmount;
    } else if (isSlotModule) {
      incomeAmount = slotTotals.houseAmount;
      expenseAmount = slotDiscountAmount;
    } else if (isBxModule) {
      incomeAmount = bxIncomeAmount;
      expenseAmount = bxExpenseAmount + bxDiscountAmount;
    } else if (isCarretaModule) {
      incomeAmount = carretaTotals.baseValue;
      expenseAmount = carretaExpenseAmount + carretaDiscountAmount;
    } else if (isRentalModule) {
      incomeAmount = rentalTotalAmount - rentalTotals.signalAmount;
      expenseAmount = rentalExpenseAmount + rentalDiscountAmount;
    }

    const receiptData: VisitReceipt = {
      clientName: selectedClient?.name || clientSearch,
      clientPhone: selectedClient?.phone || "",
      visitType: visitLabel,
      occurredAt: String(fd.get("occurredAt") ?? ""),
      checkedItems: [],
      incomeAmount,
      expenseAmount,
      photo1Name: photo1 && photo1.size > 0 ? photo1.name : undefined,
      photo2Name: photo2 && photo2.size > 0 ? photo2.name : undefined,
      notes: String(fd.get("notes") ?? "").trim() || undefined,
      billiard: isBilliardModule
        ? {
            quantityOfChips,
            chipValue,
            percentage,
            discountAmount,
            grossAmount: billiardTotals.grossAmount,
            clientShare: billiardTotals.clientShare,
          }
        : undefined,
      plush: isPlushModule
        ? {
            grossAmount: plushGrossAmount,
            commissionPercentage: plushCommissionPercentage,
            discountAmount: plushDiscountAmount,
            ownerExpenseAmount: plushOwnerExpenseAmount,
            clientAmount: plushTotals.clientAmount,
            companyAmount: plushTotals.companyAmount,
          }
        : undefined,
      slotH: isSlotModule
        ? {
            incomeDifference: slotTotals.incomeDifference,
            expenseDifference: slotTotals.expenseDifference,
            percentageSplit: slotPercentageSplit,
            netRevenue: slotTotals.netRevenue,
            clientShare: slotTotals.clientShare,
            houseAmount: slotTotals.houseAmount,
            discountAmount: slotDiscountAmount,
          }
        : undefined,
      bx: isBxModule
        ? {
            incomeAmount: bxIncomeAmount,
            expenseAmount: bxExpenseAmount,
            discountAmount: bxDiscountAmount,
          }
        : undefined,
      carretaKids: isCarretaModule
        ? {
            minutesCharged: carretaMinutesCharged,
            baseValue: carretaTotals.baseValue,
            expenseAmount: carretaExpenseAmount,
            discountAmount: carretaDiscountAmount,
          }
        : undefined,
      rental: isRentalModule
        ? {
            totalAmount: rentalTotalAmount,
            signalEnabled: rentalSignalEnabled,
            signalPercentage: rentalSignalPercentage,
            signalAmount: rentalTotals.signalAmount,
            expenseAmount: rentalExpenseAmount,
            discountAmount: rentalDiscountAmount,
          }
        : undefined,
    };

    setReceipt(receiptData);

    startTransition(async () => {
      try {
        if (isBilliardModule && selectedBilliardPoint) {
          const photoFile = photo1 && photo1.size > 0 ? photo1 : null;
          let photoFileId: string | null = null;
          if (photoFile) {
            const uploadForm = new FormData();
            uploadForm.append("file", photoFile);
            uploadForm.append("category", "PHOTO");
            const uploadResponse = await fetch("/api/upload", { method: "POST", body: uploadForm });
            if (uploadResponse.ok) {
              const uploaded = (await uploadResponse.json()) as { id: string };
              photoFileId = uploaded.id;
            }
          }

          const point = selectedBilliardPoint;
          await fetch("/api/modules/bilhar-pebolim/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pointCode: point.code,
              pointName: point.name,
              clientName: point.clientName ?? "",
              phone: point.phone ?? "",
              cpf: point.cpf ?? "",
              cnpj: point.cnpj ?? "",
              cep: point.cep ?? "",
              street: point.street ?? "",
              neighborhood: point.neighborhood ?? "",
              city: point.city ?? "",
              state: point.state ?? "",
              tableModel: point.tableModel ?? "",
              chipValue,
              routeNumber: point.routeNumber ?? 1,
              partialRoute: point.partialRoute ?? "",
              collectionDate: receiptData.occurredAt.slice(0, 10) || new Date().toISOString().slice(0, 10),
              fortnight: "PRIMEIRA",
              quantityOfChips,
              accumulatedChips,
              percentage,
              discountAmount,
              discountReason,
              roofDebt: point.roofOpenDebt,
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
              notes: receiptData.notes ?? "",
              photoNames: photoFile ? [photoFile.name] : [],
              photoFileIds: photoFileId ? [photoFileId] : [],
            }),
          });
        }

        await saveVisitAction({
          clientId: useModuleTarget ? undefined : selectedClient?.id,
          targetId: useModuleTarget ? selectedClient?.id : undefined,
          clientName: receiptData.clientName,
          clientPhone: receiptData.clientPhone,
          visitType: receiptData.visitType,
          occurredAt: receiptData.occurredAt,
          checkedItems: receiptData.checkedItems,
          incomeAmount: receiptData.incomeAmount,
          expenseAmount: receiptData.expenseAmount,
          notes: receiptData.notes,
        });
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function buildMessage(r: VisitReceipt) {
    const header = [
      `*Visita de campo — ${r.visitType}*`,
      `📅 ${r.occurredAt}`,
      `👤 Cliente: ${r.clientName}`,
      ``,
    ];
    const footer = [
      ...(r.photo1Name || r.photo2Name
        ? [``, `📷 Fotos: ${[r.photo1Name, r.photo2Name].filter(Boolean).join(", ")}`]
        : []),
      ...(r.notes ? [``, `📝 ${r.notes}`] : []),
    ];

    if (r.billiard) {
      return [
        ...header,
        `🎟️ Fichas: ${r.billiard.quantityOfChips}`,
        `*Bruto: ${formatCurrency(r.billiard.grossAmount)}*`,
        `Repasse cliente: ${formatCurrency(r.billiard.clientShare)}`,
        ...(r.billiard.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.billiard.discountAmount)}`]
          : []),
        `Resultado: ${formatCurrency(r.incomeAmount - r.expenseAmount)}`,
        ...footer,
      ].join("\n");
    }

    if (r.plush) {
      return [
        ...header,
        `*Bruto: ${formatCurrency(r.plush.grossAmount)}*`,
        `Repasse cliente: ${formatCurrency(r.plush.clientAmount)}`,
        ...(r.plush.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.plush.discountAmount)}`]
          : []),
        ...(r.plush.ownerExpenseAmount > 0
          ? [`Despesa: ${formatCurrency(r.plush.ownerExpenseAmount)}`]
          : []),
        `Resultado: ${formatCurrency(r.incomeAmount - r.expenseAmount)}`,
        ...footer,
      ].join("\n");
    }

    if (r.slotH) {
      return [
        ...header,
        `Entrada: ${formatCurrency(r.slotH.incomeDifference)}`,
        `Saída: ${formatCurrency(r.slotH.expenseDifference)}`,
        `*Líquido: ${formatCurrency(r.slotH.netRevenue)}*`,
        `Repasse cliente: ${formatCurrency(r.slotH.clientShare)}`,
        ...(r.slotH.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.slotH.discountAmount)}`]
          : []),
        `Resultado casa: ${formatCurrency(r.slotH.houseAmount)}`,
        ...footer,
      ].join("\n");
    }

    if (r.bx) {
      return [
        ...header,
        `💰 Entrada: ${formatCurrency(r.bx.incomeAmount)}`,
        `💸 Saída: ${formatCurrency(r.bx.expenseAmount)}`,
        ...(r.bx.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.bx.discountAmount)}`]
          : []),
        `Resultado: ${formatCurrency(r.incomeAmount - r.expenseAmount)}`,
        ...footer,
      ].join("\n");
    }

    if (r.carretaKids) {
      return [
        ...header,
        `⏱️ Tempo cobrado: ${r.carretaKids.minutesCharged} min`,
        `*Valor: ${formatCurrency(r.carretaKids.baseValue)}*`,
        ...(r.carretaKids.expenseAmount > 0
          ? [`Despesa: ${formatCurrency(r.carretaKids.expenseAmount)}`]
          : []),
        ...(r.carretaKids.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.carretaKids.discountAmount)}`]
          : []),
        `Resultado: ${formatCurrency(r.incomeAmount - r.expenseAmount)}`,
        ...footer,
      ].join("\n");
    }

    if (r.rental) {
      return [
        ...header,
        `*Total: ${formatCurrency(r.rental.totalAmount)}*`,
        ...(r.rental.signalEnabled
          ? [`Sinal (${r.rental.signalPercentage}%): ${formatCurrency(r.rental.signalAmount)}`]
          : []),
        ...(r.rental.expenseAmount > 0
          ? [`Despesa: ${formatCurrency(r.rental.expenseAmount)}`]
          : []),
        ...(r.rental.discountAmount > 0
          ? [`Desconto: ${formatCurrency(r.rental.discountAmount)}`]
          : []),
        `Resultado: ${formatCurrency(r.incomeAmount - r.expenseAmount)}`,
        ...footer,
      ].join("\n");
    }

    return [
      ...header,
      `💰 Entrada: ${formatCurrency(r.incomeAmount)}`,
      `💸 Saída: ${formatCurrency(r.expenseAmount)}`,
      ...footer,
    ].join("\n");
  }

  function buildPdfHtml(r: VisitReceipt): string {
    const fmt = formatCurrency;
    let rows = `
      <div class="row"><span class="lbl">Data</span><span>${r.occurredAt}</span></div>
      <div class="row"><span class="lbl">Cliente</span><span>${r.clientName}</span></div>
      <div class="row"><span class="lbl">Tipo</span><span>${r.visitType}</span></div>`;

    if (r.billiard) {
      rows += `
      <div class="row"><span class="lbl">Fichas</span><span>${r.billiard.quantityOfChips}</span></div>
      <div class="row"><span class="lbl">Bruto</span><span>${fmt(r.billiard.grossAmount)}</span></div>
      <div class="row"><span class="lbl">Repasse cliente</span><span>${fmt(r.billiard.clientShare)}</span></div>
      ${r.billiard.discountAmount > 0 ? `<div class="row"><span class="lbl">Desconto</span><span>${fmt(r.billiard.discountAmount)}</span></div>` : ""}
      <div class="row res"><span class="lbl">Resultado</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    } else if (r.plush) {
      rows += `
      <div class="row"><span class="lbl">Bruto</span><span>${fmt(r.plush.grossAmount)}</span></div>
      <div class="row"><span class="lbl">Repasse cliente</span><span>${fmt(r.plush.clientAmount)}</span></div>
      ${r.plush.discountAmount > 0 ? `<div class="row"><span class="lbl">Desconto</span><span>${fmt(r.plush.discountAmount)}</span></div>` : ""}
      ${r.plush.ownerExpenseAmount > 0 ? `<div class="row"><span class="lbl">Despesa</span><span>${fmt(r.plush.ownerExpenseAmount)}</span></div>` : ""}
      <div class="row res"><span class="lbl">Resultado</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    } else if (r.slotH) {
      rows += `
      <div class="row"><span class="lbl">Entrada</span><span>${fmt(r.slotH.incomeDifference)}</span></div>
      <div class="row"><span class="lbl">Saída</span><span>${fmt(r.slotH.expenseDifference)}</span></div>
      <div class="row"><span class="lbl">Líquido</span><span>${fmt(r.slotH.netRevenue)}</span></div>
      <div class="row"><span class="lbl">Repasse cliente</span><span>${fmt(r.slotH.clientShare)}</span></div>
      <div class="row res"><span class="lbl">Resultado casa</span><span>${fmt(r.slotH.houseAmount)}</span></div>`;
    } else if (r.bx) {
      rows += `
      <div class="row"><span class="lbl">Entrada</span><span>${fmt(r.bx.incomeAmount)}</span></div>
      <div class="row"><span class="lbl">Saída</span><span>${fmt(r.bx.expenseAmount)}</span></div>
      ${r.bx.discountAmount > 0 ? `<div class="row"><span class="lbl">Desconto</span><span>${fmt(r.bx.discountAmount)}</span></div>` : ""}
      <div class="row res"><span class="lbl">Resultado</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    } else if (r.carretaKids) {
      rows += `
      <div class="row"><span class="lbl">Tempo cobrado</span><span>${r.carretaKids.minutesCharged} min</span></div>
      <div class="row"><span class="lbl">Valor</span><span>${fmt(r.carretaKids.baseValue)}</span></div>
      ${r.carretaKids.expenseAmount > 0 ? `<div class="row"><span class="lbl">Despesa</span><span>${fmt(r.carretaKids.expenseAmount)}</span></div>` : ""}
      <div class="row res"><span class="lbl">Resultado</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    } else if (r.rental) {
      rows += `
      <div class="row"><span class="lbl">Total</span><span>${fmt(r.rental.totalAmount)}</span></div>
      ${r.rental.signalEnabled ? `<div class="row"><span class="lbl">Sinal (${r.rental.signalPercentage}%)</span><span>${fmt(r.rental.signalAmount)}</span></div>` : ""}
      ${r.rental.expenseAmount > 0 ? `<div class="row"><span class="lbl">Despesa</span><span>${fmt(r.rental.expenseAmount)}</span></div>` : ""}
      <div class="row res"><span class="lbl">Resultado</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    } else {
      rows += `
      <div class="row"><span class="lbl">Entrada</span><span>${fmt(r.incomeAmount)}</span></div>
      <div class="row"><span class="lbl">Saída</span><span>${fmt(r.expenseAmount)}</span></div>
      <div class="row res"><span class="lbl">Líquido</span><span>${fmt(r.incomeAmount - r.expenseAmount)}</span></div>`;
    }

    if (r.notes) {
      rows += `<div class="notes">${r.notes}</div>`;
    }

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Comprovante — ${r.visitType} — ${r.clientName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#fff;color:#111;padding:28px 24px;max-width:420px;margin:0 auto}
h1{font-size:17px;font-weight:700;padding-bottom:10px;border-bottom:2px solid #111;margin-bottom:16px}
.sub{font-size:12px;color:#555;margin-bottom:14px}
.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e5e5e5;font-size:13px}
.lbl{color:#666}
.res{font-weight:700;font-size:15px;border-bottom:2px solid #111}
.notes{margin-top:16px;font-size:12px;color:#555;white-space:pre-wrap}
.foot{margin-top:28px;font-size:10px;color:#aaa;text-align:center}
@media print{body{padding:0}}
</style></head><body>
<h1>Comprovante de Visita</h1>
<p class="sub">${r.visitType}${r.clientPhone ? " • " + r.clientPhone : ""}</p>
${rows}
<div class="foot">Sistema LM Gestão • ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
</body></html>`;
  }

  function handlePrintPDF() {
    if (!receipt) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPdfHtml(receipt));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function resetForm() {
    setReceipt(null);
    setPhoto1Label(null);
    setPhoto2Label(null);
    setSelectedClient(null);
    setClientSearch("");
    setVisitType(initialVisitType ?? "GENERAL");
    setAccumulatedChips(0);
    setQuantityOfChips(0);
    setChipValue(1);
    setPercentage(25);
    setDiscountAmount(0);
    setDiscountReason("");
    setPlushGrossAmount(0);
    setPlushCommissionPercentage(25);
    setPlushDiscountAmount(0);
    setPlushOwnerExpenseAmount(0);
    setSlotCurrentIncome(0);
    setSlotPreviousIncome(0);
    setSlotCurrentExpense(0);
    setSlotPreviousExpense(0);
    setSlotPercentageSplit(50);
    setSlotDiscountAmount(0);
    setBxIncomeAmount(0);
    setBxExpenseAmount(0);
    setBxDiscountAmount(0);
    setCarretaMinutesCharged("15");
    setCarretaExpenseAmount(0);
    setCarretaDiscountAmount(0);
    setRentalTotalAmount(0);
    setRentalSignalEnabled(true);
    setRentalSignalPercentage(30);
    setRentalExpenseAmount(0);
    setRentalDiscountAmount(0);
  }

  if (receipt) {
    return (
      <div className="space-y-4">
        <article className="overflow-hidden rounded-2xl border border-[#8aa17c]/25 bg-[#1d2e22]/72">
          <div className="flex items-center gap-3 border-b border-[#8aa17c]/15 px-5 py-4">
            <ClipboardCheck className="size-5 text-[#8aa17c]" />
            <div>
              <p className="font-semibold text-[#dbe6d4]">Visita registrada</p>
              <p className="text-xs text-[#8aa17c]/80">{receipt.visitType} — {receipt.clientName}</p>
            </div>
          </div>

          <div className="grid gap-2 p-5 sm:grid-cols-2">
            <DataRow label="Data" value={receipt.occurredAt} />
            {receipt.billiard ? (
              <>
                <DataRow label="Fichas" value={String(receipt.billiard.quantityOfChips)} />
                <DataRow label="Bruto" value={formatCurrency(receipt.billiard.grossAmount)} />
                <DataRow label="Repasse cliente" value={formatCurrency(receipt.billiard.clientShare)} />
                <DataRow
                  label="Resultado"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : receipt.plush ? (
              <>
                <DataRow label="Bruto" value={formatCurrency(receipt.plush.grossAmount)} />
                <DataRow label="Repasse cliente" value={formatCurrency(receipt.plush.clientAmount)} />
                <DataRow label="Despesa/desconto" value={formatCurrency(receipt.plush.discountAmount + receipt.plush.ownerExpenseAmount)} />
                <DataRow
                  label="Resultado"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : receipt.slotH ? (
              <>
                <DataRow label="Líquido" value={formatCurrency(receipt.slotH.netRevenue)} />
                <DataRow label="Repasse cliente" value={formatCurrency(receipt.slotH.clientShare)} />
                <DataRow
                  label="Resultado casa"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : receipt.bx ? (
              <>
                <DataRow label="Entrada" value={formatCurrency(receipt.bx.incomeAmount)} />
                <DataRow label="Saída" value={formatCurrency(receipt.bx.expenseAmount)} />
                <DataRow
                  label="Resultado"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : receipt.carretaKids ? (
              <>
                <DataRow label="Tempo cobrado" value={`${receipt.carretaKids.minutesCharged} min`} />
                <DataRow label="Valor" value={formatCurrency(receipt.carretaKids.baseValue)} />
                <DataRow
                  label="Resultado"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : receipt.rental ? (
              <>
                <DataRow label="Total" value={formatCurrency(receipt.rental.totalAmount)} />
                <DataRow label="Sinal" value={formatCurrency(receipt.rental.signalAmount)} />
                <DataRow
                  label="Resultado"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            ) : (
              <>
                <DataRow label="Entrada" value={formatCurrency(receipt.incomeAmount)} />
                <DataRow label="Saída" value={formatCurrency(receipt.expenseAmount)} />
                <DataRow
                  label="Líquido"
                  value={formatCurrency(receipt.incomeAmount - receipt.expenseAmount)}
                />
              </>
            )}
          </div>

          {receipt.notes ? (
            <p className="border-t border-[#8aa17c]/15 px-5 py-3 text-sm text-[#c9c2b4]">
              {receipt.notes}
            </p>
          ) : null}
        </article>

        <WhatsAppReceiptButton
          defaultPhone={receipt.clientPhone}
          message={buildMessage(receipt)}
        />

        <button
          type="button"
          onClick={handlePrintPDF}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.07]"
        >
          <FileDown className="size-4" />
          Salvar como PDF
        </button>

        <button
          type="button"
          onClick={resetForm}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.07]"
        >
          <RotateCcw className="size-4" />
          Nova visita
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client selector */}
      <div className="space-y-2">
        <p className={labelClass}>Cliente</p>
        {selectedClient ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d1a04f]/28 bg-[#d1a04f]/8 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selectedClient.name}</p>
              <p className="text-xs text-[#9a958b]">{selectedClient.phone}</p>
            </div>
            <button
              type="button"
              onClick={clearClient}
              className="shrink-0 rounded-xl p-1.5 text-[#9a958b] transition hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/72 px-4 py-3">
              <Search className="size-4 shrink-0 text-[#7e786d]" />
              <input
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                placeholder="Nome, código ou telefone..."
                className="w-full bg-transparent text-base md:text-sm text-white outline-none placeholder:text-[#7e786d]"
              />
            </div>
            {filteredClients.length > 0 ? (
              <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.12)] bg-[#111614] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => pickClient(client)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.05]"
                  >
                    <p className="truncate text-sm text-white">{client.name}</p>
                    <p className="shrink-0 text-xs text-[#9a958b]">{client.phone}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className={labelClass}>Tipo de visita</p>
          {useModuleTarget ? (
            <p className={`${fieldClass} flex items-center text-[#c9c2b4]`}>
              {VISIT_TYPES.find((t) => t.value === visitType)?.label ?? "Geral"}
            </p>
          ) : (
            <select
              name="visitType"
              className={selectClass}
              value={visitType}
              onChange={(e) => handleVisitTypeChange(e.target.value)}
            >
              {VISIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-2">
          <p className={labelClass}>Data e hora</p>
          <input
            name="occurredAt"
            type="datetime-local"
            className={fieldClass}
            defaultValue={
              typeof window !== "undefined"
                ? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                : ""
            }
          />
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <p className={labelClass}>Fotos</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoCapture
            name="photo1"
            label={photo1Label ?? "Foto 1 — tela / leitura"}
            captured={photo1Label !== null}
            onCapture={setPhoto1Label}
          />
          <PhotoCapture
            name="photo2"
            label={photo2Label ?? "Foto 2 — comprovante"}
            captured={photo2Label !== null}
            onCapture={setPhoto2Label}
          />
        </div>
      </div>

      {/* Values */}
      {isBilliardModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="accumulatedChips">
                Fichas anteriores
              </label>
              <input
                id="accumulatedChips"
                name="accumulatedChips"
                type="number"
                inputMode="numeric"
                min="0"
                value={accumulatedChips}
                onChange={(e) => setAccumulatedChips(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="quantityOfChips">
                Fichas desta visita
              </label>
              <input
                id="quantityOfChips"
                name="quantityOfChips"
                type="number"
                inputMode="numeric"
                min="0"
                value={quantityOfChips}
                onChange={(e) => setQuantityOfChips(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="chipValue">
                Valor da ficha (R$)
              </label>
              <input
                id="chipValue"
                name="chipValue"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={chipValue}
                onChange={(e) => setChipValue(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="percentage">
                Percentual do cliente
              </label>
              <input
                id="percentage"
                name="percentage"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="discountAmount">
                Desconto (R$)
              </label>
              <input
                id="discountAmount"
                name="discountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            {discountAmount > 0 ? (
              <div className="space-y-2">
                <label className={labelClass} htmlFor="discountReason">
                  Motivo do desconto
                </label>
                <input
                  id="discountReason"
                  name="discountReason"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className={fieldClass}
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#9a958b]">Bruto</p>
              <p className="font-semibold text-white">{formatCurrency(billiardTotals.grossAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Cliente</p>
              <p className="font-semibold text-white">{formatCurrency(billiardTotals.clientShare)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Desconto</p>
              <p className="font-semibold text-white">{formatCurrency(discountAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">
                {formatCurrency(billiardTotals.resultAmount)}
              </p>
            </div>
          </div>
        </div>
      ) : isPlushModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="plushGrossAmount">
                Valor bruto (R$)
              </label>
              <input
                id="plushGrossAmount"
                name="plushGrossAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={plushGrossAmount}
                onChange={(e) => setPlushGrossAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="plushCommissionPercentage">
                Percentual do cliente
              </label>
              <input
                id="plushCommissionPercentage"
                name="plushCommissionPercentage"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={plushCommissionPercentage}
                onChange={(e) => setPlushCommissionPercentage(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="plushDiscountAmount">
                Desconto (R$)
              </label>
              <input
                id="plushDiscountAmount"
                name="plushDiscountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={plushDiscountAmount}
                onChange={(e) => setPlushDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="plushOwnerExpenseAmount">
                Despesa do dono (R$)
              </label>
              <input
                id="plushOwnerExpenseAmount"
                name="plushOwnerExpenseAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={plushOwnerExpenseAmount}
                onChange={(e) => setPlushOwnerExpenseAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#9a958b]">Bruto</p>
              <p className="font-semibold text-white">{formatCurrency(plushGrossAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Cliente</p>
              <p className="font-semibold text-white">{formatCurrency(plushTotals.clientAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Despesa/desconto</p>
              <p className="font-semibold text-white">
                {formatCurrency(plushDiscountAmount + plushOwnerExpenseAmount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">{formatCurrency(plushTotals.netAmount)}</p>
            </div>
          </div>
        </div>
      ) : isSlotModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slotPreviousIncome">
                Entrada anterior
              </label>
              <input
                id="slotPreviousIncome"
                name="slotPreviousIncome"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={slotPreviousIncome}
                onChange={(e) => setSlotPreviousIncome(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slotCurrentIncome">
                Entrada atual
              </label>
              <input
                id="slotCurrentIncome"
                name="slotCurrentIncome"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={slotCurrentIncome}
                onChange={(e) => setSlotCurrentIncome(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slotPreviousExpense">
                Saída anterior
              </label>
              <input
                id="slotPreviousExpense"
                name="slotPreviousExpense"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={slotPreviousExpense}
                onChange={(e) => setSlotPreviousExpense(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slotCurrentExpense">
                Saída atual
              </label>
              <input
                id="slotCurrentExpense"
                name="slotCurrentExpense"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={slotCurrentExpense}
                onChange={(e) => setSlotCurrentExpense(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className={labelClass} htmlFor="slotPercentageSplit">
                Percentual do cliente
              </label>
              <input
                id="slotPercentageSplit"
                name="slotPercentageSplit"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={slotPercentageSplit}
                onChange={(e) => setSlotPercentageSplit(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slotDiscountAmount">
                Desconto (R$) <span className="text-[#9a958b]">opcional</span>
              </label>
              <input
                id="slotDiscountAmount"
                name="slotDiscountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={slotDiscountAmount}
                onChange={(e) => setSlotDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#9a958b]">Líquido</p>
              <p className="font-semibold text-white">{formatCurrency(slotTotals.netRevenue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Cliente</p>
              <p className="font-semibold text-white">{formatCurrency(slotTotals.clientShare)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Casa</p>
              <p className="font-semibold text-white">{formatCurrency(slotTotals.houseAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">{formatCurrency(slotTotals.houseAmount)}</p>
            </div>
          </div>
        </div>
      ) : isBxModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bxIncomeAmount">
                Entrada (R$)
              </label>
              <input
                id="bxIncomeAmount"
                name="bxIncomeAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={bxIncomeAmount}
                onChange={(e) => setBxIncomeAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bxExpenseAmount">
                Saída (R$)
              </label>
              <input
                id="bxExpenseAmount"
                name="bxExpenseAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={bxExpenseAmount}
                onChange={(e) => setBxExpenseAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bxDiscountAmount">
                Desconto (R$)
              </label>
              <input
                id="bxDiscountAmount"
                name="bxDiscountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={bxDiscountAmount}
                onChange={(e) => setBxDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <div>
              <p className="text-[11px] text-[#9a958b]">Entrada</p>
              <p className="font-semibold text-white">{formatCurrency(bxIncomeAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Saída</p>
              <p className="font-semibold text-white">{formatCurrency(bxExpenseAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">{formatCurrency(bxTotals.netAmount)}</p>
            </div>
          </div>
        </div>
      ) : isCarretaModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="carretaMinutesCharged">
                Tempo cobrado
              </label>
              <select
                id="carretaMinutesCharged"
                name="carretaMinutesCharged"
                className={selectClass}
                value={carretaMinutesCharged}
                onChange={(e) => setCarretaMinutesCharged(e.target.value as "15" | "30" | "60")}
              >
                <option value="15">15 minutos — {formatCurrency(CARRETA_PRICE_TABLE["15"])}</option>
                <option value="30">30 minutos — {formatCurrency(CARRETA_PRICE_TABLE["30"])}</option>
                <option value="60">60 minutos — {formatCurrency(CARRETA_PRICE_TABLE["60"])}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="carretaExpenseAmount">
                Despesa (R$)
              </label>
              <input
                id="carretaExpenseAmount"
                name="carretaExpenseAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={carretaExpenseAmount}
                onChange={(e) => setCarretaExpenseAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="carretaDiscountAmount">
                Desconto (R$) <span className="text-[#9a958b]">opcional</span>
              </label>
              <input
                id="carretaDiscountAmount"
                name="carretaDiscountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={carretaDiscountAmount}
                onChange={(e) => setCarretaDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <div>
              <p className="text-[11px] text-[#9a958b]">Valor</p>
              <p className="font-semibold text-white">{formatCurrency(carretaTotals.baseValue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Despesa</p>
              <p className="font-semibold text-white">{formatCurrency(carretaExpenseAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">{formatCurrency(carretaTotals.totalValue)}</p>
            </div>
          </div>
        </div>
      ) : isRentalModule ? (
        <div className="space-y-3">
          <p className={labelClass}>Fechamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="rentalTotalAmount">
                Valor total (R$)
              </label>
              <input
                id="rentalTotalAmount"
                name="rentalTotalAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={rentalTotalAmount}
                onChange={(e) => setRentalTotalAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="rentalExpenseAmount">
                Despesa (R$)
              </label>
              <input
                id="rentalExpenseAmount"
                name="rentalExpenseAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={rentalExpenseAmount}
                onChange={(e) => setRentalExpenseAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rentalSignalEnabled"
                type="checkbox"
                checked={rentalSignalEnabled}
                onChange={(e) => setRentalSignalEnabled(e.target.checked)}
                className="size-4 rounded border-white/20 bg-white/5"
              />
              <label className="text-sm text-[#c9c2b4]" htmlFor="rentalSignalEnabled">
                Cobrar sinal
              </label>
            </div>
            {rentalSignalEnabled ? (
              <div className="space-y-2">
                <label className={labelClass} htmlFor="rentalSignalPercentage">
                  Sinal (%)
                </label>
                <input
                  id="rentalSignalPercentage"
                  name="rentalSignalPercentage"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rentalSignalPercentage}
                  onChange={(e) => setRentalSignalPercentage(Number(e.target.value))}
                  className={fieldClass}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <label className={labelClass} htmlFor="rentalDiscountAmount">
                Desconto (R$) <span className="text-[#9a958b]">opcional</span>
              </label>
              <input
                id="rentalDiscountAmount"
                name="rentalDiscountAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={rentalDiscountAmount}
                onChange={(e) => setRentalDiscountAmount(Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <div>
              <p className="text-[11px] text-[#9a958b]">Sinal</p>
              <p className="font-semibold text-white">{formatCurrency(rentalTotals.signalAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Despesa</p>
              <p className="font-semibold text-white">{formatCurrency(rentalExpenseAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9a958b]">Resultado</p>
              <p className="font-semibold text-[#dbe6d4]">{formatCurrency(rentalTotals.balanceAmount)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="incomeAmount">
              Entrada (R$)
            </label>
            <input
              id="incomeAmount"
              name="incomeAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue="0"
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Saída (R$)
            </label>
            <input
              id="expenseAmount"
              name="expenseAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue="0"
              className={fieldClass}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className={labelClass} htmlFor="notes">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          className={textareaClass}
          placeholder="Máquina com problema, acordos, recado para o escritório..."
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-4 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-60"
      >
        <ClipboardCheck className="size-4" />
        {isPending ? "Salvando..." : "Salvar visita e gerar comprovante"}
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}

function PhotoCapture({
  name,
  label,
  captured,
  onCapture,
}: {
  name: string;
  label: string;
  captured: boolean;
  onCapture: (name: string) => void;
}) {
  return (
    <label
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-center transition ${
        captured
          ? "border-[#8aa17c]/50 bg-[#8aa17c]/8 hover:bg-[#8aa17c]/12"
          : "border-[rgba(245,241,232,0.14)] bg-white/[0.02] hover:border-[#d1a04f]/35 hover:bg-[#d1a04f]/5"
      }`}
    >
      {captured
        ? <CheckCircle2 className="size-6 text-[#8aa17c]" />
        : <Camera className="size-6 text-[#5a544c]" />
      }
      <p className={`text-xs ${captured ? "text-[#8aa17c]" : "text-[#9a958b]"}`}>{label}</p>
      <input
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file.name);
        }}
      />
    </label>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#8aa17c]/15 bg-[#8aa17c]/5 px-3 py-2.5">
      <p className="text-[11px] text-[#8aa17c]/70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#dbe6d4]">{value}</p>
    </div>
  );
}
