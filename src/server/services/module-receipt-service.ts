import { formatCurrency, formatShortDate } from "@/lib/format";
import { canViewCalculatedFinancials } from "@/lib/access-policy";
import {
  calculateBilliardFinancials,
  calculateBxFinancials,
  calculateSlotMachineSplit,
} from "@/lib/module-calculations";
import { prisma } from "@/lib/prisma";
import { formatClosingReceiptId } from "@/lib/receipt";
import {
  FINANCIAL_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  RECEIPT_STATUS_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
import type { ModuleSlug } from "@/server/services/module-record-service";
import type { SessionData } from "@/types/app";

export const receiptModuleSlugs: ModuleSlug[] = [
  "bilhar-pebolim",
  "bx",
  "h-caca-niquel",
  "carreta-kids",
  "maquinas-de-pelucia",
  "locacao",
];

export type ModuleReceiptItem = {
  id: string;
  title: string;
  subtitle: string;
  phone: string;
  occurredAt: string;
  closedAt: string;
  message: string;
};

function paymentLabel(value: string | null | undefined) {
  return value
    ? rotuloDeStatus(value, PAYMENT_METHOD_LABEL)
    : "Não informado";
}

function receiptId(id: string, occurredAt: Date) {
  return formatClosingReceiptId(id, occurredAt.toISOString());
}

export async function listModuleReceipts(
  session: SessionData,
  slug: ModuleSlug,
  take = 50,
): Promise<ModuleReceiptItem[]> {
  if (!receiptModuleSlugs.includes(slug)) return [];
  const showFinancials = canViewCalculatedFinancials(session.role);

  switch (slug) {
    case "carreta-kids": {
      const records = await prisma.carretaKidsRecord.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "desc" },
        take,
      });
      return records.map((record) => ({
        id: record.id,
        title: record.locationName,
        subtitle: `Ficha ${record.sheetName}`,
        phone: record.phone ?? "",
        occurredAt: record.serviceDate.toISOString(),
        closedAt: record.createdAt.toISOString(),
        message: [
          "*Fechamento Carreta Kids*",
          `Comprovante: ${receiptId(record.id, record.serviceDate)}`,
          `Local: ${record.locationName}`,
          `Ficha: ${record.sheetName}`,
          `Data: ${formatShortDate(record.serviceDate)}`,
          `Tempo: ${record.minutesCharged} min`,
          ...(record.entryTime ? [`Entrada: ${record.entryTime}`] : []),
          ...(record.exitTime ? [`Saída: ${record.exitTime}`] : []),
          `Pagamento: ${paymentLabel(record.paymentMethod)}`,
          ...(showFinancials
            ? [
                `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
                `*Total: ${formatCurrency(Number(record.totalAmount))}*`,
              ]
            : []),
          "Situação: Fechamento concluído",
        ].join("\n"),
      }));
    }
    case "maquinas-de-pelucia": {
      const records = await prisma.plushCollection.findMany({
        where: { organizationId: session.organizationId },
        include: { plushMachine: true },
        orderBy: { createdAt: "desc" },
        take,
      });
      return records.map((record) => ({
        id: record.id,
        title: record.plushMachine.clientName ?? record.plushMachine.name,
        subtitle: `${record.plushMachine.name} #${record.plushMachine.machineNumber}`,
        phone: record.plushMachine.phone ?? "",
        occurredAt: record.createdAt.toISOString(),
        closedAt: record.createdAt.toISOString(),
        message: [
          "*Fechamento Máquinas de Pelúcia (GRUA)*",
          `Comprovante: ${receiptId(record.id, record.createdAt)}`,
          `Cliente: ${record.plushMachine.clientName ?? "-"}`,
          `Código: ${record.plushMachine.code}`,
          `Máquina: ${record.plushMachine.name} #${record.plushMachine.machineNumber}`,
          `Data: ${formatShortDate(record.createdAt)}`,
          `Pelúcias: ${record.plushCountOut}`,
          `Pagamento: ${paymentLabel(record.paymentMethod)}`,
          ...(showFinancials
            ? [
                `Bruto: ${formatCurrency(Number(record.grossAmount))}`,
                `*Líquido: ${formatCurrency(Number(record.companyAmount))}*`,
              ]
            : []),
          "Situação: Fechamento concluído",
        ].join("\n"),
      }));
    }
    case "bilhar-pebolim": {
      const records = await prisma.billiardCollection.findMany({
        where: { organizationId: session.organizationId },
        include: { billiardPoint: true },
        orderBy: { createdAt: "desc" },
        take,
      });
      return records.map((record) => {
        const totals = calculateBilliardFinancials({
          quantityOfChips: record.quantityOfChips,
          chipValue:
            record.quantityOfChips > 0
              ? Number(record.grossAmount) / record.quantityOfChips
              : 0,
          percentage: Number(record.percentage ?? 0),
          employeeCost: Number(record.employeeCost ?? 0),
          installationCost: Number(record.installationCost ?? 0),
          maintenanceCost: Number(record.maintenanceCost ?? 0),
          otherCost: Number(record.otherCost ?? 0),
          roofDebt: Number(record.roofAmount ?? 0),
          discountAmount: Number(record.discountAmount ?? 0),
        });
        return {
          id: record.id,
          title: record.billiardPoint.clientName ?? record.billiardPoint.name,
          subtitle: record.billiardPoint.name,
          phone: record.billiardPoint.phone ?? "",
          occurredAt: record.collectionDate.toISOString(),
          closedAt: record.createdAt.toISOString(),
          message: [
            "*Fechamento Bilhar / Pebolim*",
            `Comprovante: ${receiptId(record.id, record.collectionDate)}`,
            `Cliente: ${record.billiardPoint.clientName ?? "-"}`,
            `Ponto: ${record.billiardPoint.name}`,
            `Data: ${formatShortDate(record.collectionDate)}`,
            `Fichas: ${record.quantityOfChips}`,
            ...(showFinancials
              ? [
                  `*Repasse ao cliente: ${formatCurrency(totals.clientShare)}*`,
                  `*Resultado Infinity: ${formatCurrency(totals.finalValue)}*`,
                ]
              : []),
            "Situação: Fechamento concluído",
          ].join("\n"),
        };
      });
    }
    case "bx": {
      const records = await prisma.bxTransaction.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "desc" },
        take,
      });
      return records.map((record) => {
        const totals = calculateBxFinancials({
          incomeAmount: Number(record.incomeAmount ?? 0),
          expenseAmount: Number(record.expenseAmount ?? 0),
          deliveredAmount: Number(record.deliveredAmount ?? 0),
          discountAmount: Number(record.discountAmount ?? 0),
          receiptStatus: record.receiptStatus,
        });
        return {
          id: record.id,
          title: record.clientName,
          subtitle: rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL),
          phone: record.phone ?? "",
          occurredAt: record.occurredAt.toISOString(),
          closedAt: record.createdAt.toISOString(),
          message: [
            "*Fechamento BX*",
            `Comprovante: ${receiptId(record.id, record.occurredAt)}`,
            `Cliente: ${record.clientName}`,
            `Atendido por: ${record.agentName ?? record.receiverName ?? "-"}`,
            `Data: ${formatShortDate(record.occurredAt)}`,
            `Pagamento: ${paymentLabel(record.paymentMethod)}`,
            ...(showFinancials
              ? [
                  ...(totals.prizeExpenseAmount > 0
                    ? [`Prêmio da máquina: ${formatCurrency(totals.prizeExpenseAmount)}`]
                    : []),
                  `Despesas e gastos: ${formatCurrency(totals.operatingExpenseAmount)}`,
                  `Desconto: ${formatCurrency(totals.discountAmount)}`,
                  `*Resultado da operação: ${formatCurrency(totals.netAmount)}*`,
                ]
              : []),
            "Situação: Fechamento concluído",
            `Status: ${rotuloDeStatus(record.receiptStatus, RECEIPT_STATUS_LABEL)}`,
          ].join("\n"),
        };
      });
    }
    case "locacao": {
      const records = await prisma.rentalOrder.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "desc" },
        take,
      });
      return records.map((record) => ({
        id: record.id,
        title: record.clientName ?? record.localName,
        subtitle: record.localName,
        phone: record.phone ?? "",
        occurredAt: record.eventDate.toISOString(),
        closedAt: record.createdAt.toISOString(),
        message: [
          "*Fechamento Locação*",
          `Comprovante: ${receiptId(record.id, record.eventDate)}`,
          `Cliente: ${record.clientName ?? "-"}`,
          `Local: ${record.localName}`,
          `Data: ${formatShortDate(record.eventDate)}`,
          `Pagamento: ${paymentLabel(record.paymentMethod)}`,
          ...(showFinancials
            ? [
                `*Total: ${formatCurrency(Number(record.totalAmount))}*`,
                `Sinal: ${formatCurrency(Number(record.signalAmount ?? 0))}`,
                `Despesa: ${formatCurrency(Number(record.expenseAmount ?? 0))}`,
                `*Saldo: ${formatCurrency(Number(record.balanceAmount ?? 0))}*`,
              ]
            : []),
          "Situação: Fechamento concluído",
          `Status: ${rotuloDeStatus(record.paymentStatus, FINANCIAL_STATUS_LABEL)}`,
        ].join("\n"),
      }));
    }
    case "h-caca-niquel": {
      const records = await prisma.slotCollection.findMany({
        where: { organizationId: session.organizationId },
        include: { slotMachine: true },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: Math.max(take * 8, 100),
      });
      const grouped = new Map<string, typeof records>();
      for (const record of records) {
        const key = record.visitKey ?? record.id;
        grouped.set(key, [...(grouped.get(key) ?? []), record]);
      }

      return [...grouped.entries()].slice(0, take).map(([key, visit]) => {
        const first = visit[0]!;
        const totalClient = visit.reduce((sum, record) => {
          const split = calculateSlotMachineSplit({
            currentIncome: Number(record.currentIncome),
            previousIncome: Number(record.previousIncome),
            currentExpense: Number(record.currentExpense),
            previousExpense: Number(record.previousExpense),
            percentageSplit: Number(record.percentageSplit),
            previousMachineDebt: Number(record.previousMachineDebt ?? 0),
            finalMachineDebt: Number(record.negativeAmount ?? 0),
            feedingNegativeAmount: Number(record.feedingNegativeAmount ?? 0),
            optionalGreedAmount: Number(record.optionalGreedAmount ?? 0),
            customerDebtDiscounted: Number(record.customerDebtDiscounted ?? 0),
            generatedDebtAmount: Number(record.generatedDebtAmount ?? 0),
          });
          return sum + split.clientShareFinal;
        }, 0);
        const finalDebt = Number(first.finalCustomerDebt ?? 0);
        const machines = visit
          .map((record) => record.slotMachine.clientMachineNumber)
          .sort((a, b) => a - b);
        const closedAt = visit.reduce(
          (latest, record) => (record.createdAt > latest ? record.createdAt : latest),
          first.createdAt,
        );
        return {
          id: key,
          title: first.slotMachine.clientName ?? "Cliente",
          subtitle: `Máquinas ${machines.join(", ")}`,
          phone: first.slotMachine.phone ?? "",
          occurredAt: first.occurredAt.toISOString(),
          closedAt: closedAt.toISOString(),
          message: [
            "*Fechamento H*",
            `Comprovante: ${receiptId(key, first.occurredAt)}`,
            `Cliente: ${first.slotMachine.clientName ?? "-"}`,
            `Data: ${formatShortDate(first.occurredAt)}`,
            `Máquinas fechadas: ${machines.join(", ")}`,
            ...(showFinancials
              ? [
                  `*Repasse ao cliente: ${formatCurrency(totalClient)}*`,
                  `*Saldo final da dívida: ${formatCurrency(finalDebt)}*`,
                ]
              : []),
            `Pagamento: ${paymentLabel(first.paymentMethod)}`,
            "Situação: Fechamento concluído",
          ].join("\n"),
        };
      });
    }
    default:
      return [];
  }
}
