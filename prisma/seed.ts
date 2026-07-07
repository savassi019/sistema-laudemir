import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, SystemModule, UserRole } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "svs-demo" },
    update: {},
    create: {
      name: "SVS Demo Operacoes",
      slug: "svs-demo",
      legalName: "SVS Demo Operacoes Ltda",
      phone: "(11) 99999-9999",
      email: "contato@svs-demo.local",
    },
  });

  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const owner = await prisma.user.upsert({
    where: { email: "admin@svs-demo.local" },
    update: {
      name: "Administrador Demo",
      passwordHash,
      organizationId: organization.id,
      role: UserRole.OWNER,
    },
    create: {
      organizationId: organization.id,
      role: UserRole.OWNER,
      name: "Administrador Demo",
      email: "admin@svs-demo.local",
      phone: "(11) 99999-0000",
      passwordHash,
    },
  });

  const allModules = Object.values(SystemModule).map((module) => ({
    organizationId: organization.id,
    userId: owner.id,
    module,
    canView: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canApprove: true,
    canExport: true,
  }));

  await prisma.modulePermission.deleteMany({
    where: { organizationId: organization.id, userId: owner.id },
  });

  await prisma.modulePermission.createMany({
    data: allModules,
  });

  await prisma.systemSetting.upsert({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: "carreta_kids_price_table",
      },
    },
    update: {
      value: {
        "15": 20,
        "30": 30,
        "60": 40,
      },
    },
    create: {
      organizationId: organization.id,
      module: SystemModule.CARRETA_KIDS,
      key: "carreta_kids_price_table",
      value: {
        "15": 20,
        "30": 30,
        "60": 40,
      },
    },
  });

  await prisma.systemSetting.upsert({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: "default_rules",
      },
    },
    update: {
      value: {
        plushCommissionPercentage: 25,
        slotSplitPercentage: 50,
        billiardClothAlertAt: 1500,
      },
    },
    create: {
      organizationId: organization.id,
      key: "default_rules",
      value: {
        plushCommissionPercentage: 25,
        slotSplitPercentage: 50,
        billiardClothAlertAt: 1500,
      },
    },
  });

  const account = await prisma.financialAccount.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Caixa Operacional",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Caixa Operacional",
      description: "Conta principal para receitas e despesas operacionais.",
    },
  });

  const incomeCategory = await prisma.financialCategory.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Receita de Servico",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Receita de Servico",
      direction: "INCOME",
      module: SystemModule.FINANCE,
    },
  });

  const expenseCategory = await prisma.financialCategory.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Despesa Operacional",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Despesa Operacional",
      direction: "EXPENSE",
      module: SystemModule.FINANCE,
    },
  });

  const existingClients = await prisma.client.count({
    where: { organizationId: organization.id },
  });

  if (existingClients === 0) {
    await prisma.client.createMany({
      data: [
        {
          organizationId: organization.id,
          code: "CLI-0001",
          name: "Carlos Henrique",
          phone: "(11) 98888-1111",
          cpf: "000.000.000-00",
          city: "Sao Paulo",
          state: "SP",
          status: "ACTIVE",
          createdById: owner.id,
        },
        {
          organizationId: organization.id,
          code: "CLI-0002",
          name: "Loja Central Kids",
          personType: "COMPANY",
          phone: "(11) 97777-2222",
          cnpj: "00.000.000/0001-00",
          city: "Guarulhos",
          state: "SP",
          status: "DELINQUENT",
          createdById: owner.id,
        },
      ],
    });
  }

  const firstClient = await prisma.client.findFirst({
    where: { organizationId: organization.id },
  });

  const entriesCount = await prisma.financialEntry.count({
    where: { organizationId: organization.id },
  });

  if (entriesCount === 0 && firstClient) {
    await prisma.financialEntry.createMany({
      data: [
        {
          organizationId: organization.id,
          clientId: firstClient.id,
          accountId: account.id,
          categoryId: incomeCategory.id,
          module: SystemModule.FINANCE,
          kind: "RECEIVABLE",
          direction: "INCOME",
          status: "PAID",
          description: "Recebimento de fechamento quinzenal",
          referenceCode: "FIN-0001",
          totalAmount: 2400,
          paidAmount: 2400,
          discountAmount: 0,
          interestAmount: 0,
          remainingAmount: 0,
          paymentMethod: "PIX",
          createdById: owner.id,
          paidAt: new Date(),
        },
        {
          organizationId: organization.id,
          accountId: account.id,
          categoryId: expenseCategory.id,
          module: SystemModule.FINANCE,
          kind: "EXPENSE",
          direction: "EXPENSE",
          status: "PARTIAL",
          description: "Compra de pecas e manutencao",
          referenceCode: "FIN-0002",
          totalAmount: 1350,
          paidAmount: 800,
          discountAmount: 0,
          interestAmount: 0,
          remainingAmount: 550,
          paymentMethod: "BANK_TRANSFER",
          createdById: owner.id,
        },
      ],
    });
  }

  console.log("Seed executado com sucesso.");
  console.log("Login demo: admin@svs-demo.local / Admin@12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
