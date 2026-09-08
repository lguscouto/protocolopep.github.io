import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

function keyFor(date) {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
}

function shiftKey(key, days) {
  const value = new Date(`${key}T12:00:00`);
  value.setDate(value.getDate() + days);
  return keyFor(value);
}

test.describe("Fase 2 — consistência descritiva", () => {
  test("exibe o resumo da rotina e alterna entre 7 e 30 dias", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const today = keyFor(new Date());
    const yesterday = shiftKey(today, -1);
    const peptide = {
      id: "pep_phase2",
      name: "Rotina Fase 2",
      dose: "250 mcg",
      ui: 10,
      perDay: 1,
      time: "08:00",
      start: shiftKey(today, -29),
      days: null,
      interval: null,
      lifecycleStatus: "active"
    };
    const logs = {
      [today]: {
        pep_phase2: {
          id: "phase2-today",
          peptideId: "pep_phase2",
          scheduledDate: today,
          time: "08:00",
          dose: "250 mcg",
          ui: 10,
          status: "applied"
        }
      },
      [yesterday]: {
        pep_phase2: {
          id: "phase2-yesterday",
          peptideId: "pep_phase2",
          scheduledDate: yesterday,
          time: "08:00",
          dose: "250 mcg",
          ui: 10,
          status: "skipped",
          statusReason: "Pausa pessoal"
        }
      }
    };

    await seedStorage(page, { skipOnboarding: true, peptides: [peptide], logs });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#tab-history").click();

    const summary = page.locator("#adherence-summary");
    await expect(summary).toContainText("Consistência da rotina");
    await expect(summary.locator(".adherence-period-btn.is-selected")).toHaveText("7 dias");
    await expect(summary.locator("[role=progressbar]")).toHaveAttribute("aria-valuenow", "14");
    await expect(summary).toContainText("2/7");

    await summary.locator('[data-adherence-days="30"]').click();
    await expect(summary.locator(".adherence-period-btn.is-selected")).toHaveText("30 dias");
    await expect(summary).toContainText("Últimos 30 dias");
    await expect(summary.locator("[role=progressbar]")).toHaveAttribute("aria-valuenow", "3");

    runtime.assertCleanRuntime();
  });

  test("mantém o histórico limpo quando não existe agenda no período", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#tab-history").click();

    await expect(page.locator("#adherence-summary")).toBeEmpty();
    runtime.assertCleanRuntime();
  });
});
