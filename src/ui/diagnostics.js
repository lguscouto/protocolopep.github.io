/**
 * Módulo de Interface para Diagnósticos Técnicos Locais (V09)
 */

import { generateDiagnosticReport } from "../services/diagnostics.js";
import { downloadBlob } from "../services/export.js";
import { haptics } from "../services/haptics.js";

export function setupDiagnosticsModal({ storage, getNotificationsActive, appVersion = "2.0.0" }) {
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
        preEl.textContent = `Erro ao gerar diagnóstico: ${err.message}`;
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
        alert("Diagnóstico técnico copiado para a área de transferência!");
        haptics.success();
      } catch {
        alert("Não foi possível copiar automaticamente.");
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (!currentReport) return;
      const jsonStr = JSON.stringify(currentReport, null, 2);
      const filename = `protocolo-pep-diag-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(jsonStr, filename, "application/json;charset=utf-8;");
      haptics.success();
    });
  }
}
