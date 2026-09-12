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

  test("exige tratamento explícito para registro manual sem pendência", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await page.clock.setFixedTime(new Date("2026-09-12T10:35:00-03:00"));
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [treatment("pep_manual", "Tratamento manual")],
      logs: { "2026-09-12": { pep_manual: [{ id: "done", status: "applied", time: "08:00" }] } }
    });
    await page.goto("/");
    await page.locator("#quick-register-fab").click();
    await page.locator('[data-register="application"]').click();
    await expect(page.locator("#quick-register-body")).toContainText("Nenhum registro está pendente hoje.");
    await expect(page.locator("[data-treatment-id='pep_manual']")).toContainText("Tratamento manual");
    await page.locator("[data-treatment-id='pep_manual']").click();
    await expect(page.locator("#retro-pep-select option:checked")).toContainText("Tratamento manual");
    runtime.assertCleanRuntime();
  });

  test("exige escolha entre tratamentos para registro manual sem pendências", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await page.clock.setFixedTime(new Date("2026-09-12T10:35:00-03:00"));
    await seedStorage(page, {
      skipOnboarding: true,
      peptides: [treatment("pep_manual-a", "Tratamento A"), treatment("pep_manual-b", "Tratamento B", "20:00")],
      logs: {
        "2026-09-12": {
          "pep_manual-a": [{ id: "done-a", status: "applied", time: "08:00" }],
          "pep_manual-b": [{ id: "done-b", status: "applied", time: "20:00" }]
        }
      }
    });
    await page.goto("/");

    await page.locator("#quick-register-fab").click();
    await page.locator('[data-register="application"]').click();
    await expect(page.locator("[data-treatment-id]")).toHaveCount(2);
    await page.locator("[data-treatment-id='pep_manual-b']").click();
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

  test("navega pelas listas compactas de Mais e restaura o menu ao sair", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");
    await page.locator("#tab-settings").click();
    await expect(page.locator("#settings-menu")).toBeVisible();
    await expect(page.locator("#settings-menu [data-settings-target]")).toHaveCount(5);
    await page.locator("[data-settings-target='treatment']").click();
    await expect(page.locator("#settings-panel-treatment")).toBeVisible();
    await expect(page.locator("#settings-detail-back")).toBeVisible();
    await page.locator("#settings-detail-back").click();
    await expect(page.locator("#settings-menu")).toBeVisible();
    await page.locator("#tab-today").click();
    await page.locator("#tab-settings").click();
    await expect(page.locator("#settings-menu")).toBeVisible();
    runtime.assertCleanRuntime();
  });

  test("mantém teclado e estados ARIA dos segmentos de Jornada", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");
    await page.locator("#tab-journey").click();
    await page.locator("#journey-upcoming").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#journey-history")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#journey-history")).toHaveAttribute("tabindex", "0");
    await expect(page.locator("#view-history")).not.toHaveAttribute("hidden");
    await page.keyboard.press("Home");
    await expect(page.locator("#journey-upcoming")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#view-week")).not.toHaveAttribute("hidden");
    runtime.assertCleanRuntime();
  });

  test("usa chips de período no Progresso mantendo o estado canônico", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");
    await page.locator("#tab-progress").click();
    await page.locator("[data-progress-period='90']").click();
    await expect(page.locator("#progress-period")).toHaveValue("90");
    await expect(page.locator("[data-progress-period='90']")).toHaveClass(/is-active/);
    await page.locator("[data-progress-period='custom']").click();
    await expect(page.locator("#progress-custom-dates")).toBeVisible();
    runtime.assertCleanRuntime();
  });

  test("prende o foco no registro rápido e o devolve ao acionador", async ({ page }) => {
    const runtime = trackPageRuntime(page);
    await seedStorage(page, { skipOnboarding: true, peptides: [] });
    await page.goto("/");
    const fab = page.locator("#quick-register-fab");
    await fab.click();
    const first = page.locator("#quick-register-body [data-register]").first();
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#quick-register-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(fab).toBeFocused();
    runtime.assertCleanRuntime();
  });
});
