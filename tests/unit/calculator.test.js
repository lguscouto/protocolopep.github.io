import { describe, it, expect } from "vitest";
import { calculateReconstitution, convertDoseValue } from "../../src/domain/calculator.js";

describe("Calculator Domain", () => {
  it("converte valores ao alternar unidades mcg <-> mg sem multiplicar por 1000 indevidamente", () => {
    expect(convertDoseValue(250, "mcg", "mg")).toBe("0.25");
    expect(convertDoseValue("0.25", "mg", "mcg")).toBe("250");
    expect(convertDoseValue(5, "mg", "mcg")).toBe("5000");
    expect(convertDoseValue("5000", "mcg", "mg")).toBe("5");
    expect(convertDoseValue("", "mcg", "mg")).toBe("");
  });

  it("calcula reconstituição padrão com precisão auditável", () => {
    // 5mg vial, 2ml water, 250 mcg dose
    // Concentração = 2.5 mg/ml (2500 mcg/ml)
    // Volume da dose = 250 / 2500 = 0.1 ml = 10 UI
    // Doses por frasco = 5000 / 250 = 20 doses
    const result = calculateReconstitution({
      vialMg: 5,
      waterMl: 2,
      doseVal: 250,
      doseUnit: "mcg"
    });

    expect(result.valid).toBe(true);
    expect(result.concentrationMgMl).toBe(2.5);
    expect(result.volumeMl).toBe(0.1);
    expect(result.unitsUI).toBe(10);
    expect(result.dosesPerVial).toBe(20);
  });

  it("calcula dose fornecida em mg corretamente", () => {
    // 10mg vial, 2ml water, 2.5 mg dose
    // Concentração = 5 mg/ml
    // Volume da dose = 2.5 / 5 = 0.5 ml = 50 UI
    const result = calculateReconstitution({
      vialMg: 10,
      waterMl: 2,
      doseVal: 2.5,
      doseUnit: "mg"
    });

    expect(result.valid).toBe(true);
    expect(result.concentrationMgMl).toBe(5);
    expect(result.volumeMl).toBe(0.5);
    expect(result.unitsUI).toBe(50);
    expect(result.dosesPerVial).toBe(4);
  });

  it("rejeita entradas nulas, zero, negativas ou não numéricas", () => {
    expect(calculateReconstitution({ vialMg: 0, waterMl: 2, doseVal: 250 }).valid).toBe(false);
    expect(calculateReconstitution({ vialMg: 5, waterMl: -1, doseVal: 250 }).valid).toBe(false);
    expect(calculateReconstitution({ vialMg: 5, waterMl: 2, doseVal: "abc" }).valid).toBe(false);
  });

  it("rejeita dose maior que a quantidade total do frasco", () => {
    const result = calculateReconstitution({
      vialMg: 5,
      waterMl: 2,
      doseVal: 6, // 6mg > 5mg frasco
      doseUnit: "mg"
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("excede a quantidade total");
  });

  it("rejeita dose cujo volume exceda a capacidade da seringa U-100", () => {
    // 2mg vial, 5ml water, 1.5 mg dose -> volume = 3.75 ml = 375 UI (excede 100 UI da seringa padrão)
    const result = calculateReconstitution({
      vialMg: 2,
      waterMl: 5,
      doseVal: 1.5,
      doseUnit: "mg",
      syringeMaxUI: 100
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("excede a capacidade máxima da seringa");
  });
});
