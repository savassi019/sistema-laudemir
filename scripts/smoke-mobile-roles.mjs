import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
const runId = process.env.SMOKE_RUN_ID ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";
if (!baseUrl || !runId || !password) {
  throw new Error("Defina SMOKE_BASE_URL, SMOKE_RUN_ID e SMOKE_PASSWORD.");
}

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const profiles = [
  { role: "owner", email: `${runId}-owner@smoke.infinity.local` },
  { role: "admin", email: `${runId}-admin@smoke.infinity.local` },
  { role: "staff", email: `${runId}-staff@smoke.infinity.local` },
];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill(profile.email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /Entrar no painel/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    if (profile.role === "owner") {
      await page.goto(`${baseUrl}/painel`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /Painel do Dono/i }).waitFor();
      await page.getByText(/Central de pendencias/i).waitFor();
    } else {
      await page.goto(`${baseUrl}/painel`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/(dashboard|modulos)/, { timeout: 20_000 });
      if (page.url().includes("/painel")) throw new Error(`${profile.role} acessou o Painel do Dono.`);
    }

    await page.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
    await page.getByText("BX", { exact: true }).first().waitFor();
    if (profile.role !== "staff" && (await page.getByText("Financeiro", { exact: true }).count()) === 0) {
      throw new Error(`${profile.role} nao visualizou a area Financeiro do modulo.`);
    }
    if (profile.role === "staff" && (await page.getByText("Financeiro", { exact: true }).count()) > 0) {
      throw new Error("STAFF visualizou a area Financeiro do modulo.");
    }

    if (profile.role !== "owner") {
      const deniedResponse = await page.goto(`${baseUrl}/modulos/h-caca-niquel`, { waitUntil: "domcontentloaded" });
      if (deniedResponse?.status() !== 404) throw new Error(`${profile.role} acessou modulo H sem permissao.`);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (hasHorizontalOverflow) throw new Error(`${profile.role} encontrou rolagem horizontal no mobile.`);
    console.log(`[mobile-smoke] ${profile.role}: OK`);
    await context.close();
  }
} finally {
  await browser.close();
}
