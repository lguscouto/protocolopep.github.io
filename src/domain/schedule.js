/**
 * Motor Puro de Agendamento e Ocorrências de Doses
 */

export function isValidTime(timeStr) {
  if (typeof timeStr !== "string") return false;
  const trimmed = timeStr.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return false;
  const [hh, mm] = trimmed.split(":").map(Number);
  return Number.isInteger(hh) && Number.isInteger(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function isValidDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return false;
  }
  const [y, m, d] = key.split("-").map(Number);
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function dateToKey(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export function keyToDate(key) {
  if (typeof key !== "string" || !isValidDateKey(key)) {
    return new Date();
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function daysBetween(aKey, bDate) {
  if (!aKey || !bDate) return 0;
  const aStr = typeof aKey === "string" ? aKey : dateToKey(aKey);
  const bStr = typeof bDate === "string" ? bDate : dateToKey(bDate);
  if (!isValidDateKey(aStr) || !isValidDateKey(bStr)) return 0;

  const [y1, m1, d1] = aStr.split("-").map(Number);
  const [y2, m2, d2] = bStr.split("-").map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((utc2 - utc1) / 86400000);
}

export function isScheduledOnDate(peptide, targetDate = new Date()) {
  if (!peptide || typeof peptide !== "object") return false;

  const d = new Date(targetDate);
  d.setHours(0, 0, 0, 0);

  // 1. Regra de Intervalo Cíclico (A cada X dias)
  if (peptide.interval && Number.isInteger(parseInt(peptide.interval, 10)) && parseInt(peptide.interval, 10) > 1) {
    const intVal = parseInt(peptide.interval, 10);
    if (!peptide.start) return true;
    const diff = daysBetween(peptide.start, d);
    if (diff < 0) return false; // Antes do início do ciclo
    return diff % intVal === 0;
  }

  // 2. Regra de Dias Específicos da Semana ([0..6] - Dom a Sáb)
  if (Array.isArray(peptide.days) && peptide.days.length > 0 && peptide.days.length < 7) {
    const dow = d.getDay();
    return peptide.days.includes(dow);
  }

  // 3. Regra Padrão: Todos os dias (days == null ou todos os 7 dias)
  return true;
}

export function getScheduledPeptides(peptides = [], targetDate = new Date()) {
  if (!Array.isArray(peptides)) return [];
  return peptides.filter((p) => isScheduledOnDate(p, targetDate));
}

export function calculateDayProgress(peptides = [], logs = {}, targetDate = new Date()) {
  const tKey = dateToKey(targetDate);
  const dayLogs = (logs && logs[tKey]) ? logs[tKey] : {};
  const scheduled = getScheduledPeptides(peptides, targetDate);

  let totalDue = 0;
  let scheduledTaken = 0;
  const scheduledPepIds = new Set();

  scheduled.forEach((p) => {
    const due = Math.max(1, parseInt(p.perDay, 10) || 1);
    totalDue += due;
    scheduledPepIds.add(p.id);

    const val = dayLogs[p.id];
    let count = 0;
    if (Array.isArray(val)) {
      count = val.length;
    } else if (val && typeof val === "object") {
      count = 1;
    }
    scheduledTaken += Math.min(due, count);
  });

  let totalTaken = 0;
  let extraTaken = 0;
  Object.entries(dayLogs).forEach(([pepId, val]) => {
    let count = 0;
    if (Array.isArray(val)) {
      count = val.length;
    } else if (val && typeof val === "object") {
      count = 1;
    }
    totalTaken += count;
    if (!scheduledPepIds.has(pepId)) {
      extraTaken += count;
    } else {
      const p = scheduled.find((x) => x.id === pepId);
      const due = p ? Math.max(1, parseInt(p.perDay, 10) || 1) : 1;
      if (count > due) {
        extraTaken += (count - due);
      }
    }
  });

  const percentage = totalDue > 0
    ? Math.min(100, Math.round((scheduledTaken / totalDue) * 100))
    : (totalTaken > 0 ? 100 : 0);

  return {
    dateKey: tKey,
    totalScheduled: scheduled.length,
    totalDue,
    totalTaken,
    scheduledTaken,
    extraTaken,
    percentage,
    isComplete: totalDue > 0 && scheduledTaken >= totalDue
  };
}

export function occurrencesForRange(peptide, startDate, endDate) {
  if (!peptide) return [];
  const start = typeof startDate === "string" ? keyToDate(startDate) : new Date(startDate);
  const end = typeof endDate === "string" ? keyToDate(endDate) : new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const dates = [];
  const curr = new Date(start);

  while (curr <= end) {
    if (isScheduledOnDate(peptide, curr)) {
      dates.push(new Date(curr));
    }
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

export function getUpcomingOccurrences(peptides = [], fromDate = new Date(), limit = 3, horizonDays = 14) {
  if (!Array.isArray(peptides) || peptides.length === 0 || limit <= 0) return [];

  const start = typeof fromDate === "string" ? keyToDate(fromDate) : new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const results = [];
  const current = new Date(start);

  for (let day = 0; day <= horizonDays; day++) {
    const d = new Date(current);
    d.setDate(d.getDate() + day);
    const dKey = dateToKey(d);

    for (const p of peptides) {
      if (isScheduledOnDate(p, d)) {
        results.push({
          dateKey: dKey,
          date: d,
          peptideId: p.id,
          name: p.name,
          dose: p.dose || "",
          ui: p.ui || 0,
          time: p.time || "08:00",
          color: p.color || "var(--primary)"
        });
      }
    }
  }

  results.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }
    return (a.time || "").localeCompare(b.time || "");
  });

  return results.slice(0, limit);
}

/**
 * Calcula as ocorrências de doses programadas anteriores à data atual (até ontem).
 * @param {Object} peptide Objeto do peptídeo com regras de agendamento
 * @param {string|Date} startDate Data da primeira dose / início do protocolo
 * @param {string|Date} [todayDate=new Date()] Data de referência (hoje)
 * @returns {Array<{dateKey: string, date: Date, times: string[]}>}
 */
export function calculateBackfillDates(peptide, startDate, todayDate = new Date()) {
  if (!peptide || !startDate) return [];

  const startStr = typeof startDate === "string" ? startDate : dateToKey(startDate);
  const todayStr = typeof todayDate === "string" ? todayDate : dateToKey(todayDate);

  if (!isValidDateKey(startStr) || !isValidDateKey(todayStr)) return [];
  if (startStr >= todayStr) return [];

  const startDt = keyToDate(startStr);
  const todayDt = keyToDate(todayStr);

  const endDt = new Date(todayDt);
  endDt.setDate(endDt.getDate() - 1);

  if (startDt > endDt) return [];

  const dates = occurrencesForRange(peptide, startDt, endDt);

  const times = Array.isArray(peptide.times) && peptide.times.length > 0
    ? peptide.times
    : [peptide.time || "08:00"];

  const perDay = Math.max(1, parseInt(peptide.perDay, 10) || times.length || 1);
  const resolvedTimes = times.slice(0, perDay);
  while (resolvedTimes.length < perDay) {
    resolvedTimes.push(resolvedTimes[resolvedTimes.length - 1] || "08:00");
  }

  return dates.map((d) => ({
    dateKey: dateToKey(d),
    date: d,
    times: resolvedTimes
  }));
}
