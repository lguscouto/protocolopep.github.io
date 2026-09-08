/**
 * Módulo de Interface e Prévia de Relatórios (V08)
 */

import { buildPersonalReport, generatePersonalReportCSV, generateReportHTML, getReportVialLabel, summarizeReportEntries } from "../domain/report.js";
import { exportFile, shareExportedFile, printReportHTML } from "../services/export.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";
import { i18nService } from "../services/i18n.js";
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
  const measurementsCheckbox = document.getElementById("report-opt-measurements");
  const previewList = document.getElementById("report-preview-list");
  const previewSummary = document.getElementById("report-preview-summary");
  const countEl = document.getElementById("report-entries-count");
  const csvBtn = document.getElementById("report-export-csv");
  const pdfBtn = document.getElementById("report-print-pdf");

  let currentReport = {
    entries: [],
    adherence: null,
    measurements: [],
    measurementCount: 0,
    measurementStats: null,
    startDate: null,
    endDate: null
  };

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
    const includeMeasurements = Boolean(measurementsCheckbox?.checked);
    const measurements = typeof storage.getMeasurements === "function" ? storage.getMeasurements() : [];

    currentReport = buildPersonalReport({
      protocol: storage.getPeptides(),
      logs: storage.getLogs(),
      measurements,
      startDate,
      endDate,
      includeNotes,
      includeMeasurements
    });
    const currentEntries = currentReport.entries;

    if (countEl) {
      const summary = summarizeReportEntries(currentEntries);
      const countParts = ["applied", "skipped", "missed"]
        .map((status) => `${summary[status]} ${i18nService.t(`phase1.${status}`)}`)
        .concat(summary.unknown ? [`${summary.unknown} com estado não identificado`] : []);
      if (includeMeasurements) countParts.push(`${currentReport.measurements.length} medições incluídas`);
      else if (currentReport.measurementCount > 0) countParts.push(`${currentReport.measurementCount} medições disponíveis`);
      countEl.textContent = countParts.join(" · ");
    }

    if (previewSummary) {
      const adherence = currentReport.adherence;
      const summaryItems = adherence ? [
        `<span><b>${esc(String(adherence.applicationPercent))}%</b> aplicações registradas</span>`,
        `<span><b>${esc(String(adherence.resolutionPercent))}%</b> rotina resolvida</span>`,
        `<span><b>${esc(String(adherence.pending))}</b> pendentes</span>`,
        `<span><b>${esc(String(adherence.completeDays))}</b> dias completos</span>`
      ] : [];
      if (includeMeasurements) {
        summaryItems.push(`<span><b>${esc(String(currentReport.measurements.length))}</b> medições incluídas</span>`);
      }
      previewSummary.innerHTML = summaryItems.length > 0
        ? `<div class="report-preview-summary-grid">${summaryItems.join("")}</div><div class="report-preview-summary-note">Resumo descritivo do período; não representa avaliação clínica.</div>`
        : "";
    }

    if (!previewList) return;

    if (currentEntries.length === 0) {
      previewList.innerHTML = includeMeasurements && currentReport.measurements.length > 0
        ? `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px;">Nenhuma aplicação encontrada. As medições selecionadas serão incluídas no relatório.</div>`
        : `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px;">Nenhum registro de aplicação encontrado no período selecionado.</div>`;
      return;
    }

    // Exibir as primeiras 15 entradas na prévia rápida
    const previewItems = currentEntries.slice(0, 15);
    let html = previewItems.map((e) => {
      const [y, m, d] = (e.date || "").split("-");
      const dateFmt = d && m ? `${d}/${m}` : e.date;
      const statusLabel = ["applied", "skipped", "missed"].includes(e.status)
        ? i18nService.t(`phase1.${e.status}`) : e.statusLabel;
      const vialLabel = getReportVialLabel(e);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border2);font-size:12px;">
          <div>
            <span style="font-weight:700;color:var(--text);">${esc(e.peptideName)}</span>
            <span style="color:var(--muted);font-size:11px;margin-left:4px;">${esc(e.dose)} (${esc(e.ui ?? "--")} UI)</span>
            ${e.historyIntegrity === "legacy" ? `<div style="font-size:11px;color:var(--muted);">${esc(i18nService.t("phase1.legacy"))}</div>` : ""}
            ${e.site || vialLabel ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${esc([e.site, vialLabel].filter(Boolean).join(" · "))}</div>` : ""}
            ${e.note ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px;">💬 ${esc(e.note)}</div>` : ""}
            ${e.statusReason ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px;">Motivo: ${esc(e.statusReason)}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600;color:var(--text);">${esc(dateFmt)} · ${esc(e.time)}</div>
            <span class="report-entry-type ${e.status !== "applied" || e.retroactive ? "report-entry-type--retroactive" : "report-entry-type--applied"}">${esc(statusLabel)} · ${esc(e.type)}</span>
          </div>
        </div>
      `;
    }).join("");

    if (currentEntries.length > 15) {
      html += `<div style="padding:8px;text-align:center;font-size:11px;color:var(--muted);">+ ${currentEntries.length - 15} outros registros incluídos no relatório final</div>`;
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
  if (measurementsCheckbox) measurementsCheckbox.addEventListener("change", updatePreview);

  const hasReportContent = () => currentReport.entries.length > 0
    || currentReport.measurements.length > 0
    || Boolean(currentReport.adherence && currentReport.adherence.due > 0);

  if (csvBtn) {
    csvBtn.addEventListener("click", async () => {
      if (!hasReportContent()) {
        void dialogService.alert({ title: "Sem dados", message: "Nenhum dado encontrado para exportação no período selecionado." });
        return;
      }
      const csv = generatePersonalReportCSV(currentReport);
      const filename = `protocolo-pep-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;

      try {
        const result = await exportFile({
          fileName: filename,
          content: csv,
          mimeType: "text/csv;charset=utf-8;",
          subDir: "ProtocoloPEP"
        });

        if (result.aborted) return;
        if (!result.success) throw new Error(result.error || "Falha ao exportar");

        haptics.success();
        const userWantsShare = await dialogService.confirm({
          title: "Relatório Exportado ✓",
          message: `Arquivo salvo com sucesso em:\n📁 ${result.path}\n\nDeseja compartilhar este relatório CSV?`,
          confirmText: "Compartilhar",
          cancelText: "OK",
          isDanger: false
        });

        if (userWantsShare) {
          await shareExportedFile({
            fileName: filename,
            content: csv,
            mimeType: "text/csv",
            title: "Relatório Protocolo PEP"
          });
        }
      } catch (err) {
        haptics.warning();
        void dialogService.alert({
          title: "Erro na Exportação",
          message: "Não foi possível salvar o relatório: " + (err.message || err),
          isDanger: true
        });
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      if (!hasReportContent()) {
        void dialogService.alert({ title: "Sem dados", message: "Nenhum dado encontrado para impressão no período selecionado." });
        return;
      }
      const html = generateReportHTML(currentReport.entries, {
        startDate: currentReport.startDate,
        endDate: currentReport.endDate,
        adherenceSummary: currentReport.adherence,
        measurements: currentReport.measurements,
        includeMeasurements: Boolean(measurementsCheckbox?.checked),
        measurementStats: currentReport.measurementStats
      });
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
