import { expect, test, type Page } from "@playwright/test";

import { clickAfterHydration, loginByApi } from "./helpers/auth";

const bxPassword = process.env.E2E_BX_PASSWORD;
const bxUsername = process.env.E2E_BX_USERNAME ?? "bx";

async function login(page: Page, username: string, password: string) {
  await loginByApi(page, username, password);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

test.describe("acesso móvel do BX", () => {
  test.skip(!bxPassword, "Defina E2E_BX_PASSWORD para testar a conta real sem gravar dados.");

  test("entra só no BX, vê apenas o financeiro de hoje e não abre áreas do dono", async ({ page }) => {
    test.setTimeout(45_000);
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await login(page, bxUsername, bxPassword!);
    await page.goto("/modulos/bx");

    await expect(page).toHaveURL(/\/modulos\/bx/);
    await expect(page.getByText("Entradas hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Despesas hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Resultado hoje", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await clickAfterHydration(
      page.getByRole("button", { name: /Financeiro Entradas/ }),
      page.getByText("Financeiro de hoje", { exact: true }),
    );
    await expect(page.getByText(/O consolidado completo fica disponível apenas para o dono/)).toBeVisible();

    await page.goto("/modulos/bx");
    await clickAfterHydration(
      page.getByRole("button", { name: /Comprovantes Reenviar/ }),
      page.getByRole("heading", { name: "Comprovantes", exact: true }).last(),
    );
    const invalidReceiptEventStatus = await page.evaluate(async () => {
      const response = await fetch("/api/receipts/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return response.status;
    });
    expect(invalidReceiptEventStatus).toBe(400);

    await page.goto("/equipe");
    await expect(page).not.toHaveURL(/\/equipe/);

    await page.goto("/painel");
    await expect(page).not.toHaveURL(/\/painel/);

    await page.goto("/modulos/bilhar-pebolim");
    await expect(page.getByRole("heading", { name: "Pagina nao encontrada" })).toBeVisible();

    expect(browserErrors).toEqual([]);
  });
});
