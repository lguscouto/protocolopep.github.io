import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

const protocol = {
  id: "pep_revision", name: "Rotina revisada", dose: "100 mcg", ui: 2.5, perDay: 1, times: ["08:00"], lifecycleStatus: "active",
  revisions: [
    { id: "legacy", legacy: true, status: "active", effectiveFrom: "2026-09-01T08:00:00.000Z", config: { name: "Legado", times: ["08:00"] } },
    { id: "pause", status: "paused", effectiveFrom: "2026-09-05T08:00:00.000Z", config: { name: "Rotina revisada", dose: "100 mcg", ui: 2.5, freq: "Todos os dias", perDay: 1, times: ["08:00"], remindersEnabled: true } },
    { id: "resume", status: "active", effectiveFrom: "2026-09-05T18:00:00.000Z", config: { name: "Rotina revisada", dose: "120 mcg", ui: 3, freq: "Todos os dias", perDay: 1, times: ["18:00"], remindersEnabled: false } }
  ]
};

test("Fase 7 — seleciona revisões persistidas sem alterar o gráfico corporal", async ({ page }) => {
  const runtime = trackPageRuntime(page);
  await page.clock.setFixedTime(new Date("2026-09-12T12:00:00-03:00"));
  await seedStorage(page, { peptides: [protocol], measurements: [
    { id: "w1", date: "2026-09-01", time: "08:00", weightKg: 80, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] },
    { id: "w2", date: "2026-09-10", time: "08:00", weightKg: 79, source: "local", ownership: "pep", symptoms: [], symptomDetails: [] }
  ] });
  await page.goto("/");
  await page.locator("#tab-progress").click();
  await expect(page.locator("#history-revision-compound")).toHaveValue("");
  await expect(page.locator(".protocol-revision-marker")).toHaveCount(0);
  await page.locator("#history-revision-compound").selectOption("pep_revision");
  await expect(page.locator(".protocol-revision-marker")).toHaveCount(2);
  await page.locator(".protocol-revision-marker").first().press("Enter");
  await expect(page.locator("#history-protocol-revision-detail")).toContainText("Pausado");
  await expect(page.locator("#history-protocol-revision-detail")).toContainText("100 mcg");
  await expect(page.locator(".weight-chart-point")).toHaveCount(2);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  runtime.assertCleanRuntime();
});
