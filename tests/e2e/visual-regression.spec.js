import { test, expect } from "@playwright/test";
import { trackPageRuntime } from "./runtime.js";

const THEMES = Object.freeze([
  { id: "escuro", storage: "preto", highContrast: false, bodyClass: "theme-dark" },
  { id: "claro", storage: "branco", highContrast: false, bodyClass: "theme-light" },
  { id: "alto-contraste", storage: "preto", highContrast: true, bodyClass: "theme-dark" }
]);

const today = new Date();
const todayKey = today.toISOString().slice(0, 10);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayKey = yesterday.toISOString().slice(0, 10);

const VISUAL_STATE = Object.freeze({
  peptide: {
    id: "pep-visual-matrix",
    name: "Composto Visual",
    sub: "auditoria de regressão",
    dose: "250 mcg",
    ui: 10,
    perDay: 1,
    time: "20:00",
    color: "#30D5C8",
    days: null
  },
  logs: {
    [yesterdayKey]: {
      "pep-visual-matrix": [{
        id: "log-visual-matrix",
        peptideId: "pep-visual-matrix",
        scheduledDate: yesterdayKey,
        time: "08:00",
        dose: "250 mcg",
        ui: 10,
        site: "Abdômen (Direito)"
      }]
    }
  },
  inventory: [{
    id: "vial-visual-matrix",
    peptideId: "pep-visual-matrix",
    peptideName: "Composto Visual",
    totalMg: 5,
    waterMl: 2,
    concentrationMcgPerMl: 2500,
    initialMcg: 5000,
    remainingMcg: 3750,
    reconstitutionDate: todayKey,
    expirationDate: null,
    status: "active",
    movements: []
  }],
  measurements: [{
    id: "measurement-visual-matrix",
    date: todayKey,
    time: "08:00",
    weightKg: 82.4,
    energyLevel: 4,
    moodLevel: 4,
    symptoms: ["Fadiga"],
    notes: "Registro visual sintético",
    source: "local",
    ownership: "pep"
  }]
});

const SCREENSHOT_OPTIONS = Object.freeze({
  animations: "disabled",
  caret: "hide",
  scale: "css",
  // O runner Ubuntu e o Chromium empacotado podem rasterizar fontes e
  // subpixels de forma ligeiramente diferente; o limite preserva a detecção
  // de mudanças estruturais sem reprovar apenas antialiasing do ambiente.
  maxDiffPixelRatio: 0.08
});

async function installVisualState(page, { onboarding = false } = {}) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ state, onboarding: showOnboarding }) => {
    const params = new URLSearchParams(window.location.search);
    localStorage.clear();
    localStorage.setItem("pep_user_language", "pt-BR");
    localStorage.setItem("pep_theme_mode", params.get("visualTheme") || "preto");
    if (params.get("highContrast") === "true") {
      localStorage.setItem("pep_high_contrast", "true");
    }
    if (!showOnboarding) {
      localStorage.setItem("pep_onboarding_version", "1");
    }
    localStorage.setItem("pep_protocol_v2", JSON.stringify([state.peptide]));
    localStorage.setItem("pep_logs_v2", JSON.stringify(state.logs));
    localStorage.setItem("pep_inventory_v2", JSON.stringify(state.inventory));
    localStorage.setItem("pep_measurements_v2", JSON.stringify(state.measurements));
  }, { state: VISUAL_STATE, onboarding });
}

async function assertVisualAnchor(page, selector, label) {
  const element = page.locator(selector).first();
  await expect(element, `${label} deve estar visível`).toBeVisible();
  const box = await element.boundingBox();
  expect(box?.width, `${label} deve ocupar largura`).toBeGreaterThan(0);
  expect(box?.height, `${label} deve ocupar altura`).toBeGreaterThan(0);
}

async function assertViewportIntegrity(page, label) {
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

  expect(metrics.documentWidth, `overflow horizontal em ${label}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.navLeft, `navegação saiu pela esquerda em ${label}`).toBeGreaterThanOrEqual(-1);
  expect(metrics.navRight, `navegação saiu pela direita em ${label}`).toBeLessThanOrEqual(metrics.windowWidth + 1);
}

async function resetVisualScroll(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll("*" ).forEach((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
  });
  await page.waitForTimeout(50);
}

test.describe("Protocolo PEP — Matriz de regressão visual", () => {
  test.describe.configure({ timeout: 120000 });

  test("valida temas e telas preenchidas nos viewports críticos", async ({ page }, testInfo) => {
    const runtime = trackPageRuntime(page);
    await installVisualState(page);

    for (const theme of THEMES) {
      await page.goto(`/?visualTheme=${theme.storage}&highContrast=${theme.highContrast}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(400);

      const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect([360, 412, 600], `viewport não mapeado no projeto ${testInfo.project.name}`).toContain(viewportWidth);
      await expect(page.locator("body")).toHaveClass(new RegExp(theme.bodyClass));
      if (theme.highContrast) {
        await expect(page.locator("html")).toHaveClass(/high-contrast/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/high-contrast/);
      }

      await assertVisualAnchor(page, "#dash-hero", `dashboard (${theme.id})`);
      await assertVisualAnchor(page, "#dash-focus-action", `ação principal (${theme.id})`);
      await assertViewportIntegrity(page, `dashboard/${theme.id}/${viewportWidth}px`);

      await page.locator("#tab-week").click();
      await assertVisualAnchor(page, ".week-timeline", `semana (${theme.id})`);
      await assertViewportIntegrity(page, `semana/${theme.id}/${viewportWidth}px`);

      await page.locator("#tab-history").click();
      await assertVisualAnchor(page, ".history-timeline", `histórico (${theme.id})`);
      await assertVisualAnchor(page, ".measurement-chip--weight", `medidas preenchidas (${theme.id})`);
      await assertViewportIntegrity(page, `histórico/${theme.id}/${viewportWidth}px`);

      await page.locator("#hist-retro-btn").evaluate((element) => {
        element.scrollIntoView({ block: "center", inline: "nearest" });
      });
      await page.locator("#hist-retro-btn").click();
      await assertVisualAnchor(page, "#retro-log-modal.on", `mapa de aplicação (${theme.id})`);
      await assertVisualAnchor(page, ".injection-site-map", `ilustração do mapa (${theme.id})`);
      await page.locator("#retro-close").click();

      await page.locator("#tab-settings").click();
      await assertVisualAnchor(page, ".settings-section", `ajustes (${theme.id})`);
      await assertVisualAnchor(page, ".edit-vial-btn", `inventário preenchido (${theme.id})`);
      await assertVisualAnchor(page, ".inventory-status--active", `status do inventário (${theme.id})`);
      await assertViewportIntegrity(page, `ajustes/${theme.id}/${viewportWidth}px`);
      await resetVisualScroll(page);
      await expect(page).toHaveScreenshot(
        `filled-settings-${theme.id}-${viewportWidth}.png`,
        SCREENSHOT_OPTIONS
      );

      await page.locator("#tab-today").click();
      await page.locator("#dash-research-btn").click();
      await assertVisualAnchor(page, "#research-modal.on", `pesquisa (${theme.id})`);
      await assertVisualAnchor(page, ".research-card", `resultado de pesquisa (${theme.id})`);
      await page.locator("#research-modal-close").click();
    }

    runtime.assertCleanRuntime();
  });

  test("valida onboarding ilustrado nos três temas", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await installVisualState(page, { onboarding: true });

    for (const theme of THEMES) {
      await page.goto(`/?visualTheme=${theme.storage}&highContrast=${theme.highContrast}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(400);

      await assertVisualAnchor(page, "#onboarding-overlay", `onboarding (${theme.id})`);
      const image = page.locator("#onboarding-overlay .onboarding-art img");
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => element.complete ? element.naturalWidth : 0)).toBeGreaterThan(0);
      await assertViewportIntegrity(page, `onboarding/${theme.id}`);
      await resetVisualScroll(page);
      await expect(page).toHaveScreenshot(
        `onboarding-${theme.id}.png`,
        SCREENSHOT_OPTIONS
      );
    }

    runtime.assertCleanRuntime();
  });
});
