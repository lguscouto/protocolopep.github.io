import { describe, expect, it } from "vitest";
import { buildDailyApplicationProgress } from "../../src/domain/dose-state.js";

const peptide = { id: "multi", perDay: 3, time: "08:00", times: ["08:00", "14:00", "20:00"] };

describe("buildDailyApplicationProgress", () => {
  it.each([
    [[], 0, 3, "pending"],
    [[{ status: "applied" }], 1, 2, "pending"],
    [[{ status: "applied" }, { status: "applied" }], 2, 1, "pending"],
    [[{ status: "applied" }, { status: "applied" }, { status: "applied" }], 3, 0, "all_applied"]
  ])("calcula a série resolvida %s/3", (records, resolved, pending, state) => {
    expect(buildDailyApplicationProgress({ peptide, records })).toMatchObject({
      total: 3,
      applied: resolved,
      resolved,
      pending,
      state
    });
  });

  it("conclui uma rotina mista sem tratar exceções como aplicações", () => {
    const model = buildDailyApplicationProgress({
      peptide,
      records: [
        { id: "a", status: "applied", time: "08:04" },
        { id: "s", status: "skipped", time: "14:10", statusReason: "Decisão pessoal" },
        { id: "m", status: "missed", time: "20:30", statusReason: "Não foi possível" }
      ]
    });

    expect(model).toMatchObject({ total: 3, applied: 1, skipped: 1, missed: 1, resolved: 3, pending: 0, state: "resolved_with_exceptions" });
    expect(model.occurrences).toEqual([
      expect.objectContaining({ position: 1, scheduledTime: "08:00", status: "applied", effectiveTime: "08:04" }),
      expect.objectContaining({ position: 2, scheduledTime: "14:00", status: "skipped", reason: "Decisão pessoal" }),
      expect.objectContaining({ position: 3, scheduledTime: "20:00", status: "missed", reason: "Não foi possível" })
    ]);
  });

  it("expõe horários ausentes sem inventar valores", () => {
    const model = buildDailyApplicationProgress({ peptide: { perDay: 3, times: ["08:00"] }, records: [] });
    expect(model.occurrences.map((item) => item.scheduledTime)).toEqual(["08:00", null, null]);
  });

  it("aceita registro legado, separa excedentes e ignora estado desconhecido na conclusão", () => {
    const model = buildDailyApplicationProgress({
      peptide: { perDay: 2, times: ["08:00", "18:00"] },
      records: [
        { id: "legacy", time: "08:03" },
        { id: "invalid", status: "other", time: "09:00" },
        { id: "skip", status: "skipped", time: "18:10" },
        { id: "extra", status: "applied", time: "22:00" }
      ]
    });

    expect(model).toMatchObject({ applied: 1, skipped: 1, resolved: 2, pending: 0, state: "resolved_with_exceptions" });
    expect(model.occurrences[0]).toMatchObject({ recordId: "legacy", status: "applied", isLegacy: true });
    expect(model.extras).toEqual([
      expect.objectContaining({ id: "invalid", kind: "unknown", status: "other" }),
      expect.objectContaining({ id: "extra", kind: "excess", status: "applied" })
    ]);
  });

  it("não altera protocolo nem registros recebidos", () => {
    const immutablePeptide = Object.freeze({ perDay: 2, times: Object.freeze(["08:00", "18:00"]) });
    const immutableRecords = Object.freeze([
      Object.freeze({ id: "one", status: "applied", time: "08:05" }),
      Object.freeze({ id: "two", status: "missed", statusReason: "Ausência" })
    ]);
    const beforePeptide = JSON.stringify(immutablePeptide);
    const beforeRecords = JSON.stringify(immutableRecords);

    buildDailyApplicationProgress({ peptide: immutablePeptide, records: immutableRecords });

    expect(JSON.stringify(immutablePeptide)).toBe(beforePeptide);
    expect(JSON.stringify(immutableRecords)).toBe(beforeRecords);
  });
});
