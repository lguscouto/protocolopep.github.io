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

    const invalidWeight = createMeasurementEntry({
      date: "2026-08-29",
      weightKg: 500 // Acima do limite aceitável de 400kg
    });
    const valRes = validateMeasurementEntry(invalidWeight);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors[0]).toContain("O peso deve estar entre 20 kg e 400 kg");
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
});
