import { describe, it, expect } from "vitest";
import { generateDailySummary } from "../../src/domain/daily-summary.js";

describe("Daily Summary Domain (V04)", () => {
  const mockPeptides = [
    { id: "p1", name: "BPC-157", dose: "250 mcg", ui: 10, perDay: 1, days: [0, 1, 2, 3, 4, 5, 6] },
    { id: "p2", name: "TB-500", dose: "2.5 mg", ui: 25, perDay: 1, days: [0, 1, 2, 3, 4, 5, 6] }
  ];

  it("deve gerar resumo sem conter 'undefined%'", () => {
    const logs = {
      "2026-08-29": {
        p1: [{ time: "08:00" }]
      }
    };

    const targetDate = new Date("2026-08-29T12:00:00");
    const summary = generateDailySummary(mockPeptides, logs, targetDate);

    expect(summary).not.toContain("undefined%");
    expect(summary).toContain("50%");
    expect(summary).toContain("1 de 2 doses previstas concluídas");
    expect(summary).toContain("✓ BPC-157");
    expect(summary).toContain("250 mcg · 10 UI");
    expect(summary).toContain("○ TB-500");
    expect(summary).toContain("não clínico");
  });

  it("não deve exibir '3 de 1' quando houver doses extras (P1 - Sec 18)", () => {
    const singlePeptide = [
      { id: "p1", name: "BPC-157", dose: "250 mcg", perDay: 1, days: [0, 1, 2, 3, 4, 5, 6] }
    ];

    const logsWithExtras = {
      "2026-08-29": {
        p1: [{ time: "08:00" }, { time: "14:00" }, { time: "20:00" }] // 3 doses para 1 prevista
      }
    };

    const targetDate = new Date("2026-08-29T12:00:00");
    const summary = generateDailySummary(singlePeptide, logsWithExtras, targetDate);

    expect(summary).not.toContain("3 de 1");
    expect(summary).toContain("1 de 1 dose prevista concluída");
    expect(summary).toContain("+ 2 registros extras");
    expect(summary).toContain("100%");
  });

  it("deve respeitar a opção de ocultar dosagens para privacidade", () => {
    const logs = {};
    const targetDate = new Date("2026-08-29T12:00:00");
    const summary = generateDailySummary(mockPeptides, logs, targetDate, { includeDoses: false });

    expect(summary).not.toContain("250 mcg");
    expect(summary).not.toContain("10 UI");
    expect(summary).toContain("BPC-157");
  });

  it("deve respeitar a opção de ocultar nomes de substâncias para privacidade", () => {
    const logs = {};
    const targetDate = new Date("2026-08-29T12:00:00");
    const summary = generateDailySummary(mockPeptides, logs, targetDate, { includeNames: false });

    expect(summary).not.toContain("BPC-157");
    expect(summary).not.toContain("TB-500");
    expect(summary).toContain("Item 1");
    expect(summary).toContain("Item 2");
  });

  it("deve tratar dia sem doses agendadas com clareza", () => {
    const emptySummary = generateDailySummary([], {}, new Date("2026-08-29T12:00:00"));
    expect(emptySummary).toContain("0%");
    expect(emptySummary).toContain("Nenhuma dose agendada para este dia");
  });
});
