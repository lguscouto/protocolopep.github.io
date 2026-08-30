import { describe, it, expect } from "vitest";
import { createDoseLog, validateDoseLog, normalizeDoseEntry } from "../../src/domain/dose-log.js";
import { dateToKey } from "../../src/domain/schedule.js";

describe("Dose Log Domain (V03)", () => {
  it("deve criar log de dose para a data de hoje como não retroativo", () => {
    const today = dateToKey(new Date());
    const log = createDoseLog({
      peptideId: "pep_123",
      scheduledDate: today,
      time: "08:30",
      dose: "250 mcg",
      ui: 10
    });

    expect(log.id).toMatch(/^log_/);
    expect(log.peptideId).toBe("pep_123");
    expect(log.scheduledDate).toBe(today);
    expect(log.time).toBe("08:30");
    expect(log.dose).toBe("250 mcg");
    expect(log.ui).toBe(10);
    expect(log.retroactive).toBe(false);
  });

  it("deve marcar explicitamente como retroativo ao registrar em data passada", () => {
    const pastDate = "2026-08-20";
    const log = createDoseLog({
      peptideId: "pep_123",
      scheduledDate: pastDate,
      time: "09:00",
      dose: "500 mcg",
      ui: 20,
      note: "Esqueci de registrar"
    });

    expect(log.scheduledDate).toBe(pastDate);
    expect(log.retroactive).toBe(true);
    expect(log.note).toBe("Esqueci de registrar");
  });

  it("deve validar e rejeitar datas futuras como aplicação tomada", () => {
    const futureDate = "2099-01-01";
    const log = createDoseLog({
      peptideId: "pep_123",
      scheduledDate: futureDate
    });

    const res = validateDoseLog(log);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("futuras");
  });

  it("deve validar e rejeitar log sem peptideId", () => {
    const log = createDoseLog({
      scheduledDate: "2026-08-28"
    });
    expect(validateDoseLog(log).valid).toBe(false);
  });

  it("deve normalizar entrada legada corretamente", () => {
    const legacy = { time: "07:15", note: "Tomado cedo" };
    const normalized = normalizeDoseEntry(legacy, "2026-08-25", "pep_456");

    expect(normalized).toBeDefined();
    expect(normalized.peptideId).toBe("pep_456");
    expect(normalized.scheduledDate).toBe("2026-08-25");
    expect(normalized.time).toBe("07:15");
    expect(normalized.note).toBe("Tomado cedo");
    expect(normalized.retroactive).toBe(true);
  });

  it("deve manter integridade e id único ao instanciar múltiplos logs", () => {
    const log1 = createDoseLog({ peptideId: "p1", scheduledDate: "2026-08-28" });
    const log2 = createDoseLog({ peptideId: "p1", scheduledDate: "2026-08-28" });

    expect(log1.id).not.toBe(log2.id);
  });

  it("suporta status de dose (applied, skipped, missed) e statusReason", () => {
    const logSkipped = createDoseLog({
      peptideId: "pep_1",
      status: "skipped",
      statusReason: "Pausa programada"
    });
    expect(logSkipped.status).toBe("skipped");
    expect(logSkipped.statusReason).toBe("Pausa programada");

    const logMissed = createDoseLog({
      peptideId: "pep_2",
      status: "missed",
      statusReason: "Esquecimento involuntário"
    });
    expect(logMissed.status).toBe("missed");
    expect(logMissed.statusReason).toBe("Esquecimento involuntário");
  });

  it("rejeita status de dose inválido na validação", () => {
    const invalidLog = {
      peptideId: "pep_1",
      scheduledDate: "2026-08-28",
      status: "invalid_status"
    };
    const res = validateDoseLog(invalidLog);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("status de dose inválido");
  });
});
