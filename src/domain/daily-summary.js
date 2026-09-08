/**
 * Domínio Puro de Resumo Diário e Compartilhamento Seguro (V04)
 */

import { dateToKey, isValidDateKey, calculateDayProgress, getScheduledPeptides } from "./schedule.js";
import { summarizeDoseEntries } from "./dose-state.js";

export function generateDailySummary(
  peptides = [],
  logs = {},
  targetDate = new Date(),
  options = {}
) {
  const {
    includeDoses = true,
    includeNames = true,
    includeDisclaimer = true
  } = options;

  const tKey = typeof targetDate === "string" && isValidDateKey(targetDate) ? targetDate : dateToKey(targetDate);
  const [y, m, d] = tKey.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  const progress = calculateDayProgress(peptides, logs, targetDate);
  const scheduled = getScheduledPeptides(peptides, targetDate);
  const dayLogs = logs && logs[tKey] ? logs[tKey] : {};

  let summary = `🧪 Protocolo PEP — Resumo Diário (${dateFormatted})\n`;
  const dueLabel = progress.totalDue === 1 ? "dose prevista" : "doses previstas";
  const appliedLabel = progress.totalDue === 1 ? "aplicada" : "aplicadas";
  let progLine = `Aplicações: ${progress.scheduledTaken} de ${progress.totalDue} ${dueLabel} ${appliedLabel} (${progress.percentage}%)`;
  if (progress.extraTaken > 0) {
    const extraLabel = progress.extraTaken === 1 ? "registro extra" : "registros extras";
    progLine += ` (+ ${progress.extraTaken} ${extraLabel})`;
  }
  summary += `${progLine}\nPuladas: ${progress.skippedCount} · Esquecidas registradas: ${progress.missedCount} · Pendentes: ${progress.pendingCount}\n\n`;

  if (scheduled.length === 0) {
    summary += `Nenhuma dose agendada para este dia.\n`;
  } else {
    scheduled.forEach((p, idx) => {
      const due = Math.max(1, parseInt(p.perDay, 10) || 1);
      const counts = summarizeDoseEntries(dayLogs[p.id], due);
      const isDone = counts.pending === 0;
      const statusIcon = isDone ? "✓" : "○";
      const parts = [`Aplicadas: ${Math.min(due, counts.applied)}/${due}`];
      if (counts.applied > due) parts.push(`${counts.applied - due} extras`);
      if (counts.skipped) parts.push(`Puladas: ${counts.skipped}`);
      if (counts.missed) parts.push(`Esquecidas registradas: ${counts.missed}`);
      parts.push(`Pendentes: ${counts.pending}`);
      const statusText = parts.join(" · ");

      const nameLabel = includeNames ? (p.name || `Peptídeo ${idx + 1}`) : `Item ${idx + 1}`;
      let doseInfo = "";
      if (includeDoses && (p.dose || p.ui)) {
        const parts = [];
        if (p.dose) parts.push(p.dose);
        if (p.ui) parts.push(`${p.ui} UI`);
        doseInfo = ` [${parts.join(" · ")}]`;
      }

      summary += `${statusIcon} ${nameLabel}${doseInfo} — ${statusText}\n`;
    });
  }

  if (includeDisclaimer) {
    summary += `\n⚠️ Registro pessoal autorrelatado; uso informativo, não clínico.`;
  }
  summary += `\nGerado localmente no app Protocolo PEP.`;

  return summary;
}
