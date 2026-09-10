import { describe, expect, it } from "vitest";
import {
  buildPersonalReport,
  generatePersonalReportCSV,
  generateReportHTML
} from "../../src/domain/report.js";

describe("Relatório pessoal da Fase 3", () => {
  const protocol = [{
    id: "pep-fase3",
    name: "Rotina descritiva",
    dose: "250 mcg",
    ui: 10,
    perDay: 1,
    time: "08:00",
    start: "2026-08-01",
    days: null,
    interval: null,
    lifecycleStatus: "active"
  }];

  const logs = {
    "2026-08-02": {
      "pep-fase3": {
        id: "dose-1",
        peptideId: "pep-fase3",
        scheduledDate: "2026-08-02",
        time: "08:00",
        status: "applied"
      }
    }
  };

  const measurements = [
    {
      id: "m-in",
      date: "2026-08-02",
      time: "07:00",
      weightKg: 82.4,
      circumferencesCm: { abdomen: 94.5, waist: 89, hips: 101 },
      energyLevel: 4,
      moodLevel: 3,
      symptoms: ["Fadiga"],
      notes: "Observação pessoal",
      source: "local"
    },
    {
      id: "m-out",
      date: "2026-09-02",
      time: "07:00",
      weightKg: 81.2,
      energyLevel: 2,
      moodLevel: 2,
      symptoms: ["Náusea leve"],
      notes: "Fora do intervalo",
      source: "health_connect"
    }
  ];

  it("filtra medições pelo período e agrega apenas a rotina observada", () => {
    const report = buildPersonalReport({
      protocol,
      logs,
      measurements,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      includeMeasurements: true
    });

    expect(report.entries).toHaveLength(1);
    expect(report.measurements).toHaveLength(1);
    expect(report.measurements[0]).toMatchObject({ date: "2026-08-02", weightKg: 82.4, circumferencesCm: { abdomen: 94.5, waist: 89, hips: 101 }, source: "Local" });
    expect(report.measurementStats).toMatchObject({ totalEntries: 1, latestWeight: 82.4, earliestWeight: 82.4, weightDelta: 0 });
    expect(report.adherence).toMatchObject({ due: 31, applied: 1, resolutionPercent: 3 });
  });

  it("mantém notas de medições protegidas até que o usuário inclua observações", () => {
    const redacted = buildPersonalReport({ measurements, includeMeasurements: true, includeNotes: false });
    const included = buildPersonalReport({ measurements, includeMeasurements: true, includeNotes: true });

    expect(redacted.measurements[0].notes).toBe("");
    expect(included.measurements[0].notes).toBe("Observação pessoal");
    expect(redacted.measurements[0]).not.toHaveProperty("id");
  });

  it("gera CSV por seções com escape contra fórmula e HTML sem injeção", () => {
    const report = buildPersonalReport({
      measurements: [{
        date: "2026-08-02",
        time: "07:00",
        weightKg: 82,
        circumferencesCm: { abdomen: 93.5, waist: 88, hips: 100.5 },
        energyLevel: 4,
        moodLevel: 3,
        symptoms: ["<img src=x>"],
        notes: "=HYPERLINK(\"https://evil.test\")",
        source: "local"
      }],
      includeMeasurements: true,
      includeNotes: true
    });

    const csv = generatePersonalReportCSV(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Aplicações";"Data";"Hora"');
    expect(csv).toContain('"Abdômen (cm)";"Cintura (cm)";"Quadril (cm)"');
    expect(csv).toContain('"93.5";"88";"100.5"');
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.test"")"');

    const html = generateReportHTML([], {
      adherenceSummary: report.adherence,
      measurements: report.measurements,
      includeMeasurements: true,
      measurementStats: report.measurementStats
    });
    expect(html).toContain("Medições autorrelatadas");
    expect(html).toContain("Abdômen: 93.5 · Cintura: 88 · Quadril: 100.5");
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).toContain("&quot;https://evil.test&quot;");
    expect(html).not.toContain("<img src=x>");
  });
});
