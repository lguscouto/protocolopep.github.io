/**
 * Domínio de Serviço e Transições de Estado de Doses (P0)
 * Lógica pura, testável e sem dependências do DOM ou storage.
 */

import { createDoseLog, normalizeDoseEntry, validateDoseLog } from "./dose-log.js";
import { debitVialDose, creditVialDose, extractDoseInMcg } from "./inventory.js";
import { dateToKey } from "./schedule.js";

/**
 * Registra uma dose e debita o inventário correspondente (se disponível).
 * Retorna { success, logs, inventory, doseLog, vial, debitedMcg, error, message }
 */
export function registerDoseState({
  logs = {},
  inventory = [],
  peptides = [],
  peptideId,
  scheduledDate,
  time,
  dose,
  ui,
  site,
  note,
  status = "applied",
  statusReason = "",
  retroactive = false
}) {
  const targetDate = scheduledDate || dateToKey(new Date());
  const peptide = (peptides || []).find((p) => p.id === peptideId);
  const peptideName = peptide ? peptide.name : "";
  const doseStr = dose || (peptide ? peptide.dose : "");
  const uiVal = ui !== undefined && ui !== null ? Number(ui) : (peptide ? Number(peptide.ui) || 0 : 0);

  // 1. Localizar frasco ativo compatível
  let targetVial = null;
  let vialIndex = -1;
  if (Array.isArray(inventory)) {
    vialIndex = inventory.findIndex((v) => {
      if (v.status !== "active") return false;
      const vId = v.peptideId ? String(v.peptideId).trim().toLowerCase() : "";
      const vName = v.peptideName ? String(v.peptideName).trim().toLowerCase() : "";
      const pId = peptideId ? String(peptideId).trim().toLowerCase() : "";
      const pName = peptideName ? String(peptideName).trim().toLowerCase() : "";
      if (pId && (vId === pId || vName === pId)) return true;
      if (pName && (vId === pName || vName === pName)) return true;
      return false;
    });
    if (vialIndex !== -1) {
      targetVial = inventory[vialIndex];
    }
  }

  let updatedInventory = Array.isArray(inventory) ? [...inventory] : [];
  let debitedVial = null;
  let debitMovementId = null;
  let debitedMcg = 0;
  const generatedLogId = `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // 2. Se houver frasco ativo, tentar debitar
  if (targetVial) {
    const effectiveDoseInput = doseStr || (uiVal > 0 ? `${uiVal} UI` : "");
    const amountToDebit = extractDoseInMcg(effectiveDoseInput, targetVial);
    if (amountToDebit > 0) {
      // Rejeitar se saldo for insuficiente (P1 - Sec 12)
      if (amountToDebit > Number(targetVial.remainingMcg)) {
        return {
          success: false,
          error: "INSUFFICIENT_BALANCE",
          message: `Saldo insuficiente no frasco de ${targetVial.peptideName} (${targetVial.remainingMcg} mcg restantes, dose requer ${amountToDebit} mcg).`
        };
      }

      const debitResult = debitVialDose(targetVial, {
        doseMcg: amountToDebit,
        doseStr: effectiveDoseInput,
        doseLogId: generatedLogId,
        date: targetDate,
        note: peptideName || `Dose de ${amountToDebit} mcg`
      });

      if (!debitResult.success) {
        return { success: false, error: debitResult.error, message: debitResult.error };
      }

      debitedVial = debitResult.vial;
      debitedMcg = debitResult.debitedMcg;
      const movements = debitedVial.movements || [];
      debitMovementId = movements.length > 0 ? movements[movements.length - 1].id : null;
      updatedInventory[vialIndex] = debitedVial;
    }
  }

  // 3. Criar log de dose com vinculação ao frasco e movimento
  const doseLog = createDoseLog({
    id: generatedLogId,
    peptideId,
    scheduledDate: targetDate,
    time: time || (targetDate === dateToKey(new Date()) ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "12:00"),
    dose: doseStr,
    ui: uiVal,
    site: site || "",
    note: note || "",
    status,
    statusReason,
    retroactive,
    vialId: debitedVial ? debitedVial.id : null,
    inventoryMovementId: debitMovementId
  });

  const validation = validateDoseLog(doseLog);
  if (!validation.valid) {
    return { success: false, error: "VALIDATION_FAILED", message: validation.error };
  }

  // 4. Adicionar log de dose no registro da data
  const updatedLogs = { ...(logs || {}) };
  const dayRec = { ...(updatedLogs[targetDate] || {}) };
  const curr = dayRec[peptideId];
  let arr = [];
  if (Array.isArray(curr)) {
    arr = [...curr];
  } else if (curr && typeof curr === "object") {
    const norm = normalizeDoseEntry(curr, targetDate, peptideId);
    if (norm) arr = [norm];
  }
  arr.push(doseLog);
  dayRec[peptideId] = arr;
  updatedLogs[targetDate] = dayRec;

  return {
    success: true,
    logs: updatedLogs,
    inventory: updatedInventory,
    doseLog,
    vial: debitedVial,
    debitedMcg
  };
}

/**
 * Desfaz uma dose de um peptídeo em uma data, estornando exatamente no frasco original.
 * Retorna { success, logs, inventory, removedLog, vial, creditedMcg, error, message }
 */
export function undoDoseState({
  logs = {},
  inventory = [],
  peptideId,
  scheduledDate,
  doseLogId = null
}) {
  const targetDate = scheduledDate || dateToKey(new Date());
  const updatedLogs = { ...(logs || {}) };
  const dayRec = { ...(updatedLogs[targetDate] || {}) };
  const curr = dayRec[peptideId];

  let arr = [];
  if (Array.isArray(curr)) {
    arr = [...curr];
  } else if (curr && typeof curr === "object") {
    const norm = normalizeDoseEntry(curr, targetDate, peptideId);
    if (norm) arr = [norm];
  }

  if (arr.length === 0) {
    return { success: false, error: "NO_DOSE_TO_UNDO", message: "Nenhuma dose encontrada para desfazer." };
  }

  let removedLog = null;

  if (doseLogId) {
    const targetIndex = arr.findIndex((l) => l.id === doseLogId);
    if (targetIndex !== -1) {
      removedLog = arr[targetIndex];
      arr.splice(targetIndex, 1);
    }
  } else {
    removedLog = arr.pop();
  }

  if (!removedLog) {
    return { success: false, error: "DOSE_NOT_FOUND", message: "Dose não encontrada para desfazer." };
  }

  if (arr.length === 0) {
    delete dayRec[peptideId];
  } else {
    dayRec[peptideId] = arr;
  }

  if (Object.keys(dayRec).length === 0) {
    delete updatedLogs[targetDate];
  } else {
    updatedLogs[targetDate] = dayRec;
  }

  let updatedInventory = Array.isArray(inventory) ? [...inventory] : [];
  let creditedVial = null;
  let creditedMcg = 0;

  // 2. Estornar no frasco ORIGINAL que foi debitado (P0 - Sec 3 e 4)
  if (removedLog.vialId) {
    const vialIndex = updatedInventory.findIndex((v) => v.id === removedLog.vialId);
    if (vialIndex !== -1) {
      const origVial = updatedInventory[vialIndex];
      const effectiveDoseInput = removedLog.dose || (removedLog.ui ? `${removedLog.ui} UI` : "");
      const amountToCredit = extractDoseInMcg(effectiveDoseInput, origVial);
      if (amountToCredit > 0) {
        const creditRes = creditVialDose(origVial, {
          doseMcg: amountToCredit,
          doseStr: effectiveDoseInput,
          doseLogId: removedLog.id,
          date: targetDate,
          note: `Estorno de aplicação (${removedLog.id})`
        });
        if (creditRes.success) {
          creditedVial = creditRes.vial;
          creditedMcg = creditRes.creditedMcg;
          updatedInventory[vialIndex] = creditedVial;
        }
      }
    }
  }

  return {
    success: true,
    logs: updatedLogs,
    inventory: updatedInventory,
    removedLog,
    vial: creditedVial,
    creditedMcg
  };
}

/**
 * Remove uma dose do histórico por índice ou ID, estornando estoque se e somente se debitou originalmente.
 */
export function deleteDoseState({
  logs = {},
  inventory = [],
  scheduledDate,
  peptideId,
  doseLogId = null
}) {
  return undoDoseState({
    logs,
    inventory,
    peptideId,
    scheduledDate,
    doseLogId
  });
}

/**
 * Preenche retroativamente os logs de doses de um peptídeo para uma lista de datas calculadas.
 * Idempotente: não duplica logs caso uma data já possua dose registrada para este peptídeo.
 * Não debita inventário de frascos passados.
 * @param {Object} logs Objeto de logs { [dateKey]: { [peptideId]: [...] } }
 * @param {Object} peptide Objeto do peptídeo
 * @param {Array<{dateKey: string, times: string[]}>} backfillDates Lista de datas com horários
 * @returns {{ logs: Object, addedCount: number, datesAdded: string[] }}
 */
export function backfillPeptideDoseLogs(logs = {}, peptide = {}, backfillDates = []) {
  if (!peptide || !peptide.id || !Array.isArray(backfillDates) || backfillDates.length === 0) {
    return { logs: logs || {}, addedCount: 0, datesAdded: [] };
  }

  const updatedLogs = { ...(logs || {}) };
  let addedCount = 0;
  const datesAdded = [];

  const peptideId = peptide.id;
  const doseStr = peptide.dose || "";
  const uiVal = Number(peptide.ui) || 0;

  for (const item of backfillDates) {
    const { dateKey, times } = item;
    if (!dateKey) continue;

    const dayRec = { ...(updatedLogs[dateKey] || {}) };
    const curr = dayRec[peptideId];

    let existingArr = [];
    if (Array.isArray(curr)) {
      existingArr = curr;
    } else if (curr && typeof curr === "object") {
      existingArr = [curr];
    }

    if (existingArr.length > 0) {
      continue;
    }

    const timesList = Array.isArray(times) && times.length > 0 ? times : [peptide.time || "08:00"];
    const newLogsForDay = timesList.map((t) =>
      createDoseLog({
        peptideId,
        scheduledDate: dateKey,
        time: t,
        dose: doseStr,
        ui: uiVal,
        note: "Início do protocolo (retroativo)",
        status: "applied",
        retroactive: true,
        vialId: null,
        inventoryMovementId: null
      })
    );

    dayRec[peptideId] = newLogsForDay;
    updatedLogs[dateKey] = dayRec;
    addedCount += newLogsForDay.length;
    datesAdded.push(dateKey);
  }

  return {
    logs: updatedLogs,
    addedCount,
    datesAdded
  };
}
