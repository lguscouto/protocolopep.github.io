import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

const MEASUREMENTS = [
  { id: "weight-day-1", date: "2026-09-01", time: "08:00", weightKg: 81.2, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] },
  { id: "weight-day-2-morning", date: "2026-09-02", time: "07:00", weightKg: 80.9, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] },
  { id: "weight-day-2-latest", date: "2026-09-02", time: "20:00", weightKg: 80.7, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] },
  { id: "weight-day-11", date: "2026-09-11", time: "09:15", weightKg: 79.8, source: "health_connect", ownership: "external", symptoms: [], symptomDetails: [] }
];

async function prepare(page, measurements = MEASUREMENTS) {
  const runtime = trackPageRuntime(page);
  await page.clock.setFixedTime(new Date("2026-09-12T12:00:00-03:00"));
  await seedStorage(page, { measurements });
  await page.goto("/");
  await page.locator("#tab-progress").click();
  await expect(page.locator("#view-progress")).toHaveAttribute("data-feature-ready", "true");
  return runtime;
}

test.describe("Fase 1 — gráfico de evolução do peso", () => {
  test("mostra o último peso de cada dia e preserva os intervalos reais", async ({ page }) => {
    const runtime = await prepare(page);
    const chart = page.getByTestId("weight-chart");
    await expect(chart).toBeVisible();

    const points = chart.locator(".weight-chart-point");
    await expect(points).toHaveCount(3);
    await expect(points.nth(1)).toHaveAttribute("data-measurement-id", "weight-day-2-latest");
    const touchTarget = await points.first().boundingBox();
    expect(touchTarget?.width).toBeGreaterThanOrEqual(44);
    expect(touchTarget?.height).toBeGreaterThanOrEqual(44);

    const xCoordinates = await points.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return box.left + box.width / 2;
    }));
    expect((xCoordinates[1] - xCoordinates[0]) / (xCoordinates[2] - xCoordinates[0])).toBeCloseTo(0.1, 3);

    await points.nth(1).hover();
    await expect(page.locator("#history-weight-chart-detail")).toContainText("02/09/2026 às 20:00: 80.7 kg");

    await page.locator("#progress-period").selectOption("custom");
    await page.locator("#progress-start-date").fill("2026-09-10");
    await page.locator("#progress-end-date").fill("2026-09-12");
    await expect(chart.locator(".weight-chart-point")).toHaveCount(1);
    await expect(chart.locator(".weight-chart-point")).toHaveAttribute("data-measurement-id", "weight-day-11");
    runtime.assertCleanRuntime();
  });

  test("abre o registro por teclado, mantém Health Connect somente leitura e não causa overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const runtime = await prepare(page);
    const externalPoint = page.locator('[data-measurement-id="weight-day-11"]');

    await externalPoint.focus();
    await expect(externalPoint).toBeFocused();
    await expect(page.locator("#history-weight-chart-detail")).toContainText("11/09/2026 às 09:15: 79.8 kg");
    await externalPoint.press("Enter");

    await expect(page.locator("#measurement-modal")).toHaveClass(/on/);
    await expect(page.locator("#measurement-modal-title")).toHaveText("Registro Externo (Health Connect)");
    await expect(page.locator("#meas-date-input")).toBeDisabled();
    await expect(page.locator("#meas-time-input")).toBeDisabled();
    await expect(page.locator("#meas-weight-input")).toBeDisabled();

    await page.locator("#measurement-modal-close").click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    runtime.assertCleanRuntime();
  });

  test("mantém a evolução útil quando há observações sem peso", async ({ page }) => {
    const runtime = await prepare(page, [{
      id: "symptom-only", date: "2026-09-10", time: "08:00", weightKg: null,
      source: "local", ownership: "pep", symptoms: ["Fadiga"], symptomDetails: [{ name: "Fadiga", intensity: "leve" }]
    }]);

    await expect(page.getByTestId("weight-chart")).toHaveCount(0);
    await expect(page.getByTestId("weight-chart-empty")).toContainText("Ainda não há pesos válidos neste período");
    await expect(page.locator(".history-symptom-frequency")).toContainText("Fadiga");
    runtime.assertCleanRuntime();
  });
});
