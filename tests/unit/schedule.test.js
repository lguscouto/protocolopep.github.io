import { describe, it, expect } from "vitest";
import { isScheduledOnDate, getScheduledPeptides, calculateDayProgress, occurrencesForRange, daysBetween, getUpcomingOccurrences } from "../../src/domain/schedule.js";

describe("Schedule Domain", () => {
  it("calcula dias entre datas corretamente", () => {
    expect(daysBetween("2026-08-25", new Date("2026-08-28T12:00:00"))).toBe(3);
    expect(daysBetween("2026-08-28", new Date("2026-08-28T00:00:00"))).toBe(0);
  });

  it("avalia agendamento de 'Todos os dias' (days: null)", () => {
    const pep = { id: "p1", days: null };
    expect(isScheduledOnDate(pep, new Date("2026-08-28"))).toBe(true); // Sexta
    expect(isScheduledOnDate(pep, new Date("2026-08-30"))).toBe(true); // Domingo
  });

  it("avalia agendamento de dias específicos (ex: Seg, Qua, Sex = [1, 3, 5])", () => {
    const motsc = { id: "motsc", days: [1, 3, 5] };
    const sexta = new Date("2026-08-28T12:00:00"); // Day 5 = Sex
    const sabado = new Date("2026-08-29T12:00:00"); // Day 6 = Sáb
    const domingo = new Date("2026-08-30T12:00:00"); // Day 0 = Dom
    const segunda = new Date("2026-08-31T12:00:00"); // Day 1 = Seg

    expect(isScheduledOnDate(motsc, sexta)).toBe(true);
    expect(isScheduledOnDate(motsc, sabado)).toBe(false);
    expect(isScheduledOnDate(motsc, domingo)).toBe(false);
    expect(isScheduledOnDate(motsc, segunda)).toBe(true);
  });

  it("avalia agendamento por intervalo (A cada 2 dias)", () => {
    const pepInterval = { id: "p2", interval: 2, start: "2026-08-28" };
    expect(isScheduledOnDate(pepInterval, new Date("2026-08-28T00:00:00"))).toBe(true); // Dia 0
    expect(isScheduledOnDate(pepInterval, new Date("2026-08-29T00:00:00"))).toBe(false); // Dia 1
    expect(isScheduledOnDate(pepInterval, new Date("2026-08-30T00:00:00"))).toBe(true); // Dia 2
    expect(isScheduledOnDate(pepInterval, new Date("2026-08-27T00:00:00"))).toBe(false); // Antes de iniciar
  });

  it("calcula o progresso do dia baseado apenas nas doses devidas hoje", () => {
    const peptides = [
      { id: "p1", name: "Diário", days: null, perDay: 1 },
      { id: "p2", name: "Somente Domingo", days: [0], perDay: 1 }, // Não devido na sexta
      { id: "p3", name: "Sexta 2x", days: [5], perDay: 2 } // Devido na sexta com 2 doses
    ];

    const sexta = new Date("2026-08-28T12:00:00"); // Sexta-feira
    const scheduled = getScheduledPeptides(peptides, sexta);
    expect(scheduled).toHaveLength(2); // p1 e p3

    // Nenhum registro ainda
    const prog0 = calculateDayProgress(peptides, {}, sexta);
    expect(prog0.totalDue).toBe(3); // 1 dose de p1 + 2 doses de p3
    expect(prog0.totalTaken).toBe(0);
    expect(prog0.percentage).toBe(0);

    // 1 dose tomada de p1
    const logs1 = { "2026-08-28": { "p1": { t: "08:00" } } };
    const prog1 = calculateDayProgress(peptides, logs1, sexta);
    expect(prog1.totalTaken).toBe(1);
    expect(prog1.percentage).toBe(33);

    // Todas as 3 doses tomadas
    const logsAll = {
      "2026-08-28": {
        "p1": { t: "08:00" },
        "p3": [{ t: "09:00" }, { t: "21:00" }]
      }
    };
    const progAll = calculateDayProgress(peptides, logsAll, sexta);
    expect(progAll.totalTaken).toBe(3);
    expect(progAll.percentage).toBe(100);
    expect(progAll.isComplete).toBe(true);
  });

  it("gera ocorrências de doses em um intervalo de datas", () => {
    const pep = { id: "p1", days: [1, 5] }; // Seg e Sex
    // 2026-08-24 (Seg) até 2026-08-31 (Seg): deve conter 24(Seg), 28(Sex), 31(Seg)
    const occs = occurrencesForRange(pep, "2026-08-24", "2026-08-31");
    expect(occs).toHaveLength(3);
  });

  it("calcula próximas ocorrências (getUpcomingOccurrences) ordenadas por data e hora", () => {
    const peptides = [
      { id: "bpc", name: "BPC-157", days: null, time: "08:00", dose: "250 mcg", ui: 10 },
      { id: "tb", name: "TB-500", days: [1, 4], time: "20:00", dose: "500 mcg", ui: 20 }
    ];

    // 2026-08-30 é Domingo (0)
    const upcoming = getUpcomingOccurrences(peptides, "2026-08-30", 3);
    expect(upcoming).toHaveLength(3);
    expect(upcoming[0].name).toBe("BPC-157");
    expect(upcoming[0].dateKey).toBe("2026-08-30");
    expect(upcoming[1].dateKey).toBe("2026-08-31"); // Segunda: BPC-157 08:00
    expect(upcoming[1].name).toBe("BPC-157");
    expect(upcoming[2].dateKey).toBe("2026-08-31"); // Segunda: TB-500 20:00
    expect(upcoming[2].name).toBe("TB-500");
  });
});
