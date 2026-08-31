/**
 * Módulo de Geração e Estruturação de Relatórios de Doses (V08)
 */

export function buildReportData({
  protocol = [],
  logs = {},
  startDate = null,
  endDate = null,
  includeNotes = false
}) {
  const pepMap = {};
  if (Array.isArray(protocol)) {
    protocol.forEach((p) => {
      if (p && p.id) {
        pepMap[p.id] = p;
      }
    });
  }

  const entries = [];

  Object.entries(logs || {}).forEach(([dateStr, pepLogs]) => {
    if (startDate && dateStr < startDate) return;
    if (endDate && dateStr > endDate) return;

    Object.entries(pepLogs || {}).forEach(([pepId, val]) => {
      const pInfo = pepMap[pepId] || { name: pepId, sub: "", dose: "", ui: 0 };
      const rawList = Array.isArray(val) ? val : (val ? [val] : []);

      rawList.forEach((entry) => {
        let time = "";
        let dose = pInfo.dose || "";
        let ui = pInfo.ui || 0;
        let retroactive = false;
        let note = "";

        if (typeof entry === "string") {
          time = entry;
        } else if (entry && typeof entry === "object") {
          time = entry.time || "";
          if (entry.dose) dose = entry.dose;
          if (entry.ui !== undefined && entry.ui !== null) ui = entry.ui;
          if (entry.retroactive) retroactive = true;
          if (entry.note) note = entry.note;
        }

        entries.push({
          date: dateStr,
          time: time || "--:--",
          peptideId: pepId,
          peptideName: pInfo.name || pepId,
          peptideSub: pInfo.sub || "",
          dose: dose || "--",
          ui: Number(ui) || 0,
          retroactive: Boolean(retroactive),
          type: retroactive ? "Retroativo" : "Regular",
          note: includeNotes ? (note || "") : ""
        });
      });
    });
  });

  // Ordenar cronologicamente decrescente (mais recente primeiro)
  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time || "").localeCompare(a.time || "");
  });

  return entries;
}

export function escapeHTML(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Formula Injection prevention: se iniciar por =, +, -, @ ou \t, prefixa com '
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateReportCSV(entries = []) {
  // UTF-8 BOM para compatibilidade com Microsoft Excel e planilhas em PT-BR
  const BOM = "\uFEFF";
  const headers = ["Data", "Hora", "Peptídeo", "Subtítulo", "Dose", "UI", "Tipo", "Observações"];
  const headerLine = headers.map(escapeCSV).join(";");

  const lines = entries.map((e) => {
    const [y, m, d] = (e.date || "").split("-");
    const formattedDate = d && m && y ? `${d}/${m}/${y}` : e.date;
    return [
      formattedDate,
      e.time,
      e.peptideName,
      e.peptideSub,
      e.dose,
      e.ui,
      e.type,
      e.note
    ].map(escapeCSV).join(";");
  });

  return BOM + [headerLine, ...lines].join("\r\n");
}

export function generateReportHTML(entries = [], { startDate, endDate, generatedAt = new Date() } = {}) {
  const dStr = escapeHTML(generatedAt.toLocaleDateString("pt-BR"));
  const tStr = escapeHTML(generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  
  let periodText = "Todo o Histórico";
  if (startDate && endDate) {
    periodText = `${startDate.split("-").reverse().join("/")} até ${endDate.split("-").reverse().join("/")}`;
  } else if (startDate) {
    periodText = `A partir de ${startDate.split("-").reverse().join("/")}`;
  } else if (endDate) {
    periodText = `Até ${endDate.split("-").reverse().join("/")}`;
  }
  const safePeriodText = escapeHTML(periodText);

  const rows = entries.map((e) => {
    const [y, m, d] = (e.date || "").split("-");
    const dateFmt = d && m && y ? `${d}/${m}/${y}` : e.date;
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:600;">${escapeHTML(dateFmt)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">${escapeHTML(e.time)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:700;">${escapeHTML(e.peptideName)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">${escapeHTML(e.dose)} (${Number(e.ui) || 0} UI)</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:${e.retroactive ? "#FEF3C7;color:#92400E" : "#E6FFFA;color:#047857"}">${escapeHTML(e.type)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;">${escapeHTML(e.note || "--")}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Protocolo PEP — Relatório de Aplicações</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #0F172A; background: #FFF; font-size: 13px; line-height: 1.5; }
    .header { border-bottom: 2px solid #0E8580; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 800; color: #0E8580; margin: 0; }
    .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .stats { display: flex; gap: 16px; margin-bottom: 16px; background: #F8FAFC; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2E8F0; }
    .stats-item { font-size: 12px; }
    .stats-item b { color: #0E8580; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px; }
    th { background: #F1F5F9; padding: 8px 10px; border-bottom: 2px solid #CBD5E1; font-weight: 700; font-size: 12px; color: #475569; }
    .disclaimer { font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; margin-top: 20px; line-height: 1.4; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Protocolo PEP — Relatório de Aplicações</h1>
      <div class="meta">Período: <b>${safePeriodText}</b> · Emitido em: <b>${dStr} às ${tStr}</b></div>
    </div>
  </div>

  <div class="stats">
    <div class="stats-item">Total de Aplicações: <b>${entries.length}</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Hora</th>
        <th>Peptídeo</th>
        <th>Dose</th>
        <th>Tipo</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748B;">Nenhum registro de aplicação encontrado para o período selecionado.</td></tr>'}
    </tbody>
  </table>

  <div class="disclaimer">
    ⚠️ <b>Registro Pessoal Autorrelatado:</b> Este documento é um registro individual gerado localmente pelo usuário do aplicativo Protocolo PEP. Não substitui prontuário médico, receita nem avaliação clínica.
  </div>
</body>
</html>`;
}
