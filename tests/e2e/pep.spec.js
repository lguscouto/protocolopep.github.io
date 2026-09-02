import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { trackPageRuntime, seedStorage } from "./runtime.js";

test.describe("Protocolo PEP — E2E Smoke & Runtime", () => {
  test("carrega protocolo vazio sem erros de console ou requests com falha", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // O título do app ou cabeçalho deve estar visível
    const header = page.locator("header, .topbar, #app-title");
    await expect(header.first()).toBeVisible();

    runtime.assertCleanRuntime();
  });

  test("navega entre as 5 abas principais sem erro", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const tabs = ["tab-today", "tab-week", "tab-history", "tab-calc", "tab-settings"];
    for (const tabId of tabs) {
      const tabButton = page.locator(`[data-tab="${tabId}"], #${tabId}`);
      if (await tabButton.count() > 0) {
        await tabButton.first().click();
      }
    }

    runtime.assertCleanRuntime();
  });

  test("alvos de toque atendem às dimensões mínimas de 44x44px e 48px na navegação", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Topbar buttons
    const notifBtn = page.locator("#notif-btn");
    const notifBox = await notifBtn.boundingBox();
    expect(notifBox?.width).toBeGreaterThanOrEqual(44);
    expect(notifBox?.height).toBeGreaterThanOrEqual(44);

    const themeBtn = page.locator("#theme-btn");
    const themeBox = await themeBtn.boundingBox();
    expect(themeBox?.width).toBeGreaterThanOrEqual(44);
    expect(themeBox?.height).toBeGreaterThanOrEqual(44);

    // Nav buttons
    const navButtons = page.locator(".nav button");
    const count = await navButtons.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const box = await navButtons.nth(i).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    runtime.assertCleanRuntime();
  });

  test("dashboard vazio exibe boas-vindas e oculta anel de progresso", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Deve exibir card de boas-vindas
    const emptyTitle = page.locator(".dash-empty-title");
    await expect(emptyTitle).toBeVisible();
    await expect(emptyTitle).toContainText("Seu protocolo começa aqui");

    // O anel de progresso hero deve estar oculto
    const hero = page.locator("#dash-hero");
    await expect(hero).toBeHidden();

    // Clicar em criar protocolo abre o modal
    const createBtn = page.locator('[data-action="create-protocol"]');
    await createBtn.click();

    const editModal = page.locator("#edit-modal");
    await expect(editModal).toHaveClass(/on/);

    runtime.assertCleanRuntime();
  });

  test("dashboard com protocolo exibe cards da rotina de hoje e secao de proximos", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const mockPeptides = [
      {
        id: "pep-alfa",
        name: "Composto Alfa",
        sub: "reparo sintético",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        time: "08:00",
        color: "#30D5C8",
        days: null
      },
      {
        id: "pep-beta",
        name: "Composto Beta",
        sub: "energia celular",
        dose: "500 mcg",
        ui: 20,
        perDay: 1,
        time: "20:00",
        color: "#F5B75B",
        days: null
      }
    ];

    await seedStorage(page, { skipOnboarding: true, peptides: mockPeptides });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // O card hero de progresso deve estar visível
    const hero = page.locator("#dash-hero");
    await expect(hero).toBeVisible();

    // Deve renderizar os 2 cards
    const cards = page.locator("#today-cards article.card");
    await expect(cards).toHaveCount(2);

    // Deve renderizar a seção de próximos
    const upcomingSection = page.locator(".upcoming-section");
    await expect(upcomingSection).toBeVisible();

    // Confirmar a primeira dose
    const takeBtn = cards.first().locator("button.take");
    await takeBtn.click();

    // Card deve estar com status de aplicado
    await expect(cards.first()).toHaveClass(/done/);

    runtime.assertCleanRuntime();
  });

  test("registro de aplicação usa mapa visual acessível e preserva os demais locais", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const mockPeptides = [
      {
        id: "pep-visual",
        name: "Composto Visual",
        sub: "teste de interface",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        time: "08:00",
        color: "#30D5C8",
        days: null
      }
    ];

    await seedStorage(page, { skipOnboarding: true, peptides: mockPeptides });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#tab-history").click();
    await page.locator("#hist-retro-btn").click();

    const modal = page.locator("#retro-log-modal");
    await expect(modal).toHaveClass(/on/);
    await expect(page.locator(".injection-site-map")).toBeVisible();
    await expect(page.locator(".injection-site-point")).toHaveCount(2);
    await expect(page.locator(".injection-site-chip")).toHaveCount(4);
    await expect(page.locator(".injection-site-disclaimer")).toContainText("não avalia a pele");
    // Aguarda a transição de tema já usada pelos demais testes de contraste.
    await page.waitForTimeout(400);

    const mapAccessibility = await new AxeBuilder({ page })
      .include("#retro-log-modal")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(mapAccessibility.violations).toEqual([]);

    const rightAbdomen = page.getByRole("button", { name: "Selecionar Abdômen (Direito)", exact: true });
    const leftAbdomen = page.getByRole("button", { name: "Selecionar Abdômen (Esquerdo)", exact: true });
    await expect(rightAbdomen).toHaveAttribute("aria-pressed", "true");

    const pointBox = await rightAbdomen.boundingBox();
    expect(pointBox?.width).toBeGreaterThanOrEqual(44);
    expect(pointBox?.height).toBeGreaterThanOrEqual(44);

    await leftAbdomen.click();
    await expect(leftAbdomen).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#retro-site-select")).toHaveValue("Abdômen (Esquerdo)");

    runtime.assertCleanRuntime();
  });

  test("onboarding carrega as três ilustrações locais sem erro", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: false, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const onboardingAccessibility = await new AxeBuilder({ page })
      .include("#onboarding-overlay")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(onboardingAccessibility.violations).toEqual([]);

    for (let step = 0; step < 3; step++) {
      const image = page.locator(".onboarding-art img");
      await expect(image).toBeVisible();
      await expect.poll(
        () => image.evaluate((element) => element.complete ? element.naturalWidth : 0)
      ).toBeGreaterThan(0);

      if (step < 2) {
        await page.locator("#onboarding-next").click();
      }
    }

    runtime.assertCleanRuntime();
  });

  test("calculadora calcula unidades U-100 e exibe bloco de conferencia dos dados", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Navegar para a Calculadora
    const calcTab = page.locator("#tab-calc, [data-tab='tab-calc']");
    await calcTab.first().click();

    // Preencher dose de 250 mcg (padrão 5mg / 2ml = 2.5 mg/ml -> 250 mcg = 0.25 mg -> 0.1 ml -> 10 UI)
    const doseInput = page.locator("#calc-dose-input");
    await doseInput.fill("250");

    // Verificar resultado
    const resBig = page.locator("#calc-res-big");
    await expect(resBig).toHaveText("10");

    // Bloco de conferência deve estar visível
    const summaryCard = page.locator("#calc-inputs-summary");
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toContainText("Frasco: 5 mg");
    await expect(summaryCard).toContainText("Diluente: 2 mL");
    await expect(summaryCard).toContainText("Dose pretendida: 250 mcg");

    // Botões de ação devem estar habilitados
    const useBtn = page.locator("#calc-use-btn");
    await expect(useBtn).toBeEnabled();

    runtime.assertCleanRuntime();
  });

  test("semana renderiza tabela dentro de wrapper de rolagem com legenda e coluna fixa", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const mockPeptides = [
      {
        id: "pep-week",
        name: "Composto Teste Semana",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        days: [1, 3, 5]
      }
    ];

    await seedStorage(page, { skipOnboarding: true, peptides: mockPeptides });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Navegar para a Semana
    const weekTab = page.locator("#tab-week, [data-tab='tab-week']");
    await weekTab.first().click();

    // Wrapper de scroll deve existir
    const scrollWrap = page.locator(".week-scroll");
    await expect(scrollWrap).toBeVisible();

    // Tabela e legenda devem estar presentes
    const table = page.locator("table.week-table");
    await expect(table).toBeVisible();

    const legend = page.locator(".week-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Aplicado");
    await expect(legend).toContainText("Pendente");
    await expect(legend).toContainText("Não programado");

    runtime.assertCleanRuntime();
  });

  test("ajustes organiza opcoes em 4 grupos estruturados e permite troca de idioma", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Navegar para Ajustes
    const settingsTab = page.locator("#tab-settings, [data-tab='tab-settings']");
    await settingsTab.first().click();

    // Deve conter os 4 grupos de ajustes
    const groups = page.locator("#view-settings .settings-group");
    await expect(groups).toHaveCount(4);

    await expect(page.locator("#settings-group-appearance")).toContainText("Aparência");
    await expect(page.locator("#settings-group-security")).toContainText("Segurança");
    await expect(page.locator("#settings-group-data")).toContainText("Dados");
    await expect(page.locator("#settings-group-about")).toContainText("Sobre");

    // Trocar idioma para English
    const enBtn = page.locator("#lang-btn-en");
    await enBtn.click();

    // Validar atualização do badge ou texto
    const badge = page.locator("#current-lang-badge");
    await expect(badge).toContainText("ENGLISH");

    runtime.assertCleanRuntime();
  });

  test("clique no botão de notificações abre modal com zero exceções ou erros de console", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const notifBtn = page.locator("#notif-btn");
    await expect(notifBtn).toBeVisible();
    await notifBtn.click();

    const notifModal = page.locator("#notif-modal");
    await expect(notifModal).toHaveClass(/on/);

    const closeBtn = page.locator("#notif-close, #nf-done");
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await expect(notifModal).not.toHaveClass(/on/);
    }

    runtime.assertCleanRuntime();
  });

  // ─── P2 (CODEX v2.5.0 Item 20): Acessibilidade Automatizada com Axe ───

  test("avalia acessibilidade WCAG 2.1 AA com Axe no Dashboard", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(400);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    runtime.assertCleanRuntime();
  });

  test("avalia acessibilidade WCAG 2.1 AA com Axe na Calculadora", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const calcTab = page.locator('[data-tab="tab-calc"], #tab-calc');
    if (await calcTab.count() > 0) {
      await calcTab.first().click();
    }
    await page.waitForTimeout(400);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    runtime.assertCleanRuntime();
  });

  for (const scenario of [
    { name: "Histórico e medições", tab: "history", open: "#open-measurement-modal-btn" },
    { name: "Ajustes, inventário e Health Connect", tab: "settings" },
    { name: "Notificações", open: "#notif-btn" }
  ]) {
    test(`avalia acessibilidade WCAG 2.1 AA em ${scenario.name}`, async ({ page }) => {
      const runtime = trackPageRuntime(page);
      await seedStorage(page, { skipOnboarding: true, peptides: [] });
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      if (scenario.tab) {
        await page.locator(`#tab-${scenario.tab}`).click();
      }
      if (scenario.open) {
        await page.locator(scenario.open).click();
      }
      await page.waitForTimeout(400);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
      runtime.assertCleanRuntime();
    });
  }
});





