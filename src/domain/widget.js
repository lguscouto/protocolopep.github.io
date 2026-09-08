/**
 * Motor Puro de Resumo para o Widget Nativo Android (V14)
 *
 * Princípios de Governança (AGENTS.md):
 * - Função pura e determinística.
 * - Modo Discreto: Proteção de privacidade por padrão ou configuração, ocultando nomes clínicos de peptídeos.
 * - Sem dependência do DOM ou APIs de rede.
 */

import { getScheduledPeptides, dateToKey, keyToDate } from "./schedule.js";
import { summarizeDoseEntries } from "./dose-state.js";

export function calculateWidgetSummary({
  peptides = [],
  logs = {},
  targetDate = new Date(),
  discreteMode = false
} = {}) {
  const dateObj = typeof targetDate === "string" ? keyToDate(targetDate) : new Date(targetDate);
  const tKey = dateToKey(dateObj);
  const dayLogs = (logs && typeof logs === "object" && logs[tKey]) ? logs[tKey] : {};

  const scheduled = getScheduledPeptides(peptides, dateObj);
  let totalCount = 0;
  let takenCount = 0;
  let resolvedCount = 0;
  let skippedCount = 0;
  let missedCount = 0;
  const pendingSlots = [];

  scheduled.forEach((p) => {
    const due = Math.max(1, parseInt(p.perDay, 10) || (Array.isArray(p.times) ? p.times.length : 1));
    totalCount += due;

    const counts = summarizeDoseEntries(dayLogs[p.id], due);
    const recorded = counts.resolved;
    const takenForPeptide = Math.min(due, counts.applied);
    takenCount += takenForPeptide;
    resolvedCount += Math.min(due, counts.resolved);
    skippedCount += counts.skipped;
    missedCount += counts.missed;

    if (recorded < due) {
      let times = Array.isArray(p.times) && p.times.length > 0
        ? [...p.times].filter((t) => typeof t === "string" && t.trim()).sort()
        : (p.time ? [p.time] : ["08:00"]);

      while (times.length < due) {
        times.push(times[times.length - 1] || "08:00");
      }

      const nextSlotTime = times[recorded] || times[0] || "08:00";
      pendingSlots.push({
        peptide: p,
        time: nextSlotTime,
        slotIndex: recorded
      });
    }
  });

  const progressPct = totalCount > 0 ? Math.min(100, Math.round((takenCount / totalCount) * 100)) : 0;

  if (totalCount === 0) {
    return {
      totalCount: 0,
      takenCount: 0,
      resolvedCount: 0,
      skippedCount: 0,
      missedCount: 0,
      pendingCount: 0,
      progressPct: 0,
      nextDoseTime: "--",
      nextDosePeptide: "Nenhum protocolo hoje",
      statusText: "Nenhum protocolo para hoje",
      subText: "Abra o app para configurar",
      discreteMode: Boolean(discreteMode)
    };
  }

  if (resolvedCount >= totalCount) {
    const allApplied = takenCount === totalCount;
    return {
      totalCount,
      takenCount,
      resolvedCount,
      skippedCount,
      missedCount,
      pendingCount: 0,
      progressPct,
      nextDoseTime: allApplied ? "100%" : "--",
      nextDosePeptide: allApplied ? "Tudo concluído hoje! 🎉" : "Sem ocorrências pendentes hoje",
      statusText: allApplied ? "Tudo concluído hoje! 🎉" : "Sem ocorrências pendentes hoje",
      subText: allApplied ? `Todas as ${totalCount} doses registradas` : `Aplicadas: ${takenCount} · Puladas: ${skippedCount} · Esquecidas: ${missedCount}`,
      discreteMode: Boolean(discreteMode)
    };
  }

  pendingSlots.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const nextSlot = pendingSlots[0];
  const nextP = nextSlot ? nextSlot.peptide : null;
  const rawTime = nextSlot ? String(nextSlot.time).trim() : "";
  const nextDoseTime = rawTime || "Pendente";
  const peptideLabel = discreteMode ? "Aplicação Agendada" : (nextP && nextP.name ? nextP.name : "Aplicação");
  const nextDosePeptide = peptideLabel;

  const statusText = rawTime ? `${peptideLabel} · ${rawTime}` : peptideLabel;
  const subText = `${takenCount} de ${totalCount} doses aplicadas (${progressPct}%)`
    + (skippedCount ? ` · Puladas: ${skippedCount}` : "")
    + (missedCount ? ` · Esquecidas: ${missedCount}` : "");

  return {
    totalCount,
    takenCount,
    resolvedCount,
    skippedCount,
    missedCount,
    pendingCount: totalCount - resolvedCount,
    progressPct,
    nextDoseTime,
    nextDosePeptide,
    statusText,
    subText,
    discreteMode: Boolean(discreteMode)
  };
}
