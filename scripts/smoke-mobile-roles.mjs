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
  { role: "owner", username: `${runId}-owner` },
  { role: "admin", username: `${runId}-admin` },
  { role: "staff", username: `${runId}-staff` },
];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.querySelector("#username")?._valueTracker));
    if ((await page.locator("#email").count()) > 0) throw new Error("Login antigo por e-mail ainda apareceu.");
    await page.locator("#username").fill(profile.username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /Entrar no painel/i }).click();
    try {
      await page.waitForURL(/\/(dashboard|modulos)/, { timeout: 15_000 });
    } catch (error) {
      const alert = await page.locator('[role="alert"]').allTextContents();
      const formText = await page.locator("form").innerText().catch(() => "formulario indisponivel");
      console.error(`[mobile-smoke] login ${profile.role} parou em ${page.url()}`, alert, formText);
      throw error;
    }

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

    if (profile.role !== "staff") {
      await page.getByRole("button", { name: /^Financeiro/ }).click();
      if (profile.role === "admin") {
        await page.getByText("Financeiro de hoje", { exact: true }).waitFor();
        if ((await page.locator('input[type="date"]').count()) > 0) {
          throw new Error("ADMIN recebeu filtro para consultar outro dia.");
        }
      } else {
        await page.getByText("Filtrar por período", { exact: true }).waitFor();
      }
      await page.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
    }

    await page.getByRole("button", { name: /^Clientes/ }).click();
    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByLabel("Nome do cliente", { exact: true }).waitFor();

    if (profile.role === "staff") {
      await page.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
      if ((await page.getByText("Prêmio", { exact: true }).count()) > 0) {
        throw new Error("STAFF visualizou os valores de premios.");
      }
      if ((await page.getByText("Comprovantes", { exact: true }).count()) > 0) {
        throw new Error("STAFF visualizou comprovantes financeiros.");
      }
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
