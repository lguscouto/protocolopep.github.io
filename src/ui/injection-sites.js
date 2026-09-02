/**
 * UI Controller: Gerenciamento e Rotação de Sítios de Aplicação (V11)
 *
 * Governança:
 * - Linguagem não prescritiva ('próximo na sua rotação', 'último registrado').
 * - Atualização reativa e sanitização contra injeção HTML.
 */

import {
  getDefaultSites,
  formatSiteLabel,
  validateSitesList,
  getNextSite,
  getLastUsedSite
} from "../domain/injection-sites.js";
import { escapeHtml } from "./dom.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";

export function setupInjectionSitesUI({ storage, onSitesChange = () => {} }) {
  const modal = document.getElementById("sites-modal");
  const listEl = document.getElementById("sites-manage-list");
  const addInput = document.getElementById("sites-new-name");
  const addBtn = document.getElementById("sites-add-btn");
  const resetBtn = document.getElementById("sites-reset-btn");
  const closeBtn = document.getElementById("sites-modal-close");
  const openBtn = document.getElementById("open-sites-settings-btn");
  const summaryEl = document.getElementById("sites-summary-text");

  function updateSummary() {
    if (!summaryEl) return;
    const sites = storage.getSites();
    if (!sites || sites.length === 0) {
      summaryEl.textContent = "Nenhum local configurado na rotação.";
      return;
    }
    const lastUsed = getLastUsedSite(storage.getLogs());
    const nextSite = getNextSite(sites, lastUsed ? lastUsed.site : null);
    summaryEl.innerHTML = `Próximo na sua rotação: <strong>${escapeHtml(nextSite || sites[0])}</strong> (${sites.length} locais ativos)`;
  }

  function renderSitesList() {
    if (!listEl) return;
    const sites = storage.getSites();

    if (!sites || sites.length === 0) {
      listEl.innerHTML = `
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;">
          Nenhum local na sua lista de rotação. Adicione um abaixo ou restaure o padrão.
        </div>`;
      updateSummary();
      return;
    }

    listEl.innerHTML = sites.map((site, index) => {
      const isFirst = index === 0;
      const isLast = index === sites.length - 1;

      return `
        <div class="site-row-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span style="font-size:11px;font-weight:700;color:var(--muted);width:18px;text-align:right;">${index + 1}.</span>
            <span style="font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(site)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
            <button type="button" class="btn-site-move-up" data-index="${index}" ${isFirst ? "disabled" : ""} style="padding:4px 8px;font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);" aria-label="Subir ${escapeHtml(site)}">
              ▲
            </button>
            <button type="button" class="btn-site-move-down" data-index="${index}" ${isLast ? "disabled" : ""} style="padding:4px 8px;font-size:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);" aria-label="Descer ${escapeHtml(site)}">
              ▼
            </button>
            <button type="button" class="btn-site-remove" data-index="${index}" style="padding:4px 8px;font-size:11px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:4px;color:#ef4444;" aria-label="Remover ${escapeHtml(site)}">
              ✕
            </button>
          </div>
        </div>`;
    }).join("");

    updateSummary();
  }

  function handleMoveUp(index) {
    if (index <= 0) return;
    const sites = storage.getSites();
    const temp = sites[index];
    sites[index] = sites[index - 1];
    sites[index - 1] = temp;
    const res = storage.setSites(sites);
    if (res.success) {
      haptics.selection();
      renderSitesList();
      onSitesChange();
    }
  }

  function handleMoveDown(index) {
    const sites = storage.getSites();
    if (index >= sites.length - 1) return;
    const temp = sites[index];
    sites[index] = sites[index + 1];
    sites[index + 1] = temp;
    const res = storage.setSites(sites);
    if (res.success) {
      haptics.selection();
      renderSitesList();
      onSitesChange();
    }
  }

  function handleRemove(index) {
    const sites = storage.getSites();
    sites.splice(index, 1);
    const res = storage.setSites(sites);
    if (res.success) {
      haptics.warning();
      renderSitesList();
      onSitesChange();
    }
  }

  function handleAdd() {
    if (!addInput) return;
    const rawVal = addInput.value;
    const formatted = formatSiteLabel(rawVal);
    if (!formatted) {
      void dialogService.alert({ title: "Nome inválido", message: "Informe um nome válido para o local.", isDanger: true });
      return;
    }

    const sites = storage.getSites();
    if (sites.some((s) => s.toLowerCase() === formatted.toLowerCase())) {
      void dialogService.alert({ title: "Local duplicado", message: `O local "${formatted}" já está na rotação.` });
      return;
    }

    sites.push(formatted);
    const res = storage.setSites(sites);
    if (res.success) {
      haptics.success();
      addInput.value = "";
      renderSitesList();
      onSitesChange();
    } else {
      void dialogService.alert({ title: "Erro ao salvar", message: "Erro ao salvar local: " + (res.error || "Falha no armazenamento"), isDanger: true });
    }
  }

  function handleReset() {
    const defaults = getDefaultSites();
    const res = storage.setSites(defaults);
    if (res.success) {
      haptics.selection();
      renderSitesList();
      onSitesChange();
    }
  }

  // Event Listeners
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const moveUpBtn = e.target.closest(".btn-site-move-up");
      if (moveUpBtn && !moveUpBtn.disabled) {
        handleMoveUp(parseInt(moveUpBtn.dataset.index, 10));
        return;
      }
      const moveDownBtn = e.target.closest(".btn-site-move-down");
      if (moveDownBtn && !moveDownBtn.disabled) {
        handleMoveDown(parseInt(moveDownBtn.dataset.index, 10));
        return;
      }
      const removeBtn = e.target.closest(".btn-site-remove");
      if (removeBtn) {
        handleRemove(parseInt(removeBtn.dataset.index, 10));
        return;
      }
    });
  }

  if (addBtn) addBtn.addEventListener("click", handleAdd);
  if (addInput) {
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", handleReset);

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      haptics.selection();
      renderSitesList();
      modal.classList.add("on");
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      haptics.light();
      modal.classList.remove("on");
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("on");
      }
    });
  }

  // Initial render
  updateSummary();

  return {
    renderSitesList,
    updateSummary
  };
}
