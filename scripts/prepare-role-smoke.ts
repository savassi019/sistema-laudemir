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
};
const usernames = {
  owner: `${runId}-owner`,
  admin: `${runId}-admin`,
  staff: `${runId}-staff`,
};

async function main() {
  if (command === "cleanup") {
    const deleted = await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    console.log(JSON.stringify({ cleaned: deleted.count, emails }));
    return;
  }
  if (command !== "create") throw new Error("Comando deve ser create ou cleanup.");
  if (!password || password.length < 12) {
    throw new Error("Defina SMOKE_PASSWORD com pelo menos 12 caracteres.");
  }

  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) throw new Error("Nenhuma organizacao encontrada.");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
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
            create: {
              organizationId: organization.id,
              module: "BX",
              canView: true,
              canCreate: true,
              canUpdate: role === "ADMIN",
              canDelete: false,
              canApprove: role === "ADMIN",
              canExport: role === "ADMIN",
            },
          },
        },
      });
    }
  });

  console.log(JSON.stringify({ created: 3, organizationId: organization.id, usernames }));
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
