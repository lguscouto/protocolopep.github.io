/**
 * Métricas descritivas de consistência da rotina.
 *
 * Este módulo não avalia eficácia, segurança ou necessidade de ajuste. Ele
 * apenas agrega o que foi programado e registrado pelo próprio usuário.
 */

import {
  calculateDayProgress,
  dateToKey,
  daysBetween,
  isValidDateKey,
  keyToDate
} from "./schedule.js";

function normalizeDateKey(value, fallback) {
  if (typeof value === "string" && isValidDateKey(value)) return value;
  if (value instanceof Date || typeof value === "number") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return dateToKey(date);
  }
  return fallback;
}

function shiftDateKey(key, offset) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + offset);
  return dateToKey(date);
}

function emptySummary(startDate, endDate) {
  return {
    startDate,
    endDate,
    days: [],
    scheduledDays: 0,
    completeDays: 0,
    partialDays: 0,
    emptyScheduledDays: 0,
    due: 0,
    applied: 0,
    resolved: 0,
    skipped: 0,
    missed: 0,
    pending: 0,
    extraApplied: 0,
    applicationPercent: 0,
    resolutionPercent: 0,
    completionPercent: 0
  };
}

/**
 * Agrega os estados da rotina em um intervalo inclusivo.
 * @param {Array} peptides
 * @param {Object} logs
 * @param {{startDate?: string|Date, endDate?: string|Date, days?: number}} options
 */
export function calculateAdherenceSummary(peptides = [], logs = {}, options = {}) {
  const todayKey = dateToKey(new Date());
  const endDate = normalizeDateKey(options.endDate, todayKey);
  const requestedDays = Number.parseInt(options.days, 10);
  const windowDays = Number.isInteger(requestedDays) && requestedDays > 0
    ? Math.min(366, requestedDays)
    : 7;
  const defaultStart = shiftDateKey(endDate, -(windowDays - 1));
  const startDate = normalizeDateKey(options.startDate, defaultStart);

  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || daysBetween(startDate, endDate) < 0) {
    return emptySummary(startDate, endDate);
  }

  const result = emptySummary(startDate, endDate);
  const current = keyToDate(startDate);
  const end = keyToDate(endDate);

  while (current <= end) {
    const dateKeyValue = dateToKey(current);
    const progress = calculateDayProgress(peptides, logs, dateKeyValue);
    const hasScheduled = progress.totalDue > 0;
    const isComplete = hasScheduled && progress.pendingCount === 0;
    const isPartial = hasScheduled && progress.resolvedCount > 0 && progress.pendingCount > 0;
    const day = {
      dateKey: dateKeyValue,
      totalDue: progress.totalDue,
      applied: Math.min(progress.totalDue, progress.scheduledTaken),
      resolved: Math.min(progress.totalDue, progress.resolvedCount),
      skipped: progress.skippedCount,
      missed: progress.missedCount,
      pending: progress.pendingCount,
      extraApplied: progress.extraTaken,
      status: isComplete ? "complete" : isPartial ? "partial" : hasScheduled ? "empty" : "rest"
    };

    result.days.push(day);
    if (hasScheduled) {
      result.scheduledDays += 1;
      result.due += progress.totalDue;
      result.applied += day.applied;
      result.resolved += day.resolved;
      result.skipped += day.skipped;
      result.missed += day.missed;
      result.pending += day.pending;
      result.extraApplied += day.extraApplied;
      if (isComplete) result.completeDays += 1;
      else if (isPartial) result.partialDays += 1;
      else result.emptyScheduledDays += 1;
    } else {
      // Registros extras fora da agenda continuam visíveis no balanço, mas não
      // transformam um dia de descanso em dia programado.
      result.extraApplied += day.extraApplied;
    }

    current.setDate(current.getDate() + 1);
  }

  result.applicationPercent = result.due > 0
    ? Math.min(100, Math.round((result.applied / result.due) * 100))
    : 0;
  result.resolutionPercent = result.due > 0
    ? Math.min(100, Math.round((result.resolved / result.due) * 100))
    : 0;
  result.completionPercent = result.scheduledDays > 0
    ? Math.round((result.completeDays / result.scheduledDays) * 100)
    : 0;

  return result;
}
