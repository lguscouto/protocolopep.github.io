/**
 * Módulo de Domínio: Inventário e Validade de Frascos (V10)
 * Lógica pura, sem dependências do DOM ou storage.
 */


/**
 * Cria um novo objeto de frasco normalizado
 */
export function createVial(data = {}) {
  const id = data.id || `vial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const peptideName = typeof data.peptideName === "string" ? data.peptideName.trim() : "";
  const peptideId = typeof data.peptideId === "string" ? data.peptideId.trim() : null;
  const lotNumber = typeof data.lotNumber === "string" ? data.lotNumber.trim() : "";
  const totalMg = Number(data.totalMg) > 0 ? Number(data.totalMg) : 0;
  const waterMl = Number(data.waterMl) > 0 ? Number(data.waterMl) : 0;
  
  // Concentração em mcg/ml: (totalMg * 1000) / waterMl
  let concentrationMcgPerMl = 0;
  if (totalMg > 0 && waterMl > 0) {
    concentrationMcgPerMl = Math.round((totalMg * 1000) / waterMl * 100) / 100;
  }

  const totalMcg = totalMg * 1000;
  const initialMcg = Number(data.initialMcg) > 0 ? Number(data.initialMcg) : totalMcg;
  const remainingMcg = data.remainingMcg !== undefined && data.remainingMcg !== null && !isNaN(Number(data.remainingMcg))
    ? Math.max(0, Number(data.remainingMcg))
    : initialMcg;

  const reconstitutionDate = data.reconstitutionDate || new Date().toISOString().slice(0, 10);
  const expirationDate = data.expirationDate || null;
  
  // Status: active, finished, discarded
  let status = data.status || "active";
  if (remainingMcg <= 0 && status === "active") {
    status = "finished";
  }

  const movements = Array.isArray(data.movements) ? [...data.movements] : [
    {
      id: `mov-${Date.now()}-init`,
      date: reconstitutionDate,
      type: "reconstitution",
      amountMcg: totalMcg,
      balanceAfterMcg: totalMcg,
      note: "Reconstituição inicial do frasco",
      timestamp: new Date().toISOString()
    }
  ];

  return {
    id,
    peptideName,
    peptideId,
    lotNumber,
    totalMg,
    waterMl,
    concentrationMcgPerMl,
    initialMcg,
    remainingMcg,
    reconstitutionDate,
    expirationDate,
    status,
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    createdAt: data.createdAt || new Date().toISOString(),
    movements
  };
}

/**
 * Valida os dados de um frasco
 */
export function validateVial(vial) {
  const errors = [];
  if (!vial || typeof vial !== "object") {
    return { valid: false, errors: ["Frasco inválido ou vazio."] };
  }
  if (!vial.peptideName || typeof vial.peptideName !== "string" || !vial.peptideName.trim()) {
    errors.push("Nome do peptídeo é obrigatório.");
  }
  if (isNaN(vial.totalMg) || vial.totalMg <= 0) {
    errors.push("Massa total (mg) deve ser um número positivo.");
  }
  if (isNaN(vial.waterMl) || vial.waterMl <= 0) {
    errors.push("Volume de diluente (ml) deve ser um número positivo.");
  }
  if (vial.remainingMcg !== undefined && (isNaN(vial.remainingMcg) || vial.remainingMcg < 0)) {
    errors.push("Saldo restante (mcg) não pode ser negativo.");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extrai dose em mcg a partir de string ou número
 */
export function extractDoseInMcg(doseInput) {
  if (typeof doseInput === "number" && !isNaN(doseInput)) {
    return doseInput > 0 ? doseInput : 0;
  }
  if (typeof doseInput === "string") {
    const trimmed = doseInput.trim().toLowerCase();
    if (!trimmed) return 0;
    const match = trimmed.match(/^([\d.,]+)\s*(mcg|mg|ui)?$/);
    if (match) {
      const val = parseFloat(match[1].replace(",", "."));
      const unit = match[2] || "mcg";
      if (isNaN(val) || val <= 0) return 0;
      if (unit === "mg") return Math.round(val * 1000 * 100) / 100;
      return val;
    }
    const fallbackNum = parseFloat(trimmed.replace(",", "."));
    return !isNaN(fallbackNum) && fallbackNum > 0 ? fallbackNum : 0;
  }
  return 0;
}

/**
 * Debita uma dose de um frasco (retorna novo objeto de frasco imutável)
 */
export function debitVialDose(vial, { doseMcg = 0, doseStr = "", doseLogId = null, date = null, note = "" } = {}) {
  const amountToDebit = doseMcg > 0 ? doseMcg : extractDoseInMcg(doseStr);
  if (amountToDebit <= 0) {
    return { success: false, error: "Quantidade a debitar deve ser maior que zero.", vial };
  }

  const currentBalance = Number(vial.remainingMcg) || 0;
  const newBalance = Math.max(0, currentBalance - amountToDebit);
  const now = new Date();
  const dateStr = date || now.toISOString().slice(0, 10);

  const newMovement = {
    id: `mov-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    type: "dose",
    amountMcg: -amountToDebit,
    balanceAfterMcg: newBalance,
    doseLogId: doseLogId || null,
    note: note || `Aplicação de ${amountToDebit} mcg`,
    timestamp: now.toISOString()
  };

  const newStatus = newBalance <= 0 ? "finished" : vial.status;

  const updatedVial = {
    ...vial,
    remainingMcg: newBalance,
    status: newStatus,
    movements: [...(vial.movements || []), newMovement]
  };

  return {
    success: true,
    vial: updatedVial,
    debitedMcg: amountToDebit,
    newBalanceMcg: newBalance,
    isFinished: newBalance <= 0
  };
}

/**
 * Estorna/Credita uma dose no frasco (retorna novo objeto imutável)
 */
export function creditVialDose(vial, { doseMcg = 0, doseStr = "", doseLogId = null, date = null, note = "" } = {}) {
  const amountToCredit = doseMcg > 0 ? doseMcg : extractDoseInMcg(doseStr);
  if (amountToCredit <= 0) {
    return { success: false, error: "Quantidade a estornar deve ser maior que zero.", vial };
  }

  const currentBalance = Number(vial.remainingMcg) || 0;
  const maxBalance = Number(vial.initialMcg) || (vial.totalMg * 1000);
  const newBalance = Math.min(maxBalance, currentBalance + amountToCredit);
  const now = new Date();
  const dateStr = date || now.toISOString().slice(0, 10);

  const newMovement = {
    id: `mov-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    type: "undo_dose",
    amountMcg: amountToCredit,
    balanceAfterMcg: newBalance,
    doseLogId: doseLogId || null,
    note: note || `Estorno de dose (${amountToCredit} mcg)`,
    timestamp: now.toISOString()
  };

  const newStatus = newBalance > 0 && vial.status === "finished" ? "active" : vial.status;

  const updatedVial = {
    ...vial,
    remainingMcg: newBalance,
    status: newStatus,
    movements: [...(vial.movements || []), newMovement]
  };

  return {
    success: true,
    vial: updatedVial,
    creditedMcg: amountToCredit,
    newBalanceMcg: newBalance
  };
}

/**
 * Calcula doses estimadas restantes em um frasco
 */
export function calculateRemainingDoses(vial, doseStrOrMcg) {
  if (!vial || typeof vial !== "object") return 0;
  const doseMcg = typeof doseStrOrMcg === "number" ? doseStrOrMcg : extractDoseInMcg(doseStrOrMcg);
  if (doseMcg <= 0) return 0;
  const balance = Number(vial.remainingMcg) || 0;
  return Math.floor(balance / doseMcg);
}

/**
 * Avalia o status de validade do frasco
 */
export function getExpirationStatus(vial, referenceDate = new Date()) {
  if (!vial || !vial.expirationDate) {
    return { status: "unknown", label: "Sem validade informada", daysRemaining: null };
  }

  const [y, m, d] = vial.expirationDate.split("-").map(Number);
  if (!y || !m || !d) {
    return { status: "unknown", label: "Data de validade inválida", daysRemaining: null };
  }

  const exp = new Date(y, m - 1, d, 23, 59, 59);
  const diffMs = exp.getTime() - referenceDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "expired",
      label: `Vencido há ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "dia" : "dias"}`,
      daysRemaining: diffDays
    };
  }

  if (diffDays <= 7) {
    return {
      status: "expiring_soon",
      label: `Vence em ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`,
      daysRemaining: diffDays
    };
  }

  return {
    status: "ok",
    label: `Válido por mais ${diffDays} dias`,
    daysRemaining: diffDays
  };
}
