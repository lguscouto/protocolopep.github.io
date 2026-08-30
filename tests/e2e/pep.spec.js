import { test, expect } from "@playwright/test";
import { trackPageRuntime, seedStorage } from "./runtime.js";

test.describe("Protocolo PEP — E2E Smoke & Runtime", () => {
  test("carrega protocolo vazio sem erros de console ou requests com falha", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // O título do app ou cabeçalho deve estar visível
    const header = page.locator("header, .topbar, #app-title");
    await expect(header.first()).toBeVisible();

    runtime.assertCleanRuntime();
  });

  test("navega entre as 5 abas principais sem erro", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const tabs = ["tab-today", "tab-week", "tab-history", "tab-calc", "tab-settings"];
    for (const tabId of tabs) {
      const tabButton = page.locator(`[data-tab="${tabId}"], #${tabId}`);
      if (await tabButton.count() > 0) {
        await tabButton.first().click();
      }
    }

    runtime.assertCleanRuntime();
  });
});
