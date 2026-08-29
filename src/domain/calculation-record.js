/**
 * Domínio de Registro Imutável e Auditável de Cálculo de Reconstituição (V02)
 */

export const CALC_ALGORITHM_VERSION = "1";

export function createCalculationSnapshot(calcResult) {
  if (!calcResult || !calcResult.valid) {
    throw new Error("Não é possível criar snapshot de um cálculo inválido.");
  }

  const snapshot = {
    id: `calc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    algorithmVersion: CALC_ALGORITHM_VERSION,
    createdAt: new Date().toISOString(),
    vialMg: Number(calcResult.vialMg),
    waterMl: Number(calcResult.waterMl),
    doseVal: Number(calcResult.doseVal),
    doseUnit: calcResult.doseUnit === "mg" ? "mg" : "mcg",
    canonicalDoseMcg: Number(calcResult.canonicalDoseMcg),
    canonicalVialMcg: Number(calcResult.canonicalVialMcg),
    concentrationMgMl: Number(calcResult.concentrationMgMl),
    volumeMl: Number(calcResult.volumeMl),
    unitsUI: Number(calcResult.unitsUI),
    dosesPerVial: Number(calcResult.dosesPerVial),
    syringeMaxUI: Number(calcResult.syringeMaxUI || 100),
    formula: String(calcResult.formula || "")
  };

  return Object.freeze(snapshot);
}

export function validateCalculationSnapshot(snap) {
  if (!snap || typeof snap !== "object") {
    return { valid: false, error: "Snapshot de cálculo inválido ou ausente." };
  }

  const requiredNum = ["vialMg", "waterMl", "doseVal", "concentrationMgMl", "volumeMl", "unitsUI"];
  for (const field of requiredNum) {
    if (typeof snap[field] !== "number" || !Number.isFinite(snap[field]) || snap[field] <= 0) {
      return { valid: false, error: `Campo numérico inválido ou menor que zero no snapshot: ${field}` };
    }
  }

  if (snap.doseUnit !== "mcg" && snap.doseUnit !== "mg") {
    return { valid: false, error: "Unidade de dose inválida no snapshot de cálculo." };
  }

  return { valid: true };
}

export function formatAuditTrail(snap) {
  if (!snap) return "";
  return [
    `Frasco: ${snap.vialMg} mg`,
    `Diluente: ${snap.waterMl} mL`,
    `Concentração: ${snap.concentrationMgMl} mg/mL`,
    `Dose: ${snap.doseVal} ${snap.doseUnit}`,
    `Volume: ${snap.volumeMl} mL`,
    `Aplicação: ${snap.unitsUI} UI (U-100)`
  ].join(" ➔ ");
}
