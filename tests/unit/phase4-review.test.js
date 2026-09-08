import { describe, expect, it } from "vitest";
import { createMeasurementEntry } from "../../src/domain/measurements.js";
import { buildReviewModel, generateMeasurementsCSV, generateReportHTML } from "../../src/domain/report.js";

describe("Histórico e relatório da Fase 4", () => {
  const protocol = [{
    id: "p1", name: "Composto A", start: "2026-08-01", perDay: 1, time: "08:00", lifecycleStatus: "ended",
    revisions: [{ id: "r1", effectiveFrom: "2026-08-02T12:00:00.000Z", status: "ended", config: { name: "Composto A", dose: "1 mg", time: "08:00" } }]
  }];
  const logs = { "2026-08-03": { p1: [
    { id: "a1", time: "09:10", status: "applied", retroactive: true, protocolSnapshot: { name: "Composto A", dose: "1 mg", time: "08:00" } },
    { id: "a2", time: "08:00", status: "skipped", statusReason: "Decisão pessoal", protocolSnapshot: { name: "Composto A", dose: "1 mg", time: "08:00" } }
  ] } };

  it("integra eventos, preserva contexto geral e exclui dose pulada do total aplicado", () => {
    const measurement = createMeasurementEntry({ date: "2026-08-03", time: "10:00", weightKg: 80, symptomDetails: [{ name: "Fadiga", intensity: "moderada" }] });
    const model = buildReviewModel({ protocol, logs, measurements: [measurement], startDate: "2026-08-01", endDate: "2026-08-05", compoundId: "p1" });
    expect(model.events.map((event) => event.type)).toEqual(expect.arrayContaining(["application", "measurement", "symptom", "protocol"]));
    expect(model.events.find((event) => event.type === "measurement").contextGeneral).toBe(true);
    expect(model.summary).toMatchObject({ applied: 1, skipped: 1 });
    expect(model.revisions[0]).toMatchObject({ statusLabel: "Encerrado" });
    expect(model.applications[0]).toHaveProperty("scheduledTime", "08:00");
  });

  it("busca em observações e exporta intensidade e PDF vazio paginado", () => {
    const measurement = createMeasurementEntry({ date: "2026-08-03", symptoms: ["Fadiga"], symptomDetails: [{ name: "Fadiga", intensity: "intensa" }], notes: "após viagem" });
    const model = buildReviewModel({ measurements: [measurement], query: "viagem", includeNotes: true });
    expect(model.events).toHaveLength(1);
    expect(generateMeasurementsCSV(model.measurements)).toContain('"Fadiga: intensa"');
    const html = generateReportHTML([], { measurements: [], includeMeasurements: true, revisions: [] });
    expect(html).toContain("Nenhum registro de aplicação");
    expect(html).toContain("@page");
  });
});
