import { expect, test, type Page } from "@playwright/test";

const bxPassword = process.env.E2E_BX_PASSWORD;
const bxUsername = process.env.E2E_BX_USERNAME ?? "bx";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
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
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await login(page, bxUsername, bxPassword!);
    await page.goto("/modulos/bx");

    await expect(page.getByRole("heading", { name: "BX", exact: true })).toBeVisible();
    await expect(page.getByText("Entradas hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Despesas hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Resultado hoje", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/equipe");
    await expect(page).not.toHaveURL(/\/equipe/);

    await page.goto("/painel");
    await expect(page).not.toHaveURL(/\/painel/);

    await page.goto("/modulos/bilhar-pebolim");
    await expect(page).not.toHaveURL(/\/modulos\/bilhar-pebolim/);

    expect(browserErrors).toEqual([]);
  });
});
