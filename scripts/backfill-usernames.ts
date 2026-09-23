import "dotenv/config";

import { prisma } from "../src/lib/prisma";

function baseUsername(email: string, id: string) {
  const localPart = (email.split("@")[0] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .slice(0, 32);
  if (localPart.length >= 3) return localPart;
  return `usuario-${id.slice(-8).toLowerCase()}`;
}

function uniqueUsername(base: string, used: Set<string>) {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (true) {
    const text = String(suffix);
    const candidate = `${base.slice(0, 32 - text.length)}${text}`;
    if (!used.has(candidate)) return candidate;
    suffix += 1;
  }
}

function clientKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, email: true, username: true },
  });
  const used = new Set(
    users.flatMap((user) => (user.username ? [user.username.toLowerCase()] : [])),
  );
  let updated = 0;

  for (const user of users) {
    if (user.username) continue;
    const username = uniqueUsername(baseUsername(user.email, user.id), used);
    await prisma.user.update({ where: { id: user.id }, data: { username } });
    used.add(username);
    updated += 1;
  }

  const [bxRecords, carretaRecords, rentalOrders] = await Promise.all([
    prisma.bxTransaction.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.carretaKidsRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rentalOrder.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  for (const record of bxRecords) {
    const nameKey = clientKey(record.clientName);
    if (!nameKey) continue;
    await prisma.bxClient.upsert({
      where: { organizationId_nameKey: { organizationId: record.organizationId, nameKey } },
      create: {
        organizationId: record.organizationId,
        createdById: record.createdById,
        nameKey,
        clientName: record.clientName,
        phone: record.phone,
        cpf: record.cpf,
        cep: record.cep,
        street: record.street,
        neighborhood: record.neighborhood,
        city: record.city,
        state: record.state,
        exceptionClient: record.exceptionClient,
      },
      update: {
        clientName: record.clientName,
        phone: record.phone,
        cpf: record.cpf,
        cep: record.cep,
        street: record.street,
        neighborhood: record.neighborhood,
        city: record.city,
        state: record.state,
        exceptionClient: record.exceptionClient,
      },
    });
  }

  for (const record of carretaRecords) {
    const nameKey = clientKey(record.sheetName);
    if (!nameKey) continue;
    await prisma.carretaKidsClient.upsert({
      where: { organizationId_nameKey: { organizationId: record.organizationId, nameKey } },
      create: {
        organizationId: record.organizationId,
        createdById: record.createdById,
        nameKey,
        locationName: record.locationName,
        sheetName: record.sheetName,
        phone: record.phone,
      },
      update: {
        locationName: record.locationName,
        sheetName: record.sheetName,
        phone: record.phone,
      },
    });
  }

  for (const record of rentalOrders) {
    if (!record.clientName?.trim()) continue;
    const nameKey = clientKey(record.clientName);
    await prisma.rentalClient.upsert({
      where: { organizationId_nameKey: { organizationId: record.organizationId, nameKey } },
      create: {
        organizationId: record.organizationId,
        createdById: record.createdById,
        nameKey,
        clientName: record.clientName,
        phone: record.phone,
        document: record.document,
        localName: record.localName,
      },
      update: {
        clientName: record.clientName,
        phone: record.phone,
        document: record.document,
        localName: record.localName,
      },
    });
  }

  console.log(JSON.stringify({
    users: users.length,
    usernamesAdded: updated,
    bxClientsProcessed: bxRecords.length,
    carretaClientsProcessed: carretaRecords.length,
    rentalClientsProcessed: rentalOrders.length,
  }));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
