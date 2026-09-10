import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

async function prepare(page, measurements = []) {
  const runtime = trackPageRuntime(page);
  await page.clock.setFixedTime(new Date("2026-09-12T12:00:00-03:00"));
  await seedStorage(page, { measurements });
  await page.goto("/");
  await page.locator("#tab-history").click();
  await expect(page.locator("#view-history")).toHaveAttribute("data-feature-ready", "true");
  return runtime;
}

test.describe("Fase 2 — circunferências corporais", () => {
  test("cria, exibe, alterna o gráfico e edita circunferências", async ({ page }) => {
    const runtime = await prepare(page);
    await page.locator("#open-measurement-modal-btn").click();
    await expect(page.locator(".measurement-circumferences")).not.toHaveAttribute("open", "");
    await page.locator(".measurement-circumferences summary").click();
    await page.locator("#meas-date-input").fill("2026-09-10");
    await page.locator("#meas-abdomen-input").fill("94,5");
    await page.locator("#meas-waist-input").fill("89");
    await page.locator("#meas-hips-input").fill("101,25");
    await page.locator("#measurement-form button[type='submit']").click();

    const selector = page.locator("#history-body-metric");
    await expect(selector).toHaveValue("abdomen");
    await expect(selector.locator("option")).toHaveCount(3);
    await expect(page.locator(".weight-chart-heading")).toContainText("Evolução de abdômen");
    await expect(page.locator("#history-weight-chart-detail")).toContainText("94.5 cm");

    await selector.selectOption("waist");
    await expect(page.locator(".weight-chart-heading")).toContainText("Evolução de cintura");
    await page.locator(".weight-chart-point").press("Enter");
    await expect(page.locator("#measurement-modal")).toHaveClass(/on/);
    await expect(page.locator("#meas-waist-input")).toHaveValue("89");
    await page.locator("#meas-waist-input").fill("");
    await page.locator("#measurement-form button[type='submit']").click();
    await expect(page.locator("#history-body-metric option[value='waist']")).toHaveCount(0);
    await page.locator("#history-period").selectOption("custom");
    await page.locator("#history-start-date").fill("2026-09-11");
    await page.locator("#history-end-date").fill("2026-09-12");
    await expect(page.locator("#history-body-metric")).toHaveCount(0);
    await expect(page.locator("#measurements-trend-summary .empty-state-title")).toBeVisible();
    runtime.assertCleanRuntime();
  });

  test("mantém circunferências bloqueadas em registro externo e sem overflow móvel", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const runtime = await prepare(page, [{
      id: "external", date: "2026-09-11", time: "09:15", weightKg: 79.8,
      source: "health_connect", ownership: "external", symptoms: [], symptomDetails: []
    }]);
    await page.locator(".weight-chart-point").click();
    await expect(page.locator("#meas-abdomen-input")).toBeDisabled();
    await expect(page.locator("#meas-waist-input")).toBeDisabled();
    await expect(page.locator("#meas-hips-input")).toBeDisabled();
    await expect(page.locator("#meas-circumferences-help")).toContainText("Crie um registro local");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    runtime.assertCleanRuntime();
  });

  test("mantém o gráfico responsivo no desktop nos temas claro, escuro e alto contraste", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "android-small", "A matriz móvel já cobre 360, 412 e 600 px.");
    await page.setViewportSize({ width: 1280, height: 800 });
    const measurements = [{ id: "body", date: "2026-09-10", time: "08:00", weightKg: 80, circumferencesCm: { abdomen: 94, waist: 89, hips: 101 }, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] }];
    for (const theme of [{ mode: "preto", contrast: false }, { mode: "branco", contrast: false }, { mode: "preto", contrast: true }]) {
      await page.addInitScript(({ mode, contrast }) => {
        localStorage.setItem("pep_theme_mode", mode);
        localStorage.setItem("pep_high_contrast", String(contrast));
      }, theme);
      await prepare(page, measurements);
      await page.locator("#history-body-metric").selectOption("hips");
      await expect(page.locator(".weight-chart-heading")).toContainText("Evolução de quadril");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});
