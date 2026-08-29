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
});
