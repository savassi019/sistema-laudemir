import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, SystemModule, UserRole } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  // ── Organização ─────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "lm-gestao" },
    update: { name: "Sistema LM Gestão" },
    create: {
      name: "Sistema LM Gestão",
      slug: "lm-gestao",
      legalName: "LM Gestão Operacional Ltda",
      phone: "(11) 99000-0001",
      email: "contato@lmgestao.local",
    },
  });

  const hash = await bcrypt.hash("Admin@12345", 10);
  const staffHash = await bcrypt.hash("Staff@12345", 10);

  // ── Usuário dono ─────────────────────────────────────────────────────────────
  // ATENCAO: o update abaixo redefine a senha do dono para a de seed.
  // Rodar este seed contra producao derruba o acesso do cliente.
  const owner = await prisma.user.upsert({
    where: { email: "laudemir@lmgestao.local" },
    update: { name: "Laudemir Admin", passwordHash: hash, organizationId: org.id, role: UserRole.OWNER },
    create: {
      organizationId: org.id,
      role: UserRole.OWNER,
      name: "Laudemir Admin",
      email: "laudemir@lmgestao.local",
      phone: "(11) 99000-0001",
      passwordHash: hash,
    },
  });

  // ── Funcionário para aba Equipe ──────────────────────────────────────────────
  const staff = await prisma.user.upsert({
    where: { email: "joao@lmgestao.local" },
    update: { name: "João Silva", passwordHash: staffHash, organizationId: org.id },
    create: {
      organizationId: org.id,
      role: UserRole.STAFF,
      name: "João Silva",
      email: "joao@lmgestao.local",
      phone: "(11) 98000-1111",
      passwordHash: staffHash,
    },
  });

  const allMods = Object.values(SystemModule);
  for (const user of [owner, staff]) {
    await prisma.modulePermission.deleteMany({ where: { organizationId: org.id, userId: user.id } });
    await prisma.modulePermission.createMany({
      data: allMods.map((module) => ({
        organizationId: org.id,
        userId: user.id,
        module,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: user.role === UserRole.OWNER,
        canApprove: user.role === UserRole.OWNER,
        canExport: user.role === UserRole.OWNER,
      })),
    });
  }

  // ── Configurações base ───────────────────────────────────────────────────────
  await prisma.systemSetting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "carreta_kids_price_table" } },
    update: { value: { "15": 20, "30": 30, "60": 40, "90": 55 } },
    create: {
      organizationId: org.id,
      module: SystemModule.CARRETA_KIDS,
      key: "carreta_kids_price_table",
      value: { "15": 20, "30": 30, "60": 40, "90": 55 },
    },
  });

  await prisma.systemSetting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "default_rules" } },
    update: { value: { plushCommissionPercentage: 25, slotSplitPercentage: 50, billiardClothAlertAt: 1500 } },
    create: {
      organizationId: org.id,
      key: "default_rules",
      value: { plushCommissionPercentage: 25, slotSplitPercentage: 50, billiardClothAlertAt: 1500 },
    },
  });

  // ── Conta e categorias financeiras ───────────────────────────────────────────
  const account = await prisma.financialAccount.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Caixa Operacional" } },
    update: {},
    create: { organizationId: org.id, name: "Caixa Operacional", description: "Conta principal de operações." },
  });

  const catIncome = await prisma.financialCategory.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Receita Operacional" } },
    update: {},
    create: { organizationId: org.id, name: "Receita Operacional", direction: "INCOME", module: SystemModule.FINANCE },
  });
  const catExpense = await prisma.financialCategory.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Despesa Operacional" } },
    update: {},
    create: { organizationId: org.id, name: "Despesa Operacional", direction: "EXPENSE", module: SystemModule.FINANCE },
  });

  // ── Entradas financeiras (OVERDUE para alertas + histórico) ──────────────────
  const entriesCount = await prisma.financialEntry.count({ where: { organizationId: org.id } });
  if (entriesCount === 0) {
    await prisma.financialEntry.createMany({
      data: [
        // Vencidas — aparecem no alerta do /painel
        {
          organizationId: org.id, accountId: account.id, categoryId: catIncome.id,
          module: SystemModule.FINANCE, kind: "RECEIVABLE", direction: "INCOME",
          status: "OVERDUE", description: "Fechamento Bilhar — Bar do Zé (Jul)",
          referenceCode: "REC-001", totalAmount: 3200, paidAmount: 0,
          discountAmount: 0, interestAmount: 0, remainingAmount: 3200,
          dueDate: daysAgo(18), createdById: owner.id,
        },
        {
          organizationId: org.id, accountId: account.id, categoryId: catIncome.id,
          module: SystemModule.FINANCE, kind: "RECEIVABLE", direction: "INCOME",
          status: "OVERDUE", description: "Pelúcia — Shopping Norte (Jun)",
          referenceCode: "REC-002", totalAmount: 1450, paidAmount: 0,
          discountAmount: 0, interestAmount: 0, remainingAmount: 1450,
          dueDate: daysAgo(25), createdById: owner.id,
        },
        {
          organizationId: org.id, accountId: account.id, categoryId: catExpense.id,
          module: SystemModule.FINANCE, kind: "EXPENSE", direction: "EXPENSE",
          status: "OVERDUE", description: "Manutenção de mesa (Mai)",
          referenceCode: "EXP-001", totalAmount: 890, paidAmount: 0,
          discountAmount: 0, interestAmount: 0, remainingAmount: 890,
          dueDate: daysAgo(40), createdById: owner.id,
        },
        // Pagas — histórico
        {
          organizationId: org.id, accountId: account.id, categoryId: catIncome.id,
          module: SystemModule.FINANCE, kind: "RECEIVABLE", direction: "INCOME",
          status: "PAID", description: "Fechamento Bilhar — Lanchonete Central",
          referenceCode: "REC-010", totalAmount: 2700, paidAmount: 2700,
          discountAmount: 0, interestAmount: 0, remainingAmount: 0,
          paymentMethod: "PIX", paidAt: daysAgo(5), createdById: owner.id,
        },
        {
          organizationId: org.id, accountId: account.id, categoryId: catIncome.id,
          module: SystemModule.FINANCE, kind: "RECEIVABLE", direction: "INCOME",
          status: "PAID", description: "Pelúcia — Parque Kids (Jun)",
          referenceCode: "REC-011", totalAmount: 1850, paidAmount: 1850,
          discountAmount: 0, interestAmount: 0, remainingAmount: 0,
          paymentMethod: "PIX", paidAt: daysAgo(8), createdById: owner.id,
        },
        {
          organizationId: org.id, accountId: account.id, categoryId: catIncome.id,
          module: SystemModule.FINANCE, kind: "RECEIVABLE", direction: "INCOME",
          status: "PAID", description: "H Caça-níquel — Bar do Chico",
          referenceCode: "REC-012", totalAmount: 4100, paidAmount: 4100,
          discountAmount: 0, interestAmount: 0, remainingAmount: 0,
          paymentMethod: "CASH", paidAt: daysAgo(3), createdById: owner.id,
        },
      ],
    });
  }

  // ── BILHAR ───────────────────────────────────────────────────────────────────
  const billiardPoints = await Promise.all([
    prisma.billiardPoint.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "BP001" } },
      update: {},
      create: {
        organizationId: org.id, code: "BP001", registrationNumber: 1,
        name: "Bar do Zé", clientName: "José Aparecido",
        phone: "(11) 98111-0001", city: "São Paulo", state: "SP",
        chipValue: 0.25, routeNumber: 1, createdById: owner.id,
      },
    }),
    prisma.billiardPoint.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "BP002" } },
      update: {},
      create: {
        organizationId: org.id, code: "BP002", registrationNumber: 2,
        name: "Lanchonete Central", clientName: "Marcos Oliveira",
        phone: "(11) 98111-0002", city: "Guarulhos", state: "SP",
        chipValue: 0.25, routeNumber: 1, createdById: owner.id,
      },
    }),
    prisma.billiardPoint.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "BP003" } },
      update: {},
      create: {
        organizationId: org.id, code: "BP003", registrationNumber: 3,
        name: "Snooker Premium", clientName: "Carlos Henrique",
        phone: "(11) 98111-0003", city: "Santo André", state: "SP",
        chipValue: 0.50, routeNumber: 2, createdById: owner.id,
      },
    }),
    prisma.billiardPoint.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "BP004" } },
      update: {},
      create: {
        organizationId: org.id, code: "BP004", registrationNumber: 4,
        name: "Boteco do Nelson", clientName: "Nelson Ferreira",
        phone: "(11) 98111-0004", city: "São Paulo", state: "SP",
        chipValue: 0.25, routeNumber: 2, createdById: owner.id,
      },
    }),
    prisma.billiardPoint.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "BP005" } },
      update: {},
      create: {
        organizationId: org.id, code: "BP005", registrationNumber: 5,
        name: "Bar e Mercearia Dias", clientName: "Antônio Dias",
        phone: "(11) 98111-0005", city: "Mogi das Cruzes", state: "SP",
        chipValue: 0.25, routeNumber: 3, createdById: owner.id,
      },
    }),
  ]);

  const collectionsCount = await prisma.billiardCollection.count({ where: { organizationId: org.id } });
  if (collectionsCount === 0) {
    for (const [i, bp] of billiardPoints.entries()) {
      await prisma.billiardCollection.createMany({
        data: [
          {
            organizationId: org.id, billiardPointId: bp.id,
            collectionDate: daysAgo(3 + i * 2),
            quantityOfChips: 800 + i * 120, grossAmount: 200 + i * 30,
            percentage: 50, createdById: staff.id,
          },
          {
            organizationId: org.id, billiardPointId: bp.id,
            collectionDate: daysAgo(17 + i * 2),
            quantityOfChips: 650 + i * 100, grossAmount: 162 + i * 25,
            percentage: 50, createdById: staff.id,
          },
        ],
      });
    }
  }

  // ── PELÚCIA ──────────────────────────────────────────────────────────────────
  const plushMachines = await Promise.all([
    prisma.plushMachine.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "PLU001" } },
      update: {},
      create: {
        organizationId: org.id, code: "PLU001", name: "Shopping Norte",
        clientName: "Shopping Norte SA", phone: "(11) 3111-0001",
        machineNumber: "MQ01", coinPhotoRule: true, giftPhotoRule: true,
      },
    }),
    prisma.plushMachine.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "PLU002" } },
      update: {},
      create: {
        organizationId: org.id, code: "PLU002", name: "Supermercado Extra",
        clientName: "Supermercado Extra Ltda", phone: "(11) 3111-0002",
        machineNumber: "MQ02", coinPhotoRule: true, giftPhotoRule: false,
      },
    }),
    prisma.plushMachine.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "PLU003" } },
      update: {},
      create: {
        organizationId: org.id, code: "PLU003", name: "Parque Kids",
        clientName: "Parque Kids Entretenimento", phone: "(11) 3111-0003",
        machineNumber: "MQ03", coinPhotoRule: false, giftPhotoRule: true,
      },
    }),
    prisma.plushMachine.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "PLU004" } },
      update: {},
      create: {
        organizationId: org.id, code: "PLU004", name: "Mercadão Central",
        clientName: "Mercadão Central LTDA", phone: "(11) 3111-0004",
        machineNumber: "MQ04", coinPhotoRule: true, giftPhotoRule: true,
        active: true,
      },
    }),
  ]);

  const plushCount = await prisma.plushCollection.count({ where: { organizationId: org.id } });
  if (plushCount === 0) {
    for (const [i, pm] of plushMachines.entries()) {
      const gross = 1200 + i * 250;
      const commission = Math.round(gross * 0.25 * 100) / 100;
      await prisma.plushCollection.createMany({
        data: [
          {
            organizationId: org.id, plushMachineId: pm.id,
            grossAmount: gross, commissionPercentage: 25,
            clientAmount: commission, companyAmount: gross - commission,
            plushCountOut: 8 + i, compensationStatus: "WORTH_IT",
            paymentMethod: "PIX", createdById: staff.id,
          },
          {
            organizationId: org.id, plushMachineId: pm.id,
            grossAmount: gross - 200, commissionPercentage: 25,
            clientAmount: Math.round((gross - 200) * 0.25), companyAmount: Math.round((gross - 200) * 0.75),
            plushCountOut: 5 + i, compensationStatus: i % 2 === 0 ? "WORTH_IT" : "NOT_WORTH_IT",
            paymentMethod: "CASH", createdById: staff.id,
          },
        ],
      });
    }
  }

  // ── H / CAÇA-NÍQUEL ──────────────────────────────────────────────────────────
  const slotMachines = await Promise.all([
    prisma.slotMachine.upsert({
      where: { organizationId_uniqueMachineNumber: { organizationId: org.id, uniqueMachineNumber: "SLT001" } },
      update: {},
      create: {
        organizationId: org.id, uniqueMachineNumber: "SLT001", clientSequenceNumber: "01",
        clientName: "Bar do Chico", phone: "(11) 98222-0001",
        city: "São Paulo", state: "SP", ppValue: 50, active: true,
      },
    }),
    prisma.slotMachine.upsert({
      where: { organizationId_uniqueMachineNumber: { organizationId: org.id, uniqueMachineNumber: "SLT002" } },
      update: {},
      create: {
        organizationId: org.id, uniqueMachineNumber: "SLT002", clientSequenceNumber: "01",
        clientName: "Boteco Paulista", phone: "(11) 98222-0002",
        city: "Guarulhos", state: "SP", ppValue: 50, active: true,
      },
    }),
    prisma.slotMachine.upsert({
      where: { organizationId_uniqueMachineNumber: { organizationId: org.id, uniqueMachineNumber: "SLT003" } },
      update: {},
      create: {
        organizationId: org.id, uniqueMachineNumber: "SLT003", clientSequenceNumber: "01",
        clientName: "Mercearia Silva", phone: "(11) 98222-0003",
        city: "Santo André", state: "SP", ppValue: 50, active: true,
      },
    }),
  ]);

  const slotCount = await prisma.slotCollection.count({ where: { organizationId: org.id } });
  if (slotCount === 0) {
    for (const [i, sm] of slotMachines.entries()) {
      await prisma.slotCollection.createMany({
        data: [
          {
            organizationId: org.id, slotMachineId: sm.id,
            occurredAt: daysAgo(4 + i),
            currentIncome: 8500 + i * 500, previousIncome: 7800 + i * 400,
            incomeDifference: 700 + i * 100,
            currentExpense: 3200 + i * 200, previousExpense: 2900 + i * 150,
            expenseDifference: 300 + i * 50,
            percentageSplit: 50, conferenceCount: 10 + i,
            paymentMethod: "CASH", createdById: staff.id,
          },
          {
            organizationId: org.id, slotMachineId: sm.id,
            occurredAt: daysAgo(19 + i),
            currentIncome: 7800 + i * 400, previousIncome: 7100 + i * 300,
            incomeDifference: 700 + i * 100,
            currentExpense: 2900 + i * 150, previousExpense: 2600 + i * 100,
            expenseDifference: 300 + i * 50,
            percentageSplit: 50, conferenceCount: 9 + i,
            paymentMethod: "CASH", createdById: staff.id,
          },
        ],
      });
    }
  }

  // ── BX ───────────────────────────────────────────────────────────────────────
  const bxCount = await prisma.bxTransaction.count({ where: { organizationId: org.id } });
  if (bxCount === 0) {
    await prisma.bxTransaction.createMany({
      data: [
        {
          organizationId: org.id, clientName: "Roberto Almeida",
          phone: "(11) 97333-0001", occurredAt: daysAgo(2),
          agentName: "João Silva", receiverName: "Pedro Costa",
          sentToAgentAmount: 500, deliveredAmount: 498,
          incomeAmount: 498, expenseAmount: 2, totalAmount: 498,
          receiptStatus: "RECEIVED", createdById: staff.id,
        },
        {
          organizationId: org.id, clientName: "Ana Paula Souza",
          phone: "(11) 97333-0002", occurredAt: daysAgo(5),
          agentName: "João Silva", receiverName: "Maria Fernanda",
          sentToAgentAmount: 1200, deliveredAmount: 1195,
          incomeAmount: 1195, expenseAmount: 5, totalAmount: 1195,
          receiptStatus: "RECEIVED", createdById: staff.id,
        },
        {
          organizationId: org.id, clientName: "Marcos Rodrigues",
          phone: "(11) 97333-0003", occurredAt: daysAgo(9),
          agentName: "Carlos", receiverName: "João Silva",
          sentToAgentAmount: 350, deliveredAmount: 348,
          incomeAmount: 348, expenseAmount: 2, totalAmount: 348,
          receiptStatus: "NOT_RECEIVED", createdById: staff.id,
        },
        {
          organizationId: org.id, clientName: "Luciana Martins",
          phone: "(11) 97333-0004", occurredAt: daysAgo(1),
          agentName: "João Silva", receiverName: "Carlos",
          sentToAgentAmount: 800, deliveredAmount: 798,
          incomeAmount: 798, expenseAmount: 2, totalAmount: 798,
          receiptStatus: "RECEIVED", createdById: owner.id,
        },
      ],
    });
  }

  // ── CARRETA KIDS ──────────────────────────────────────────────────────────────
  const carretaCount = await prisma.carretaKidsRecord.count({ where: { organizationId: org.id } });
  if (carretaCount === 0) {
    await prisma.carretaKidsRecord.createMany({
      data: [
        {
          organizationId: org.id, locationName: "Festa da Maria Clara",
          sheetName: "Maria Clara Santos", phone: "(11) 96444-0001",
          serviceDate: daysAgo(1), entryTime: "14:00", exitTime: "16:30",
          minutesCharged: 150, tablePrice: 30, totalAmount: 75,
          paymentMethod: "PIX", createdById: staff.id,
        },
        {
          organizationId: org.id, locationName: "Aniversário João Pedro",
          sheetName: "Família Pereira", phone: "(11) 96444-0002",
          serviceDate: daysAgo(4), entryTime: "10:00", exitTime: "12:00",
          minutesCharged: 120, tablePrice: 30, totalAmount: 60,
          paymentMethod: "CASH", createdById: staff.id,
        },
        {
          organizationId: org.id, locationName: "Parque Municipal",
          sheetName: "Evento Público", phone: "(11) 96444-0003",
          serviceDate: daysAgo(7), entryTime: "09:00", exitTime: "17:00",
          minutesCharged: 480, tablePrice: 30, totalAmount: 240,
          paymentMethod: "PIX", createdById: owner.id,
        },
      ],
    });
  }

  // ── LOCAÇÃO ───────────────────────────────────────────────────────────────────
  const rentalCount = await prisma.rentalOrder.count({ where: { organizationId: org.id } });
  if (rentalCount === 0) {
    await prisma.rentalOrder.createMany({
      data: [
        {
          organizationId: org.id, clientName: "Empresa XYZ Eventos",
          phone: "(11) 95555-0001", document: "12.345.678/0001-99",
          localName: "Espaço Festivo Central", eventDate: daysAgo(-5), // futuro
          totalAmount: 4500, signalPercentage: 30, signalAmount: 1350,
          balanceAmount: 3150, paymentMethod: "PIX",
          paymentStatus: "PARTIAL", status: "CONFIRMED",
          contractNumber: "LOC-2026-001", createdById: owner.id,
        },
        {
          organizationId: org.id, clientName: "Ricardo Nogueira",
          phone: "(11) 95555-0002", document: "123.456.789-00",
          localName: "Salão de Festas Vila Nova", eventDate: daysAgo(10),
          totalAmount: 2800, signalPercentage: 50, signalAmount: 1400,
          balanceAmount: 0, paymentMethod: "CASH",
          paymentStatus: "PAID", status: "COMPLETED",
          contractNumber: "LOC-2026-002", createdById: owner.id,
        },
      ],
    });
  }

  // ── VISITAS (FieldVisit) ──────────────────────────────────────────────────────
  const visitCount = await prisma.fieldVisit.count({ where: { organizationId: org.id } });
  if (visitCount === 0) {
    // Visitas recentes (últimos 7 dias) para a aba Equipe
    const recentVisits = [
      { targetId: billiardPoints[0].id, visitType: "BILLIARD" as const, daysAgo_n: 1, income: 200, who: staff.id, clientName: "Bar do Zé" },
      { targetId: billiardPoints[1].id, visitType: "BILLIARD" as const, daysAgo_n: 2, income: 180, who: staff.id, clientName: "Lanchonete Central" },
      { targetId: billiardPoints[2].id, visitType: "BILLIARD" as const, daysAgo_n: 3, income: 210, who: staff.id, clientName: "Snooker Premium" },
      { targetId: plushMachines[0].id, visitType: "PLUSH" as const, daysAgo_n: 1, income: 900, who: staff.id, clientName: "Shopping Norte" },
      { targetId: plushMachines[1].id, visitType: "PLUSH" as const, daysAgo_n: 4, income: 750, who: staff.id, clientName: "Supermercado Extra" },
      { targetId: slotMachines[0].id, visitType: "SLOT_H" as const, daysAgo_n: 3, income: 350, who: owner.id, clientName: "Bar do Chico" },
      { targetId: slotMachines[1].id, visitType: "SLOT_H" as const, daysAgo_n: 5, income: 420, who: staff.id, clientName: "Boteco Paulista" },
    ];

    for (const v of recentVisits) {
      await prisma.fieldVisit.create({
        data: {
          organizationId: org.id, targetId: v.targetId, createdById: v.who,
          visitType: v.visitType, occurredAt: daysAgo(v.daysAgo_n),
          clientName: v.clientName, checkedItems: [],
          incomeAmount: v.income, expenseAmount: 0,
        },
      });
    }

    // Visitas ANTIGAS (+20 dias) — os pontos abaixo aparecem no alerta +15 dias
    const oldVisits = [
      { targetId: billiardPoints[3].id, visitType: "BILLIARD" as const, daysAgo_n: 22, clientName: "Boteco do Nelson" },
      { targetId: billiardPoints[4].id, visitType: "BILLIARD" as const, daysAgo_n: 28, clientName: "Bar Mercearia Dias" },
      { targetId: plushMachines[2].id, visitType: "PLUSH" as const, daysAgo_n: 20, clientName: "Parque Kids" },
      { targetId: slotMachines[2].id, visitType: "SLOT_H" as const, daysAgo_n: 25, clientName: "Mercearia Silva" },
    ];

    for (const v of oldVisits) {
      await prisma.fieldVisit.create({
        data: {
          organizationId: org.id, targetId: v.targetId, createdById: staff.id,
          visitType: v.visitType, occurredAt: daysAgo(v.daysAgo_n),
          clientName: v.clientName, checkedItems: [], incomeAmount: 0, expenseAmount: 0,
        },
      });
    }
  }

  console.log("\n✅ Seed concluído!");
  console.log("─────────────────────────────────────────────");
  console.log("Login dono   : laudemir@lmgestao.local / Admin@12345");
  console.log("Login staff  : joao@lmgestao.local  / Staff@12345");
  console.log("─────────────────────────────────────────────");
  console.log("Dados criados:");
  console.log("  • 5 pontos de Bilhar + 10 coletas");
  console.log("  • 4 máquinas de Pelúcia + 8 coletas");
  console.log("  • 3 máquinas H/Caça-níquel + 6 coletas");
  console.log("  • 4 transações BX");
  console.log("  • 3 registros Carreta Kids");
  console.log("  • 2 ordens de Locação");
  console.log("  • 11 visitas (7 recentes + 4 com +20 dias → alerta)");
  console.log("  • 6 entradas financeiras (3 OVERDUE → alerta)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
