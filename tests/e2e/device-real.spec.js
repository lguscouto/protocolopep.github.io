import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

const THEMES = Object.freeze([
  { id: "escuro", storage: "preto", highContrast: false },
  { id: "claro", storage: "branco", highContrast: false },
  { id: "alto-contraste", storage: "preto", highContrast: true }
]);

const NAV_MODES = Object.freeze([
  { id: "gestos", inset: 24 },
  { id: "tres-botoes", inset: 48 }
]);

const FONT_SCALES = Object.freeze([1, 1.25, 1.5]);

const MODAL_IDS = Object.freeze([
  "edit-modal",
  "notif-modal",
  "retro-log-modal",
  "share-preview-modal",
  "backup-preview-modal",
  "report-modal",
  "diag-modal",
  "vial-modal",
  "vial-history-modal",
  "sites-modal",
  "measurement-modal",
  "research-modal",
  "compound-detail-modal",
  "confirm-modal"
]);

const A55_PROFILE = Object.freeze({
  portrait: { width: 412, height: 915 },
  landscape: { width: 915, height: 412 }
});

function isLandscape(testInfo) {
  return testInfo.project.name.includes("landscape");
}

function getViewportFor(testInfo) {
  return isLandscape(testInfo) ? A55_PROFILE.landscape : A55_PROFILE.portrait;
}

async function installDeviceSimulation(page) {
  await page.addInitScript(() => {
    const applyProfile = () => {
      const params = new URLSearchParams(window.location.search);
      const landscape = params.get("orientation") === "landscape";
      const navInset = Number(params.get("navInset") || 24);
      const fontScale = Number(params.get("fontScale") || 1);
      const root = document.documentElement;
      if (!root) {
        document.addEventListener("DOMContentLoaded", applyProfile, { once: true });
        return;
      }
      const bottomInset = landscape ? 0 : navInset;
      const rightInset = landscape ? navInset : 0;

      root.dataset.testDevice = "galaxy-a55";
      root.dataset.testOrientation = landscape ? "landscape" : "portrait";
      root.dataset.testNavMode = params.get("navMode") || "gestos";
      root.dataset.testFontScale = String(fontScale);
      root.style.setProperty("--safe-area-inset-top", "24px");
      root.style.setProperty("--safe-area-inset-right", `${rightInset}px`);
      root.style.setProperty("--safe-area-inset-bottom", `${bottomInset}px`);
      root.style.setProperty("--safe-area-inset-left", "0px");
      // Definimos também os aliases consumidos pelos componentes. Isso evita
      // depender da ordem em que o WebView calcula variáveis que usam env().
      root.style.setProperty("--app-safe-top", "24px");
      root.style.setProperty("--app-safe-right", `${rightInset}px`);
      root.style.setProperty("--app-safe-bottom", `${bottomInset}px`);
      root.style.setProperty("--app-safe-left", "0px");
      root.style.setProperty("--test-system-inset-bottom", `${bottomInset}px`);
      root.style.setProperty("--test-system-inset-right", `${rightInset}px`);

      // O WebView Android aplica esta propriedade quando a escala de fonte do
      // sistema aumenta. Ela preserva a viewport CSS e aumenta a métrica de
      // texto, que é justamente o cenário que pressiona os componentes.
      root.style.setProperty("-webkit-text-size-adjust", `${fontScale * 100}%`);
      const applyBodyScale = () => {
        if (!document.body) return;
        document.body.style.setProperty("-webkit-text-size-adjust", `${fontScale * 100}%`);
      };
      applyBodyScale();
      document.addEventListener("DOMContentLoaded", applyBodyScale, { once: true });
    };

    applyProfile();
  });

  await page.addInitScript(() => {
    const params = new URLSearchParams(window.location.search);
    localStorage.setItem("pep_theme_mode", params.get("visualTheme") || "preto");
    if (params.get("highContrast") === "true") {
      localStorage.setItem("pep_high_contrast", "true");
    } else {
      localStorage.removeItem("pep_high_contrast");
    }
  });
}

function scenarioUrl({ theme, nav, fontScale, landscape }) {
  const query = new URLSearchParams({
    visualTheme: theme.storage,
    highContrast: String(theme.highContrast),
    navMode: nav.id,
    navInset: String(nav.inset),
    fontScale: String(fontScale),
    orientation: landscape ? "landscape" : "portrait"
  });
  return `/?${query.toString()}`;
}

async function waitForStableLayout(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(100);
}

async function assertPageInvariants(page, { nav, landscape }, label) {
  const metrics = await page.evaluate(({ inset, landscape: isLandscapeView }) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const reserved = isLandscapeView
      ? { left: viewport.width - inset, right: viewport.width, top: 0, bottom: viewport.height }
      : { left: 0, right: viewport.width, top: viewport.height - inset, bottom: viewport.height };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" ||
        style.pointerEvents === "none" || rect.width <= 0 || rect.height <= 0 ||
        element.getAttribute("aria-hidden") === "true") return false;
      let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor);
        if ([ancestorStyle.overflow, ancestorStyle.overflowX, ancestorStyle.overflowY]
          .some((value) => value === "hidden" || value === "clip" || value === "auto" || value === "scroll")) {
          const ancestorRect = ancestor.getBoundingClientRect();
          clip = {
            left: Math.max(clip.left, ancestorRect.left),
            top: Math.max(clip.top, ancestorRect.top),
            right: Math.min(clip.right, ancestorRect.right),
            bottom: Math.min(clip.bottom, ancestorRect.bottom)
          };
        }
      }
      return rect.right > clip.left && rect.left < clip.right &&
        rect.bottom > clip.top && rect.top < clip.bottom;
    };
    const crosses = [];
    for (const element of document.querySelectorAll("button, a, input, select, textarea, [role='button']")) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      const intersects = rect.right > reserved.left && rect.left < reserved.right &&
        rect.bottom > reserved.top && rect.top < reserved.bottom;
      if (intersects) {
        crosses.push({ id: element.id || "(sem-id)", tag: element.tagName, rect: {
          left: Math.round(rect.left), top: Math.round(rect.top),
          right: Math.round(rect.right), bottom: Math.round(rect.bottom)
        } });
      }
    }
    const scrollables = [document.documentElement, ...document.querySelectorAll(".sheet-body, .view.on")];
    const overflow = scrollables.map((element) => ({
      selector: element === document.documentElement ? "document" : `.${element.className}`,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth
    })).filter(({ scrollWidth, clientWidth }) => scrollWidth > clientWidth + 1);
    return {
      crosses,
      overflow,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  }, { inset: nav.inset, landscape });

  expect(metrics.crosses, `${label}: ação clicável entrou no inset do sistema`).toEqual([]);
  expect(metrics.overflow, `${label}: scrollWidth ultrapassou clientWidth`).toEqual([]);
  expect(metrics.documentWidth, `${label}: documento excedeu a viewport`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function assertLastContentAboveNavigation(page, { nav, landscape }, label) {
  const metrics = await page.evaluate(({ inset, landscape: isLandscapeView }) => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(
      0,
      scrollingElement.scrollHeight - window.innerHeight,
      document.body?.scrollHeight - window.innerHeight || 0
    );
    const activeView = document.querySelector(".view.on");
    const nav = document.querySelector(".nav");
    const visibleRects = activeView ? [...activeView.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.position !== "fixed" && style.display !== "none" &&
          style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => element.getBoundingClientRect()) : [];
    const contentBottom = visibleRects.reduce((max, rect) => Math.max(max, rect.bottom), activeView?.getBoundingClientRect().bottom || 0);
    const contentBottomAtDocumentEnd = contentBottom + window.scrollY - maxScroll;
    const navRect = nav?.getBoundingClientRect();
    const usableBottom = isLandscapeView ? window.innerHeight : window.innerHeight - inset;
    return {
      contentBottom: contentBottomAtDocumentEnd,
      navTop: navRect?.top ?? window.innerHeight,
      usableBottom,
      scrollY: window.scrollY,
      maxScroll,
      documentScrollHeight: scrollingElement.scrollHeight,
      bodyScrollHeight: document.body?.scrollHeight ?? null
    };
  }, { inset: nav.inset, landscape });

  const boundary = landscape ? metrics.navTop : Math.min(metrics.navTop, metrics.usableBottom);
  expect(metrics.contentBottom, `${label}: barra inferior cobriu o último conteúdo`).toBeLessThanOrEqual(boundary + 1);
}

async function assertSheetInvariants(page, modalId, label) {
  const metrics = await page.locator(`#${modalId} .sheet`).evaluate((sheet) => {
    const body = sheet.querySelector(".sheet-body");
    const foot = sheet.querySelector(".sheet-foot");
    if (!body) return { hasBody: false };
    const visibleField = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        !element.disabled && rect.width > 0 && rect.height > 0;
    };
    const fields = [...body.querySelectorAll('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')]
      .filter(visibleField);
    body.style.scrollBehavior = "auto";
    body.scrollTop = 0;
    const first = fields[0];
    first?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const bodyRect = body.getBoundingClientRect();
    const firstRect = first?.getBoundingClientRect();
    body.scrollTop = body.scrollHeight;
    const last = fields.at(-1);
    last?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const lastRect = last?.getBoundingClientRect();
    body.scrollTop = 0;
    const sheetRect = sheet.getBoundingClientRect();
    const footRect = foot?.getBoundingClientRect();
    return {
      hasBody: true,
      fieldCount: fields.length,
      firstReachable: !firstRect || (firstRect.top >= bodyRect.top - 1 && firstRect.bottom <= bodyRect.bottom + 1),
      lastReachable: !lastRect || (lastRect.top >= bodyRect.top - 1 && lastRect.bottom <= bodyRect.bottom + 1),
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      sheetScrollWidth: sheet.scrollWidth,
      sheetClientWidth: sheet.clientWidth,
      bodyTop: bodyRect.top,
      bodyBottom: bodyRect.bottom,
      footTop: footRect?.top ?? null,
      footBottom: footRect?.bottom ?? null,
      viewportHeight: window.innerHeight,
      sheetTop: sheetRect.top,
      sheetScrollTop: sheet.scrollTop,
      bodyScrollTop: body.scrollTop
    };
  });

  expect(metrics.hasBody, `${label}: sheet sem corpo rolável`).toBe(true);
  expect(metrics.firstReachable, `${label}: primeiro campo não alcançável`).toBe(true);
  expect(metrics.lastReachable, `${label}: último campo não alcançável`).toBe(true);
  expect(metrics.bodyScrollWidth, `${label}: corpo excedeu sua largura`).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
  expect(metrics.sheetScrollWidth, `${label}: sheet excedeu sua largura`).toBeLessThanOrEqual(metrics.sheetClientWidth + 1);
  expect(metrics.footTop === null || metrics.footTop >= metrics.bodyBottom - 1, `${label}: rodapé cobriu o corpo`).toBe(true);
  expect(metrics.footBottom === null || metrics.footBottom <= metrics.viewportHeight + 1, `${label}: rodapé saiu da viewport`).toBe(true);
  expect(metrics.sheetScrollTop, `${label}: sheet não iniciou no topo`).toBe(0);
  expect(metrics.bodyScrollTop, `${label}: corpo não iniciou no topo`).toBe(0);
  expect(metrics.sheetTop, `${label}: sheet começou fora da viewport`).toBeGreaterThanOrEqual(-1);
}

async function showModal(page, modalId) {
  await page.evaluate((id) => {
    document.querySelectorAll(".modal.on").forEach((modal) => modal.classList.remove("on"));
    document.getElementById(id)?.classList.add("on");
  }, modalId);
  await page.waitForTimeout(350);
}

test.describe("Protocolo PEP — Galaxy A55 / geometria real", () => {
  test("mantém invariantes em navegação, fonte e tema", async ({ page }, testInfo) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [{
        id: "pep-a55",
        name: "Composto A55",
        sub: "perfil de dispositivo real",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        time: "08:00",
        color: "#30D5C8",
        days: null
      }]
    });
    await installDeviceSimulation(page);
    const landscape = isLandscape(testInfo);

    for (const theme of THEMES) {
      for (const nav of NAV_MODES) {
        for (const fontScale of FONT_SCALES) {
          await page.goto(scenarioUrl({ theme, nav, fontScale, landscape }));
          await waitForStableLayout(page);
          await expect(page.locator("html")).toHaveAttribute("data-test-device", "galaxy-a55");
          await expect(page.locator("html")).toHaveAttribute("data-test-font-scale", String(fontScale));
          await assertPageInvariants(page, { nav, landscape }, `${theme.id}/${nav.id}/${fontScale}x`);

          await page.locator("#tab-settings").click();
          await assertPageInvariants(page, { nav, landscape }, `ajustes/${theme.id}/${nav.id}/${fontScale}x`);
          await assertLastContentAboveNavigation(page, { nav, landscape }, `ajustes/${theme.id}/${nav.id}/${fontScale}x`);

          await page.locator("#notif-btn").click();
          await page.waitForTimeout(350);
          await expect(page.locator("#notif-modal")).toHaveClass(/on/);
          await assertSheetInvariants(page, "notif-modal", `notificações/${theme.id}/${nav.id}/${fontScale}x`);
          await assertPageInvariants(page, { nav, landscape }, `notificações/${theme.id}/${nav.id}/${fontScale}x`);
          await page.locator("#notif-close").click();
        }
      }
    }

    runtime.assertCleanRuntime();
  });

  test("permite alcançar os campos extremos de todos os sheets", async ({ page }, testInfo) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await installDeviceSimulation(page);
    const landscape = isLandscape(testInfo);
    const theme = THEMES[0];
    const nav = NAV_MODES[0];
    await page.goto(scenarioUrl({ theme, nav, fontScale: 1, landscape }));
    await waitForStableLayout(page);

    for (const modalId of MODAL_IDS) {
      await showModal(page, modalId);
      await expect(page.locator(`#${modalId}`)).toHaveClass(/on/);
      await assertSheetInvariants(page, modalId, modalId);
      await assertPageInvariants(page, { nav, landscape }, modalId);
    }

    await page.evaluate(() => document.querySelectorAll(".modal.on").forEach((modal) => modal.classList.remove("on")));
    runtime.assertCleanRuntime();
  });

  test("captura snapshots do A55 em temas e orientações", async ({ page }, testInfo) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await installDeviceSimulation(page);
    const landscape = isLandscape(testInfo);
    const viewport = getViewportFor(testInfo);
    const screenshotOptions = { animations: "disabled", caret: "hide", scale: "css" };

    for (const theme of THEMES) {
      const nav = NAV_MODES[0];
      await page.goto(scenarioUrl({ theme, nav, fontScale: 1, landscape }));
      await waitForStableLayout(page);
      await page.locator("#tab-settings").click();
      await expect(page).toHaveScreenshot(
        `galaxy-a55-${landscape ? "landscape" : "portrait"}-${theme.id}-${viewport.width}x${viewport.height}-settings.png`,
        screenshotOptions
      );

      await page.locator("#notif-btn").click();
      await expect(page.locator("#notif-modal .sheet")).toHaveScreenshot(
        `galaxy-a55-${landscape ? "landscape" : "portrait"}-${theme.id}-${viewport.width}x${viewport.height}-notifications.png`,
        screenshotOptions
      );
      await page.locator("#notif-close").click();
    }

    runtime.assertCleanRuntime();
  });

  test("mantém o modal utilizável com o teclado virtual aberto", async ({ page }, testInfo) => {
    test.skip(isLandscape(testInfo), "o cenário de teclado é coberto no retrato");
    const runtime = trackPageRuntime(page);
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [{
        id: "pep-a55-keyboard",
        name: "Composto teclado",
        dose: "250 mcg",
        ui: 10,
        perDay: 1,
        time: "08:00",
        color: "#30D5C8",
        days: null
      }]
    });
    await installDeviceSimulation(page);
    const theme = THEMES[0];
    const nav = NAV_MODES[0];
    await page.goto(scenarioUrl({ theme, nav, fontScale: 1, landscape: false }));
    await waitForStableLayout(page);
    await page.locator("#today-cards .gear").first().click();
    await expect(page.locator("#edit-modal")).toHaveClass(/on/);
    await page.waitForTimeout(350);

    const input = page.locator("#edit-note");
    await input.focus();
    await page.setViewportSize({ width: 412, height: 600 });
    await page.waitForTimeout(150);
    await assertSheetInvariants(page, "edit-modal", "teclado virtual");
    await page.evaluate(() => document.activeElement?.blur());
    await input.focus();
    await page.waitForTimeout(500);
    const focusedBounds = await input.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const body = element.closest(".sheet-body").getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, bodyTop: body.top, bodyBottom: body.bottom };
    });
    expect(focusedBounds.top).toBeGreaterThanOrEqual(focusedBounds.bodyTop - 1);
    expect(focusedBounds.bottom).toBeLessThanOrEqual(focusedBounds.bodyBottom + 1);

    await page.setViewportSize({ width: 412, height: 915 });
    await page.locator("#edit-close").click();
    runtime.assertCleanRuntime();
  });
});
