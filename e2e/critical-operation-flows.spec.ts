import { expect, test } from "@playwright/test";

import { loginByApi } from "./helpers/auth";

const runId = process.env.E2E_SMOKE_RUN_ID;
const password = process.env.E2E_SMOKE_PASSWORD;

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const normalizeSpaces = (value: string) => value.replace(/\s/g, " ");

async function uploadPhoto(page: Parameters<typeof loginByApi>[0], name: string) {
  const response = await page.request.post("/api/upload", {
    multipart: {
      category: "PHOTO",
      file: {
        name,
        mimeType: "image/png",
        buffer: onePixelPng,
      },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { id?: string };
  expect(body.id).toBeTruthy();
  return body.id!;
}

test.describe("fluxos financeiros criticos", () => {
  test.skip(!runId || !password, "Crie a organizacao smoke e defina as credenciais E2E.");

  test("GRUA impede retirar fotos pelo JSON e fecha somente com os dois anexos", async ({ page }) => {
    await loginByApi(page, `${runId}-owner`, password!);
    const unique = `${runId}-${Date.now()}`;
    const payload = {
      clientName: "Cliente GRUA E2E",
      phone: "11999999999",
      code: `GRUA-${unique}`,
      name: "GRUA teste",
      machineNumber: `E2E-${unique}`,
      collectionDate: "2026-10-10",
      grossAmount: 100,
      commissionPercentage: 25,
      plushCountOut: 2,
      paymentMethod: "PIX",
      discountAmount: 0,
      ownerExpenseAmount: 0,
      compensationStatus: "WORTH_IT",
      coinPhotoRule: false,
      giftPhotoRule: false,
      active: true,
    };

    const bypassAttempt = await page.request.post("/api/modules/maquinas-de-pelucia/records", {
      data: payload,
    });
    expect(bypassAttempt.status()).toBe(400);
    expect((await bypassAttempt.json()).error).toMatch(/foto.*obrigatoria/i);

    const coinPhotoFileId = await uploadPhoto(page, "moedas-e2e.png");
    const giftPhotoFileId = await uploadPhoto(page, "brindes-e2e.png");
    const validClosing = await page.request.post("/api/modules/maquinas-de-pelucia/records", {
      data: { ...payload, coinPhotoFileId, giftPhotoFileId },
    });
    expect(validClosing.status(), await validClosing.text()).toBe(201);
  });

  test("credito cria contrato e cobranca parcelada na mesma operacao", async ({ page }) => {
    await loginByApi(page, `${runId}-owner`, password!);
    const unique = `${runId}-${Date.now()}`;
    const clientName = `Credito E2E ${unique}`;
    const creation = await page.request.post("/api/modules/credito-financeiro/records", {
      data: {
        clientCode: `CRED-${unique}`,
        clientName,
        amount: 1_000,
        contractDate: "2026-10-10",
        dueDate: "2027-01-10",
        year: 2026,
        monthlyInterest: 10,
        installmentsCount: 3,
        installmentFixed: true,
        guaranteeEnabled: false,
        signatureLink: "",
        signatureFileId: null,
        expenseAmount: 20,
        paymentMethod: "PIX",
        status: "ACTIVE",
        notes: "Fluxo automatizado isolado",
      },
    });
    expect(creation.status(), await creation.text()).toBe(201);
    const created = (await creation.json()) as {
      record: { title: string; details: string[]; amount: string };
    };
    expect(created.record.title).toBe(clientName);
    expect(created.record.details.map(normalizeSpaces)).toContain("Parcelas: 3 de R$ 433,33");
    expect(normalizeSpaces(created.record.amount)).toBe("R$ 1.300,00");

    const listing = await page.request.get("/api/modules/credito-financeiro/records?take=50");
    expect(listing.status()).toBe(200);
    const body = (await listing.json()) as { records: Array<{ title: string }> };
    expect(body.records.some((record) => record.title === clientName)).toBe(true);
  });
});
