/**
 * Módulo de Prévia e Importação Segura de Backup (V06)
 */

import { validateAndParseBackup, MAX_BACKUP_SIZE_BYTES } from "../domain/backup.js";
import { recordBackupRestore, renderBackupStatusUI } from "./backup-status.js";
import { haptics } from "../services/haptics.js";
import { escapeHtml } from "./dom.js";

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
        alert(`O arquivo selecionado (${(file.size / (1024 * 1024)).toFixed(1)} MB) ultrapassa o limite máximo permitido de 5 MB.`);
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
              <div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;margin-bottom:14px;">
                <div style="font-weight:700;color:var(--danger);font-size:13px;margin-bottom:4px;">Arquivo Incompatível ou Corrompido</div>
                <div style="font-size:12px;color:var(--text);">${esc(validation.error)}</div>
              </div>
              <div style="font-size:12px;color:var(--muted);line-height:1.4;">
                Certifique-se de selecionar um arquivo <code>.json</code> exportado legitimamente pelo aplicativo Protocolo PEP.
              </div>
            `;
          }
        } else {
          pendingStats = validation.stats;
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = "1";
          }

          const expDate = validation.stats.exportedAt ? new Date(validation.stats.exportedAt).toLocaleString("pt-BR") : "Data não informada";
          const fileSizeKb = (file.size / 1024).toFixed(1);

          if (contentEl) {
            contentEl.innerHTML = `
              <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:12px 14px;margin-bottom:14px;">
                <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px;">Metadados do Arquivo</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                  <div><span style="color:var(--muted);">Nome:</span> <b style="word-break:break-all;">${esc(file.name)}</b></div>
                  <div><span style="color:var(--muted);">Tamanho:</span> <b>${fileSizeKb} KB</b></div>
                  <div style="grid-column:1/-1;"><span style="color:var(--muted);">Exportado em:</span> <b>${esc(expDate)}</b></div>
                </div>
              </div>

              <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:12px 14px;margin-bottom:14px;">
                <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px;">Conteúdo a ser Restaurado</div>
                <div style="display:flex;gap:12px;text-align:center;">
                  <div style="flex:1;background:var(--surface);padding:8px 6px;border-radius:8px;border:1px solid var(--border);">
                    <div style="font-size:16px;font-weight:800;color:var(--primary);">${validation.stats.peptideCount}</div>
                    <div style="font-size:10.5px;color:var(--muted);">Peptídeos</div>
                  </div>
                  <div style="flex:1;background:var(--surface);padding:8px 6px;border-radius:8px;border:1px solid var(--border);">
                    <div style="font-size:16px;font-weight:800;color:var(--primary);">${validation.stats.logDaysCount}</div>
                    <div style="font-size:10.5px;color:var(--muted);">Dias Registrados</div>
                  </div>
                  <div style="flex:1;background:var(--surface);padding:8px 6px;border-radius:8px;border:1px solid var(--border);">
                    <div style="font-size:16px;font-weight:800;color:var(--primary);">${validation.stats.totalDosesCount}</div>
                    <div style="font-size:10.5px;color:var(--muted);">Total Doses</div>
                  </div>
                </div>
              </div>

              <div style="padding:10px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;font-size:11.5px;color:var(--muted);line-height:1.4;">
                ⚠️ <b>Atenção:</b> Esta ação substituirá integralmente os compostos e registros atuais deste aparelho pelos dados deste backup.
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
    confirmBtn.addEventListener("click", () => {
      if (!pendingBackupString || !pendingStats) return;

      const res = storage.importBackup(pendingBackupString);
      if (res.success) {
        recordBackupRestore(pendingStats);
        renderBackupStatusUI();

        if (res.theme && theme) theme.setTheme(res.theme);
        if (onStateRestored) onStateRestored();
        if (notifications) notifications.schedulePeptideReminders(storage.getPeptides());

        if (modal) modal.classList.remove("on");
        haptics.success();
        alert(`Backup restaurado com sucesso! ✓\n• Peptídeos: ${res.stats.peptideCount}\n• Dias registrados: ${res.stats.logDaysCount}\n• Total de doses: ${res.stats.totalDosesCount}`);
      } else {
        haptics.warning();
        alert("Erro ao importar backup: " + (res.error || "Formato incompatível"));
      }
    });
  }

  const closeModal = () => {
    if (modal) modal.classList.remove("on");
    pendingBackupString = null;
    pendingStats = null;
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
}
