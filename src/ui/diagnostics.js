/**
 * Módulo de Interface para Diagnósticos Técnicos Locais (V09)
 */

import { generateDiagnosticReport } from "../services/diagnostics.js";
import { exportFile, shareExportedFile } from "../services/export.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";
import { i18nService } from "../services/i18n.js";

export function setupDiagnosticsModal({ storage, getNotificationsActive, appVersion = "3.9.10" }) {
  const modal = document.getElementById("diag-modal");
  const openBtn = document.getElementById("open-diag-btn");
  const closeBtn = document.getElementById("diag-close");
  const preEl = document.getElementById("diag-json-preview");
  const copyBtn = document.getElementById("diag-copy-btn");
  const exportBtn = document.getElementById("diag-export-btn");

  let currentReport = null;

  const renderDiagnostic = () => {
    try {
      const active = typeof getNotificationsActive === "function" ? getNotificationsActive() : false;
      currentReport = generateDiagnosticReport({
        storage,
        appVersion,
        notificationsActive: active
      });

      if (preEl) {
        preEl.textContent = JSON.stringify(currentReport, null, 2);
      }
    } catch (err) {
      if (preEl) {
        preEl.textContent = (i18nService.t("modals.diagnostics.generateError") || "Erro ao gerar diagnóstico: {error}").replace("{error}", err.message);
      }
    }
  };

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      haptics.light();
      renderDiagnostic();
      if (modal) modal.classList.add("on");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.classList.remove("on");
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!currentReport) return;
      try {
        const text = JSON.stringify(currentReport, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        void dialogService.alert({ title: i18nService.t("dialogs.diagCopiedTitle"), message: i18nService.t("dialogs.diagCopiedMsg") });
        haptics.success();
      } catch {
        void dialogService.alert({ title: i18nService.t("dialogs.copyFailTitle"), message: i18nService.t("dialogs.copyFailMsg"), isDanger: true });
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      if (!currentReport) return;
      const jsonStr = JSON.stringify(currentReport, null, 2);
      const filename = `protocolo-pep-diag-${new Date().toISOString().slice(0, 10)}.json`;

      try {
        const result = await exportFile({
          fileName: filename,
          content: jsonStr,
          mimeType: "application/json",
          subDir: "ProtocoloPEP"
        });

        if (result.aborted) return;
        if (!result.success) throw new Error(result.error || "Falha ao exportar");

        haptics.success();
        const userWantsShare = await dialogService.confirm({
          title: i18nService.t("dialogs.diagExportTitle"),
          message: i18nService.t("dialogs.diagExportMsg", { path: result.path }),
          confirmText: i18nService.t("modals.share.actionShare"),
          cancelText: i18nService.t("common.ok"),
          isDanger: false
        });

        if (userWantsShare) {
          await shareExportedFile({
            fileName: filename,
            content: jsonStr,
            mimeType: "application/json",
            title: "Diagnóstico Protocolo PEP"
          });
        }
      } catch (err) {
        haptics.warning();
        void dialogService.alert({
          title: i18nService.t("modals.report.exportErrorTitle"),
          message: i18nService.t("modals.report.exportErrorMsg", { error: err.message || err }),
          isDanger: true
        });
      }
    });
  }
}
