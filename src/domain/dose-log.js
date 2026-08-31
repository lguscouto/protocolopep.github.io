/**
 * Domínio de Log e Rastreabilidade de Doses / Aplicações (V03)
 */

import { dateToKey } from "./schedule.js";

export const DOSE_STATUSES = ["applied", "skipped", "missed"];

export function createDoseLog(data = {}) {
  const todayKey = dateToKey(new Date());
  const scheduledDate = data.scheduledDate || todayKey;

  // Se a data agendada for anterior a hoje, ou data.retroactive for true, marca explicitamente como retroativo
  const isPastDate = scheduledDate < todayKey;
  const isRetroactive = Boolean(data.retroactive !== undefined ? data.retroactive : isPastDate);

  const now = new Date();
  let takenAt = data.takenAt;
  if (!takenAt) {
    if (isRetroactive && scheduledDate) {
      // Se for retroativo e não informou takenAt completo, compõe a data com o horário
      const timeStr = data.time || "12:00";
      const [hh, mm] = timeStr.split(":").map(Number);
      const safeH = Number.isInteger(hh) ? hh : 12;
      const safeM = Number.isInteger(mm) ? mm : 0;
      const pastD = new Date(`${scheduledDate}T${String(safeH).padStart(2, "0")}:${String(safeM).padStart(2, "0")}:00`);
      takenAt = pastD.toISOString();
    } else {
      takenAt = now.toISOString();
    }
  }

  const time = data.time || (takenAt ? new Date(takenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "12:00");
  const rawStatus = data.status || "applied";
  const status = DOSE_STATUSES.includes(rawStatus) ? rawStatus : "applied";

  return {
    id: data.id && typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    peptideId: data.peptideId ? String(data.peptideId) : "",
    scheduledDate,
    takenAt,
    time,
    status,
    statusReason: data.statusReason ? String(data.statusReason).trim() : "",
    dose: data.dose ? String(data.dose).trim() : "",
    ui: Number.isFinite(Number(data.ui)) ? Number(data.ui) : 0,
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

  if (!log.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(log.scheduledDate)) {
    return { valid: false, error: "scheduledDate inválida (deve ser formato YYYY-MM-DD)." };
  }

  if (log.status && !DOSE_STATUSES.includes(log.status)) {
    return { valid: false, error: `status de dose inválido. Deve ser um de: ${DOSE_STATUSES.join(", ")}` };
  }

  const todayKey = dateToKey(new Date());
  if (log.scheduledDate > todayKey) {
    return { valid: false, error: "Não é permitido registrar aplicações em datas futuras." };
  }

  return { valid: true };
}

export function normalizeDoseEntry(entry, scheduledDate, peptideId) {
  if (!entry) return null;

  if (typeof entry === "object" && entry.id && entry.peptideId) {
    return createDoseLog({
      ...entry,
      scheduledDate: entry.scheduledDate || scheduledDate,
      peptideId: entry.peptideId || peptideId
    });
  }

  // Objeto legado (ex: { time: "08:30" } ou { taken: true })
  return createDoseLog({
    id: typeof entry === "object" && entry.id ? entry.id : undefined,
    peptideId,
    scheduledDate,
    time: typeof entry === "object" ? entry.time || "12:00" : "12:00",
    dose: typeof entry === "object" ? entry.dose || "" : "",
    ui: typeof entry === "object" ? entry.ui || 0 : 0,
    note: typeof entry === "object" ? entry.note || "" : "",
    site: typeof entry === "object" ? entry.site || "" : "",
    vialId: typeof entry === "object" && entry.vialId ? entry.vialId : null,
    inventoryMovementId: typeof entry === "object" && entry.inventoryMovementId ? entry.inventoryMovementId : null,
    retroactive: scheduledDate < dateToKey(new Date())
  });
}
