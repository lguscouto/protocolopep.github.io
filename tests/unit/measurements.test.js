import { describe, it, expect } from "vitest";
import {
  createMeasurementEntry,
  validateMeasurementEntry,
  calculateMeasurementStats,
  filterMeasurements,
  haveMeasurementsChanged,
  formatSymptomLabel,
  DEFAULT_SYMPTOM_SUGGESTIONS
} from "../../src/domain/measurements.js";

describe("Measurements Domain (V12)", () => {
  it("possui lista padrão de sugestões de sintomas", () => {
    expect(Array.isArray(DEFAULT_SYMPTOM_SUGGESTIONS)).toBe(true);
    expect(DEFAULT_SYMPTOM_SUGGESTIONS.length).toBeGreaterThan(0);
    expect(DEFAULT_SYMPTOM_SUGGESTIONS).toContain("Fadiga");
  });

  it("cria registro de medição normalizado e sanitizado", () => {
    const entry = createMeasurementEntry({
      date: "2026-08-29",
      time: "09:30",
      weightKg: "82,5",
      energyLevel: 4,
      moodLevel: 5,
      symptoms: [" Fadiga ", "Dor de cabeça", "Fadiga", ""],
      notes: " Pós treino leve "
    });

    expect(entry.id).toMatch(/^m_/);
    expect(entry.date).toBe("2026-08-29");
    expect(entry.time).toBe("09:30");
    expect(entry.weightKg).toBe(82.5);
    expect(entry.energyLevel).toBe(4);
    expect(entry.moodLevel).toBe(5);
    expect(entry.symptoms).toEqual(["Fadiga", "Dor de cabeça"]);
    expect(entry.notes).toBe("Pós treino leve");
    expect(entry.zoneOffset).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(typeof entry.zoneOffset).toBe("string");
    expect(entry.zoneOffset).toMatch(/^[+-]\d{2}:\d{2}$/);

    const validRes = validateMeasurementEntry(entry);
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toHaveLength(0);
  });

  it("preserva clientRecordId quando fornecido", () => {
    const entry = createMeasurementEntry({
      id: "m_custom_1",
      clientRecordId: "client_rec_12345",
      date: "2026-08-29",
      weightKg: 81.0
    });

    expect(entry.clientRecordId).toBe("client_rec_12345");
    expect(entry.id).toBe("m_custom_1");
  });

  it("distingue estritamente entre peso ausente (null) e valores numéricos", () => {
    const entryWithoutWeight = createMeasurementEntry({
      date: "2026-08-29",
      weightKg: null,
      energyLevel: 3
    });
    expect(entryWithoutWeight.weightKg).toBeNull();
    expect(validateMeasurementEntry(entryWithoutWeight).valid).toBe(true);

    expect(() => createMeasurementEntry({
      date: "2026-08-29",
      weightKg: 500
    })).toThrow("O peso deve estar entre 20 kg e 400 kg");
  });

  it("rejeita datas inválidas e níveis de energia/humor fora da escala 1 a 5", () => {
    const invalidEntry = {
      date: "data-invalida",
      energyLevel: 6,
      moodLevel: 0
    };
    const res = validateMeasurementEntry(invalidEntry);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("calcula estatísticas descritivas puras sem inventar ou interpolar dias vazios", () => {
    const entries = [
      createMeasurementEntry({ date: "2026-08-01", weightKg: 85.0, energyLevel: 3, symptoms: ["Fadiga"] }),
      createMeasurementEntry({ date: "2026-08-10", weightKg: 84.2, energyLevel: 4, symptoms: ["Fadiga", "Náusea leve"] }),
      createMeasurementEntry({ date: "2026-08-20", weightKg: null, energyLevel: 5, symptoms: ["Disposição elevada"] }), // Sem peso
      createMeasurementEntry({ date: "2026-08-29", weightKg: 83.0, energyLevel: 4, symptoms: ["Disposição elevada"] })
    ];

    const stats = calculateMeasurementStats(entries);
    expect(stats.totalEntries).toBe(4);
    expect(stats.earliestWeight).toBe(85.0);
    expect(stats.latestWeight).toBe(83.0);
    expect(stats.weightDelta).toBe(-2.0);
    expect(stats.minWeight).toBe(83.0);
    expect(stats.maxWeight).toBe(85.0);
    expect(stats.averageEnergy).toBe(4.0); // (3 + 4 + 5 + 4) / 4 = 4.0
    expect(stats.symptomsFrequency["Fadiga"]).toBe(2);
    expect(stats.symptomsFrequency["Disposição elevada"]).toBe(2);
    expect(stats.mostFrequentSymptom).toBeDefined();
  });

  it("filtra registros por intervalo de datas e sintoma", () => {
    const entries = [
      createMeasurementEntry({ date: "2026-08-01", symptoms: ["Fadiga"] }),
      createMeasurementEntry({ date: "2026-08-15", symptoms: ["Dor de cabeça"] }),
      createMeasurementEntry({ date: "2026-08-29", symptoms: ["Fadiga", "Dor de cabeça"] })
    ];

    const filteredDate = filterMeasurements(entries, { startDate: "2026-08-10", endDate: "2026-08-30" });
    expect(filteredDate).toHaveLength(2);

    const filteredSymptom = filterMeasurements(entries, { symptom: "Fadiga" });
    expect(filteredSymptom).toHaveLength(2);
  });

  it("detecta alterações profundas com haveMeasurementsChanged", () => {
    const a = [createMeasurementEntry({ date: "2026-08-29", weightKg: 80.0 })];
    const b = [createMeasurementEntry({ date: "2026-08-29", weightKg: 80.0 })];
    expect(haveMeasurementsChanged(a, b)).toBe(true); // IDs diferentes

    const item = createMeasurementEntry({ id: "m1", date: "2026-08-29", weightKg: 80.0 });
    expect(haveMeasurementsChanged([item], [item])).toBe(false);

    const itemEdited = { ...item, weightKg: 79.5 };
    expect(haveMeasurementsChanged([item], [itemEdited])).toBe(true);
  });

  // ─── P0 (CODEX v2.5.0): Separação semântica de timestamp / createdAt / updatedAt ───

  describe("P0 — timestamp / createdAt / updatedAt (CODEX v2.5.0)", () => {
    it("novo registro retroativo: timestamp é histórico e createdAt = updatedAt = agora", () => {
      const entry = createMeasurementEntry({ date: "2026-08-29", time: "08:00", weightKg: 82.5 });
      expect(entry.timestamp).toBeDefined();
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();
      expect(entry.createdAt).not.toBe(entry.timestamp);
      expect(Date.parse(entry.createdAt)).toBeGreaterThan(Date.parse(entry.timestamp));
      expect(entry.updatedAt).toBe(entry.createdAt);
    });

    it("persiste timeZoneId e calcula offset histórico coerente", () => {
      const january = createMeasurementEntry({
        date: "2026-01-15", time: "08:00", weightKg: 82.5, timeZoneId: "America/New_York"
      });
      const july = createMeasurementEntry({
        date: "2026-07-15", time: "08:00", weightKg: 82.5, timeZoneId: "America/New_York"
      });
      expect(january.timeZoneId).toBe("America/New_York");
      expect(january.zoneOffset).toBe("-05:00");
      expect(january.timestamp).toBe("2026-01-15T13:00:00.000Z");
      expect(july.zoneOffset).toBe("-04:00");
      expect(july.timestamp).toBe("2026-07-15T12:00:00.000Z");
    });

    it("rejeita data, hora, offset e timezone explicitamente inválidos", () => {
      expect(() => createMeasurementEntry({ date: "2026-99-99" })).toThrow("Data da medição inválida");
      expect(() => createMeasurementEntry({ date: "2026-08-29", time: "99:99" })).toThrow("Hora da medição inválida");
      expect(() => createMeasurementEntry({ date: "" })).toThrow("Data da medição inválida");
      expect(() => createMeasurementEntry({ date: "2026-08-29", time: "" })).toThrow("Hora da medição inválida");
      expect(() => createMeasurementEntry({ date: "2026-08-29", zoneOffset: "+19:00" })).toThrow("Offset de fuso inválido");
      expect(() => createMeasurementEntry({ date: "2026-08-29", timeZoneId: "Not/A_Zone" })).toThrow("Timezone IANA inválido");
    });

    it("rejeita números parcialmente válidos e escalas fracionárias", () => {
      expect(() => createMeasurementEntry({ date: "2026-08-29", weightKg: "80kg" })).toThrow("peso");
      expect(() => createMeasurementEntry({ date: "2026-08-29", energyLevel: 2.5 })).toThrow("energia");
      expect(() => createMeasurementEntry({ date: "2026-08-29", moodLevel: "3.5" })).toThrow("humor");
    });

    it("detecta mudanças apenas em metadados de sincronização", () => {
      const base = createMeasurementEntry({
        id: "m_meta", date: "2026-08-29", time: "08:00", weightKg: 80,
        timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-03:00",
        healthConnectRecordId: "hc-1", clientRecordId: "m_meta", clientRecordVersion: 1,
        dataOrigin: "com.protocolopep.app", ownership: "pep"
      });
      for (const patch of [
        { healthConnectRecordId: "hc-2" },
        { zoneOffset: "+09:00" },
        { clientRecordVersion: 2 },
        { timestamp: "2026-08-29T12:00:00.000Z" },
        { timeZoneId: "Asia/Tokyo" }
      ]) {
        expect(haveMeasurementsChanged([base], [{ ...base, ...patch }])).toBe(true);
      }
      expect(haveMeasurementsChanged([base], [{ ...base }])).toBe(false);
    });

    it("timestamp explícito é preservado e não derivado de createdAt", () => {
      const explicitTimestamp = "2026-08-29T11:00:00.000Z";
      const entry = createMeasurementEntry({
        date: "2026-08-29", time: "08:00", weightKg: 82.5,
        timestamp: explicitTimestamp, zoneOffset: "-03:00",
        createdAt: "2099-01-01T00:00:00.000Z"
      });
      expect(entry.timestamp).toBe(explicitTimestamp);
      expect(entry.createdAt).toBe("2099-01-01T00:00:00.000Z");
    });

    it("editar data recalcula timestamp (cenário canônico CODEX)", () => {
      const originalTimestamp = "2026-08-29T11:00:00.000Z";
      const originalCreatedAt = "2026-08-29T11:00:00.000Z";
      const edited = createMeasurementEntry({
        id: "m_test_1", date: "2026-08-30", time: "10:00", weightKg: 82.5,
        zoneOffset: "-03:00",
        timestamp: null,
        createdAt: originalCreatedAt,
        updatedAt: new Date().toISOString()
      });
      expect(edited.timestamp).not.toBe(originalTimestamp);
      expect(edited.createdAt).toBe(originalCreatedAt);
      expect(edited.timestamp).toContain("2026-08-30");
    });

    it("editar apenas peso preserva timestamp histórico", () => {
      const originalTimestamp = "2026-08-29T11:00:00.000Z";
      const originalCreatedAt = "2026-08-29T11:00:00.000Z";
      const edited = createMeasurementEntry({
        id: "m_test_2", date: "2026-08-29", time: "08:00", weightKg: 83.0,
        zoneOffset: "-03:00",
        timestamp: originalTimestamp,
        createdAt: originalCreatedAt,
        updatedAt: new Date().toISOString()
      });
      expect(edited.timestamp).toBe(originalTimestamp);
      expect(edited.createdAt).toBe(originalCreatedAt);
      expect(edited.weightKg).toBe(83.0);
    });

    it("createdAt nunca muda após múltiplas edições", () => {
      const originalCreatedAt = "2026-08-01T12:00:00.000Z";
      const edit1 = createMeasurementEntry({ id: "m_i", date: "2026-08-02", time: "09:00", weightKg: 80.0, createdAt: originalCreatedAt, updatedAt: "2026-08-02T12:00:00.000Z" });
      const edit2 = createMeasurementEntry({ id: "m_i", date: "2026-08-05", time: "11:00", weightKg: 79.5, createdAt: originalCreatedAt, updatedAt: "2026-08-05T14:00:00.000Z" });
      const edit3 = createMeasurementEntry({ id: "m_i", date: "2026-08-10", time: "08:30", weightKg: 78.8, createdAt: originalCreatedAt, updatedAt: "2026-08-10T11:30:00.000Z" });
      expect(edit1.createdAt).toBe(originalCreatedAt);
      expect(edit2.createdAt).toBe(originalCreatedAt);
      expect(edit3.createdAt).toBe(originalCreatedAt);
    });

    it("updatedAt avança a cada edição e é maior que o anterior", () => {
      const createdAt = "2026-08-01T12:00:00.000Z";
      const updatedAt1 = "2026-08-05T10:00:00.000Z";
      const updatedAt2 = "2026-08-20T15:30:00.000Z";
      const original = createMeasurementEntry({ id: "m_u", date: "2026-08-01", time: "09:00", weightKg: 80.0, createdAt, updatedAt: null });
      expect(original.updatedAt).toBe(createdAt);
      const edit1 = createMeasurementEntry({ id: "m_u", date: "2026-08-01", time: "09:00", weightKg: 80.5, createdAt, updatedAt: updatedAt1 });
      const edit2 = createMeasurementEntry({ id: "m_u", date: "2026-08-01", time: "09:00", weightKg: 81.0, createdAt, updatedAt: updatedAt2 });
      expect(edit1.updatedAt).toBe(updatedAt1);
      expect(edit2.updatedAt).toBe(updatedAt2);
      expect(edit2.updatedAt > edit1.updatedAt).toBe(true);
    });

    it("editar hora recalcula timestamp para novo instante", () => {
      const originalCreatedAt = "2026-08-15T12:00:00.000Z";
      const edited = createMeasurementEntry({
        id: "m_time_test", date: "2026-08-15", time: "18:00", weightKg: 82.0,
        zoneOffset: "-03:00", timestamp: null, createdAt: originalCreatedAt
      });
      expect(edited.timestamp).toContain("2026-08-15");
      expect(edited.createdAt).toBe(originalCreatedAt);
      expect(edited.timestamp).not.toBe(originalCreatedAt);
    });

    it("backup preserva os três campos temporais sem alteração", () => {
      const ts = "2026-08-10T14:00:00.000Z";
      const ca = "2026-08-10T14:00:00.000Z";
      const ua = "2026-08-25T09:30:00.000Z";
      const entry = createMeasurementEntry({ id: "m_bk", date: "2026-08-10", time: "11:00", weightKg: 80.0, timestamp: ts, zoneOffset: "-03:00", createdAt: ca, updatedAt: ua });
      expect(entry.timestamp).toBe(ts);
      expect(entry.createdAt).toBe(ca);
      expect(entry.updatedAt).toBe(ua);
    });
  });
});
