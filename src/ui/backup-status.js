/**
 * Módulo de Status e Histórico de Operações de Backup (V15)
 */

import { escapeHtml } from "./dom.js";

const LAST_EXPORT_KEY = "pep_last_backup_export";
const LAST_RESTORE_KEY = "pep_last_backup_restore";

export function recordBackupExport(path = null) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      path: path ? String(path) : null
    };
    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(payload));
  } catch (e) {}
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

  try {
    const exp = localStorage.getItem(LAST_EXPORT_KEY);
    if (exp) lastExport = JSON.parse(exp);
  } catch (e) {}

  try {
    const res = localStorage.getItem(LAST_RESTORE_KEY);
    if (res) lastRestore = JSON.parse(res);
  } catch (e) {}

  return { lastExport, lastRestore };
}

export function renderBackupStatusUI() {
  const statusEl = document.getElementById("backup-status-area");
  if (!statusEl) return;

  const { lastExport, lastRestore } = getBackupStatus();

  let html = "";
  if (!lastExport && !lastRestore) {
    html = `<div style="font-size:11.5px;color:var(--muted);margin-top:10px;">Nenhum backup realizado ou restaurado neste dispositivo ainda.</div>`;
  } else {
    html = `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border2);font-size:11.5px;color:var(--muted);line-height:1.5;">`;
    if (lastExport) {
      const d = new Date(lastExport.timestamp);
      html += `<div>📤 <b>Último backup exportado:</b> ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>`;
      if (lastExport.path) {
        html += `<div style="margin-top:2px;font-size:11px;color:var(--muted);word-break:break-all;">📁 <b>Local:</b> ${escapeHtml(lastExport.path)}</div>`;
      }
    }
    if (lastRestore) {
      const d = new Date(lastRestore.timestamp);
      html += `<div style="margin-top:2px;">📥 <b>Última restauração:</b> ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>`;
    }
    html += `</div>`;
  }

  statusEl.innerHTML = html;
}
