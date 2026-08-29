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
  const totalCount = scheduled.length;

  let takenCount = 0;
  const pendingPeptides = [];

  scheduled.forEach((p) => {
    const isTaken = Boolean(dayLogs[p.id]);
    if (isTaken) {
      takenCount++;
    } else {
      pendingPeptides.push(p);
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

  const nextP = pendingPeptides[0];
  const rawTime = (nextP && nextP.time) ? String(nextP.time).trim() : "";
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
