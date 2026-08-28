import { describe, it, expect } from "vitest";
import { createPeptide, validatePeptide, validateHexColor, validateDays, validateTimes } from "../../src/domain/protocol.js";

describe("Protocol Domain", () => {
  it("valida cores hexadecimais com segurança", () => {
    expect(validateHexColor("#2CC5C0")).toBe("#2CC5C0");
    expect(validateHexColor("#ffffff")).toBe("#ffffff");
    expect(validateHexColor("invalid", "#000000")).toBe("#000000");
    expect(validateHexColor("<script>", "#2CC5C0")).toBe("#2CC5C0");
  });

  it("valida e normaliza dias da semana", () => {
    expect(validateDays([1, 3, 5])).toEqual([1, 3, 5]);
    expect(validateDays([5, 1, 3, 1])).toEqual([1, 3, 5]); // remove duplicados e ordena
    expect(validateDays([0, 1, 2, 3, 4, 5, 6])).toBeNull(); // todos os dias = null
    expect(validateDays([])).toBeNull();
    expect(validateDays(null)).toBeNull();
  });

  it("valida e normaliza horários (times)", () => {
    expect(validateTimes(["08:00", "20:00"])).toEqual(["08:00", "20:00"]);
    expect(validateTimes([], "09:30")).toEqual(["09:30"]);
    expect(validateTimes(["invalid", "07:00"])).toEqual(["07:00"]);
  });

  it("cria peptídeo sanitizado com valores seguros", () => {
    const pep = createPeptide({
      name: "  BPC-157  ",
      sub: "Reparo tecidual",
      dose: "250 mcg",
      ui: 10,
      per: "dia",
      days: [1, 3, 5],
      time: "08:00",
      accent: "#2CC5C0"
    });

    expect(pep.name).toBe("BPC-157");
    expect(pep.days).toEqual([1, 3, 5]);
    expect(pep.freq).toBe("Seg · Qua · Sex");
    expect(pep.times).toEqual(["08:00"]);
    expect(pep.accent).toBe("#2CC5C0");
    expect(pep.id).toMatch(/^pep_/);
  });

  it("valida objeto de peptídeo", () => {
    expect(validatePeptide(null).valid).toBe(false);
    expect(validatePeptide({ name: "" }).valid).toBe(false);
    expect(validatePeptide({ name: "CJC-1295" }).valid).toBe(true);
  });
});
