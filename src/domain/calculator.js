/**
 * Domínio da Calculadora de Reconstituição e Conversões Canônicas
 */

export function convertDoseValue(value, fromUnit, toUnit) {
  if (!["mg", "mcg"].includes(fromUnit) || !["mg", "mcg"].includes(toUnit)) {
    return "";
  }
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  if (fromUnit === toUnit) return String(num);

  if (fromUnit === "mcg" && toUnit === "mg") {
    const res = num / 1000;
    return Number.isInteger(res) ? String(res) : String(parseFloat(res.toFixed(4)));
  }
  if (fromUnit === "mg" && toUnit === "mcg") {
    const res = num * 1000;
    return Number.isInteger(res) ? String(res) : String(parseFloat(res.toFixed(2)));
  }
  return String(num);
}

export function calculateReconstitution({
  vialMg,
  waterMl,
  doseVal,
  doseUnit = "mcg",
  syringeMaxUI = 100
}) {
  if (!["mg", "mcg"].includes(doseUnit)) {
    return { valid: false, error: "Unidade de dose inválida. Utilize 'mg' ou 'mcg'." };
  }

  const vMg = parseFloat(vialMg);
  const wMl = parseFloat(waterMl);
  const dVal = parseFloat(doseVal);
  const sMax = parseFloat(syringeMaxUI) || 100;

  if (!Number.isFinite(vMg) || vMg <= 0) {
    return { valid: false, error: "Quantidade do frasco deve ser um número maior que zero." };
  }
  if (!Number.isFinite(wMl) || wMl <= 0) {
    return { valid: false, error: "Volume de água deve ser um número maior que zero." };
  }
  if (!Number.isFinite(dVal) || dVal <= 0) {
    return { valid: false, error: "Dose pretendida deve ser um número maior que zero." };
  }

  const canonicalVialMcg = vMg * 1000;
  const canonicalDoseMcg = doseUnit === "mg" ? dVal * 1000 : dVal;
  const doseInMg = canonicalDoseMcg / 1000;

  if (canonicalDoseMcg > canonicalVialMcg) {
    return {
      valid: false,
      error: `Dose (${doseUnit === "mg" ? dVal + " mg" : dVal + " mcg"}) excede a quantidade total do frasco (${vMg} mg).`
    };
  }

  const concentrationMgMl = vMg / wMl;
  const concentrationMcgMl = canonicalVialMcg / wMl;

  // Volume em mL = dose em mg / concentração em mg/mL
  const volumeMl = doseInMg / concentrationMgMl;
  // Seringa U-100: 1 mL = 100 UI
  const unitsUI = volumeMl * 100;

  if (unitsUI > sMax) {
    return {
      valid: false,
      error: `Volume da dose (${unitsUI.toFixed(1)} UI / ${volumeMl.toFixed(2)} mL) excede a capacidade máxima da seringa (${sMax} UI).`
    };
  }

  const dosesPerVial = canonicalVialMcg / canonicalDoseMcg;

  return {
    valid: true,
    vialMg: vMg,
    waterMl: wMl,
    doseVal: dVal,
    doseUnit,
    canonicalDoseMcg,
    canonicalVialMcg,
    concentrationMgMl: parseFloat(concentrationMgMl.toFixed(4)),
    concentrationMcgMl: parseFloat(concentrationMcgMl.toFixed(2)),
    volumeMl: parseFloat(volumeMl.toFixed(4)),
    unitsUI: parseFloat(unitsUI.toFixed(2)),
    dosesPerVial: parseFloat(dosesPerVial.toFixed(2)),
    syringeMaxUI: sMax,
    formula: `${dVal} ${doseUnit} / ${concentrationMgMl.toFixed(2)} mg/mL = ${volumeMl.toFixed(3)} mL (${unitsUI.toFixed(1)} UI)`
  };
}
