/**
 * Motor Puro de Resumo para o Widget Nativo Android (V14)
 *
 * Princípios de Governança (AGENTS.md):
 * - Função pura e determinística.
 * - Modo Discreto: Proteção de privacidade por padrão ou configuração, ocultando nomes clínicos de peptídeos.
 * - Sem dependência do DOM ou APIs de rede.
 */

import { getScheduledPeptides, dateToKey, keyToDate } from "./schedule.js";

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
  const pendingSlots = [];

  scheduled.forEach((p) => {
    const due = Math.max(1, parseInt(p.perDay, 10) || (Array.isArray(p.times) ? p.times.length : 1));
    totalCount += due;

    const val = dayLogs[p.id];
    let recorded = 0;
    if (Array.isArray(val)) {
      recorded = val.length;
    } else if (val && typeof val === "object") {
      recorded = 1;
    }
    const takenForPeptide = Math.min(due, recorded);
    takenCount += takenForPeptide;

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
      progressPct: 0,
      nextDoseTime: "--",
      nextDosePeptide: "Nenhum protocolo hoje",
      statusText: "Nenhum protocolo para hoje",
      subText: "Abra o app para configurar",
      discreteMode: Boolean(discreteMode)
    };
  }

  if (takenCount >= totalCount) {
    return {
      totalCount,
      takenCount,
      progressPct: 100,
      nextDoseTime: "100%",
      nextDosePeptide: "Tudo concluído hoje! 🎉",
      statusText: "Tudo concluído hoje! 🎉",
      subText: `Todas as ${totalCount} doses registradas`,
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
  const subText = `${takenCount} de ${totalCount} doses tomadas (${progressPct}%)`;

  return {
    totalCount,
    takenCount,
    progressPct,
    nextDoseTime,
    nextDosePeptide,
    statusText,
    subText,
    discreteMode: Boolean(discreteMode)
  };
}
