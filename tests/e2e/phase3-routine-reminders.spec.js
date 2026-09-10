import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedStorage, trackPageRuntime } from "./runtime.js";

async function storedProtocol(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("pep_protocol_v2") || "[]"));
}

async function openFirstRoutine(page) {
  await page.locator('[data-tab="today"]').click();
  await page.locator(".gear").first().click();
  await expect(page.locator("#edit-modal")).toHaveClass(/on/);
}

test.describe("Fase 3 — lembretes por rotina", () => {
  test("ativa a primeira rotina com horário e explica o controle global desligado", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page);
    await page.goto("/");
    await page.locator('[data-action="create-protocol"]').click();

    const toggle = page.locator("#edit-reminders-enabled");
    await expect(toggle).toBeDisabled();
    await page.locator("#edit-name").fill("Rotina com lembrete");
    await page.locator("#edit-ui").fill("2,5");
    await page.locator("#edit-time").fill("08:00");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await expect(page.locator("#edit-reminders-help")).toContainText("Ative também os lembretes gerais");
    const accessibility = await new AxeBuilder({ page }).include("#edit-reminder-control").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(accessibility.violations).toEqual([]);

    await page.locator("#edit-save").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    expect((await storedProtocol(page))[0]).toMatchObject({
      name: "Rotina com lembrete",
      times: ["08:00"],
      remindersEnabled: true
    });
    runtime.assertCleanRuntime();
  });

  test("mantém a rotina silenciada ao editar horários e permite reativá-la", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { peptides: [{
      id: "pep_silenced",
      name: "Rotina visível",
      dose: "62.5 mcg",
      ui: 2.5,
      perDay: 1,
      times: ["08:00"],
      time: "08:00",
      remindersEnabled: false,
      lifecycleStatus: "active"
    }] });
    await page.goto("/");

    await expect(page.locator("#today-cards")).toContainText("Rotina visível");
    await openFirstRoutine(page);
    const toggle = page.locator("#edit-reminders-enabled");
    await expect(toggle).not.toBeChecked();
    await page.locator("#edit-time").fill("09:30");
    await expect(toggle).not.toBeChecked();
    await page.locator("#edit-save").click();
    expect((await storedProtocol(page))[0]).toMatchObject({ times: ["09:30"], remindersEnabled: false });

    await expect(page.locator("#today-cards")).toContainText("Rotina visível");
    await page.locator('[data-tab="week"]').click();
    await expect(page.locator("#week-table-wrap")).toContainText("Rotina visível");

    await openFirstRoutine(page);
    await toggle.check();
    await page.locator("#edit-save").click();
    expect((await storedProtocol(page))[0].remindersEnabled).toBe(true);
    runtime.assertCleanRuntime();
  });

  test("controle permanece dentro do modal sem rolagem horizontal", async ({ page }) => {
    await seedStorage(page);
    await page.goto("/");
    await page.locator('[data-action="create-protocol"]').click();
    const layout = await page.locator("#edit-reminder-control").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const sheet = element.closest(".sheet").getBoundingClientRect();
      return { left: box.left, right: box.right, sheetLeft: sheet.left, sheetRight: sheet.right, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
    });
    expect(layout.left).toBeGreaterThanOrEqual(layout.sheetLeft - 1);
    expect(layout.right).toBeLessThanOrEqual(layout.sheetRight + 1);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });

  test("adapta o controle aos temas e larguras críticas", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "android-small", "Matriz visual executada uma vez.");
    await page.addInitScript(() => {
      const params = new URLSearchParams(window.location.search);
      localStorage.clear();
      localStorage.setItem("pep_onboarding_version", "1");
      localStorage.setItem("pep_user_language", "pt-BR");
      localStorage.setItem("pep_theme_mode", params.get("visualTheme") || "preto");
      if (params.get("highContrast") === "true") localStorage.setItem("pep_high_contrast", "true");
    });
    const themes = [
      { storage: "preto", highContrast: false, body: "theme-dark" },
      { storage: "branco", highContrast: false, body: "theme-light" },
      { storage: "preto", highContrast: true, body: "theme-dark" }
    ];

    for (const width of [360, 412, 600, 1280]) {
      await page.setViewportSize({ width, height: width >= 1280 ? 900 : 800 });
      for (const theme of themes) {
        await page.goto(`/?visualTheme=${theme.storage}&highContrast=${theme.highContrast}`);
        await page.locator('[data-action="create-protocol"]').click();
        await expect(page.locator("body")).toHaveClass(new RegExp(theme.body));
        if (theme.highContrast) await expect(page.locator("html")).toHaveClass(/high-contrast/);
        const bounds = await page.locator("#edit-reminder-control").evaluate((element) => {
          const box = element.getBoundingClientRect();
          const sheet = element.closest(".sheet").getBoundingClientRect();
          return { left: box.left, right: box.right, sheetLeft: sheet.left, sheetRight: sheet.right, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.sheetLeft - 1);
        expect(bounds.right).toBeLessThanOrEqual(bounds.sheetRight + 1);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
      }
    }
  });
});
