import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFeatureLoader } from "../../src/services/feature-loader.js";
import { createViewCoordinator } from "../../src/services/view-coordinator.js";
import { buildActiveVialIndex, buildLastSiteIndex, createRevisionedPerformanceIndexes } from "../../src/domain/performance-indexes.js";
import { StorageService } from "../../src/services/storage.js";
import { NotificationService } from "../../src/services/notifications.js";
import { startAnimatedBackground } from "../../src/services/animated-background.js";

describe("Infraestrutura de desempenho", () => {
  beforeEach(() => {
    const values = new Map();
    global.localStorage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, String(value))),
      removeItem: vi.fn((key) => values.delete(key)),
      clear: vi.fn(() => values.clear())
    };
  });

  it("carrega uma feature uma vez e permite tentar novamente após falha", async () => {
    let calls = 0;
    const loader = createFeatureLoader(async () => {
      calls += 1;
      if (calls === 1) throw new Error("falha transitória");
      return "pronta";
    });
    await expect(loader.load()).rejects.toThrow("falha transitória");
    expect(loader.state).toBe("not-loaded");
    const [first, second] = await Promise.all([loader.load(), loader.load()]);
    expect(first).toBe("pronta");
    expect(second).toBe("pronta");
    expect(calls).toBe(2);
  });

  it("renderiza somente a tela ativa e conserva invalidações das demais", () => {
    const renders = { today: 0, week: 0 };
    const coordinator = createViewCoordinator({
      renderers: {
        today: () => { renders.today += 1; },
        week: () => { renders.week += 1; }
      }
    });
    coordinator.render("today");
    coordinator.invalidate("today", "week");
    expect(renders).toEqual({ today: 2, week: 0 });
    coordinator.activate("week");
    expect(renders).toEqual({ today: 2, week: 1 });
  });

  it("reutiliza snapshot imutável por revisão e invalida o cache após escrita", () => {
    const service = new StorageService();
    service.init();
    const first = service.readSnapshot(["logs", "peptides"]);
    const second = service.readSnapshot(["peptides", "logs"]);
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.peptides)).toBe(true);
    service.setPeptides([{ id: "p1", name: "Teste", dose: "1 mg", ui: 1, perDay: 1 }]);
    expect(service.readSnapshot(["logs", "peptides"])).not.toBe(first);
  });

  it("indexa último local e frasco ativo sem mudar a precedência histórica", () => {
    const logs = {
      "2026-09-08": { p1: [{ status: "applied", site: "Coxa" }] },
      "2026-09-09": { p1: [{ status: "skipped", site: "Braço" }, { status: "applied", site: "Abdômen" }] }
    };
    expect(buildLastSiteIndex(logs).byPeptide.get("p1")).toEqual({ site: "Abdômen", date: "2026-09-09", time: "" });
    const vials = buildActiveVialIndex([{ id: "v1", peptideId: "P1", peptideName: "Teste", status: "active" }]);
    expect(vials.find("p1").id).toBe("v1");
  });

  it("reutiliza índices derivados durante a revisão e os reconstrói após mudança", () => {
    let revision = 1;
    const cache = createRevisionedPerformanceIndexes(() => revision);
    const state = {
      logs: { "2026-09-09": { p1: [{ status: "applied", site: "Coxa" }] } },
      inventory: [{ id: "v1", peptideId: "p1", status: "active" }]
    };
    const first = cache.get(state);
    expect(cache.get(state)).toBe(first);
    expect(first.getRecordsForDate("2026-09-09")).toBe(state.logs["2026-09-09"]);
    revision += 1;
    expect(cache.get(state)).not.toBe(first);
  });

  it("coalesce agendamentos idênticos e força nova reconciliação quando solicitado", async () => {
    const service = new NotificationService();
    service.schedulePeptideReminders = vi.fn(async () => ({ scheduledCount: 2, schedulingMode: "not_applicable" }));
    const [first, concurrent] = await Promise.all([
      service.schedulePeptideRemindersIfNeeded([], { reason: "teste" }),
      service.schedulePeptideRemindersIfNeeded([], { reason: "teste" })
    ]);
    expect(first.scheduledCount).toBe(2);
    expect(concurrent.scheduledCount).toBe(2);
    expect(service.schedulePeptideReminders).toHaveBeenCalledTimes(1);
    const skipped = await service.schedulePeptideRemindersIfNeeded([], { reason: "teste" });
    expect(skipped.skipped).toBe(true);
    await service.schedulePeptideRemindersIfNeeded([], { force: true, reason: "mudança" });
    expect(service.schedulePeptideReminders).toHaveBeenCalledTimes(2);
  });

  it("pausa e retoma a animação quando o documento fica invisível", () => {
    const listeners = {};
    const frames = new Map();
    let nextFrame = 1;
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }),
      remove: vi.fn()
    };
    const documentRef = {
      hidden: false,
      createElement: () => canvas,
      addEventListener: (name, fn) => { listeners[name] = fn; },
      removeEventListener: vi.fn()
    };
    const windowRef = {
      innerWidth: 400, innerHeight: 800,
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: vi.fn((fn) => { const id = nextFrame++; frames.set(id, fn); return id; }),
      cancelAnimationFrame: vi.fn((id) => frames.delete(id)),
      addEventListener: vi.fn(), removeEventListener: vi.fn()
    };
    const controller = startAnimatedBackground({
      container: { appendChild: vi.fn() }, theme: { isLight: () => false }, windowRef, documentRef, random: () => 0.5
    });
    expect(controller.isRunning()).toBe(true);
    documentRef.hidden = true;
    listeners.visibilitychange();
    expect(controller.isRunning()).toBe(false);
    documentRef.hidden = false;
    listeners.visibilitychange();
    expect(controller.isRunning()).toBe(true);
    controller.destroy();
  });
});
