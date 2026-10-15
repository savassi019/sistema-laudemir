import { randomUUID } from "crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { clickAfterHydration, loginByApi } from "./helpers/auth";

const runId = process.env.E2E_SMOKE_RUN_ID;
const password = process.env.E2E_SMOKE_PASSWORD;

const moduleSlugs = [
  "carreta-kids",
  "maquinas-de-pelucia",
  "bilhar-pebolim",
  "bx",
  "h-caca-niquel",
  "credito-financeiro",
  "mercado-autonomo",
  "marketing",
  "plataforma-online",
  "locacao",
  "financas-pessoais",
] as const;

const fieldModules = [
  "bilhar-pebolim",
  "maquinas-de-pelucia",
  "bx",
  "h-caca-niquel",
  "carreta-kids",
  "locacao",
] as const;

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function businessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function upload(request: APIRequestContext, category: "PHOTO" | "PROOF" | "CONTRACT", name: string) {
  const response = await request.post("/api/upload", {
    multipart: {
      category,
      file: { name, mimeType: "image/png", buffer: onePixelPng },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { id?: string };
  expect(body.id).toBeTruthy();
  return body.id!;
}

async function assertMobilePage(page: Page, slug: string, expectEmployeeCash: boolean) {
  const response = await page.goto(`/modulos/${slug}`);
  expect(response?.status(), `${slug} nao abriu`).toBe(200);
  await expect(page.getByRole("link", { name: /M.dulos/i }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  await expect(page.getByText(/Servidor temporariamente indispon.vel/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Gastos da equipe/i })).toHaveCount(
    expectEmployeeCash ? 1 : 0,
  );
}

function operationPayloads(date: string, suffix: string, files: Record<string, string>) {
  return {
    "carreta-kids": {
      expectedTitle: `Local Carreta ${suffix}`,
      data: {
        localName: `Local Carreta ${suffix}`,
        serviceDate: date,
        sheetName: `Ficha ${suffix}`,
        phone: "11999990001",
        minutesCharged: "15",
        paymentMethod: "PIX",
        entryTime: "10:00",
        exitTime: "10:15",
        expenseAmount: 2,
        notes: "Regressao completa",
      },
    },
    "maquinas-de-pelucia": {
      expectedTitle: `GRUA ${suffix}`,
      data: {
        clientName: `Cliente GRUA ${suffix}`,
        phone: "11999990002",
        code: `GRUA-${suffix}`,
        name: `GRUA ${suffix}`,
        machineNumber: `M-${suffix}`,
        collectionDate: date,
        grossAmount: 100,
        commissionPercentage: 25,
        plushCountOut: 2,
        paymentMethod: "PIX",
        discountAmount: 3,
        ownerExpenseAmount: 5,
        compensationStatus: "WORTH_IT",
        coinPhotoFileId: files.coin,
        giftPhotoFileId: files.gift,
        notes: "Regressao completa",
      },
    },
    "bilhar-pebolim": {
      expectedTitle: `Ponto Bilhar ${suffix}`,
      data: {
        clientName: `Cliente Bilhar ${suffix}`,
        pointName: `Ponto Bilhar ${suffix}`,
        phone: "11999990003",
        city: "Sao Paulo",
        neighborhood: "Centro",
        state: "SP",
        tableModel: "Mesa teste",
        chipValue: 2,
        collectionDate: date,
        quantityOfChips: 50,
        accumulatedChips: 0,
        discountAmount: 5,
        roofChargeType: "FIXED",
        roofInstallmentAmount: 100,
        roofPaidAmount: 40,
        roofPaymentMethod: "PIX",
        structureCost: 0,
        employeeCost: 0,
        installationCost: 0,
        maintenanceCost: 0,
        otherCost: 0,
        routeNumber: 1,
        photoFileIds: [files.billiard],
        notes: "Saldo parcial do telhado",
      },
    },
    bx: {
      expectedTitle: `Cliente BX ${suffix}`,
      data: {
        clientName: `Cliente BX ${suffix}`,
        phone: "11999990004",
        city: "Sao Paulo",
        state: "SP",
        occurredAt: `${date}T12:00`,
        sentToAgentAmount: 100,
        deliveredAmount: 0,
        incomeAmount: 120,
        expenseAmount: 10,
        discountAmount: 5,
        customerDebt: 50,
        generatedDebtAmount: 30,
        paymentMethod: "PIX",
        receiptStatus: "NOT_RECEIVED",
        exceptionClient: false,
        screenPhotoFileId: files.bxScreen,
        paperPhotoFileId: files.bxPaper,
        notes: "Divida e fechamento de regressao",
      },
    },
    "h-caca-niquel": {
      expectedTitle: `Cliente H ${suffix}`,
      data: {
        newClient: true,
        clientName: `Cliente H ${suffix}`,
        phone: "11999990005",
        city: "Sao Paulo",
        state: "SP",
        initialAmountMode: "NONE",
        occurredAt: date,
        currentIncome: 1_000,
        previousIncome: 900,
        currentExpense: 400,
        previousExpense: 350,
        percentageSplit: 50,
        negativeAmount: 10,
        customerDebtDiscounted: 0,
        paymentMethod: "PIX",
        screenPhotoFileId: files.hScreen,
        notes: "Fechamento H de regressao",
      },
    },
    "credito-financeiro": {
      expectedTitle: `Credito ${suffix}`,
      data: {
        clientCode: `CRED-${suffix}`,
        clientName: `Credito ${suffix}`,
        amount: 1_000,
        contractDate: date,
        dueDate: "2027-12-31",
        year: 2026,
        monthlyInterest: 10,
        installmentsCount: 3,
        installmentFixed: true,
        guaranteeEnabled: false,
        signatureLink: "",
        signatureFileId: files.contract,
        expenseAmount: 20,
        paymentMethod: "PIX",
        status: "ACTIVE",
        notes: "Credito com baixa parcial",
      },
    },
    "mercado-autonomo": {
      expectedTitle: `Mercado ${suffix}`,
      data: {
        movementDate: date,
        description: `Mercado ${suffix}`,
        direction: "ENTRADA",
        amount: 200,
        expenseAmount: 10,
        paymentMethod: "PIX",
        notes: "Regressao completa",
      },
    },
    marketing: {
      expectedTitle: `Marketing ${suffix}`,
      data: {
        name: `Marketing ${suffix}`,
        personType: "PF",
        serviceType: "Gestao de redes",
        contractValue: 500,
        contractDate: date,
        phone: "11999990006",
        signatureLink: "",
        signatureFileId: files.marketingContract,
        expenseAmount: 25,
        paymentMethod: "PIX",
        contractFileId: files.marketingContract,
        status: "ACTIVE",
        notes: "Regressao completa",
      },
    },
    "plataforma-online": {
      expectedTitle: `Plataforma ${suffix}`,
      data: {
        movementDate: date,
        description: `Plataforma ${suffix}`,
        direction: "ENTRADA",
        status: "PAID",
        amount: 300,
        expenseAmount: 10,
        paymentMethod: "PIX",
        notes: "Regressao completa",
      },
    },
    locacao: {
      expectedTitle: `Locacao ${suffix}`,
      data: {
        clientName: `Locacao ${suffix}`,
        phone: "11999990007",
        localName: "Salao teste",
        eventDate: date,
        totalAmount: 500,
        signalEnabled: true,
        signalPercentage: 20,
        expenseAmount: 20,
        paymentMethod: "PIX",
        paymentStatus: "PARTIAL",
        contractNumber: `LOC-${suffix}`,
        notes: "Pagamento parcial",
      },
    },
    "financas-pessoais": {
      expectedTitle: `Pessoal ${suffix}`,
      data: {
        title: `Pessoal ${suffix}`,
        category: "Teste",
        type: "RECEITA",
        amount: 200,
        dueDate: date,
        paymentMethod: "PIX",
        notes: "Regressao completa",
      },
    },
  } as const;
}

test.describe("regressao completa de liberacao", () => {
  test.skip(!runId || !password, "Crie o tenant smoke e defina as credenciais E2E.");

  test("dono e funcionario autorizado abrem todos os modulos no celular", async ({ browser }) => {
    test.setTimeout(180_000);
    for (const username of [`${runId}-owner`, `${runId}-operator`]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await loginByApi(page, username, password!);
      for (const slug of moduleSlugs) {
        await assertMobilePage(page, slug, slug !== "marketing");
        if (username.endsWith("-operator")) {
          await expect(page.getByRole("button", { name: /^Financeiro/i })).toHaveCount(0);
        }
      }
      await context.close();
    }
  });

  test("funcionario cadastra contraparte nos seis modulos de campo", async ({ page }) => {
    test.setTimeout(180_000);
    await loginByApi(page, `${runId}-operator`, password!);
    for (const [index, slug] of fieldModules.entries()) {
      const clientName = `Cadastro ${slug} ${runId}`;
      await page.goto(`/modulos/${slug}`);
      await clickAfterHydration(
        page.getByRole("button", { name: /^Clientes/i }),
        page.getByRole("button", { name: "Novo", exact: true }),
      );
      await page.getByRole("button", { name: "Novo", exact: true }).click();
      await page.getByLabel("Nome do cliente", { exact: true }).fill(clientName);
      await page.getByLabel("Telefone", { exact: true }).fill(`1198888000${index}`);
      if (slug === "bilhar-pebolim") {
        await page.getByLabel("Nome do ponto", { exact: true }).fill(`Ponto ${runId}`);
      } else if (slug === "maquinas-de-pelucia") {
        await page.getByLabel(/Nome da m.quina/i).fill(`GRUA cadastro ${runId}`);
        await page.getByLabel(/N.mero da m.quina/i).fill(`CAD-${index}`);
      } else if (slug === "carreta-kids" || slug === "locacao") {
        await page.getByLabel(/Local de atendimento|Local padr.o/i).fill("Local de teste");
      }
      await page.getByRole("button", { name: "Salvar cliente", exact: true }).click();
      await expect(page.getByText("Cliente cadastrado.", { exact: true })).toBeVisible();
    }
  });

  test("executa operacao, anexos, divida, parcial e idempotencia em todos os modulos", async ({ page }) => {
    test.setTimeout(240_000);
    await loginByApi(page, `${runId}-operator`, password!);
    const suffix = `${runId}-${Date.now()}`.slice(-36);
    const files = {
      coin: await upload(page.request, "PHOTO", `${suffix}-moedas.png`),
      gift: await upload(page.request, "PHOTO", `${suffix}-brindes.png`),
      billiard: await upload(page.request, "PHOTO", `${suffix}-bilhar.png`),
      bxScreen: await upload(page.request, "PHOTO", `${suffix}-bx-tela.png`),
      bxPaper: await upload(page.request, "PHOTO", `${suffix}-bx-papel.png`),
      hScreen: await upload(page.request, "PHOTO", `${suffix}-h-tela.png`),
      contract: await upload(page.request, "CONTRACT", `${suffix}-credito.png`),
      marketingContract: await upload(page.request, "CONTRACT", `${suffix}-marketing.png`),
    };
    const payloads = operationPayloads(businessDate(), suffix, files);

    for (const slug of moduleSlugs) {
      const operation = payloads[slug];
      const requestKey = randomUUID();
      const save = () => page.request.post(`/api/modules/${slug}/records`, {
        headers: { "X-Idempotency-Key": requestKey },
        data: operation.data,
      });
      const first = await save();
      expect(first.status(), `${slug}: ${await first.text()}`).toBe(201);
      const firstBody = (await first.json()) as { record: { id: string; title: string; amount?: string; details: string[] } };
      expect(firstBody.record.title).toBe(operation.expectedTitle);
      expect(firstBody.record).not.toHaveProperty("amount");
      expect(firstBody.record.details.join(" ")).not.toContain("R$");

      const replay = await save();
      expect(replay.status(), `${slug}: replay ${await replay.text()}`).toBe(201);
      const replayBody = (await replay.json()) as { record: { id: string } };
      expect(replayBody.record.id).toBe(firstBody.record.id);

      const listing = await page.request.get(`/api/modules/${slug}/records?take=50`);
      expect(listing.status()).toBe(200);
      const listBody = (await listing.json()) as { records: Array<{ id: string; amount?: string; details: string[] }> };
      expect(listBody.records.filter((record) => record.id === firstBody.record.id)).toHaveLength(1);
      const visible = listBody.records.find((record) => record.id === firstBody.record.id)!;
      expect(visible).not.toHaveProperty("amount");
      expect(visible.details.join(" ")).not.toContain("R$");
    }
  });

  test("protege uma visita BX offline, sincroniza fotos e nao duplica", async ({ context, page }) => {
    test.setTimeout(180_000);
    await loginByApi(page, `${runId}-operator`, password!);
    const clientName = `BX offline ${runId}-${Date.now()}`;
    await page.goto("/modulos/bx");
    await clickAfterHydration(
      page.getByRole("button", { name: /^Clientes/i }),
      page.getByRole("button", { name: "Novo", exact: true }),
    );
    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByLabel("Nome do cliente", { exact: true }).fill(clientName);
    await page.getByLabel("Telefone", { exact: true }).fill("11977776666");
    await page.getByRole("button", { name: "Salvar cliente", exact: true }).click();
    await expect(page.getByText("Cliente cadastrado.", { exact: true })).toBeVisible();

    await page.goto("/modulos/bx");
    await clickAfterHydration(
      page.getByRole("button", { name: /^Visita/i }),
      page.getByRole("button").filter({ hasText: clientName }),
    );
    await page.getByRole("button").filter({ hasText: clientName }).click();
    await page.getByLabel("Data e hora", { exact: true }).fill(`${businessDate()}T13:00`);
    await page.getByLabel(/Situa.*do recebimento/i).selectOption("RECEIVED");
    await page.getByLabel(/Valor entregue ao funcion/i).fill("100");
    await page.getByLabel("Valor entregue ao cliente", { exact: true }).fill("0");
    await page.getByLabel("Despesas e gastos", { exact: true }).fill("7");
    await page.getByLabel("Forma de pagamento", { exact: true }).selectOption("PIX");
    const photoInputs = page.locator('input[type="file"]');
    await expect(photoInputs).toHaveCount(2);
    await photoInputs.nth(0).setInputFiles({ name: "offline-tela.png", mimeType: "image/png", buffer: onePixelPng });
    await photoInputs.nth(1).setInputFiles({ name: "offline-papel.png", mimeType: "image/png", buffer: onePixelPng });

    await context.setOffline(true);
    await page.getByRole("button", { name: "Salvar BX", exact: true }).click();
    await expect(page.getByText("Protegido neste aparelho", { exact: true })).toBeVisible();
    await context.setOffline(false);

    await expect.poll(async () => {
      const response = await page.request.get("/api/modules/bx/records?take=50");
      if (!response.ok()) return 0;
      const body = (await response.json()) as { records: Array<{ title: string }> };
      return body.records.filter((record) => record.title === clientName).length;
    }, { timeout: 60_000 }).toBe(1);
    await expect(page.getByText("Protegido neste aparelho", { exact: true })).toHaveCount(0);

    await page.reload();
    const finalListing = await page.request.get("/api/modules/bx/records?take=50");
    const finalBody = (await finalListing.json()) as { records: Array<{ title: string }> };
    expect(finalBody.records.filter((record) => record.title === clientName)).toHaveLength(1);
  });

  test("gera comprovante local da GRUA offline e sincroniza uma unica vez", async ({ context, page }) => {
    test.setTimeout(180_000);
    await loginByApi(page, `${runId}-operator`, password!);
    const suffix = `${runId}-${Date.now()}`.slice(-28);
    const clientName = `GRUA offline ${suffix}`;
    const machineName = `GRUA recibo ${suffix}`;

    await page.goto("/modulos/maquinas-de-pelucia");
    await clickAfterHydration(
      page.getByRole("button", { name: /^Clientes/i }),
      page.getByRole("button", { name: "Novo", exact: true }),
    );
    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByLabel("Nome do cliente", { exact: true }).fill(clientName);
    await page.getByLabel("Telefone", { exact: true }).fill("11966665555");
    await page.getByLabel(/Nome da m.quina/i).fill(machineName);
    await page.getByLabel(/N.mero da m.quina/i).fill(`OFF-${suffix}`);
    await page.getByLabel("Pay Blue", { exact: true }).fill(`PAY-${suffix}`);
    await page.getByLabel(/C.digo MAC/i).fill("AA:BB:CC:DD:EE:FF");
    await page.getByRole("button", { name: "Salvar cliente", exact: true }).click();
    await expect(page.getByText("Cliente cadastrado.", { exact: true })).toBeVisible();

    await page.goto("/modulos/maquinas-de-pelucia");
    await clickAfterHydration(
      page.getByRole("button", { name: /^Visita/i }),
      page.getByRole("button").filter({ hasText: clientName }),
    );
    await page.getByRole("button").filter({ hasText: clientName }).click();
    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();
    await expect(page.getByText(`Pay Blue: PAY-${suffix}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Código MAC: AA:BB:CC:DD:EE:FF", { exact: true })).toBeVisible();
    await page.getByLabel("Data da coleta", { exact: true }).fill(businessDate());
    await page.getByLabel("Total bruto", { exact: true }).fill("1400");
    await page.getByLabel(/Comiss.o %/i).fill("25");
    await page.getByLabel(/Quantidade de pel.cia/i).fill("4");
    const photoInputs = page.locator('input[type="file"]');
    await expect(photoInputs).toHaveCount(2);
    await photoInputs.nth(0).setInputFiles({ name: "grua-moedas-offline.png", mimeType: "image/png", buffer: onePixelPng });
    await photoInputs.nth(1).setInputFiles({ name: "grua-brindes-offline.png", mimeType: "image/png", buffer: onePixelPng });

    await context.setOffline(true);
    await page.getByRole("button", { name: /Salvar Pel.cia/i }).click();
    await expect(page.getByText("Protegido neste aparelho", { exact: true })).toBeVisible();
    await expect(page.getByText("Fechamento da GRUA protegido neste aparelho", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aguardando sincronizacao" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Compartilhar imagem do comprovante" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar via do cliente em PDF" })).toBeVisible();

    await context.setOffline(false);
    await expect.poll(async () => {
      const response = await page.request.get("/api/modules/maquinas-de-pelucia/records?take=50");
      if (!response.ok()) return 0;
      const body = (await response.json()) as { records: Array<{ title: string }> };
      return body.records.filter((record) => record.title === machineName).length;
    }, { timeout: 60_000 }).toBe(1);
    await expect(page.getByText("Registro da grua salvo", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Enviar comprovante ao cliente" }).first()).toBeEnabled();

    const finalListing = await page.request.get("/api/modules/maquinas-de-pelucia/records?take=50");
    const finalBody = (await finalListing.json()) as { records: Array<{ title: string }> };
    expect(finalBody.records.filter((record) => record.title === machineName)).toHaveLength(1);
  });
});
