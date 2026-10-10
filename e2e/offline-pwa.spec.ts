import { expect, test } from "@playwright/test";

import { loginByApi } from "./helpers/auth";

const username = process.env.E2E_OFFLINE_USERNAME;
const password = process.env.E2E_OFFLINE_PASSWORD;

test.describe("PWA operacional offline", () => {
  test.skip(
    !username || !password,
    "Defina um login operacional para o teste somente de leitura.",
  );

  test("mantem o modulo e sua copia operacional preparados sem internet", async ({ context, page }) => {
    test.setTimeout(90_000);
    await loginByApi(page, username!, password!);

    await page.goto("/modulos/bx");
    await expect(page.getByRole("button", { name: /Visita/ }).first()).toBeVisible();
    let offlineCopy: {
      ready: boolean;
      hasVisit: boolean;
      hasFinance: boolean;
    } = { ready: false, hasVisit: false, hasFinance: false };
    await expect.poll(async () => {
      offlineCopy = await page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) {
          return { ready: false, hasVisit: false, hasFinance: false };
        }
        const names = (await caches.keys()).filter((name) => name.startsWith("infinity-operations-"));
        for (const name of names) {
          const cache = await caches.open(name);
          const metaResponse = await cache.match("/__infinity_offline_meta__");
          const meta = metaResponse ? await metaResponse.json() : null;
          const route = await cache.match("/modulos/bx", { ignoreVary: true });
          if (meta?.routes?.includes("/modulos/bx") && route) {
            const html = await route.text();
            return {
              ready: true,
              hasVisit: html.includes("Visita"),
              hasFinance: html.includes("Financeiro"),
            };
          }
        }
        return { ready: false, hasVisit: false, hasFinance: false };
      });
      return offlineCopy.ready;
    }, { timeout: 60_000 }).toBe(true);

    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(offlineCopy).toEqual({ ready: true, hasVisit: true, hasFinance: true });
    await expect(page.getByRole("button", { name: /Visita/ }).first()).toBeVisible();
    await context.setOffline(false);

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    });
    await expect.poll(() => page.evaluate(async () =>
      (await caches.keys()).filter((name) => name.startsWith("infinity-operations-")).length,
    )).toBe(0);
  });
});
