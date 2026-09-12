import { test, expect } from "@playwright/test";

test.use({ timezoneId: "America/Sao_Paulo" });

test("cartão multidose permanece acessível nos temas, larguras e escalas de fonte críticas", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "android-small", "Matriz visual executada uma vez.");
  await page.clock.setFixedTime(new Date("2026-09-11T12:00:00-03:00"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const params = new URLSearchParams(window.location.search);
    const fontScale = Number(params.get("fontScale") || 1);
    localStorage.clear();
    localStorage.setItem("pep_onboarding_version", "1");
    localStorage.setItem("pep_user_language", "pt-BR");
    localStorage.setItem("pep_theme_mode", params.get("visualTheme") || "preto");
    if (params.get("highContrast") === "true") localStorage.setItem("pep_high_contrast", "true");
    localStorage.setItem("pep_protocol_v2", JSON.stringify([{
      id: "pep_phase4_responsive", name: "Rotina multidose", dose: "100 mcg", ui: 4,
      perDay: 3, time: "08:00", times: ["08:00", "14:00", "20:00"],
      start: "2026-09-01", days: null, accent: "#2CC5C0"
    }]));
    localStorage.setItem("pep_logs_v2", JSON.stringify({
      "2026-09-11": { "pep_phase4_responsive": [{ id: "r1", status: "applied", time: "08:05", site: "Coxa (Direita)" }] }
    }));
    const applyScale = () => {
      document.documentElement.style.setProperty("-webkit-text-size-adjust", `${fontScale * 100}%`);
      if (document.body) document.body.style.setProperty("-webkit-text-size-adjust", `${fontScale * 100}%`);
    };
    applyScale();
    document.addEventListener("DOMContentLoaded", applyScale, { once: true });
  });

  const themes = [
    { storage: "preto", highContrast: false, body: "theme-dark" },
    { storage: "branco", highContrast: false, body: "theme-light" },
    { storage: "preto", highContrast: true, body: "theme-dark" }
  ];

  for (const width of [360, 412, 600, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 800 });
    for (const fontScale of [1, 1.25, 1.5]) {
      for (const theme of themes) {
        await page.goto(`/?visualTheme=${theme.storage}&highContrast=${theme.highContrast}&fontScale=${fontScale}`);
        await expect(page.locator("body")).toHaveClass(new RegExp(theme.body));
        if (theme.highContrast) await expect(page.locator("html")).toHaveClass(/high-contrast/);
        const action = page.locator("#dash-focus-action");
        await expect(action).toContainText("Registrar aplicação");
        await expect(page.locator("#ring-n")).toContainText("1 / 3");
        const actionBox = await action.boundingBox();
        expect(actionBox?.width).toBeGreaterThanOrEqual(44);
        expect(actionBox?.height).toBeGreaterThanOrEqual(44);
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          cardRight: document.querySelector("#dash-hero")?.getBoundingClientRect().right || 0,
          viewportWidth: window.innerWidth
        }));
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
        expect(layout.cardRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
      }
    }
  }
});
