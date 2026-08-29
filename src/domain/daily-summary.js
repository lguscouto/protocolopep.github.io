/**
 * Domínio Puro de Resumo Diário e Compartilhamento Seguro (V04)
 */

import { dateToKey, calculateDayProgress, getScheduledPeptides } from "./schedule.js";

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

  const tKey = dateToKey(targetDate);
  const [y, m, d] = tKey.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  const progress = calculateDayProgress(peptides, logs, targetDate);
  const scheduled = getScheduledPeptides(peptides, targetDate);
  const dayLogs = logs && logs[tKey] ? logs[tKey] : {};

  let summary = `🧪 Protocolo PEP — Resumo Diário (${dateFormatted})\n`;
  summary += `Progresso: ${progress.totalTaken} de ${progress.totalDue} doses registradas (${progress.percentage}%)\n\n`;

  if (scheduled.length === 0) {
    summary += `Nenhuma dose agendada para este dia.\n`;
  } else {
    scheduled.forEach((p, idx) => {
      const pLogs = dayLogs[p.id];
      let takenCount = 0;
      if (Array.isArray(pLogs)) {
        takenCount = pLogs.length;
      } else if (pLogs && typeof pLogs === "object") {
        takenCount = 1;
      }

      const due = Math.max(1, parseInt(p.perDay, 10) || 1);
      const isDone = takenCount >= due;
      const statusIcon = isDone ? "✓" : "○";
      const statusText = isDone ? "Concluído" : `${takenCount}/${due}`;

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
