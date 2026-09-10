/**
 * Módulo de Interface e Prévia de Relatórios (V08)
 */

import { buildPersonalReport, generateReportCSV, generateMeasurementsCSV, generateReportHTML, getReportVialLabel, summarizeReportEntries } from "../domain/report.js";
import { exportFile, shareExportedFile, saveReportPdf, shareSavedFile } from "../services/export.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";
import { i18nService } from "../services/i18n.js";
import { escapeHtml } from "./dom.js";

const esc = escapeHtml;

export function setupReportModal(storage) {
  const modal = document.getElementById("report-modal");
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
  const measurementsCsvBtn = document.getElementById("report-export-measurements-csv");
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
    const includeMeasurements = true;
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

    const previewEvents = Array.isArray(currentReport.events) ? currentReport.events : [];
    if (previewEvents.length === 0) {
      previewList.innerHTML = `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px;">${esc(i18nService.t("modals.report.noEventsInPeriod"))}</div>`;
      return;
    }

    // Exibir os primeiros 15 eventos do mesmo modelo usado nas saídas
    const previewItems = previewEvents.slice(0, 15);
    let html = previewItems.map((e) => {
      const [y, m, d] = (e.date || "").split("-");
      const dateFmt = d && m ? `${d}/${m}` : e.date;
      const statusLabel = e.type === "application" ? i18nService.t(`phase1.${e.data.status}`) : e.type === "protocol" ? `Protocolo ${e.data.statusLabel.toLocaleLowerCase("pt-BR")}` : e.type === "symptom" ? "Sintoma" : "Medida";
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border2);font-size:12px;">
          <div>
            <span style="font-weight:700;color:var(--text);">${esc(e.title)}</span>
            <span style="color:var(--muted);font-size:11px;margin-left:4px;">${esc(e.subtitle)}</span>
            ${e.notes ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px;">💬 ${esc(e.notes)}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600;color:var(--text);">${esc(dateFmt)} · ${esc(e.time)}</div>
            <span class="report-entry-type ${e.type === "application" && e.data.status === "applied" ? "report-entry-type--applied" : "report-entry-type--retroactive"}">${esc(statusLabel)} · ${esc(e.type)}</span>
          </div>
        </div>
      `;
    }).join("");

    if (previewEvents.length > 15) {
      html += `<div style="padding:8px;text-align:center;font-size:11px;color:var(--muted);">${esc(i18nService.t("modals.report.otherEventsIncluded", { count: previewEvents.length - 15 }))}</div>`;
    }

    previewList.innerHTML = html;
  };

  if (document.documentElement.dataset.reportOpenBound !== "true") {
    document.documentElement.dataset.reportOpenBound = "true";
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#hist-report-btn, #settings-report-btn, #dash-report-btn")) return;
      haptics.light();
      updatePreview();
      if (modal) modal.classList.add("on");
    });
  }

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

  if (csvBtn) {
    csvBtn.addEventListener("click", async () => {
      const csv = generateReportCSV(currentReport.entries);
      const filename = `protocolo-pep-aplicacoes-${new Date().toISOString().slice(0, 10)}.csv`;

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
          title: "CSV de aplicações salvo",
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

  if (measurementsCsvBtn) {
    measurementsCsvBtn.addEventListener("click", async () => {
      const csv = generateMeasurementsCSV(currentReport.measurements);
      const filename = `protocolo-pep-medidas-${new Date().toISOString().slice(0, 10)}.csv`;
      try {
        const result = await exportFile({ fileName: filename, content: csv, mimeType: "text/csv;charset=utf-8;", subDir: "ProtocoloPEP" });
        if (result.aborted) return;
        if (!result.success) throw new Error(result.error || "Falha ao exportar");
        haptics.success();
        const share = await dialogService.confirm({
          title: i18nService.t("modals.report.csvMeasSavedTitle"),
          message: i18nService.t("modals.report.csvMeasSavedMsg", { path: result.path }),
          confirmText: i18nService.t("modals.share.actionShare"),
          cancelText: i18nService.t("common.ok")
        });
        if (share) {
          const shared = await shareExportedFile({ fileName: filename, content: csv, mimeType: "text/csv", title: "Medidas Protocolo PEP" });
          if (!shared.success && !shared.aborted) void dialogService.alert({ title: "Compartilhamento indisponível", message: shared.error, isDanger: true });
        }
      } catch (error) {
        void dialogService.alert({
          title: i18nService.t("modals.report.exportErrorTitle"),
          message: i18nService.t("modals.report.exportErrorMsg", { error: error.message || "" }),
          isDanger: true
        });
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      const html = generateReportHTML(currentReport.entries, {
        startDate: currentReport.startDate,
        endDate: currentReport.endDate,
        adherenceSummary: currentReport.adherence,
        measurements: currentReport.measurements,
        includeMeasurements: true,
        measurementStats: currentReport.measurementStats,
        revisions: currentReport.revisions
      });
      const fileName = `protocolo-pep-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
      const result = await saveReportPdf({ fileName, html });
      if (result.aborted) return;
      if (!result.success) {
        void dialogService.alert({
          title: i18nService.t("modals.report.pdfErrorTitle"),
          message: result.error || i18nService.t("modals.report.exportErrorMsg", { error: "" }),
          isDanger: true
        });
        return;
      }
      haptics.success();
      if (result.printDialog) return;
      const share = await dialogService.confirm({
        title: i18nService.t("modals.report.pdfSavedTitle"),
        message: i18nService.t("modals.report.pdfSavedMsg", { path: result.path }),
        confirmText: i18nService.t("modals.share.actionShare"),
        cancelText: i18nService.t("common.ok")
      });
      if (share) {
        const shared = await shareSavedFile({ uri: result.uri, title: "Relatório Protocolo PEP" });
        if (!shared.success && !shared.aborted) void dialogService.alert({ title: "Compartilhamento indisponível", message: shared.error, isDanger: true });
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.classList.remove("on");
    });
  }
}
