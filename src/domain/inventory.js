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
  
  // Status: active, finished, discarded, archived
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
      doseLogId: null,
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
    finishedAt: data.finishedAt || null,
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
 * Extrai dose em mcg a partir de string ou número.
 * Se a unidade for UI (U-100) e um frasco com concentração conhecida for fornecido, realiza a conversão:
 * volumeMl = UI / 100; doseMcg = volumeMl * concentrationMcgPerMl.
 *
 * @param {string|number} doseInput
 * @param {Object} [vial]
 * @returns {number}
 */
export function extractDoseInMcg(doseInput, vial = null) {
  if (typeof doseInput === "number" && !isNaN(doseInput)) {
    return doseInput > 0 ? doseInput : 0;
  }
  if (typeof doseInput === "string") {
    const trimmed = doseInput.trim().toLowerCase();
    if (!trimmed) return 0;
    const match = trimmed.match(/^([\d.,]+)\s*(mcg|mg|ui)$/);
    if (match) {
      const val = parseFloat(match[1].replace(",", "."));
      const unit = match[2];
      if (isNaN(val) || val <= 0) return 0;
      if (unit === "mg") return Math.round(val * 1000 * 100) / 100;
      if (unit === "mcg") return val;
      if (unit === "ui") {
        if (vial && vial.concentrationMcgPerMl > 0) {
          const volumeMl = val / 100; // Seringa U-100: 100 UI = 1 mL
          return Math.round(volumeMl * vial.concentrationMcgPerMl * 100) / 100;
        }
        return 0; // Sem concentração conhecida, não assume valores arbitrários
      }
    }
    const numOnlyMatch = trimmed.match(/^([\d.,]+)$/);
    if (numOnlyMatch) {
      const val = parseFloat(numOnlyMatch[1].replace(",", "."));
      return !isNaN(val) && val > 0 ? val : 0;
    }
  }
  return 0;
}

/**
 * Verifica se um frasco possui histórico de movimentações de doses ou vínculos em logs.
 * @param {Object} vial
 * @param {Object} [allLogs]
 * @returns {boolean}
 */
export function hasVialHistory(vial, allLogs = {}) {
  if (!vial || typeof vial !== "object") return false;

  const movements = Array.isArray(vial.movements) ? vial.movements : [];
  const hasDoseMovement = movements.some((m) => m && (m.type === "dose" || m.type === "undo_dose"));
  if (hasDoseMovement) return true;

  if (allLogs && typeof allLogs === "object") {
    for (const day of Object.values(allLogs)) {
      if (!day || typeof day !== "object") continue;
      for (const logs of Object.values(day)) {
        if (Array.isArray(logs)) {
          if (logs.some((l) => l && l.vialId === vial.id)) return true;
        } else if (logs && typeof logs === "object" && logs.vialId === vial.id) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Atualiza um frasco preservando a integridade estrutural caso possua histórico.
 * @param {Object} existingVial
 * @param {Object} updates
 * @param {Object} [allLogs]
 * @returns {{ success: boolean, vial?: Object, error?: string, message?: string }}
 */
export function updateVial(existingVial, updates = {}, allLogs = {}) {
  if (!existingVial || typeof existingVial !== "object") {
    return { success: false, error: "Frasco original inexistente ou inválido." };
  }

  const hasHistory = hasVialHistory(existingVial, allLogs);

  if (hasHistory) {
    const isChangingMg = updates.totalMg !== undefined && Number(updates.totalMg) !== Number(existingVial.totalMg);
    const isChangingWater = updates.waterMl !== undefined && Number(updates.waterMl) !== Number(existingVial.waterMl);

    if (isChangingMg || isChangingWater) {
      return {
        success: false,
        error: "PROTECTED_HISTORICAL_VIAL",
        message: "Frascos com movimentações registradas não podem ter massa total ou volume de diluente alterados."
      };
    }

    const updatedVial = {
      ...existingVial,
      peptideName: typeof updates.peptideName === "string" && updates.peptideName.trim() ? updates.peptideName.trim() : existingVial.peptideName,
      lotNumber: updates.lotNumber !== undefined ? String(updates.lotNumber).trim() : existingVial.lotNumber,
      expirationDate: updates.expirationDate !== undefined ? updates.expirationDate : existingVial.expirationDate,
      notes: updates.notes !== undefined ? String(updates.notes).trim() : existingVial.notes,
      status: updates.status !== undefined ? updates.status : existingVial.status
    };

    const val = validateVial(updatedVial);
    if (!val.valid) {
      return { success: false, error: "VALIDATION_FAILED", message: val.errors.join("; ") };
    }

    return { success: true, vial: updatedVial };
  }

  // Frasco sem histórico pode ser reconfigurado livremente
  const totalMg = updates.totalMg !== undefined ? Number(updates.totalMg) : existingVial.totalMg;
  const waterMl = updates.waterMl !== undefined ? Number(updates.waterMl) : existingVial.waterMl;
  const totalMcg = totalMg * 1000;
  const concentrationMcgPerMl = totalMg > 0 && waterMl > 0 ? Math.round((totalMg * 1000) / waterMl * 100) / 100 : 0;

  const updatedVial = {
    ...existingVial,
    peptideName: typeof updates.peptideName === "string" && updates.peptideName.trim() ? updates.peptideName.trim() : existingVial.peptideName,
    peptideId: updates.peptideId !== undefined ? updates.peptideId : existingVial.peptideId,
    lotNumber: updates.lotNumber !== undefined ? String(updates.lotNumber).trim() : existingVial.lotNumber,
    totalMg,
    waterMl,
    concentrationMcgPerMl,
    initialMcg: totalMcg,
    remainingMcg: totalMcg,
    reconstitutionDate: updates.reconstitutionDate || existingVial.reconstitutionDate,
    expirationDate: updates.expirationDate !== undefined ? updates.expirationDate : existingVial.expirationDate,
    notes: updates.notes !== undefined ? String(updates.notes).trim() : existingVial.notes,
    status: updates.status !== undefined ? updates.status : existingVial.status
  };

  const val = validateVial(updatedVial);
  if (!val.valid) {
    return { success: false, error: "VALIDATION_FAILED", message: val.errors.join("; ") };
  }

  return { success: true, vial: updatedVial };
}

/**
 * Verifica se um frasco pode ser excluído fisicamente sem deixar referências órfãs.
 * @param {Object} vial
 * @param {Object} [allLogs]
 * @returns {boolean}
 */
export function canDeleteVialPhysically(vial, allLogs = {}) {
  return !hasVialHistory(vial, allLogs);
}

/**
 * Arquiva um frasco (soft-delete).
 * @param {Object} vial
 * @param {string} [reason="archived"]
 * @returns {Object}
 */
export function archiveVial(vial, reason = "archived") {
  if (!vial || typeof vial !== "object") return vial;
  return {
    ...vial,
    status: reason,
    archivedAt: new Date().toISOString()
  };
}

/**
 * Debita uma dose de um frasco (retorna novo objeto de frasco imutável)
 * Rejeita a operação se amountToDebit > saldo atual.
 */
export function debitVialDose(vial, { doseMcg = 0, doseStr = "", doseLogId = null, date = null, note = "" } = {}) {
  const amountToDebit = doseMcg > 0 ? doseMcg : extractDoseInMcg(doseStr, vial);
  if (amountToDebit <= 0) {
    return { success: false, error: "Quantidade a debitar deve ser maior que zero.", vial };
  }

  const currentBalance = Number(vial.remainingMcg) || 0;
  if (amountToDebit > currentBalance) {
    return {
      success: false,
      error: "INSUFFICIENT_BALANCE",
      message: `Saldo insuficiente (${currentBalance} mcg disponíveis, solicitado ${amountToDebit} mcg).`,
      vial
    };
  }

  const newBalance = Math.round((currentBalance - amountToDebit) * 100) / 100;
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
    finishedAt: newBalance <= 0 ? (vial.finishedAt || now.toISOString()) : null,
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
 * Calcula o crédito real respeitando a capacidade máxima do frasco e reabrindo frasco finished se saldo > 0.
 */
export function creditVialDose(vial, { doseMcg = 0, doseStr = "", doseLogId = null, date = null, note = "" } = {}) {
  const amountToCredit = doseMcg > 0 ? doseMcg : extractDoseInMcg(doseStr, vial);
  if (amountToCredit <= 0) {
    return { success: false, error: "Quantidade a estornar deve ser maior que zero.", vial };
  }

  const currentBalance = Number(vial.remainingMcg) || 0;
  const maxBalance = Number(vial.initialMcg) || (vial.totalMg * 1000);
  const targetBalance = currentBalance + amountToCredit;
  const newBalance = Math.min(maxBalance, Math.round(targetBalance * 100) / 100);
  const actualCredit = Math.round((newBalance - currentBalance) * 100) / 100;

  if (actualCredit <= 0) {
    return { success: false, error: "Frasco já está na capacidade máxima.", vial };
  }

  const now = new Date();
  const dateStr = date || now.toISOString().slice(0, 10);

  const newMovement = {
    id: `mov-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    type: "undo_dose",
    amountMcg: actualCredit,
    balanceAfterMcg: newBalance,
    doseLogId: doseLogId || null,
    note: note || `Estorno de dose (${actualCredit} mcg)`,
    timestamp: now.toISOString()
  };

  const newStatus = newBalance > 0 && vial.status === "finished" ? "active" : vial.status;

  const updatedVial = {
    ...vial,
    remainingMcg: newBalance,
    status: newStatus,
    finishedAt: newStatus === "active" ? null : vial.finishedAt,
    movements: [...(vial.movements || []), newMovement]
  };

  return {
    success: true,
    vial: updatedVial,
    creditedMcg: actualCredit,
    newBalanceMcg: newBalance
  };
}

/**
 * Calcula doses estimadas restantes em um frasco
 */
export function calculateRemainingDoses(vial, doseStrOrMcg) {
  if (!vial || typeof vial !== "object") return 0;
  const doseMcg = typeof doseStrOrMcg === "number" ? doseStrOrMcg : extractDoseInMcg(doseStrOrMcg, vial);
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

