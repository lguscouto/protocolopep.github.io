import { test, expect } from "@playwright/test";
import { seedStorage, trackPageRuntime } from "./runtime.js";

test.use({ timezoneId: "America/Sao_Paulo" });

const TODAY = "2026-09-08";
const BASE_PROTOCOL = {
  id: "pep_phase1_compound", name: "Composto de teste", dose: "62.5 mcg", ui: 2.5,
  perDay: 2, times: ["08:00", "18:00"], time: "08:00", days: null,
  start: "2026-09-06", accent: "#2CC5C0"
};
const VIAL = {
  id: "phase1-vial", peptideId: BASE_PROTOCOL.id, peptideName: BASE_PROTOCOL.name,
  lotNumber: "LOTE-TESTE", totalMg: 5, waterMl: 2, remainingMcg: 5000,
  reconstitutionDate: "2026-09-06", status: "active"
};

async function prepare(page, peptides = [BASE_PROTOCOL], logs = {}, inventory = [VIAL]) {
  const runtime = trackPageRuntime(page);
  await page.clock.setFixedTime(new Date("2026-09-08T12:00:00-03:00"));
  await seedStorage(page, { peptides, logs });
  await page.addInitScript((vials) => {
    localStorage.setItem("pep_inventory_v2", JSON.stringify(vials));
  }, inventory);
  await page.goto("/");
  await expect(page.locator("#view-today")).toBeVisible();
  return runtime;
}

const state = (page) => page.evaluate(async () => {
  const { storage } = await import("/src/services/storage.js");
  return { peptides: storage.getPeptides(), logs: storage.getLogs(), inventory: storage.getInventory() };
});

async function openManagedProtocol(page, id = BASE_PROTOCOL.id) {
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator("#view-settings")).toHaveAttribute("data-feature-ready", "true");
  const listDetails = page.locator("#settings-protocol-list details");
  if (!(await listDetails.getAttribute("open"))) await listDetails.locator("summary").click();
  const item = page.locator(`#settings-protocol-list .protocol-manage-item[data-id="${id}"]`);
  await item.scrollIntoViewIfNeeded();
  await item.click({ force: true });
  await expect(page.locator("#edit-modal")).toHaveClass(/on/);
}

async function recordStatus(page, status) {
  await page.locator("#dash-focus-action").click();
  await expect(page.locator("#retro-log-modal")).toHaveClass(/on/);
  await page.locator("#retro-status-select").selectOption(status);
  await page.locator("#retro-reason-input").fill(`Registro sintético ${status}`);
  await page.locator("#retro-save").click();
  await expect(page.locator("#retro-log-modal")).not.toHaveClass(/on/);
}

test.describe("Fase 1 — integridade da rotina", () => {
  test("cria unidades fracionárias e respeita início futuro sem aplicações antecipadas", async ({ page }) => {
    const runtime = await prepare(page, [], {}, []);
    await page.locator('[data-action="create-protocol"]').click();
    await page.locator("#edit-name").fill("Protocolo futuro");
    await page.locator("#edit-dose").fill("62.5 mcg");
    await page.locator("#edit-ui").fill("2,5");
    await page.locator("#edit-time").fill("18:00");
    await page.locator("#edit-protocol-start-date").fill("2026-09-09");
    await page.locator("#edit-save").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    expect((await state(page)).peptides[0]).toMatchObject({ name: "Protocolo futuro", ui: 2.5, start: "2026-09-09" });
    await expect(page.locator("#today-cards article.card")).toHaveCount(0);
    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-upcoming').click();
    await expect(page.locator(`.week-day[data-date="${TODAY}"] .week-event`)).toHaveCount(0);
    await expect(page.locator('.week-day[data-date="2026-09-09"] .week-event-toggle')).toBeDisabled();
    runtime.assertCleanRuntime();
  });

  test("pular e marcar esquecida resolve a rotina sem estoque; corrigir o registro debita uma única aplicação", async ({ page }) => {
    const runtime = await prepare(page);
    await recordStatus(page, "skipped");
    await recordStatus(page, "missed");
    const omitted = await state(page);
    expect(omitted.logs[TODAY][BASE_PROTOCOL.id].map((log) => log.status)).toEqual(["skipped", "missed"]);
    expect(omitted.inventory[0].remainingMcg).toBe(5000);
    await expect(page.locator("#dash-hero")).toHaveAttribute("data-state", "complete");
    await expect(page.locator("#dash-focus-title, .dash-focus-title")).toContainText("Tudo registrado por hoje");

    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-upcoming').click();
    const day = page.locator(`.week-day[data-date="${TODAY}"]`);
    await expect(day.locator(".week-day-progress")).toHaveText("0 de 2 aplicadas");
    await expect(day.locator('.week-event[data-status="skipped"]')).toContainText("Pulada");
    await expect(day.locator('.week-event[data-status="missed"]')).toContainText("Esquecida");
    await expect(day.locator('.week-event[data-status="unrecorded"]')).toHaveCount(0);
    await day.locator('.week-event[data-status="skipped"] .week-event-toggle').click();
    await expect(page.locator("#retro-modal-title")).toHaveText("Editar registro");
    await expect(page.locator("#retro-status-select")).toHaveValue("skipped");
    await page.locator("#retro-status-select").selectOption("applied");
    await page.locator("#retro-save").click();
    await expect(page.locator("#retro-log-modal")).not.toHaveClass(/on/);
    const corrected = await state(page);
    expect(corrected.logs[TODAY][BASE_PROTOCOL.id]).toHaveLength(2);
    expect(corrected.logs[TODAY][BASE_PROTOCOL.id].map(log => log.status)).toContain("applied");
    expect(corrected.inventory[0].remainingMcg).toBe(4937.5);
    await expect(day.locator(".week-day-progress")).toHaveText("1 de 2 aplicadas");

    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-history').click();
    await expect(page.locator(".hist-status").filter({ hasText: "Aplicada" })).toHaveCount(1);
    await expect(page.locator(".hist-status").filter({ hasText: "Não realizada" })).toHaveCount(1);
    runtime.assertCleanRuntime();
  });

  test("multidose usa uma ação, exige local só para aplicada e desfaz débito vinculado", async ({ page }) => {
    const runtime = await prepare(page);
    const action = page.locator("#dash-focus-action");
    await expect(action).toHaveCount(1);
    await expect(action).toContainText("Registrar aplicação");
    await expect(page.locator("#ring-n")).toContainText("0 / 2");
    await expect(page.locator(".dosebox, .dose-add, .dose-status")).toHaveCount(0);

    await action.click();
    await expect(page.locator("#retro-status-select")).toHaveValue("applied");
    await page.locator("#retro-save").click();
    await expect(page.locator("#confirm-title")).toHaveText("Escolha o local");
    expect((await state(page)).logs).toEqual({});
    expect((await state(page)).inventory[0].remainingMcg).toBe(5000);
    await page.locator("#confirm-ok").click();

    await page.locator("#retro-log-modal .injection-site-point").first().click();
    await page.locator("#retro-save").click();
    await expect(page.locator("#retro-log-modal")).not.toHaveClass(/on/);
    const applied = await state(page);
    expect(applied.logs[TODAY][BASE_PROTOCOL.id]).toHaveLength(1);
    expect(applied.inventory[0].remainingMcg).toBe(4937.5);
    await expect(page.locator("#ring-n")).toContainText("1 / 2");

    await page.locator('[data-tab="journey"]').click();
    await page.locator("#journey-history").click();
    await page.locator(".hist-rm").click();
    await page.locator("#confirm-ok").click();
    const undone = await state(page);
    expect(undone.logs[TODAY]?.[BASE_PROTOCOL.id] || []).toHaveLength(0);
    expect(undone.inventory[0].remainingMcg).toBe(5000);
    expect(undone.inventory[0].movements.at(-1)).toMatchObject({ type: "undo_dose" });
    await page.locator('[data-tab="today"]').click();
    await expect(page.locator("#ring-n")).toContainText("0 / 2");
    runtime.assertCleanRuntime();
  });

  test("rotina de aplicação única mantém o controle atual", async ({ page }) => {
    const runtime = await prepare(page, [{ ...BASE_PROTOCOL, perDay: 1, times: ["08:00"] }]);
    await expect(page.locator("#dash-focus-action")).toHaveCount(1);
    await expect(page.locator("#dash-focus-action")).toContainText("Registrar aplicação");
    runtime.assertCleanRuntime();
  });

  test("pausa, retoma com prévia e encerra sem apagar protocolo ou mudar a âncora do intervalo", async ({ page }) => {
    const runtime = await prepare(page, [{ ...BASE_PROTOCOL, interval: 2 }]);
    await openManagedProtocol(page);
    await page.locator("#protocol-toggle-status").click();
    await expect(page.locator("#confirm-title")).toHaveText("Pausar protocolo");
    await page.locator("#confirm-ok").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    expect((await state(page)).peptides[0].lifecycleStatus).toBe("paused");
    await page.locator('[data-tab="today"]').click();
    await expect(page.locator("#dash-hero")).toHaveAttribute("data-state", "clear");

    await openManagedProtocol(page);
    await page.locator("#protocol-toggle-status").click();
    await expect(page.locator("#confirm-message")).toContainText("18:00");
    await expect(page.locator("#confirm-message")).toContainText("10/09/2026");
    await page.locator("#confirm-ok").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    const resumed = (await state(page)).peptides[0];
    expect(resumed).toMatchObject({ lifecycleStatus: "active", start: "2026-09-06", interval: 2 });
    await page.locator('[data-tab="today"]').click();
    await expect(page.locator("#dash-hero")).toHaveAttribute("data-state", "pending");

    await openManagedProtocol(page);
    await page.locator("#edit-del-btn").click();
    await page.locator("#confirm-ok").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    const ended = await state(page);
    expect(ended.peptides).toHaveLength(1);
    expect(ended.peptides[0].lifecycleStatus).toBe("ended");
    expect(ended.inventory[0].remainingMcg).toBe(5000);
    await page.locator('[data-tab="today"]').click();
    await expect(page.locator("#dash-hero")).toHaveAttribute("data-state", "clear");
    await openManagedProtocol(page);
    await expect(page.locator("#protocol-lifecycle-controls")).toContainText("Encerrado");
    runtime.assertCleanRuntime();
  });

  test("alterações de nome e dose preservam o snapshot do registro na semana e no histórico", async ({ page }) => {
    const runtime = await prepare(page, [{ ...BASE_PROTOCOL, perDay: 1, times: ["08:00"] }]);
    await page.locator("#dash-focus-action").click();
    await page.locator("#retro-log-modal .injection-site-point").first().click();
    await page.locator("#retro-save").click();
    await expect(page.locator("#dash-hero")).toHaveAttribute("data-state", "complete");
    const original = (await state(page)).logs[TODAY][BASE_PROTOCOL.id][0];
    expect(original.protocolSnapshot).toMatchObject({ name: BASE_PROTOCOL.name, dose: "62.5 mcg", ui: 2.5 });

    await openManagedProtocol(page);
    await page.locator("#edit-name").fill("Nome alterado");
    await page.locator("#edit-dose").fill("125 mcg");
    await page.locator("#edit-ui").fill("5");
    await page.locator("#edit-save").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    expect((await state(page)).logs[TODAY][BASE_PROTOCOL.id][0].protocolSnapshot).toEqual(original.protocolSnapshot);

    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-upcoming').click();
    const recorded = page.locator(`.week-day[data-date="${TODAY}"] .week-event[data-status="applied"]`);
    await expect(recorded).toContainText(BASE_PROTOCOL.name);
    await expect(recorded).toContainText("62.5 mcg");
    await expect(recorded).not.toContainText("Nome alterado");
    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-history').click();
    await expect(page.locator(".hist-name")).toHaveText(BASE_PROTOCOL.name);
    await expect(page.locator(".hist-dose")).toContainText("62.5 mcg");
    await expect(page.locator(".hist-dose")).toContainText("2.5 UI");
    runtime.assertCleanRuntime();
  });

  test("revisão futura permanece fora da rotina atual e pode ser cancelada", async ({ page }) => {
    const runtime = await prepare(page);
    await openManagedProtocol(page);
    await page.locator("#edit-name").fill("Nome futuro");
    await page.locator("#edit-dose").fill("125 mcg");
    await page.locator("#edit-effective-date").fill("2026-09-09");
    await page.locator("#edit-save").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    await expect(page.locator(".dash-focus-title")).toContainText(BASE_PROTOCOL.name);
    await expect(page.locator(".dash-focus-title")).not.toContainText("Nome futuro");
    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-upcoming').click();
    await expect(page.locator('.week-day[data-date="2026-09-09"] .week-event')).toContainText("Nome futuro");

    await openManagedProtocol(page);
    await expect(page.locator("#edit-save")).toBeDisabled();
    await page.locator("#protocol-cancel-future").click();
    await expect(page.locator("#edit-modal")).not.toHaveClass(/on/);
    const protocol = (await state(page)).peptides[0];
    expect(protocol.name).toBe(BASE_PROTOCOL.name);
    expect(protocol.revisions.some((revision) => revision.config.name === "Nome futuro")).toBe(false);
    runtime.assertCleanRuntime();
  });

  test("registro sem protocolo atual continua visível e corrigível sem inventar dose histórica", async ({ page }) => {
    const logs = { [TODAY]: { removed: [{ id: "legacy-removed", peptideId: "removed", scheduledDate: TODAY, time: "08:00", status: "skipped" }] } };
    const runtime = await prepare(page, [], logs, []);
    await page.locator('[data-tab="journey"]').click();
    await page.locator('#journey-upcoming').click();
    const entry = page.locator(`.week-day[data-date="${TODAY}"] .week-event`);
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Protocolo sem identificação");
    await expect(entry).toContainText("Registro legado");
    await expect(entry).toContainText("Pulada");
    await entry.locator(".week-event-toggle").click();
    await expect(page.locator("#retro-dose-input")).toHaveValue("");
    await expect(page.locator("#retro-ui-input")).toHaveValue("");
    await expect(page.locator("#retro-status-select")).toHaveValue("skipped");
    await page.locator("#retro-reason-input").fill("Motivo corrigido");
    await page.locator("#retro-save").click();
    await expect(page.locator("#retro-log-modal")).not.toHaveClass(/on/);
    expect((await state(page)).logs[TODAY].removed[0].statusReason).toBe("Motivo corrigido");
    runtime.assertCleanRuntime();
  });
});
