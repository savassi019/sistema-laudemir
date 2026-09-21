import "dotenv/config";

import { prisma } from "../src/lib/prisma";

function money(value: unknown) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

async function main() {
  const pendingCollections = await prisma.slotCollection.findMany({
    where: {
      finalCustomerDebt: null,
      OR: [
        { customerDebtDiscounted: { gt: 0 } },
        { generatedDebtAmount: { gt: 0 } },
      ],
    },
    select: { slotMachineId: true },
    distinct: ["slotMachineId"],
  });
  const machineIds = pendingCollections.map((item) => item.slotMachineId);

  if (machineIds.length === 0) {
    console.log("Modulo H: nenhum saldo antigo precisa de correcao.");
    return;
  }

  const machines = await prisma.slotMachine.findMany({
    where: { id: { in: machineIds } },
    include: {
      collections: {
        where: { finalCustomerDebt: null },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  const preview = machines.map((machine) => {
    const debtMovement = money(
      machine.collections.reduce(
        (sum, collection) =>
          sum +
          money(collection.generatedDebtAmount) -
          money(collection.customerDebtDiscounted),
        0,
      ),
    );
    const previousBalance = money(machine.customerDebt);
    return {
      machineId: machine.id,
      organizationId: machine.organizationId,
      previousBalance,
      correctedBalance: Math.max(money(previousBalance + debtMovement), 0),
      debtMovement,
      collections: machine.collections,
    };
  });

  console.log(
    JSON.stringify({
      machines: preview.length,
      previousTotal: money(preview.reduce((sum, item) => sum + item.previousBalance, 0)),
      correctedTotal: money(preview.reduce((sum, item) => sum + item.correctedBalance, 0)),
    }),
  );

  if (!process.argv.includes("--apply")) {
    console.log("Simulacao concluida. Use --apply somente depois de confirmar o backup.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of preview) {
        let runningFinalBalance = item.correctedBalance;
        const snapshots: Array<{ id: string; previous: number; final: number }> = [];

        for (const collection of [...item.collections].reverse()) {
          const movement = money(
            money(collection.generatedDebtAmount) -
              money(collection.customerDebtDiscounted),
          );
          const finalBalance = runningFinalBalance;
          const previousBalance = money(finalBalance - movement);
          snapshots.push({ id: collection.id, previous: previousBalance, final: finalBalance });
          runningFinalBalance = previousBalance;
        }

        await tx.slotMachine.update({
          where: { id: item.machineId },
          data: { customerDebt: item.correctedBalance },
        });
        for (const snapshot of snapshots) {
          await tx.slotCollection.update({
            where: { id: snapshot.id },
            data: {
              previousCustomerDebt: snapshot.previous,
              finalCustomerDebt: snapshot.final,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            organizationId: item.organizationId,
            module: "SLOT_H",
            action: "SLOT_DEBT_BALANCE_BACKFILLED",
            entityType: "SLOT_COLLECTION",
            entityId: item.machineId,
            oldData: { customerDebt: item.previousBalance },
            newData: {
              customerDebt: item.correctedBalance,
              collectionIds: snapshots.map((snapshot) => snapshot.id),
            },
          },
        });
      }
    },
    { maxWait: 5_000, timeout: 30_000 },
  );

  console.log("Modulo H: saldos antigos corrigidos e auditados com sucesso.");
}

main()
  .catch((error) => {
    console.error("Modulo H: falha ao corrigir saldos antigos.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
