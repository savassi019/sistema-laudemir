/**
 * Gera um relatório HTML completo do sistema na área de trabalho.
 * Uso: npx tsx scripts/gerar-relatorio.ts
 * O arquivo gerado pode ser aberto no navegador e impresso como PDF.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

dotenv.config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "",
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}

function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

type Record = {
  module: string;
  date: Date;
  income: number;
  expense: number;
  net: number;
  description: string;
};

// ────────────────────────────────────────────────────────────
// Coleta de dados por módulo
// ────────────────────────────────────────────────────────────

async function collectRecords(): Promise<Record[]> {
  const all: Record[] = [];

  // 1. Carreta Kids
  const carretaKids = await prisma.carretaKidsRecord.findMany({
    orderBy: { serviceDate: "asc" },
  });
  for (const r of carretaKids) {
    const income = Number(r.tablePrice ?? 0);
    const expense = Number(r.expenseAmount ?? 0);
    all.push({
      module: "Carreta Kids",
      date: r.serviceDate,
      income,
      expense,
      net: income - expense,
      description: r.locationName,
    });
  }

  // 2. Locação
  const rental = await prisma.rentalOrder.findMany({
    orderBy: { eventDate: "asc" },
  });
  for (const r of rental) {
    const income = Number(r.totalAmount ?? 0);
    const expense = Number(r.expenseAmount ?? 0);
    const net = Number(r.balanceAmount ?? income) - expense;
    all.push({
      module: "Locação",
      date: r.eventDate,
      income,
      expense,
      net,
      description: r.localName,
    });
  }

  // 3. Pelúcia
  const plush = await prisma.plushCollection.findMany({
    orderBy: { createdAt: "asc" },
    include: { plushMachine: { select: { clientName: true } } },
  });
  for (const r of plush) {
    const income = Number(r.grossAmount ?? 0);
    const net = Number(r.companyAmount ?? 0);
    const expense = income - net;
    all.push({
      module: "Máquinas de Pelúcia",
      date: r.createdAt,
      income,
      expense,
      net,
      description: r.plushMachine.clientName ?? "Cliente",
    });
  }

  // 4. Bilhar / Pebolim
  const billiard = await prisma.billiardCollection.findMany({
    orderBy: { collectionDate: "asc" },
    include: {
      billiardPoint: { select: { name: true, chipValue: true } },
    },
  });
  for (const r of billiard) {
    const gross = Number(r.grossAmount ?? 0);
    const expenses =
      Number(r.employeeCost ?? 0) +
      Number(r.installationCost ?? 0) +
      Number(r.maintenanceCost ?? 0) +
      Number(r.otherCost ?? 0) +
      Number(r.roofAmount ?? 0) +
      Number(r.discountAmount ?? 0);
    const percentage = Number(r.percentage ?? 50) / 100;
    const net = gross * (1 - percentage) - expenses;
    all.push({
      module: "Bilhar / Pebolim",
      date: r.collectionDate,
      income: gross,
      expense: expenses,
      net,
      description: r.billiardPoint.name,
    });
  }

  // 5. BX
  const bx = await prisma.bxTransaction.findMany({
    orderBy: { occurredAt: "asc" },
  });
  for (const r of bx) {
    const income = Number(r.incomeAmount ?? r.totalAmount ?? 0);
    const expense = Number(r.expenseAmount ?? 0);
    all.push({
      module: "BX",
      date: r.occurredAt,
      income,
      expense,
      net: income - expense,
      description: r.clientName,
    });
  }

  // 6. H / Caça-níquel
  const slot = await prisma.slotCollection.findMany({
    orderBy: { occurredAt: "asc" },
    include: { slotMachine: { select: { uniqueMachineNumber: true, clientName: true } } },
  });
  for (const r of slot) {
    const incomeDiff = Number(r.incomeDifference ?? 0);
    const expenseDiff = Number(r.expenseDifference ?? 0);
    const netRevenue = incomeDiff - expenseDiff;
    const totalNegative = Number(r.negativeAmount ?? 0) + Number(r.feedingNegativeAmount ?? 0);
    const adjusted = netRevenue - totalNegative;
    const pct = Number(r.percentageSplit ?? 50) / 100;
    const houseBase = adjusted * (1 - pct);
    // greed and debt adjustments are per-record and not stored directly; use houseBase as approximation
    const net = houseBase - Number(r.generatedDebtAmount ?? 0);
    all.push({
      module: "H / Caça-níquel",
      date: r.occurredAt,
      income: incomeDiff,
      expense: expenseDiff + totalNegative,
      net,
      description: `Máq. ${r.slotMachine.uniqueMachineNumber}${r.slotMachine.clientName ? " – " + r.slotMachine.clientName : ""}`,
    });
  }

  // 7. Crédito / Financeiro (MachineContract)
  const machineContracts = await prisma.machineContract.findMany({
    orderBy: { contractDate: "asc" },
  });
  for (const r of machineContracts) {
    const income = Number(r.amount ?? 0);
    const expense = Number(r.expenseAmount ?? 0);
    all.push({
      module: "Crédito / Financeiro",
      date: r.contractDate,
      income,
      expense,
      net: income - expense,
      description: r.clientName,
    });
  }

  // 8. Mercado Autônomo (CondominiumMarketEntry)
  const market = await prisma.condominiumMarketEntry.findMany({
    orderBy: { movementDate: "asc" },
  });
  for (const r of market) {
    const isExpense = r.direction === "EXPENSE";
    const income = isExpense ? 0 : Number(r.amount ?? 0);
    const expense = isExpense
      ? Number(r.amount ?? 0) + Number(r.expenseAmount ?? 0)
      : Number(r.expenseAmount ?? 0);
    const net = income - expense;
    all.push({
      module: "Mercado Autônomo",
      date: r.movementDate,
      income,
      expense,
      net,
      description: r.description,
    });
  }

  // 9. Marketing
  const marketing = await prisma.marketingContract.findMany({
    orderBy: { contractDate: "asc" },
  });
  for (const r of marketing) {
    const income = Number(r.contractValue ?? 0);
    const expense = Number(r.expenseAmount ?? 0);
    all.push({
      module: "Marketing",
      date: r.contractDate,
      income,
      expense,
      net: income - expense,
      description: r.name,
    });
  }

  // 10. Plataforma Online (BrazilBetsEntry)
  const platform = await prisma.brazilBetsEntry.findMany({
    orderBy: { movementDate: "asc" },
  });
  for (const r of platform) {
    const isExpense = r.direction === "EXPENSE";
    const income = isExpense ? 0 : Number(r.amount ?? 0);
    const expense = isExpense ? Number(r.amount ?? 0) : 0;
    all.push({
      module: "Plataforma Online",
      date: r.movementDate,
      income,
      expense,
      net: income - expense,
      description: r.description,
    });
  }

  // 11. Finanças Pessoais
  const personal = await prisma.personalFinanceRecord.findMany({
    orderBy: { createdAt: "asc" },
  });
  for (const r of personal) {
    const isIncome = r.type === "INCOME";
    const income = isIncome ? Number(r.amount ?? 0) : 0;
    const expense = isIncome ? 0 : Number(r.amount ?? 0);
    all.push({
      module: "Finanças Pessoais",
      date: r.createdAt,
      income,
      expense,
      net: income - expense,
      description: r.title,
    });
  }

  return all.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ────────────────────────────────────────────────────────────
// Agrupamento mensal
// ────────────────────────────────────────────────────────────

type MonthBucket = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
};

function groupByMonth(records: Record[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const r of records) {
    const key = monthKey(r.date);
    const bucket = map.get(key) ?? { key, label: monthLabel(key), income: 0, expense: 0, net: 0, count: 0 };
    bucket.income += r.income;
    bucket.expense += r.expense;
    bucket.net += r.net;
    bucket.count += 1;
    map.set(key, bucket);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

type ModuleBucket = {
  module: string;
  income: number;
  expense: number;
  net: number;
  count: number;
};

function groupByModule(records: Record[]): ModuleBucket[] {
  const map = new Map<string, ModuleBucket>();
  for (const r of records) {
    const bucket = map.get(r.module) ?? { module: r.module, income: 0, expense: 0, net: 0, count: 0 };
    bucket.income += r.income;
    bucket.expense += r.expense;
    bucket.net += r.net;
    bucket.count += 1;
    map.set(r.module, bucket);
  }
  return Array.from(map.values()).sort((a, b) => b.net - a.net);
}

// ────────────────────────────────────────────────────────────
// Geração do HTML
// ────────────────────────────────────────────────────────────

function buildHtml(records: Record[], months: MonthBucket[], modules: ModuleBucket[]): string {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const totalIncome = records.reduce((s, r) => s + r.income, 0);
  const totalExpense = records.reduce((s, r) => s + r.expense, 0);
  const totalNet = records.reduce((s, r) => s + r.net, 0);

  // Group records by month for the detail section
  const recordsByMonth = new Map<string, Record[]>();
  for (const r of records) {
    const key = monthKey(r.date);
    const arr = recordsByMonth.get(key) ?? [];
    arr.push(r);
    recordsByMonth.set(key, arr);
  }

  const detailSections = Array.from(recordsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, recs]) => {
      const month = months.find((m) => m.key === key);
      const rows = recs
        .map(
          (r) => `
          <tr>
            <td>${fmtDate(r.date)}</td>
            <td>${r.module}</td>
            <td class="desc">${r.description}</td>
            <td class="num green">${r.income > 0 ? fmt(r.income) : "—"}</td>
            <td class="num red">${r.expense > 0 ? fmt(r.expense) : "—"}</td>
            <td class="num ${r.net < 0 ? "red" : "blue"}">${fmt(r.net)}</td>
          </tr>`,
        )
        .join("");

      return `
      <div class="section-break">
        <h3 class="month-title">${monthLabel(key)}</h3>
        <table>
          <thead>
            <tr>
              <th style="width:90px">Data</th>
              <th style="width:140px">Módulo</th>
              <th>Descrição</th>
              <th class="num" style="width:110px">Entrada</th>
              <th class="num" style="width:110px">Despesa</th>
              <th class="num" style="width:110px">Resultado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="subtotal">
              <td colspan="3">Subtotal ${monthLabel(key)} — ${month?.count ?? recs.length} registros</td>
              <td class="num green">${fmt(month?.income ?? 0)}</td>
              <td class="num red">${fmt(month?.expense ?? 0)}</td>
              <td class="num ${(month?.net ?? 0) < 0 ? "red" : "blue"}">${fmt(month?.net ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    })
    .join("");

  const moduleRows = modules
    .map(
      (m) => `
      <tr>
        <td>${m.module}</td>
        <td class="num">${m.count}</td>
        <td class="num green">${fmt(m.income)}</td>
        <td class="num red">${fmt(m.expense)}</td>
        <td class="num ${m.net < 0 ? "red" : "blue"}">${fmt(m.net)}</td>
      </tr>`,
    )
    .join("");

  const monthRows = months
    .map(
      (m) => `
      <tr>
        <td>${m.label}</td>
        <td class="num">${m.count}</td>
        <td class="num green">${fmt(m.income)}</td>
        <td class="num red">${fmt(m.expense)}</td>
        <td class="num ${m.net < 0 ? "red" : "blue"}">${fmt(m.net)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Gestão – Sistema Laudemir</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      background: #f0f0f0;
      padding: 20px;
    }
    .page {
      background: #fff;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 48px;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a3c1c;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1a3c1c;
    }
    .header .sub {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
    }
    .header .date {
      font-size: 11px;
      color: #888;
      text-align: right;
    }

    /* Totais gerais */
    .totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .total-card {
      border-radius: 6px;
      padding: 12px 16px;
      border-left: 4px solid #ccc;
    }
    .total-card.in { border-left-color: #2a7a2a; background: #f0faf0; }
    .total-card.out { border-left-color: #c0392b; background: #fdf0f0; }
    .total-card.net { border-left-color: #1a5fa8; background: #f0f4ff; }
    .total-card p.label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-card p.val { font-size: 18px; font-weight: 700; margin-top: 2px; }
    .total-card.in p.val { color: #1d6b1d; }
    .total-card.out p.val { color: #a93226; }
    .total-card.net p.val { color: #154890; }
    .total-card p.sub { font-size: 10px; color: #888; margin-top: 2px; }

    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #1a3c1c;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #ccc;
    }
    h3.month-title {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px 0;
      text-transform: capitalize;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 10.5px;
    }
    th {
      background: #1a3c1c;
      color: #fff;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #e8e8e8;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #fafafa; }
    tr:hover td { background: #f3f8f3; }
    td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.green { color: #1d6b1d; font-weight: 600; }
    td.red { color: #a93226; font-weight: 600; }
    td.blue { color: #154890; font-weight: 600; }
    td.desc { color: #444; font-style: italic; font-size: 10px; }

    tfoot tr td {
      background: #e8f0e8 !important;
      font-weight: 700;
      border-top: 1px solid #bbb;
      border-bottom: 2px solid #1a3c1c;
    }
    tr.subtotal td { font-weight: 700; background: #f5f5f5 !important; }

    .section-break { margin-bottom: 20px; }
    .section-break:last-child { margin-bottom: 0; }

    .print-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1a3c1c;
      color: #fff;
      border: none;
      border-radius: 30px;
      padding: 12px 24px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: background 0.2s;
    }
    .print-btn:hover { background: #2a5c2a; }

    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #888;
      text-align: center;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; padding: 20px 24px; max-width: 100%; }
      .print-btn { display: none; }
      .section-break { page-break-inside: avoid; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <h1>Relatório de Gestão</h1>
        <p class="sub">Sistema Laudemir — Todos os módulos operacionais</p>
      </div>
      <div class="date">
        <p>Gerado em ${today}</p>
        <p>${records.length} registros no total</p>
      </div>
    </div>

    <div class="totals">
      <div class="total-card in">
        <p class="label">Total de Entradas</p>
        <p class="val">${fmt(totalIncome)}</p>
        <p class="sub">${months.length} ${months.length === 1 ? "mês" : "meses"} com atividade</p>
      </div>
      <div class="total-card out">
        <p class="label">Total de Despesas</p>
        <p class="val">${fmt(totalExpense)}</p>
        <p class="sub">${modules.length} módulos ativos</p>
      </div>
      <div class="total-card net">
        <p class="label">Resultado Líquido</p>
        <p class="val">${fmt(totalNet)}</p>
        <p class="sub">${records.length} operações registradas</p>
      </div>
    </div>

    <!-- Resumo mensal -->
    <h2>Resumo por Mês (Parcela Mensal)</h2>
    <table>
      <thead>
        <tr>
          <th>Mês</th>
          <th class="num">Registros</th>
          <th class="num">Entradas</th>
          <th class="num">Despesas</th>
          <th class="num">Resultado</th>
        </tr>
      </thead>
      <tbody>${monthRows}</tbody>
      <tfoot>
        <tr>
          <td><strong>TOTAL GERAL</strong></td>
          <td class="num"><strong>${records.length}</strong></td>
          <td class="num green"><strong>${fmt(totalIncome)}</strong></td>
          <td class="num red"><strong>${fmt(totalExpense)}</strong></td>
          <td class="num ${totalNet < 0 ? "red" : "blue"}"><strong>${fmt(totalNet)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <!-- Resumo por módulo -->
    <h2>Resumo por Módulo</h2>
    <table>
      <thead>
        <tr>
          <th>Módulo</th>
          <th class="num">Registros</th>
          <th class="num">Entradas</th>
          <th class="num">Despesas</th>
          <th class="num">Resultado</th>
        </tr>
      </thead>
      <tbody>${moduleRows}</tbody>
      <tfoot>
        <tr>
          <td><strong>TOTAL</strong></td>
          <td class="num"><strong>${records.length}</strong></td>
          <td class="num green"><strong>${fmt(totalIncome)}</strong></td>
          <td class="num red"><strong>${fmt(totalExpense)}</strong></td>
          <td class="num ${totalNet < 0 ? "red" : "blue"}"><strong>${fmt(totalNet)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <!-- Detalhamento mensal -->
    <h2>Detalhamento por Mês</h2>
    ${detailSections}

    <div class="footer">
      Relatório gerado automaticamente pelo Sistema de Gestão Laudemir em ${today}. Documento confidencial.
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  console.log("Conectando ao banco de dados...");
  const records = await collectRecords();
  console.log(`${records.length} registros encontrados.`);

  const months = groupByMonth(records);
  const modules = groupByModule(records);

  const html = buildHtml(records, months, modules);

  // Save to Desktop
  const desktopPath = path.join(
    process.env.USERPROFILE ?? process.env.HOME ?? "C:/Users/Administrator",
    "Desktop",
  );

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const fileName = `relatorio-laudemir-${stamp}.html`;
  const outputPath = path.join(desktopPath, fileName);

  fs.writeFileSync(outputPath, html, "utf-8");
  console.log(`\nRelatório gerado: ${outputPath}`);
  console.log("Abra o arquivo no navegador e use Ctrl+P para salvar como PDF.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  void prisma.$disconnect();
  void pool.end();
  process.exit(1);
});
