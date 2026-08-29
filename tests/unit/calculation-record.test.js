import { describe, it, expect } from "vitest";
import { calculateReconstitution } from "../../src/domain/calculator.js";
import {
  CALC_ALGORITHM_VERSION,
  createCalculationSnapshot,
  validateCalculationSnapshot,
  formatAuditTrail
} from "../../src/domain/calculation-record.js";

describe("Calculation Record Domain (V02)", () => {
  it("deve criar snapshot imutável e completo a partir de cálculo válido", () => {
    const calc = calculateReconstitution({
      vialMg: 5,
      waterMl: 2,
      doseVal: 250,
      doseUnit: "mcg",
      syringeMaxUI: 100
    });

    const snapshot = createCalculationSnapshot(calc);

    expect(snapshot.id).toMatch(/^calc_/);
    expect(snapshot.algorithmVersion).toBe(CALC_ALGORITHM_VERSION);
    expect(snapshot.vialMg).toBe(5);
    expect(snapshot.waterMl).toBe(2);
    expect(snapshot.doseVal).toBe(250);
    expect(snapshot.doseUnit).toBe("mcg");
    expect(snapshot.concentrationMgMl).toBe(2.5);
    expect(snapshot.volumeMl).toBe(0.1);
    expect(snapshot.unitsUI).toBe(10);
    expect(snapshot.dosesPerVial).toBe(20);
    expect(snapshot.formula).toContain("250 mcg");

    // Imutabilidade
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("deve lançar erro ao tentar criar snapshot de cálculo inválido", () => {
    const invalidCalc = { valid: false, error: "Dose excede frasco" };
    expect(() => createCalculationSnapshot(invalidCalc)).toThrow();
  });

  it("deve validar snapshot corretamente", () => {
    const calc = calculateReconstitution({
      vialMg: 10,
      waterMl: 2,
      doseVal: 2.5,
      doseUnit: "mg"
    });
    const snapshot = createCalculationSnapshot(calc);

    expect(validateCalculationSnapshot(snapshot).valid).toBe(true);
    expect(validateCalculationSnapshot({}).valid).toBe(false);
    expect(validateCalculationSnapshot(null).valid).toBe(false);
    expect(validateCalculationSnapshot({ ...snapshot, vialMg: -5 }).valid).toBe(false);
    expect(validateCalculationSnapshot({ ...snapshot, doseUnit: "invalid" }).valid).toBe(false);
  });

  it("deve formatar trilha de auditoria para dupla conferência humana", () => {
    const calc = calculateReconstitution({
      vialMg: 5,
      waterMl: 2,
      doseVal: 500,
      doseUnit: "mcg"
    });
    const snapshot = createCalculationSnapshot(calc);
    const trail = formatAuditTrail(snapshot);

    expect(trail).toBe("Frasco: 5 mg ➔ Diluente: 2 mL ➔ Concentração: 2.5 mg/mL ➔ Dose: 500 mcg ➔ Volume: 0.2 mL ➔ Aplicação: 20 UI (U-100)");
  });
});
