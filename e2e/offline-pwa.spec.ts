import { expect, test } from "@playwright/test";

const username = process.env.E2E_OFFLINE_USERNAME;
const password = process.env.E2E_OFFLINE_PASSWORD;

test.describe("PWA operacional offline", () => {
  test.skip(
    !username || !password,
    "Defina um login operacional para o teste somente de leitura.",
  );

  test("reabre um modulo preparado mesmo sem internet", async ({ context, page }) => {
    test.setTimeout(90_000);
    await page.goto("/login");
    await page.getByLabel("Usuário").fill(username!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: "Entrar no painel" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/modulos/bx");
    await expect(page.getByRole("button", { name: /Visita/ }).first()).toBeVisible();
    await page.waitForFunction(async () => {
      if (!navigator.serviceWorker.controller) return false;
      const names = (await caches.keys()).filter((name) => name.startsWith("infinity-operations-"));
      for (const name of names) {
        const cache = await caches.open(name);
        const metaResponse = await cache.match("/__infinity_offline_meta__");
        const meta = metaResponse ? await metaResponse.json() : null;
        if (meta?.routes?.includes("/modulos/bx") && await cache.match("/modulos/bx")) return true;
      }
      return false;
    }, null, { timeout: 60_000 });

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(page).toHaveURL(/\/modulos\/bx/);
    await expect(page.getByRole("button", { name: /Visita/ }).first()).toBeVisible();
    await expect(page.getByText(/Abra uma operacao ao menos uma vez/)).toHaveCount(0);
    await context.setOffline(false);

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    });
    await expect.poll(() => page.evaluate(async () =>
      (await caches.keys()).filter((name) => name.startsWith("infinity-operations-")).length,
    )).toBe(0);
  });
});
