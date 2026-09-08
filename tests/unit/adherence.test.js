import { describe, expect, it } from "vitest";
import { calculateAdherenceSummary } from "../../src/domain/adherence.js";
import { createPeptide } from "../../src/domain/protocol.js";

function peptide(overrides = {}) {
  return createPeptide({
    id: "pep_adherence",
    name: "Rotina",
    dose: "250 mcg",
    ui: 10,
    perDay: 1,
    time: "08:00",
    ...overrides
  });
}

function log(status = "applied", id = "log") {
  return { id, peptideId: "pep_adherence", status, dose: "250 mcg", ui: 10, time: "08:00" };
}

describe("Métricas descritivas de consistência", () => {
  it("agrega aplicações, estados resolvidos e dias completos sem contar extras como previstas", () => {
    const summary = calculateAdherenceSummary(
      [peptide()],
      {
        "2026-01-01": { pep_adherence: log("applied", "a") },
        "2026-01-02": { pep_adherence: log("skipped", "s") },
        "2026-01-03": { pep_adherence: [log("missed", "m"), log("applied", "a2"), log("applied", "extra")] }
      },
      { startDate: "2026-01-01", endDate: "2026-01-03" }
    );

    expect(summary.scheduledDays).toBe(3);
    expect(summary.due).toBe(3);
    expect(summary.applied).toBe(2);
    expect(summary.resolved).toBe(3);
    expect(summary.skipped).toBe(1);
    expect(summary.missed).toBe(1);
    expect(summary.pending).toBe(0);
    expect(summary.extraApplied).toBe(1);
    expect(summary.applicationPercent).toBe(67);
    expect(summary.resolutionPercent).toBe(100);
    expect(summary.completeDays).toBe(3);
    expect(summary.days.map((day) => day.status)).toEqual(["complete", "complete", "complete"]);
  });

  it("respeita início e intervalo do protocolo e classifica dias sem registro", () => {
    const summary = calculateAdherenceSummary(
      [peptide({ start: "2026-01-02", interval: 2 })],
      { "2026-01-02": { pep_adherence: log("applied") } },
      { startDate: "2026-01-01", endDate: "2026-01-05" }
    );

    expect(summary.days.map((day) => [day.dateKey, day.status])).toEqual([
      ["2026-01-01", "rest"],
      ["2026-01-02", "complete"],
      ["2026-01-03", "rest"],
      ["2026-01-04", "empty"],
      ["2026-01-05", "rest"]
    ]);
    expect(summary.scheduledDays).toBe(2);
    expect(summary.completeDays).toBe(1);
    expect(summary.emptyScheduledDays).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it("não transforma protocolo pausado ou encerrado em pendência", () => {
    const paused = peptide({ id: "pep_paused", lifecycleStatus: "paused" });
    const ended = peptide({ id: "pep_ended", lifecycleStatus: "ended" });
    const summary = calculateAdherenceSummary(
      [paused, ended],
      {},
      { startDate: "2026-01-01", endDate: "2026-01-03" }
    );

    expect(summary.scheduledDays).toBe(0);
    expect(summary.due).toBe(0);
    expect(summary.days.every((day) => day.status === "rest")).toBe(true);
  });

  it("retorna estrutura vazia para intervalo inválido", () => {
    const summary = calculateAdherenceSummary(
      [peptide()],
      {},
      { startDate: "2026-02-01", endDate: "2026-01-01" }
    );

    expect(summary.days).toEqual([]);
    expect(summary.due).toBe(0);
    expect(summary.applicationPercent).toBe(0);
  });
});
