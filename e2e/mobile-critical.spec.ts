import { expect, test } from "@playwright/test";

import { loginByApi } from "./helpers/auth";

const username = process.env.E2E_OFFLINE_USERNAME;
const password = process.env.E2E_OFFLINE_PASSWORD;

test.describe("operacao mobile critica", () => {
  test.skip(!username || !password, "Defina um login operacional para os testes mobile.");

  test("BX nao cria rolagem horizontal e mantem alvos principais tocaveis", async ({ page }) => {
    await loginByApi(page, username!, password!);
    await page.goto("/modulos/bx");

    const visitButton = page.getByRole("button", { name: /Visita/ }).first();
    await expect(visitButton).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1);

    const visitBox = await visitButton.boundingBox();
    expect(visitBox).not.toBeNull();
    expect(visitBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const financeButton = page.getByRole("button", { name: /Financeiro/ }).first();
    if (await financeButton.isVisible().catch(() => false)) {
      const financeBox = await financeButton.boundingBox();
      expect(financeBox).not.toBeNull();
      expect(financeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
