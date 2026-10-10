import { expect, test, type Page } from "@playwright/test";

import { clickAfterHydration, loginByApi } from "./helpers/auth";

const runId = process.env.E2E_SMOKE_RUN_ID;
const password = process.env.E2E_SMOKE_PASSWORD;

const fieldModules = [
  "bilhar-pebolim",
  "maquinas-de-pelucia",
  "bx",
  "h-caca-niquel",
  "carreta-kids",
  "locacao",
] as const;

const officeModules = [
  "credito-financeiro",
  "mercado-autonomo",
  "plataforma-online",
  "financas-pessoais",
] as const;

async function login(page: Page) {
  await loginByApi(page, `${runId}-owner`, password!);
}

async function expectMobileReady(page: Page) {
  await expect(page.getByRole("link", { name: "Módulos" }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  await expect(page.getByText(/Servidor temporariamente indisponível/i)).toHaveCount(0);
}

test.describe("jornadas moveis dos modulos", () => {
  test.skip(!runId || !password, "Crie a organizacao smoke e defina E2E_SMOKE_RUN_ID/E2E_SMOKE_PASSWORD.");

  test("abre a visita e chega ao formulario nos seis modulos de campo", async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await login(page);

    for (const slug of fieldModules) {
      await page.goto(`/modulos/${slug}`);
      await expectMobileReady(page);
      const newLocation = page.getByRole("button", { name: /Novo ponto não cadastrado/i });
      await clickAfterHydration(
        page.getByRole("button", { name: /Visita/ }).first(),
        newLocation,
      );
      await clickAfterHydration(newLocation, page.locator("form").first());
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);
    }
    expect(pageErrors).toEqual([]);
  });

  test("abre o cadastro completo nos modulos administrativos", async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await login(page);

    for (const slug of officeModules) {
      await page.goto(`/modulos/${slug}`);
      await expectMobileReady(page);
      await clickAfterHydration(
        page.getByRole("button", { name: /Operação/ }).first(),
        page.locator("form").first(),
      );
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    }

    await page.goto("/modulos/marketing");
    await expectMobileReady(page);
    await expect(page.getByRole("button", { name: /Calendário/ }).first()).toBeVisible();
    await clickAfterHydration(
      page.getByRole("button", { name: /Clientes e funil/ }),
      page.getByText(/Novo cliente|Clientes/i).first(),
    );
    expect(pageErrors).toEqual([]);
  });
});
