import { describe, it, expect } from "vitest";
import { calculateWidgetSummary } from "../../src/domain/widget.js";

describe("Widget Domain Logic (V14)", () => {
  const samplePeptides = [
    { id: "pep-1", name: "BPC-157", time: "08:00", days: null },
    { id: "pep-2", name: "TB-500", time: "14:00", days: null },
    { id: "pep-3", name: "CJC-1295", time: "21:00", days: null }
  ];

  it("retorna estado vazio quando não há peptídeos cadastrados", () => {
    const res = calculateWidgetSummary({ peptides: [], logs: {}, targetDate: "2026-08-29" });
    expect(res.totalCount).toBe(0);
    expect(res.takenCount).toBe(0);
    expect(res.progressPct).toBe(0);
    expect(res.statusText).toContain("Nenhum protocolo");
  });

  it("calcula progresso parcial e identifica o próximo peptídeo", () => {
    const logs = {
      "2026-08-29": {
        "pep-1": { taken: true, time: "08:05" }
      }
    };
    const res = calculateWidgetSummary({
      peptides: samplePeptides,
      logs,
      targetDate: "2026-08-29",
      discreteMode: false
    });

    expect(res.totalCount).toBe(3);
    expect(res.takenCount).toBe(1);
    expect(res.progressPct).toBe(33);
    expect(res.nextDosePeptide).toBe("TB-500");
    expect(res.nextDoseTime).toBe("14:00");
    expect(res.statusText).toBe("TB-500 · 14:00");
    expect(res.subText).toContain("1 de 3 doses tomadas");
  });

  it("oculta o nome do peptídeo quando o modo discreto está ativado", () => {
    const logs = {
      "2026-08-29": {
        "pep-1": { taken: true, time: "08:05" }
      }
    };
    const res = calculateWidgetSummary({
      peptides: samplePeptides,
      logs,
      targetDate: "2026-08-29",
      discreteMode: true
    });

    expect(res.discreteMode).toBe(true);
    expect(res.nextDosePeptide).toBe("Aplicação Agendada");
    expect(res.statusText).toBe("Aplicação Agendada · 14:00");
    expect(res.statusText).not.toContain("TB-500");
  });

  it("identifica 100% de conclusão quando todas as doses foram tomadas", () => {
    const logs = {
      "2026-08-29": {
        "pep-1": { taken: true },
        "pep-2": { taken: true },
        "pep-3": { taken: true }
      }
    };
    const res = calculateWidgetSummary({
      peptides: samplePeptides,
      logs,
      targetDate: "2026-08-29"
    });

    expect(res.takenCount).toBe(3);
    expect(res.totalCount).toBe(3);
    expect(res.progressPct).toBe(100);
    expect(res.statusText).toContain("Tudo concluído");
  });

  it("calcula totalCount e takenCount respeitando perDay de cada composto (P1 - Sec 20)", () => {
    const multiPeptides = [
      { id: "pep-1", name: "BPC-157", time: "08:00", days: null, perDay: 3 } // 3 doses diárias
    ];

    // 1 dose tomada de 3 previstas
    const logs1 = {
      "2026-08-29": {
        "pep-1": [{ time: "08:00" }]
      }
    };
    const res1 = calculateWidgetSummary({
      peptides: multiPeptides,
      logs: logs1,
      targetDate: "2026-08-29"
    });

    expect(res1.totalCount).toBe(3);
    expect(res1.takenCount).toBe(1);
    expect(res1.progressPct).toBe(33);

    // 3 doses tomadas
    const logs3 = {
      "2026-08-29": {
        "pep-1": [{ time: "08:00" }, { time: "14:00" }, { time: "20:00" }]
      }
    };
    const res3 = calculateWidgetSummary({
      peptides: multiPeptides,
      logs: logs3,
      targetDate: "2026-08-29"
    });

    expect(res3.totalCount).toBe(3);
    expect(res3.takenCount).toBe(3);
    expect(res3.progressPct).toBe(100);
    expect(res3.statusText).toContain("Tudo concluído");
  });

  it("avança o próximo horário real (nextDoseTime) conforme cada aplicação é registrada (P1 - Sec 17)", () => {
    const peptide = {
      id: "pep-multi",
      name: "BPC-157",
      perDay: 3,
      times: ["08:00", "14:00", "20:00"]
    };

    // 0 doses tomadas -> 08:00
    const res0 = calculateWidgetSummary({
      peptides: [peptide],
      logs: {},
      targetDate: "2026-08-29"
    });
    expect(res0.nextDoseTime).toBe("08:00");

    // 1 dose tomada -> 14:00
    const res1 = calculateWidgetSummary({
      peptides: [peptide],
      logs: { "2026-08-29": { "pep-multi": [{ time: "08:00" }] } },
      targetDate: "2026-08-29"
    });
    expect(res1.nextDoseTime).toBe("14:00");

    // 2 doses tomadas -> 20:00
    const res2 = calculateWidgetSummary({
      peptides: [peptide],
      logs: { "2026-08-29": { "pep-multi": [{ time: "08:00" }, { time: "14:00" }] } },
      targetDate: "2026-08-29"
    });
    expect(res2.nextDoseTime).toBe("20:00");

    // 3 doses tomadas -> Tudo concluído
    const res3 = calculateWidgetSummary({
      peptides: [peptide],
      logs: { "2026-08-29": { "pep-multi": [{ time: "08:00" }, { time: "14:00" }, { time: "20:00" }] } },
      targetDate: "2026-08-29"
    });
    expect(res3.progressPct).toBe(100);
    expect(res3.statusText).toContain("Tudo concluído");
  });
});
