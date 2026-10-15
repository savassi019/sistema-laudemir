import { expect, test, type Page } from "@playwright/test";

import { clickAfterHydration, loginByApi } from "./helpers/auth";

const runId = process.env.E2E_SMOKE_RUN_ID;
const password = process.env.E2E_SMOKE_PASSWORD;

async function login(page: Page, username: string) {
  await loginByApi(page, username, password!);
}

test.describe("perfis de acesso em celular", () => {
  test.skip(!runId || !password, "Crie a organizacao smoke e defina E2E_SMOKE_RUN_ID/E2E_SMOKE_PASSWORD.");

  test("dono enxerga consolidado e areas exclusivas", async ({ page }) => {
    await login(page, `${runId}-owner`);
    await page.goto("/equipe");
    await expect(page.getByRole("heading", { name: "Equipe", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Editar", exact: true }).first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole("heading", { name: /^Editar / })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      .toBe(true);
    await editDialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(editDialog).toHaveCount(0);
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/painel/);
    await expect(page.getByRole("heading", { name: "Painel do Dono" })).toBeVisible();
    await expect(page.getByText("Saúde do sistema", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Ver histórico completo" }).click();
    await expect(page.getByRole("heading", { name: "Histórico de auditoria" })).toBeVisible();
  });

  test("gestor enxerga somente o financeiro do dia", async ({ page }) => {
    await login(page, `${runId}-admin`);
    await page.goto("/modulos/bx");
    await expect(page.getByText("Entradas hoje", { exact: true })).toBeVisible();
    await clickAfterHydration(
      page.getByRole("button", { name: /Financeiro/ }),
      page.getByText("Financeiro de hoje", { exact: true }),
    );
    await expect(page.getByText(/consolidado completo fica disponível apenas para o dono/i)).toBeVisible();
    await page.goto("/equipe");
    await expect(page).not.toHaveURL(/\/equipe/);
  });

  test("funcionario opera modulos liberados sem receber totais calculados", async ({ page }) => {
    await login(page, `${runId}-staff`);
    await page.goto("/modulos/bx");
    await expect(page.getByText("Entradas hoje", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Financeiro/ })).toHaveCount(0);

    const financeStatus = await page.evaluate(async () => (await fetch("/api/finance/summary")).status);
    expect(financeStatus).toBe(403);

    await page.goto("/modulos/credito-financeiro");
    await expect(page.getByRole("heading", { name: "Pagina nao encontrada" })).toBeVisible();
  });
});
