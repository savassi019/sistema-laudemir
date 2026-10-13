import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

const command = process.argv[2];
const runId = process.argv[3];
const password = process.env.SMOKE_PASSWORD;

if (!command || !runId || !/^[a-z0-9-]{4,40}$/.test(runId)) {
  throw new Error("Uso: tsx scripts/prepare-role-smoke.ts <create|cleanup> <run-id>");
}

const emails = {
  owner: `${runId}-owner@smoke.infinity.local`,
  admin: `${runId}-admin@smoke.infinity.local`,
  staff: `${runId}-staff@smoke.infinity.local`,
  operator: `${runId}-operator@smoke.infinity.local`,
};
const usernames = {
  owner: `${runId}-owner`,
  admin: `${runId}-admin`,
  staff: `${runId}-staff`,
  operator: `${runId}-operator`,
};
const organizationSlug = `smoke-${runId}`;
const operationalModules = [
  "CARRETA_KIDS",
  "RENTAL",
  "PLUSH",
  "BILLIARD",
  "BRASIL_BETS",
  "MACHINE",
  "CONDOMINIUM_MARKET",
  "MARKETING",
  "PERSONAL_FINANCE",
  "BX",
  "SLOT_H",
] as const;

async function main() {
  if (command === "cleanup") {
    const organizations = await prisma.organization.findMany({
      where: { slug: organizationSlug },
      select: { id: true },
    });
    const organizationIds = organizations.map((organization) => organization.id);
    if (organizationIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        // A relacao com o funcionario e RESTRICT para preservar historico em
        // producao. No tenant descartavel do smoke, removemos o caixa antes.
        await tx.employeeDailyCash.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await tx.organization.deleteMany({ where: { id: { in: organizationIds } } });
      });
    }
    console.log(JSON.stringify({
      cleanedOrganizations: organizationIds.length,
      organizationSlug,
      organizationIds,
    }));
    return;
  }
  if (command !== "create") throw new Error("Comando deve ser create ou cleanup.");
  if (!password || password.length < 12) {
    throw new Error("Defina SMOKE_PASSWORD com pelo menos 12 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const organizationId = await prisma.$transaction(async (tx) => {
    const previousOrganizations = await tx.organization.findMany({
      where: { slug: organizationSlug },
      select: { id: true },
    });
    const previousOrganizationIds = previousOrganizations.map((organization) => organization.id);
    if (previousOrganizationIds.length > 0) {
      await tx.employeeDailyCash.deleteMany({
        where: { organizationId: { in: previousOrganizationIds } },
      });
      await tx.organization.deleteMany({ where: { id: { in: previousOrganizationIds } } });
    }
    const organization = await tx.organization.create({
      data: { name: `Teste automatizado ${runId}`, slug: organizationSlug },
    });
    await tx.user.create({
      data: {
        organizationId: organization.id,
        role: "OWNER",
        status: "ACTIVE",
        name: "Teste Mobile Dono",
        username: usernames.owner,
        email: emails.owner,
        passwordHash,
      },
    });
    for (const [role, email, username] of [["ADMIN", emails.admin, usernames.admin], ["STAFF", emails.staff, usernames.staff]] as const) {
      // Os dois perfis recebem apenas BX para o teste provar que a permissao
      // por modulo realmente bloqueia as demais unidades de negocio.
      const allowedModules = operationalModules.filter((module) => module === "BX");
      await tx.user.create({
        data: {
          organizationId: organization.id,
          role,
          status: "ACTIVE",
          name: `Teste Mobile ${role}`,
          username,
          email,
          passwordHash,
          modulePermissions: {
            create: allowedModules.map((module) => ({
              organizationId: organization.id,
              module,
              canView: true,
              canCreate: true,
              canUpdate: role === "ADMIN",
              canDelete: false,
              canApprove: role === "ADMIN",
              canExport: role === "ADMIN",
            })),
          },
        },
      });
    }
    await tx.user.create({
      data: {
        organizationId: organization.id,
        role: "STAFF",
        status: "ACTIVE",
        name: "Teste Mobile Operador",
        username: usernames.operator,
        email: emails.operator,
        passwordHash,
        modulePermissions: {
          create: operationalModules.map((module) => ({
            organizationId: organization.id,
            module,
            canView: true,
            canCreate: true,
            canUpdate: false,
            canDelete: false,
            canApprove: false,
            canExport: false,
          })),
        },
      },
    });
    return organization.id;
  });

  console.log(JSON.stringify({ created: 4, organizationId, organizationSlug, usernames }));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
