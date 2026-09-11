import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

async function prepare(page, measurements) {
  const runtime = trackPageRuntime(page);
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00-03:00"));
  await seedStorage(page, { measurements });
  await page.goto("/");
  await page.locator("#tab-history").click();
  await expect(page.locator("#view-history")).toHaveAttribute("data-feature-ready", "true");
  return runtime;
}

test.describe("Fase 6 — meta pessoal de peso", () => {
  test("define, altera e apaga a meta sem alterar as medições", async ({ page }) => {
    const runtime = await prepare(page, [
      { id: "w1", date: "2026-09-01", time: "08:00", weightKg: 80, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] },
      { id: "w2", date: "2026-09-15", time: "08:00", weightKg: 77, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] }
    ]);
    await page.locator("#history-goal-weight-input").fill("75.5");
    await page.locator("#history-goal-save-btn").click();
    await expect(page.locator("#history-goal-weight-input")).toHaveValue("75.5");
    await expect(page.locator(".report-preview-summary-grid")).toContainText("1.5 kg acima da meta");
    await expect(page.locator(".report-preview-summary-grid")).toContainText("-1.5 kg");
    await page.locator("#history-goal-clear-btn").press("Enter");
    await expect(page.locator("#history-goal-weight-input")).toHaveValue("");
    const measurements = await page.evaluate(() => JSON.parse(localStorage.getItem("pep_measurements_v2")));
    expect(measurements).toHaveLength(2);
    runtime.assertCleanRuntime();
  });

  test("mantém a meta disponível sem peso no período e não causa rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const runtime = await prepare(page, [{ id: "old", date: "2026-08-01", time: "08:00", weightKg: 80, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] }]);
    await page.locator("#history-period").selectOption("7");
    await expect(page.locator("#history-goal-weight-input")).toBeVisible();
    await page.locator("#history-goal-weight-input").fill("70");
    await page.locator("#history-goal-save-btn").click();
    await expect(page.locator("#history-goal-weight-input")).toHaveValue("70");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    runtime.assertCleanRuntime();
  });
});
