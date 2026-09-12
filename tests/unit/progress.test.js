import { describe, expect, it } from "vitest";
import { buildProgressSummary } from "../../src/domain/progress.js";

describe("resumo descritivo de progresso", () => {
  it("calcula variação e frequências sem inferir causalidade", () => {
    const result = buildProgressSummary({ measurements: [
      { date: "2026-09-01", time: "08:00", weightKg: 90, symptoms: ["Náusea"] },
      { date: "2026-09-12", time: "08:00", weightKg: 87, symptoms: ["Náusea", "Fadiga"] }
    ] });
    expect(result).toMatchObject({ firstWeight: 90, latestWeight: 87, absoluteChangeKg: -3, percentChange: -3.3, weightCount: 2 });
    expect(result.symptomFrequency).toEqual([["Náusea", 2], ["Fadiga", 1]]);
  });

  it("mantém doses separadas por tratamento", () => {
    const result = buildProgressSummary({
      peptides: [{ id: "a", name: "A", dose: "1 mg" }, { id: "b", name: "B", dose: "2 mg" }],
      logs: { "2026-09-12": { a: [{ status: "applied", dose: "1 mg" }], b: [{ status: "applied", dose: "2 mg" }] } }
    });
    expect(result.doseContexts.map((item) => [item.name, item.matchingRecords])).toEqual([["A", 1], ["B", 1]]);
  });

  it("representa ausência ou uma única pesagem sem divisão inválida", () => {
    expect(buildProgressSummary().percentChange).toBeNull();
    expect(buildProgressSummary({ measurements: [{ date: "2026-09-12", weightKg: 80 }] })).toMatchObject({ absoluteChangeKg: 0, percentChange: 0 });
  });
});
