/**
 * Módulo de Prévia e Importação Segura de Backup (V06)
 */

import { validateAndParseBackup, MAX_BACKUP_SIZE_BYTES } from "../domain/backup.js";
import { recordBackupRestore, renderBackupStatusUI } from "./backup-status.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";
import { escapeHtml } from "./dom.js";
import { exportFile } from "../services/export.js";
import { i18nService } from "../services/i18n.js";

const esc = escapeHtml;

export function setupBackupPreview({
  storage,
  theme,
  notifications,
  onStateRestored
}) {
  const importFile = document.getElementById("import-file");
  const importBtns = document.querySelectorAll("#import-btn, #dash-import-btn");
  const modal = document.getElementById("backup-preview-modal");
  const closeBtn = document.getElementById("backup-preview-close");
  const cancelBtn = document.getElementById("backup-preview-cancel");
  const confirmBtn = document.getElementById("backup-preview-confirm");
  const contentEl = document.getElementById("backup-preview-content");

  let pendingBackupString = null;
  let pendingStats = null;

  importBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptics.light();
      if (importFile) {
        importFile.value = "";
        importFile.click();
      }
    });
  });

  if (importFile) {
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > MAX_BACKUP_SIZE_BYTES) {
        haptics.warning();
        void dialogService.alert({
          title: i18nService.t("modals.backup.fileTooLargeTitle"),
          message: i18nService.t("modals.backup.fileTooLargeMsg", { size: (file.size / (1024 * 1024)).toFixed(1) }),
          isDanger: true
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const rawContent = reader.result;
        pendingBackupString = rawContent;

        const validation = validateAndParseBackup(rawContent);

        if (!validation.valid) {
          pendingStats = null;
          if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.5";
          }
          if (contentEl) {
            contentEl.innerHTML = `
              <div class="backup-preview-error">
                <div class="backup-preview-error-title">${esc(i18nService.t("modals.backup.corruptTitle"))}</div>
                <div class="backup-preview-error-message">${esc(validation.error)}</div>
              </div>
              <div class="backup-preview-note">
                ${esc(i18nService.t("modals.backup.invalidFileNote"))}
              </div>
            `;
          }
        } else {
          pendingStats = validation.stats;
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = "1";
          }

          const expDate = validation.stats.exportedAt ? new Date(validation.stats.exportedAt).toLocaleString(i18nService.getLocale()) : i18nService.t("modals.backup.dateUnknown");
          const fileSizeKb = (file.size / 1024).toFixed(1);

          if (contentEl) {
            contentEl.innerHTML = `
              <div class="backup-preview-section">
                <div class="backup-preview-section-title">${esc(i18nService.t("modals.backup.fileMetadata"))}</div>
                <div class="backup-preview-metadata">
                  <div><span class="backup-preview-label">${esc(i18nService.t("modals.backup.fileName"))}:</span> <b class="backup-preview-filename">${esc(file.name)}</b></div>
                  <div><span class="backup-preview-label">${esc(i18nService.t("modals.backup.fileSize"))}:</span> <b>${fileSizeKb} KB</b></div>
                  <div class="backup-preview-metadata-wide"><span class="backup-preview-label">${esc(i18nService.t("modals.backup.exportedAt"))}:</span> <b>${esc(expDate)}</b></div>
                </div>
              </div>

              <div class="backup-preview-section">
                <div class="backup-preview-section-title">${esc(i18nService.t("modals.backup.contentHeading"))}</div>
                <div class="backup-preview-stats">
                  <div class="backup-preview-stat">
                    <div class="backup-preview-stat-value">${validation.stats.peptideCount}</div>
                    <div class="backup-preview-stat-label">${esc(i18nService.t("modals.backup.peptidesCountShort"))}</div>
                  </div>
                  <div class="backup-preview-stat">
                    <div class="backup-preview-stat-value">${validation.stats.logDaysCount}</div>
                    <div class="backup-preview-stat-label">${esc(i18nService.t("modals.backup.daysRecorded"))}</div>
                  </div>
                  <div class="backup-preview-stat">
                    <div class="backup-preview-stat-value">${validation.stats.totalDosesCount}</div>
                    <div class="backup-preview-stat-label">${esc(i18nService.t("modals.backup.totalDoses"))}</div>
                  </div>
                </div>
              </div>

              <div class="backup-preview-warning">
                ${esc(i18nService.t("modals.backup.replaceWarning"))}
              </div>
            `;
          }
        }

        if (modal) modal.classList.add("on");
      };

      reader.readAsText(file);
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (!pendingBackupString || !pendingStats) return;

      confirmBtn.disabled = true;
      const recoveryNow = new Date();
      const recoveryStamp = `${recoveryNow.toISOString().slice(0, 10)}-${String(recoveryNow.getHours()).padStart(2, "0")}${String(recoveryNow.getMinutes()).padStart(2, "0")}${String(recoveryNow.getSeconds()).padStart(2, "0")}`;
      const recoveryResult = await exportFile({
        fileName: `protocolo-pep-recuperacao-antes-restauracao-${recoveryStamp}.json`,
        content: storage.exportBackup(theme?.getBackupTheme?.() || "black"),
        mimeType: "application/json",
        subDir: i18nService.t("modals.backup.restoreRecoveryDir"),
        preferDownload: true
      });
      if (recoveryResult.aborted || !recoveryResult.success) {
        confirmBtn.disabled = false;
        void dialogService.alert({
          title: i18nService.t("modals.backup.restoreInterruptedTitle"),
          message: recoveryResult.aborted
            ? i18nService.t("modals.backup.restoreCancelledMsg")
            : i18nService.t("modals.backup.restoreFailedMsg", { error: recoveryResult.error || "" }),
          isDanger: true
        });
        return;
      }
      const res = storage.importBackup(pendingBackupString);
      if (res.success) {
        // Feche a prévia assim que a substituição persistida for confirmada.
        // Atualizações auxiliares (tema, histórico e notificações) não devem
        // deixar o modal aparentando que a restauração ainda está pendente.
        closeModal();
        let themeError = null;
        try {
          if (res.theme && theme) {
            await theme.setTheme(res.theme);
          }
        } catch (err) {
          themeError = err;
          console.warn("[Backup] Tema do backup não pôde ser aplicado:", err);
        }

        recordBackupRestore(pendingStats);
        renderBackupStatusUI();

        try {
          if (onStateRestored) onStateRestored();
        } catch (err) {
          console.warn("[Backup] Falha ao atualizar a interface após restauração:", err);
        }
        if (notifications) void notifications.schedulePeptideReminders(storage.getPeptides());

        haptics.success();
        const themeNotice = themeError ? "\n\nO tema anterior foi mantido." : "";
        void dialogService.alert({
          title: i18nService.t("modals.backup.backupRestoredTitle"),
          message: i18nService.t("modals.backup.backupRestoredMsg", {
            peptides: res.stats.peptideCount,
            days: res.stats.logDaysCount,
            doses: res.stats.totalDosesCount,
            path: recoveryResult.path,
            notice: themeNotice
          })
        });
      } else {
        confirmBtn.disabled = false;
        haptics.warning();
        void dialogService.alert({
          title: i18nService.t("modals.backup.importErrorTitle"),
          message: i18nService.t("modals.backup.importErrorMsg", { error: res.error || "" }),
          isDanger: true
        });
      }
    });
  }

  const closeModal = () => {
    if (modal) {
      modal.classList.remove("on");
      modal.setAttribute("aria-hidden", "true");
    }
    pendingBackupString = null;
    pendingStats = null;
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
}
