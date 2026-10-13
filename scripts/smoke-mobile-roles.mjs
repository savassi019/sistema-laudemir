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
const temporaryUser = {
  name: "Funcionário temporário do teste",
  username: `${runId}-temp`,
};
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const expectedOperatorNames = {
  owner: "Teste Mobile Dono",
  admin: "Teste Mobile ADMIN",
  staff: "Teste Mobile STAFF",
};

async function waitForHydratedButton(page, label) {
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll("button")].some(
        (button) =>
          button.textContent?.trim().startsWith(text) &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      ),
    label,
  );
}

async function login(page, username) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(document.querySelector("#username")?._valueTracker));
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Entrar no painel/i }).click();
  return responsePromise;
}

function currentBusinessDateTime(index) {
  const businessDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${businessDate}T12:${String(index).padStart(2, "0")}`;
}

async function registerBxClient(page, profile, index) {
  const clientName = `Cliente smoke ${profile.role} ${runId}`;
  await page.getByLabel("Nome do cliente", { exact: true }).fill(clientName);
  await page.getByLabel("Telefone", { exact: true }).fill(`1199000000${index}`);
  await page.getByLabel("Cidade", { exact: true }).fill("Cidade teste");
  await page.getByRole("button", { name: "Salvar cliente", exact: true }).click();
  await page.getByText(clientName, { exact: true }).waitFor({ timeout: 20_000 });
  return clientName;
}

async function completeBxOperation(page, profile, clientName, index) {
  await page.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
  await waitForHydratedButton(page, "Visita");
  await page.getByRole("button", { name: /^Visita/ }).click();

  const clientButton = page.getByRole("button").filter({ hasText: clientName });
  await clientButton.waitFor({ timeout: 20_000 });
  await clientButton.click();
  await page.getByLabel("Data e hora", { exact: true }).waitFor({ timeout: 20_000 });

  await page.getByLabel("Data e hora", { exact: true }).fill(currentBusinessDateTime(index));
  await page.getByLabel(/Situa.*do recebimento/i).selectOption("RECEIVED");
  await page.getByLabel(/Valor entregue ao funcion/i).fill(String(100 + index));
  await page.getByLabel("Valor entregue ao cliente", { exact: true }).fill("0");
  await page.getByLabel("Despesas e gastos", { exact: true }).fill(String(index));
  await page.getByLabel("Forma de pagamento", { exact: true }).selectOption("PIX");
  await page.getByLabel(/Observa/i).fill(`Operacao automatizada isolada - ${profile.role}`);

  const photoInputs = page.locator('input[type="file"]');
  await page.waitForFunction(() => document.querySelectorAll('input[type="file"]').length === 2);
  await photoInputs.nth(0).setInputFiles({
    name: `${runId}-${profile.role}-tela.png`,
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByRole("img", { name: `${runId}-${profile.role}-tela.jpg` }).waitFor();
  await photoInputs.nth(1).setInputFiles({
    name: `${runId}-${profile.role}-papel.png`,
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByRole("img", { name: `${runId}-${profile.role}-papel.jpg` }).waitFor();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/modules/bx/records") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar BX", exact: true }).click();
  const saveResponse = await saveResponsePromise;
  if (saveResponse.status() !== 201) {
    throw new Error(
      `${profile.role} nao concluiu a operacao BX: HTTP ${saveResponse.status()} ${await saveResponse.text()}`,
    );
  }

  const saved = await saveResponse.json();
  if (saved?.record?.title !== clientName) {
    throw new Error(`${profile.role} salvou a operacao no cliente errado.`);
  }
  if (saved?.record?.summary !== `Funcionário: ${expectedOperatorNames[profile.role]}`) {
    throw new Error(`${profile.role} foi atribuido ao funcionario errado no fechamento.`);
  }
  await page.getByText("Registro BX pronto", { exact: true }).waitFor({ timeout: 20_000 });

  const listing = await page.request.get(`${baseUrl}/api/modules/bx/records?take=50`);
  if (!listing.ok()) {
    throw new Error(`${profile.role} nao conseguiu consultar a operacao salva: HTTP ${listing.status()}.`);
  }
  const listed = await listing.json();
  const matchingRecords = (listed.records ?? []).filter((record) => record.title === clientName);
  if (matchingRecords.length !== 1) {
    throw new Error(`${profile.role} deveria ter exatamente 1 operacao BX, encontrou ${matchingRecords.length}.`);
  }

  return saved.record.id;
}

try {
  for (const [index, profile] of profiles.entries()) {
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
      await waitForHydratedButton(page, "Financeiro");
      await page.getByRole("button", { name: /^Financeiro/ }).click();
      if (profile.role === "admin") {
        await page.getByText("Financeiro de hoje", { exact: true }).waitFor();
        if ((await page.locator('input[type="date"]').count()) > 0) {
          throw new Error("ADMIN recebeu filtro para consultar outro dia.");
        }
      } else {
        await page.waitForFunction(
          () => document.querySelectorAll('input[type="date"]').length === 2,
        );
      }
      await page.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
    }

    await waitForHydratedButton(page, "Clientes");
    await page.getByRole("button", { name: /^Clientes/ }).click();
    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByLabel("Nome do cliente", { exact: true }).waitFor();
    const clientName = await registerBxClient(page, profile, index + 1);
    const recordId = await completeBxOperation(page, profile, clientName, index + 1);

    if (profile.role === "owner") {
      const pdfPopupPromise = page.waitForEvent("popup");
      await page.getByRole("button", { name: "Gerar via do cliente em PDF", exact: true }).click();
      const pdfPopup = await pdfPopupPromise;
      await pdfPopup.waitForLoadState("domcontentloaded");
      await pdfPopup.getByText("COMPROVANTE DE FECHAMENTO", { exact: true }).waitFor();
      if ((await pdfPopup.getByText(clientName, { exact: true }).count()) === 0) {
        throw new Error("PDF do BX nao recebeu os dados reais do cliente.");
      }
      await pdfPopup.close();

      const imageDownloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: /Compartilhar imagem do comprovante/i }).click();
      const imageDownload = await imageDownloadPromise;
      if (imageDownload.suggestedFilename() !== "comprovante.png") {
        throw new Error("Imagem compartilhavel do comprovante nao foi gerada.");
      }

      await context.route("https://wa.me/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: "WhatsApp smoke" }),
      );
      const whatsappPopupPromise = page.waitForEvent("popup");
      await page.getByRole("button", { name: /Enviar comprovante ao cliente/i }).click();
      const whatsappPopup = await whatsappPopupPromise;
      await whatsappPopup.waitForURL(/wa\.me\/5511990000001/);
      await whatsappPopup.close();
      console.log("[mobile-smoke] BX: PDF, imagem e redirecionamento WhatsApp OK");
    }

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
    console.log(`[mobile-smoke] ${profile.role}: login, cliente e operacao BX OK (${recordId})`);
    await context.close();
  }

  // Ciclo completo solicitado: o dono cria um funcionario pela interface,
  // o novo login acessa somente BX, e a desativacao bloqueia imediatamente
  // tanto uma sessao existente quanto uma nova tentativa de login.
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, `${runId}-owner`);
  await ownerPage.waitForURL(/\/(dashboard|modulos)/, { timeout: 15_000 });
  await ownerPage.goto(`${baseUrl}/equipe`, { waitUntil: "domcontentloaded" });
  await ownerPage.getByRole("heading", { name: "Equipe", exact: true }).waitFor();
  await waitForHydratedButton(ownerPage, "Novo funcionário");
  await ownerPage.getByRole("button", { name: "Novo funcionário", exact: true }).click();
  await ownerPage.getByRole("heading", { name: "Novo funcionário", exact: true }).waitFor();
  await ownerPage.getByLabel("Nome", { exact: true }).fill(temporaryUser.name);
  await ownerPage.getByRole("textbox", { name: /Usuário de acesso/i }).fill(temporaryUser.username);
  await ownerPage.getByLabel("Senha inicial", { exact: true }).fill(password);
  await ownerPage.getByRole("combobox", { name: /Perfil/i }).selectOption("STAFF");
  await ownerPage.getByRole("checkbox", { name: "BX", exact: true }).check();
  await ownerPage.getByRole("button", { name: "Adicionar à equipe", exact: true }).click();
  await ownerPage.getByText(`${temporaryUser.name} adicionado.`, { exact: false }).waitFor();

  const temporaryContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const temporaryPage = await temporaryContext.newPage();
  await login(temporaryPage, temporaryUser.username);
  await temporaryPage.waitForURL(/\/(dashboard|modulos)/, { timeout: 15_000 });
  await temporaryPage.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
  await temporaryPage.getByText("BX", { exact: true }).first().waitFor();
  if ((await temporaryPage.getByText("Financeiro", { exact: true }).count()) > 0) {
    throw new Error("Funcionario temporario visualizou o Financeiro.");
  }
  const deniedResponse = await temporaryPage.goto(`${baseUrl}/modulos/h-caca-niquel`, { waitUntil: "domcontentloaded" });
  if (deniedResponse?.status() !== 404) {
    throw new Error("Funcionario temporario acessou modulo H sem permissao.");
  }

  const temporaryCard = ownerPage
    .getByRole("article")
    .filter({ hasText: temporaryUser.name });
  await temporaryCard.getByRole("button", { name: "Desativar", exact: true }).click();
  await temporaryCard.getByRole("button", { name: "Desativar", exact: true }).click();
  await temporaryCard.getByText("Inativo", { exact: true }).waitFor();

  await temporaryPage.goto(`${baseUrl}/modulos/bx`, { waitUntil: "domcontentloaded" });
  await temporaryPage.waitForURL(/\/login/, { timeout: 15_000 });
  await temporaryContext.close();

  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const blockedPage = await blockedContext.newPage();
  const blockedResponse = await login(blockedPage, temporaryUser.username);
  if (blockedResponse.status() !== 401) {
    throw new Error(`Login inativo retornou HTTP ${blockedResponse.status()} em vez de 401.`);
  }
  await blockedPage.getByText(/Credenciais.*inativo/i).waitFor();
  if (!blockedPage.url().includes("/login")) {
    throw new Error("Funcionario temporario desativado conseguiu entrar novamente.");
  }
  await blockedContext.close();
  await ownerContext.close();
  console.log("[mobile-smoke] ciclo criar, entrar e desativar: OK");
} finally {
  await browser.close();
}
