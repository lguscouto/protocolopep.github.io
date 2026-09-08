/**
 * Domínio de Log e Rastreabilidade de Doses / Aplicações (V03)
 */

import { dateToKey, isValidTime, isValidDateKey } from "./schedule.js";
import { DOSE_STATUSES, parseUnits } from "./dose-state.js";
export { DOSE_STATUSES } from "./dose-state.js";

export function createDoseLog(data = {}) {
  const todayKey = dateToKey(new Date());
  // Preserve invalid supplied values so validation can reject them instead of recording today.
  const scheduledDate = data.scheduledDate === undefined ? todayKey : data.scheduledDate;

  // Se a data agendada for anterior a hoje, ou data.retroactive for true, marca explicitamente como retroativo
  const isPastDate = scheduledDate < todayKey;
  const isRetroactive = Boolean(data.retroactive !== undefined ? data.retroactive : isPastDate);

  const now = new Date();
  let takenAt = data.takenAt;
  if (!takenAt) {
    if (isValidDateKey(scheduledDate)) {
      // O instante informado pertence à data e ao horário efetivos, inclusive no dia atual.
      const timeStr = isValidTime(data.time) ? data.time : (scheduledDate === todayKey ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "12:00");
      const [hh, mm] = timeStr.split(":").map(Number);
      const safeH = Number.isInteger(hh) ? hh : 12;
      const safeM = Number.isInteger(mm) ? mm : 0;
      const pastD = new Date(`${scheduledDate}T${String(safeH).padStart(2, "0")}:${String(safeM).padStart(2, "0")}:00`);
      takenAt = pastD.toISOString();
    } else {
      takenAt = now.toISOString();
    }
  }

  const time = data.time !== undefined ? data.time : (takenAt && Number.isFinite(Date.parse(takenAt)) ? new Date(takenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "12:00");
  const rawStatus = data.status === undefined ? "applied" : data.status;
  const status = rawStatus;

  return {
    id: data.id && typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    peptideId: data.peptideId ? String(data.peptideId) : "",
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    ...(typeof data.peptideName === "string" ? { peptideName: data.peptideName } : {}),
    ...(typeof data.sub === "string" ? { sub: data.sub } : {}),
    protocolSnapshot: data.protocolSnapshot && typeof data.protocolSnapshot === "object" ? JSON.parse(JSON.stringify(data.protocolSnapshot)) : null,
    historyIntegrity: data.protocolSnapshot ? "captured" : "legacy",
    editHistory: Array.isArray(data.editHistory) ? JSON.parse(JSON.stringify(data.editHistory)) : [],
    debitedMcg: Number.isFinite(data.debitedMcg) && data.debitedMcg >= 0 ? data.debitedMcg : null,
    scheduledDate,
    takenAt,
    time,
    status,
    statusReason: data.statusReason ? String(data.statusReason).trim() : "",
    dose: data.dose ? String(data.dose).trim() : "",
    ui: data.ui === null ? null : parseUnits(data.ui),
    note: data.note ? String(data.note).trim() : "",
    site: data.site ? String(data.site).trim() : "",
    vialId: data.vialId ? String(data.vialId) : null,
    inventoryMovementId: data.inventoryMovementId ? String(data.inventoryMovementId) : null,
    retroactive: isRetroactive,
    createdAt: data.createdAt || now.toISOString(),
    editedAt: data.editedAt || null
  };
}

export function validateDoseLog(log) {
  if (!log || typeof log !== "object") {
    return { valid: false, error: "Objeto de log de dose inválido ou nulo." };
  }

  if (!log.peptideId) {
    return { valid: false, error: "peptideId é obrigatório no log de dose." };
  }

  if (!log.scheduledDate || !isValidDateKey(log.scheduledDate)) {
    return { valid: false, error: "scheduledDate inválida (deve ser formato YYYY-MM-DD com data de calendário válida)." };
  }

  if (log.time !== undefined && !isValidTime(log.time)) {
    return { valid: false, error: "time inválido (deve ser formato HH:mm válido entre 00:00 e 23:59)." };
  }

  if (log.status !== undefined && !DOSE_STATUSES.includes(log.status)) {
    return { valid: false, error: `status de dose inválido. Deve ser um de: ${DOSE_STATUSES.join(", ")}` };
  }
  if (log.ui === null || parseUnits(log.ui) === null) return { valid: false, error: "Unidades inválidas." };
  if (log.takenAt !== undefined && !Number.isFinite(Date.parse(log.takenAt))) return { valid: false, error: "Instante do registro inválido." };

  const todayKey = dateToKey(new Date());
  if (log.scheduledDate > todayKey) {
    return { valid: false, error: "Não é permitido registrar aplicações em datas futuras." };
  }

  return { valid: true };
}

export function normalizeDoseEntry(entry, scheduledDate, peptideId) {
  if (!entry) return null;
  const source = typeof entry === "object" ? entry : {};
  const normalized = createDoseLog({
    ...source,
    peptideId: source.peptideId || peptideId,
    scheduledDate: source.scheduledDate || scheduledDate,
    time: source.time !== undefined ? source.time : source.t || (isValidTime(entry) ? entry : "12:00")
  });
  // Migration must retain uncertainty: absent historical values are not an observed zero.
  if (source.ui === undefined) delete normalized.ui;
  if (source.dose === undefined) delete normalized.dose;
  return normalized;
}
