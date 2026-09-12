import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

const treatment = (id, name, time = "08:00") => ({
  id,
  name,
  dose: "250 mcg",
  ui: 5,
  time,
  times: [time],
  frequency: "daily",
  perDay: 1,
  administrationRoute: "subcutaneous",
  administrationLegacy: false,
  lifecycleStatus: "active",
  startDate: "2026-09-01",
  accent: "#2CC5C0"
});

test.describe("Experiência 4.0", () => {
  test("expõe quatro destinos principais e mantém o registro global fora do tablist", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");

    await expect(page.locator(".nav [role='tab']")).toHaveCount(4);
    await expect(page.locator("#tab-today, #tab-journey, #tab-progress, #tab-settings")).toHaveCount(4);
    await expect(page.locator(".nav #quick-register-fab")).toHaveCount(0);
    const fabBox = await page.locator("#quick-register-fab").boundingBox();
    expect(fabBox?.width).toBeGreaterThanOrEqual(48);
    expect(fabBox?.height).toBeGreaterThanOrEqual(48);

    await page.locator("#tab-journey").click();
    await expect(page.locator("#view-week")).toBeVisible();
    await page.locator("#journey-history").click();
    await expect(page.locator("#view-history")).toBeVisible();
    await page.locator("#tab-progress").click();
    await expect(page.locator("#view-progress")).toBeVisible();
    runtime.assertCleanRuntime();
  });

  test("abre aplicação compacta direto quando existe uma única pendência", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await page.clock.setFixedTime(new Date("2026-09-12T10:35:00-03:00"));
    await seedStorage(page, { skipOnboarding: true, peptides: [treatment("one", "Tratamento único")] });
    await page.goto("/");

    await page.locator("#quick-register-fab").click();
    await page.locator('[data-register="application"]').click();
    await expect(page.locator("#retro-log-modal")).toHaveClass(/on/);
    await expect(page.locator("#retro-log-modal")).toHaveAttribute("data-mode", "compact");
    await expect(page.locator("#retro-pep-select option:checked")).toContainText("Tratamento único");
    await expect(page.locator("#retro-time-input")).toBeVisible();
    await expect(page.locator("#retro-status-select")).not.toBeVisible();
    runtime.assertCleanRuntime();
  });

  test("pede a escolha quando há várias pendências", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await page.clock.setFixedTime(new Date("2026-09-12T10:35:00-03:00"));
    await seedStorage(page, { skipOnboarding: true, peptides: [treatment("a", "Tratamento A"), treatment("b", "Tratamento B", "20:00")] });
    await page.goto("/");

    await page.locator("#quick-register-fab").click();
    await page.locator('[data-register="application"]').click();
    await expect(page.locator("[data-treatment-id]")).toHaveCount(2);
    await page.locator("[data-treatment-id]", { hasText: "Tratamento B" }).click();
    await expect(page.locator("#retro-pep-select option:checked")).toContainText("Tratamento B");
    runtime.assertCleanRuntime();
  });

  test("abre peso sem carregar Histórico e inicia a data pelo dia local", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await page.clock.setFixedTime(new Date("2026-09-12T00:30:00-03:00"));
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");

    await page.locator("#quick-register-fab").click();
    await page.locator('[data-register="weight"]').click();
    await expect(page.locator("#measurement-modal")).toHaveClass(/on/);
    await expect(page.locator("#measurement-modal")).toHaveAttribute("data-mode", "weight");
    await expect(page.locator("#meas-date-input")).toHaveValue("2026-09-12");
    await expect(page.locator(".measurement-section--weight")).toBeVisible();
    await expect(page.locator(".measurement-section--symptoms")).toBeHidden();
    await expect(page.locator(".measurement-circumferences")).toBeHidden();
    await expect(page.locator("#view-history")).not.toHaveAttribute("data-feature-ready", "true");
    runtime.assertCleanRuntime();
  });
});
