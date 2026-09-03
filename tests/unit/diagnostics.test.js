import { describe, it, expect, beforeEach } from "vitest";
import { generateDiagnosticReport, sanitizeTechnicalReport, calculateStorageSize } from "../../src/services/diagnostics.js";

describe("Diagnósticos Técnicos Desidentificados (V09)", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; },
      key: (i) => Object.keys(mockStore)[i] || null,
      get length() { return Object.keys(mockStore).length; }
    };
  });

  it("deve gerar relatório com contadores numéricos sem vazar dados médicos ou nomes", () => {
    const mockStorage = {
      getPeptides: () => [
        { id: "pep-1", name: "Tirzepatide", sub: "GLP-1", dose: "2.5 mg", ui: 25 },
        { id: "pep-2", name: "BPC-157", sub: "reparo", dose: "250 mcg", ui: 10 }
      ],
      getLogs: () => ({
        "2026-08-28": {
          "pep-1": [{ time: "08:00", retroactive: false, note: "tratamento para diabetes" }]
        },
        "2026-08-27": {
          "pep-2": ["09:00"]
        }
      })
    };

    const report = generateDiagnosticReport({
      storage: mockStorage,
      appVersion: "2.9.5",
      notificationsActive: true
    });

    expect(report.app.version).toBe("2.9.5");
    expect(report.metrics.totalPeptidesCount).toBe(2);
    expect(report.metrics.totalLogDatesCount).toBe(2);
    expect(report.metrics.totalRecordedDosesCount).toBe(2);
    expect(report.subsystems.notificationsConfigured).toBe(true);

    const jsonString = JSON.stringify(report);
    // Verificação estrita de privacidade: nenhum dado sintético de saúde pode constar no JSON
    expect(jsonString).not.toContain("Tirzepatide");
    expect(jsonString).not.toContain("BPC-157");
    expect(jsonString).not.toContain("2.5 mg");
    expect(jsonString).not.toContain("250 mcg");
    expect(jsonString).not.toContain("diabetes");
    expect(jsonString).not.toContain("tratamento");
    expect(jsonString).not.toContain("pep-1");
  });

  it("sanitizeTechnicalReport deve bloquear e lançar exceção se detectar campos sensíveis", () => {
    const dangerousPayload = {
      app: { version: "2.9.5" },
      metrics: { count: 1 },
      leak: { name: "Semaglutide", dose: "1mg" }
    };

    expect(() => sanitizeTechnicalReport(dangerousPayload)).toThrow(/Violação de privacidade detectada/);
  });

  it("deve calcular o tamanho estimado do armazenamento local", () => {
    global.localStorage.setItem("test_key", "test_value_12345");
    const bytes = calculateStorageSize();
    expect(bytes).toBeGreaterThan(0);
  });
});
