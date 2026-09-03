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

  test("homologa as cinco telas sem overflow horizontal e com navegação ancorada", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.addInitScript(() => localStorage.setItem("pep_theme_mode", "preto"));

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(400);

    for (const tabId of ["today", "week", "history", "calc", "settings"]) {
      await page.locator(`[data-tab="${tabId}"]`).click();
      await page.waitForTimeout(120);

      const metrics = await page.evaluate(() => {
        const nav = document.querySelector(".nav");
        const navBox = nav?.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          navLeft: navBox?.left ?? 0,
          navRight: navBox?.right ?? 0,
          windowWidth: window.innerWidth
        };
      });

      expect(metrics.documentWidth, `overflow horizontal na aba ${tabId}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.navLeft, `navegação saiu pela esquerda na aba ${tabId}`).toBeGreaterThanOrEqual(-1);
      expect(metrics.navRight, `navegação saiu pela direita na aba ${tabId}`).toBeLessThanOrEqual(metrics.windowWidth + 1);
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
    await expect(hero).toHaveAttribute("data-state", "pending");
    await expect(page.locator(".dash-focus-eyebrow")).toContainText("Próxima ação");
    await expect(page.locator(".dash-focus-title")).toHaveText("Composto Alfa");
    await expect(page.locator("#dash-focus-action")).toHaveText(/Registrar aplicação/);
    const focusActionBox = await page.locator("#dash-focus-action").boundingBox();
    expect(focusActionBox?.height).toBeGreaterThanOrEqual(44);

    // Deve renderizar os 2 cards
    const cards = page.locator("#today-cards article.card");
    await expect(cards).toHaveCount(2);

    // Deve renderizar a seção de próximos
    const upcomingSection = page.locator(".upcoming-section");
    await expect(upcomingSection).toBeVisible();

    // A ação principal registra a primeira dose e avança para a próxima pendência
    await page.locator("#dash-focus-action").click();

    // Card deve estar com status de aplicado
    await expect(cards.first()).toHaveClass(/done/);
    await expect(page.locator(".dash-focus-title")).toHaveText("Composto Beta");

    // Ao concluir a última pendência, o hero muda para o estado de rotina em dia
    await page.locator("#dash-focus-action").click();
    await expect(hero).toHaveAttribute("data-state", "complete");
    await expect(page.locator(".dash-focus-title")).toHaveText("Tudo registrado por hoje");

    // O aviso longo saiu do dashboard; permanece apenas o lembrete local compacto
    const compactNotice = page.locator(".dash-footer-disclaimer");
    await expect(compactNotice).toContainText("Registro pessoal");
    await expect(compactNotice).not.toContainText("Confirme doses");

    runtime.assertCleanRuntime();
  });

  test("controles compactos preservam área de toque mínima em cada fluxo visual", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const today = new Date().toISOString().slice(0, 10);
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [{
        id: "pep-touch-audit",
        name: "Composto de toque",
        sub: "auditoria visual",
        dose: "500 mcg",
        ui: 10,
        perDay: 2,
        time: "08:00",
        color: "#30D5C8",
        days: null
      }],
      logs: [{
        id: "log-touch-audit",
        peptideId: "pep-touch-audit",
        date: today,
        time: "08:00",
        dose: "500 mcg",
        site: "Abdômen"
      }]
    });
    await page.addInitScript(({ today }) => {
      localStorage.setItem("pep_inventory_v2", JSON.stringify([{
        id: "vial-touch-audit",
        peptideId: "pep-touch-audit",
        peptideName: "Composto de toque",
        totalMg: 5,
        waterMl: 2,
        concentrationMcgPerMl: 2500,
        initialMcg: 5000,
        remainingMcg: 5000,
        reconstitutionDate: today,
        expirationDate: null,
        status: "active",
        movements: []
      }]));
      localStorage.setItem("pep_measurements_v2", JSON.stringify([{
        id: "measure-touch-audit",
        date: today,
        time: "08:00",
        weightKg: 82.4,
        energyLevel: 4,
        moodLevel: 4,
        symptoms: ["Fadiga"],
        notes: "",
        source: "local",
        ownership: "pep"
      }]));
    }, { today });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const assertTouchTargets = async (selector, label) => {
      const targets = page.locator(selector);
      const count = await targets.count();
      expect(count, `${label} deve renderizar ao menos um controle`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const box = await targets.nth(i).boundingBox();
        // Playwright pode devolver 43.9999px por arredondamento de escala do dispositivo.
        const width = Math.round((box?.width || 0) * 10) / 10;
        const height = Math.round((box?.height || 0) * 10) / 10;
        expect(width, `${label} largura`).toBeGreaterThanOrEqual(44);
        expect(height, `${label} altura`).toBeGreaterThanOrEqual(44);
      }
    };

    await assertTouchTargets(".take, .dose-add, .dose-undo", "ações de dose");

    await page.locator("#tab-history").click();
    await assertTouchTargets(".btn-meas-edit", "edição de medidas");
    await page.locator("#open-measurement-modal-btn").click();
    await assertTouchTargets(".symptom-chip-btn", "chips de sintomas");
    await page.locator("#measurement-modal-close").click();

    await page.locator("#tab-settings").click();
    await assertTouchTargets(".lang-select-btn", "seletor de idioma");
    await assertTouchTargets(".edit-vial-btn, .view-vial-history-btn", "ações de inventário");
    await page.locator("#open-sites-settings-btn").click();
    await assertTouchTargets(".site-control", "controles de sítios");
    await page.locator("#sites-modal-close").click();

    await page.locator("#tab-today").click();
    await page.locator("#dash-research-btn").click();
    await assertTouchTargets("#research-clear-btn, #research-category-chips .chip", "controles da pesquisa");
    await page.locator("#research-modal-close").click();

    await page.locator("#tab-calc").click();
    await assertTouchTargets("#calc-research-btn", "atalho de pesquisa da calculadora");

    await page.locator("#tab-today").click();
    await page.locator(".gear").first().click();
    await assertTouchTargets("#edit-period-toggle button, #edit-freq-type-toggle button, #modal-swatches button", "controles do protocolo");
    await page.locator('#edit-freq-type-toggle button[data-type="especificos"]').click();
    await assertTouchTargets("#edit-days-grid .day-chip", "dias da semana");

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

  test("semana renderiza linha do tempo visual com estados e ações preservadas", async ({ page }) => {
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

    const timeline = page.locator(".week-timeline");
    await expect(timeline).toBeVisible();
    await expect(page.locator(".week-day")).toHaveCount(7);
    await expect(page.locator(".week-day.is-today")).toHaveCount(1);
    await expect(page.locator(".week-event-toggle")).toHaveCount(3);
    await expect(page.locator(".week-event-edit")).toHaveCount(3);

    const legend = page.locator(".timeline-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Aplicado");
    await expect(legend).toContainText("Pendente");
    await expect(legend).toContainText("Dia sem aplicação");

    const todayEvent = page.locator(".week-day.is-today .week-event-toggle").first();
    if (await todayEvent.count() > 0) {
      const eventBox = await todayEvent.boundingBox();
      expect(eventBox?.height).toBeGreaterThanOrEqual(44);
    }

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("#view-week")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    runtime.assertCleanRuntime();
  });

  test("histórico organiza aplicações em linha do tempo por data", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const dateKey = (date) => {
      const local = new Date(date);
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      return local.toISOString().slice(0, 10);
    };
    const today = new Date();
    const todayKey = dateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dateKey(yesterday);
    const mockPeptides = [{
      id: "pep_history",
      name: "Composto Histórico",
      dose: "250 mcg",
      ui: 10,
      perDay: 1,
      time: "08:00",
      color: "#30D5C8",
      days: null
    }];
    const logs = {
      [yesterdayKey]: {
        "pep_history": {
          id: "history-yesterday",
          peptideId: "pep_history",
          scheduledDate: yesterdayKey,
          time: "08:00",
          dose: "250 mcg",
          ui: 10,
          site: "Abdômen (Direito)"
        }
      },
      [todayKey]: {
        "pep_history": [{
          id: "history-today",
          peptideId: "pep_history",
          scheduledDate: todayKey,
          time: "20:00",
          dose: "250 mcg",
          ui: 10,
          site: "Coxa (Esquerda)"
        }]
      }
    };

    await seedStorage(page, { skipOnboarding: true, peptides: mockPeptides, logs });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#tab-history").click();

    await expect(page.locator(".history-timeline")).toBeVisible();
    await expect(page.locator(".hist-day")).toHaveCount(2);
    await expect(page.locator(".hist-day.is-today")).toHaveCount(1);
    await expect(page.locator(".hist-item")).toHaveCount(2);
    await expect(page.locator(".hist-item").first()).toContainText("Composto Histórico");
    await expect(page.locator(".hist-item").first()).toContainText("📍");
    await expect(page.locator(".hist-rm")).toHaveCount(2);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("#view-history")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

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

  test("renderiza estados vazios ilustrados e compactos para inventário, medidas e pesquisa", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [{
        id: "pep_empty_states",
        name: "Composto de teste",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        time: "08:00",
        color: "#30D5C8",
        days: null
      }]
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#tab-settings").click();
    const inventoryEmpty = page.locator("#inventory-list .empty-state-illustrated--inventory");
    await expect(inventoryEmpty).toBeVisible();
    await expect(inventoryEmpty.locator(".empty-state-title")).toContainText("Seu inventário começa aqui");
    await expect(inventoryEmpty.locator("img")).toHaveAttribute("src", "/assets/illustrations/empty-inventory.png");
    await expect.poll(() => inventoryEmpty.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

    await page.locator("#tab-history").click();
    const measurementsEmpty = page.locator("#measurements-trend-summary .empty-state-illustrated--measurements");
    await expect(measurementsEmpty).toBeVisible();
    await expect(measurementsEmpty.locator(".empty-state-title")).toContainText("Registre seu primeiro acompanhamento");
    await expect(measurementsEmpty.locator("img")).toHaveAttribute("src", "/assets/illustrations/empty-measurements.png");
    await expect.poll(() => measurementsEmpty.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

    await page.locator("#tab-today").click();
    await page.locator("#dash-research-btn").click();
    await page.locator("#research-search-input").fill("termo-sem-resultado");
    const researchEmpty = page.locator("#research-results-list .empty-state-illustrated--research");
    await expect(researchEmpty).toBeVisible();
    await expect(researchEmpty.locator(".empty-state-title")).toContainText("Nenhum resultado por aqui");
    await expect(researchEmpty.locator("img")).toHaveAttribute("src", "/assets/illustrations/empty-research.png");
    await expect.poll(() => researchEmpty.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

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

  test("mantém estados semânticos legíveis ao alternar tema e alto contraste", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.addInitScript(() => localStorage.setItem("pep_theme_mode", "preto"));

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(400);
    await page.locator("#tab-settings").click();

    const languageBadge = page.locator("#current-lang-badge");
    await expect(languageBadge).toBeVisible();

    const readBadgeStyle = () => languageBadge.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.borderTopColor
      };
    });

    const darkStyle = await readBadgeStyle();
    expect(darkStyle.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(darkStyle.color).not.toBe("rgba(0, 0, 0, 0)");
    const assertA11y = async (mode) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(accessibilityScanResults.violations, `Violações no ${mode}`).toEqual([]);
    };
    await assertA11y("tema escuro");

    await page.locator("#theme-btn").click();
    await expect(page.locator("body")).toHaveClass(/theme-light/);
    await page.waitForTimeout(400);
    const lightStyle = await readBadgeStyle();
    expect(lightStyle.background).not.toBe(darkStyle.background);
    expect(lightStyle.color).not.toBe(darkStyle.color);
    await assertA11y("tema claro");

    await page.locator("#high-contrast-toggle").check();
    await expect(page.locator("html")).toHaveClass(/high-contrast/);
    await page.waitForTimeout(400);
    const highContrastStyle = await readBadgeStyle();
    expect(highContrastStyle.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(highContrastStyle.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(highContrastStyle.border).not.toBe(lightStyle.border);
    await assertA11y("alto contraste");

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





