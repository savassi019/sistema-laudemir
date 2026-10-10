import { expect, type Locator, type Page } from "@playwright/test";

export async function loginByApi(page: Page, username: string, password: string) {
  const response = await page.request.post("/api/auth/login", {
    data: { username, password },
  });

  expect(response.ok(), await response.text()).toBe(true);
}

export async function clickAfterHydration(trigger: Locator, expected: Locator) {
  await expect(async () => {
    await trigger.click();
    await expect(expected).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
}
