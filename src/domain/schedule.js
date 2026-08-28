/**
 * Motor Puro de Agendamento e Ocorrências de Doses
 */

export function dateToKey(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export function keyToDate(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return new Date();
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function daysBetween(aKey, bDate) {
  if (!aKey || !bDate) return 0;
  const a = keyToDate(typeof aKey === "string" ? aKey : dateToKey(aKey));
  const b = new Date(bDate);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
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
  scheduled.forEach((p) => {
    totalDue += Math.max(1, parseInt(p.perDay, 10) || 1);
  });

  let totalTaken = 0;
  Object.entries(dayLogs).forEach(([pepId, val]) => {
    if (Array.isArray(val)) {
      totalTaken += val.length;
    } else if (val && typeof val === "object") {
      totalTaken += 1;
    }
  });

  const percentage = totalDue > 0 ? Math.min(100, Math.round((totalTaken / totalDue) * 100)) : (totalTaken > 0 ? 100 : 0);

  return {
    dateKey: tKey,
    totalScheduled: scheduled.length,
    totalDue,
    totalTaken,
    percentage,
    isComplete: totalDue > 0 && totalTaken >= totalDue
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
