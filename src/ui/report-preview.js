/**
 * Módulo de Interface e Prévia de Relatórios (V08)
 */

import { buildReportData, generateReportCSV, generateReportHTML } from "../domain/report.js";
import { downloadBlob, printReportHTML } from "../services/export.js";
import { haptics } from "../services/haptics.js";
import { escapeHtml } from "./dom.js";

const esc = escapeHtml;

export function setupReportModal(storage) {
  const modal = document.getElementById("report-modal");
  const openBtns = document.querySelectorAll("#hist-report-btn, #settings-report-btn");
  const closeBtn = document.getElementById("report-close");
  const periodSelect = document.getElementById("report-period-select");
  const customDateWrap = document.getElementById("report-custom-dates");
  const startDateInput = document.getElementById("report-start-date");
  const endDateInput = document.getElementById("report-end-date");
  const notesCheckbox = document.getElementById("report-opt-notes");
  const previewList = document.getElementById("report-preview-list");
  const countEl = document.getElementById("report-entries-count");
  const csvBtn = document.getElementById("report-export-csv");
  const pdfBtn = document.getElementById("report-print-pdf");

  let currentEntries = [];

  const getDateRange = () => {
    const period = periodSelect?.value || "30";
    const now = new Date();
    const toDateStr = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (period === "all") {
      return { startDate: null, endDate: null };
    }

    if (period === "custom") {
      return {
        startDate: startDateInput?.value || null,
        endDate: endDateInput?.value || null
      };
    }

    const days = parseInt(period, 10) || 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);

    return {
      startDate: toDateStr(start),
      endDate: toDateStr(now)
    };
  };

  const updatePreview = () => {
    const { startDate, endDate } = getDateRange();
    const includeNotes = Boolean(notesCheckbox?.checked);

    currentEntries = buildReportData({
      protocol: storage.getPeptides(),
      logs: storage.getLogs(),
      startDate,
      endDate,
      includeNotes
    });

    if (countEl) {
      countEl.textContent = `${currentEntries.length} ${currentEntries.length === 1 ? "aplicação" : "aplicações"}`;
    }

    if (!previewList) return;

    if (currentEntries.length === 0) {
      previewList.innerHTML = `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px;">Nenhuma aplicação encontrada no período selecionado.</div>`;
      return;
    }

    // Exibir as primeiras 15 entradas na prévia rápida
    const previewItems = currentEntries.slice(0, 15);
    let html = previewItems.map((e) => {
      const [y, m, d] = (e.date || "").split("-");
      const dateFmt = d && m ? `${d}/${m}` : e.date;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border2);font-size:12px;">
          <div>
            <span style="font-weight:700;color:var(--text);">${esc(e.peptideName)}</span>
            <span style="color:var(--muted);font-size:11px;margin-left:4px;">${esc(e.dose)}</span>
            ${e.note ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px;">💬 ${esc(e.note)}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600;color:var(--text);">${esc(dateFmt)} · ${esc(e.time)}</div>
            <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:${e.retroactive ? "rgba(245,158,11,0.15);color:var(--warning)" : "rgba(44,197,192,0.15);color:var(--primary)"}">${esc(e.type)}</span>
          </div>
        </div>
      `;
    }).join("");

    if (currentEntries.length > 15) {
      html += `<div style="padding:8px;text-align:center;font-size:11px;color:var(--muted);">+ ${currentEntries.length - 15} outras aplicações incluídas no relatório final</div>`;
    }

    previewList.innerHTML = html;
  };

  openBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptics.light();
      updatePreview();
      if (modal) modal.classList.add("on");
    });
  });

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      if (customDateWrap) {
        customDateWrap.style.display = periodSelect.value === "custom" ? "grid" : "none";
      }
      updatePreview();
    });
  }

  if (startDateInput) startDateInput.addEventListener("change", updatePreview);
  if (endDateInput) endDateInput.addEventListener("change", updatePreview);
  if (notesCheckbox) notesCheckbox.addEventListener("change", updatePreview);

  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      if (currentEntries.length === 0) {
        alert("Nenhum dado encontrado para exportação no período selecionado.");
        return;
      }
      const csv = generateReportCSV(currentEntries);
      const filename = `protocolo-pep-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadBlob(csv, filename, "text/csv;charset=utf-8;");
      haptics.success();
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      if (currentEntries.length === 0) {
        alert("Nenhum dado encontrado para impressão no período selecionado.");
        return;
      }
      const { startDate, endDate } = getDateRange();
      const html = generateReportHTML(currentEntries, { startDate, endDate });
      printReportHTML(html);
      haptics.medium();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.classList.remove("on");
    });
  }
}
