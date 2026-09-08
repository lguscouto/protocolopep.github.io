/**
 * Módulo de Status e Histórico de Operações de Backup (V15)
 */

import { escapeHtml } from "./dom.js";

const LAST_EXPORT_KEY = "pep_last_backup_export";
const LAST_RESTORE_KEY = "pep_last_backup_restore";
const LAST_CHANGE_KEY = "pep_last_data_change";
const DISMISS_REMINDER_KEY = "pep_backup_reminder_dismissed";

export function recordBackupExport(path = null) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      path: path ? String(path) : null,
      availableVerified: false
    };
    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(payload));
  } catch (e) {}
}

export function recordDataChange(timestamp = new Date().toISOString()) {
  try { localStorage.setItem(LAST_CHANGE_KEY, String(timestamp)); } catch (e) {}
}

export function recordBackupRestore(stats = {}) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      stats
    };
    localStorage.setItem(LAST_RESTORE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

export function getBackupStatus() {
  let lastExport = null;
  let lastRestore = null;
  let lastChange = null;
  let dismissedAt = 0;

  try {
    const exp = localStorage.getItem(LAST_EXPORT_KEY);
    if (exp) lastExport = JSON.parse(exp);
  } catch (e) {}

  try {
    const res = localStorage.getItem(LAST_RESTORE_KEY);
    if (res) lastRestore = JSON.parse(res);
  } catch (e) {}
  try { lastChange = localStorage.getItem(LAST_CHANGE_KEY); } catch (e) {}
  try { dismissedAt = Date.parse(localStorage.getItem(DISMISS_REMINDER_KEY) || "") || 0; } catch (e) {}

  const lastExportTime = lastExport?.timestamp ? Date.parse(lastExport.timestamp) : 0;
  const changeTime = lastChange ? Date.parse(lastChange) : 0;
  return { lastExport, lastRestore, lastChange, hasChangesAfterExport: changeTime > lastExportTime, reminderDue: Boolean(changeTime > lastExportTime && Date.now() - changeTime >= 7 * 24 * 60 * 60 * 1000 && dismissedAt < changeTime) };
}

export function renderBackupStatusUI() {
  const statusEl = document.getElementById("backup-status-area");
  if (!statusEl) return;

  const { lastExport, lastRestore, hasChangesAfterExport, reminderDue } = getBackupStatus();

  let html = "";
  if (!lastExport && !lastRestore) {
    html = `<div style="font-size:11.5px;color:var(--muted);margin-top:10px;">Nenhum backup realizado ou restaurado neste dispositivo ainda.</div>`;
  } else {
    html = `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border2);font-size:11.5px;color:var(--muted);line-height:1.5;">`;
    if (lastExport) {
      const d = new Date(lastExport.timestamp);
      html += `<div>📤 <b>Último backup exportado:</b> ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>`;
      if (lastExport.path) {
        html += `<div style="margin-top:2px;font-size:11px;color:var(--muted);word-break:break-all;">📁 <b>Caminho informado na exportação:</b> ${escapeHtml(lastExport.path)}</div>`;
      }
      html += `<div style="margin-top:2px;font-size:11px;color:var(--muted);">O arquivo ainda disponível não é verificado automaticamente.</div>`;
    }
    if (lastRestore) {
      const d = new Date(lastRestore.timestamp);
      html += `<div style="margin-top:2px;">📥 <b>Última restauração:</b> ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    }
    html += `</div>`;
  }

  if (hasChangesAfterExport) {
    html += `<div style="margin-top:10px;padding:9px 11px;border:1px solid rgba(245,158,11,.35);border-radius:10px;color:var(--warning);font-size:11.5px;">Há alterações posteriores ao último backup exportado.${reminderDue ? " Recomendamos exportar uma nova cópia." : ""} <button type="button" id="backup-reminder-dismiss" class="btn-compact-action" style="margin-left:6px;">Dispensar</button></div>`;
  }

  statusEl.innerHTML = html;
  document.getElementById("backup-reminder-dismiss")?.addEventListener("click", () => {
    try { localStorage.setItem(DISMISS_REMINDER_KEY, new Date().toISOString()); } catch (e) {}
    const element = document.getElementById("backup-reminder-dismiss")?.parentElement;
    if (element) element.remove();
  });
}
