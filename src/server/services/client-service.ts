import { Prisma } from "@prisma/client";

import { demoClients } from "@/data/demo";
import { prisma } from "@/lib/prisma";
import type { ClientListItem } from "@/types/app";

export async function listClients(): Promise<ClientListItem[]> {
  if (process.env.DEMO_MODE !== "false") {
    return demoClients;
  }

  try {
    const clients = await prisma.client.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        financialItems: {
          where: {
            status: {
              in: ["PENDING", "PARTIAL", "OVERDUE"],
            },
          },
        },
      },
    });

    return clients.map((client) => ({
      id: client.id,
      code: client.code,
      name: client.name,
      phone: client.phone ?? "-",
      city: client.city ?? "-",
      status:
        client.status === "ACTIVE"
          ? "ativo"
          : client.status === "INACTIVE"
            ? "inativo"
            : client.status === "DELINQUENT"
              ? "inadimplente"
              : "excecao",
      balance: client.financialItems.reduce(
        (sum, item) => sum + Number(item.remainingAmount),
        0,
      ),
      updatedAt: client.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return demoClients;
    }

    return demoClients;
  }
}
