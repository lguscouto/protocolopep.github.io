import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test("carregamento sob demanda é idempotente em cliques rápidos e navegação repetida", async ({ page }) => {
  const runtime = trackPageRuntime(page);
  await seedStorage(page, { skipOnboarding: true, peptides: [] });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  await page.evaluate(() => {
    document.getElementById("tab-journey")?.click();
    document.getElementById("journey-history")?.click();
    document.getElementById("journey-history")?.click();
  });
  await expect(page.locator("#view-history")).toHaveAttribute("data-feature-ready", "true");
  await expect(page.locator("#measurement-modal")).toHaveCount(1);

  await page.evaluate(() => {
    document.getElementById("tab-settings")?.click();
    document.getElementById("tab-settings")?.click();
  });
  await expect(page.locator("#view-settings")).toHaveAttribute("data-feature-ready", "true");
  await expect(page.locator("#vial-modal")).toHaveCount(1);

  await page.evaluate(() => {
    document.getElementById("open-tools-btn")?.click();
    document.getElementById("open-tools-btn")?.click();
  });
  await expect(page.locator("#view-calc")).toHaveAttribute("data-feature-ready", "true");
  await expect(page.locator("#research-modal")).toHaveCount(1);

  await page.locator("#tab-journey").click();
  await page.locator("#journey-upcoming").click();
  await expect(page.locator("#view-week")).toHaveClass(/\bon\b/);
  await page.locator("#journey-history").click();
  await expect(page.locator("#view-history")).toHaveClass(/\bon\b/);
  for (const tab of ["progress", "settings", "today", "journey", "today"]) {
    await page.locator(`#tab-${tab}`).click();
    await expect(page.locator(`#view-${tab}`)).toHaveClass(/\bon\b/);
  }

  await expect(page.locator("main .view.on")).toHaveCount(1);
  runtime.assertCleanRuntime();
});
