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

test.describe("Fase 3 — relatório pessoal", () => {
  test("exibe resumo do período e inclui medições no relatório completo", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    const today = keyFor(new Date());
    const peptide = {
      id: "pep-phase3",
      name: "Rotina do relatório",
      dose: "250 mcg",
      ui: 10,
      perDay: 1,
      time: "08:00",
      start: shiftKey(today, -5),
      days: null,
      interval: null,
      lifecycleStatus: "active"
    };
    const logs = {
      [today]: {
        "pep-phase3": {
          id: "dose-phase3",
          peptideId: "pep-phase3",
          scheduledDate: today,
          time: "08:00",
          status: "applied"
        }
      }
    };
    const measurements = [{
      id: "measurement-phase3",
      date: today,
      time: "07:00",
      weightKg: 82.4,
      energyLevel: 4,
      moodLevel: 3,
      symptoms: ["Fadiga"],
      notes: "Observação pessoal",
      source: "local"
    }];

    await seedStorage(page, { skipOnboarding: true, peptides: [peptide], logs, measurements });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#tab-journey").click();
    await page.locator("#journey-history").click();
    await page.locator("#hist-report-btn").click();

    const modal = page.locator("#report-modal");
    await expect(modal).toHaveClass(/on/);
    await expect(modal.locator("#report-preview-summary")).toContainText("aplicações registradas");
    await expect(modal.locator("#report-opt-measurements")).toBeChecked();
    await expect(modal.locator("#report-opt-measurements")).toBeDisabled();
    await expect(modal.locator("#report-preview-summary")).toContainText("1 medições incluídas");
    await expect(modal.locator("#report-entries-count")).toContainText("1 medições incluídas");

    runtime.assertCleanRuntime();
  });
});
