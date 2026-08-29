/**
 * Módulo de Interface para Gerenciamento de Inventário de Frascos (V10)
 */

import {
  createVial,
  validateVial,
  calculateRemainingDoses,
  getExpirationStatus
} from "../domain/inventory.js";
import { haptics } from "../services/haptics.js";

export function setupInventoryUI({ storage, onInventoryChange }) {
  const vialModal = document.getElementById("vial-modal");
  const vialHistoryModal = document.getElementById("vial-history-modal");
  const openNewVialBtn = document.getElementById("open-new-vial-btn");
  const openNewVialFromCalcBtn = document.getElementById("calc-save-vial-btn");
  const vialCloseBtn = document.getElementById("vial-modal-close");
  const vialHistoryCloseBtn = document.getElementById("vial-history-close");
  const vialForm = document.getElementById("vial-form");
  const vialDeleteBtn = document.getElementById("vial-delete-btn");
  const inventoryListEl = document.getElementById("inventory-list");

  let editingVialId = null;

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const openVialModal = (vial = null, prefill = {}) => {
    editingVialId = vial ? vial.id : null;
    const titleEl = document.getElementById("vial-modal-title");
    if (titleEl) {
      titleEl.textContent = vial ? "Editar Frasco" : "Novo Frasco de Peptídeo";
    }

    const nameInput = document.getElementById("vial-name-input");
    const lotInput = document.getElementById("vial-lot-input");
    const mgInput = document.getElementById("vial-mg-input");
    const waterInput = document.getElementById("vial-water-input");
    const reconDateInput = document.getElementById("vial-recon-date");
    const expiryDateInput = document.getElementById("vial-expiry-date");
    const notesInput = document.getElementById("vial-notes-input");

    const todayStr = new Date().toISOString().slice(0, 10);

    if (nameInput) nameInput.value = vial ? vial.peptideName : (prefill.name || "");
    if (lotInput) lotInput.value = vial ? vial.lotNumber || "" : (prefill.lot || "");
    if (mgInput) mgInput.value = vial ? vial.totalMg : (prefill.mg || "");
    if (waterInput) waterInput.value = vial ? vial.waterMl : (prefill.waterMl || "");
    if (reconDateInput) reconDateInput.value = vial ? vial.reconstitutionDate : (prefill.reconstitutionDate || todayStr);
    if (expiryDateInput) expiryDateInput.value = vial ? vial.expirationDate || "" : (prefill.expirationDate || "");
    if (notesInput) notesInput.value = vial ? vial.notes || "" : "";

    if (vialDeleteBtn) {
      vialDeleteBtn.style.display = vial ? "inline-flex" : "none";
    }

    if (vialModal) {
      vialModal.classList.add("on");
    }
  };

  const closeVialModal = () => {
    if (vialModal) vialModal.classList.remove("on");
    editingVialId = null;
  };

  const openHistoryModal = (vialId) => {
    const vials = storage.getInventory();
    const vial = vials.find((v) => v.id === vialId);
    if (!vial) return;

    const titleEl = document.getElementById("vial-history-title");
    const listEl = document.getElementById("vial-history-list");

    if (titleEl) {
      titleEl.textContent = `Movimentações: ${vial.peptideName}`;
    }

    if (listEl) {
      const movements = [...(vial.movements || [])].reverse();
      if (movements.length === 0) {
        listEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Nenhuma movimentação registrada.</div>`;
      } else {
        listEl.innerHTML = movements.map((m) => {
          const typeLabel = m.type === "reconstitution" ? "Reconstituição Inicial" :
                            m.type === "dose" ? "Aplicação de Dose" :
                            m.type === "undo_dose" ? "Estorno de Dose" :
                            m.type === "adjustment" ? "Ajuste Manual" : m.type;
          const badgeColor = m.amountMcg > 0 ? "var(--accent)" : "var(--primary)";
          const formattedAmount = m.amountMcg > 0 ? `+${m.amountMcg} mcg` : `${m.amountMcg} mcg`;
          
          return `
            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:700;font-size:13px;color:var(--text);">${escapeHtml(typeLabel)}</span>
                <span style="font-size:12px;font-weight:800;color:${badgeColor};">${escapeHtml(formattedAmount)}</span>
              </div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:4px;">
                📅 ${escapeHtml(m.date || "")} ${m.note ? `• ${escapeHtml(m.note)}` : ""}
              </div>
              <div style="font-size:11px;color:var(--text-dim);font-weight:600;">
                Saldo após movimentação: ${escapeHtml(m.balanceAfterMcg)} mcg
              </div>
            </div>
          `;
        }).join("");
      }
    }

    if (vialHistoryModal) {
      vialHistoryModal.classList.add("on");
    }
  };

  const closeHistoryModal = () => {
    if (vialHistoryModal) vialHistoryModal.classList.remove("on");
  };

  // Renderizar a lista de frascos no container de inventário
  const renderInventoryList = () => {
    if (!inventoryListEl) return;
    const inventory = storage.getInventory();
    const peptides = storage.getPeptides();

    if (inventory.length === 0) {
      inventoryListEl.innerHTML = `
        <div style="text-align:center;padding:24px 16px;background:var(--surface);border-radius:14px;border:1px dashed var(--border);margin-top:12px;">
          <div style="font-size:26px;margin-bottom:6px;">🧪</div>
          <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px;">Nenhum frasco no inventário</div>
          <div style="font-size:12px;color:var(--text-muted);max-width:280px;margin:0 auto 12px;">
            Cadastre seus frascos reconstituídos para acompanhar saldo em tempo real e validade.
          </div>
          <button type="button" class="btn-primary" id="empty-add-vial-btn" style="font-size:12px;padding:8px 16px;">
            + Adicionar Frasco
          </button>
        </div>
      `;
      const emptyBtn = document.getElementById("empty-add-vial-btn");
      if (emptyBtn) emptyBtn.addEventListener("click", () => openVialModal());
      return;
    }

    inventoryListEl.innerHTML = inventory.map((v) => {
      const matchingPep = peptides.find((p) => (v.peptideId && p.id === v.peptideId) || (p.name.toLowerCase() === v.peptideName.toLowerCase()));
      const doseStr = matchingPep ? matchingPep.dose : null;
      const remDoses = doseStr ? calculateRemainingDoses(v, doseStr) : null;
      const expStatus = getExpirationStatus(v);

      const percent = v.initialMcg > 0 ? Math.round((v.remainingMcg / v.initialMcg) * 100) : 0;
      const statusBadge = v.status === "finished" ? `<span style="background:rgba(239,68,68,0.12);color:var(--danger);font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;">Esgotado</span>` :
                          expStatus.status === "expired" ? `<span style="background:rgba(239,68,68,0.15);color:var(--danger);font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;">Vencido</span>` :
                          expStatus.status === "expiring_soon" ? `<span style="background:rgba(245,158,11,0.15);color:#d97706;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;">Validade próxima</span>` :
                          `<span style="background:rgba(16,185,129,0.12);color:var(--accent);font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;">Ativo</span>`;

      return `
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-weight:800;font-size:15px;color:var(--text);">${escapeHtml(v.peptideName)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">
                ${escapeHtml(v.totalMg)} mg em ${escapeHtml(v.waterMl)} mL (${escapeHtml(v.concentrationMcgPerMl)} mcg/mL)
                ${v.lotNumber ? `• Lote: ${escapeHtml(v.lotNumber)}` : ""}
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Barra de Saldo -->
          <div style="margin:10px 0 6px;">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:4px;">
              <span style="color:var(--text);">Saldo: ${escapeHtml(v.remainingMcg)} / ${escapeHtml(v.initialMcg)} mcg</span>
              <span style="color:var(--text-muted);">${percent}%</span>
            </div>
            <div style="height:6px;background:var(--surface);border-radius:999px;overflow:hidden;border:1px solid var(--border);">
              <div style="height:100%;width:${percent}%;background:${percent < 20 ? 'var(--danger)' : 'var(--primary)'};border-radius:999px;transition:width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Informações de Dose e Validade -->
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-dim);margin-top:6px;">
            <div>
              ${remDoses !== null ? `🎯 <strong>~${remDoses} doses restantes</strong>` : `ℹ️ ${escapeHtml(expStatus.label)}`}
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-ghost edit-vial-btn" data-vial-id="${escapeHtml(v.id)}" style="font-size:11px;padding:4px 8px;">
                Editar
              </button>
              <button type="button" class="btn-ghost view-vial-history-btn" data-vial-id="${escapeHtml(v.id)}" style="font-size:11px;padding:4px 8px;">
                Histórico
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Conectar eventos dos botões de cada card
    inventoryListEl.querySelectorAll(".edit-vial-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-vial-id");
        const vial = storage.getInventory().find((v) => v.id === id);
        if (vial) openVialModal(vial);
      });
    });

    inventoryListEl.querySelectorAll(".view-vial-history-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-vial-id");
        if (id) openHistoryModal(id);
      });
    });
  };

  // Event Listeners
  if (openNewVialBtn) {
    openNewVialBtn.addEventListener("click", () => {
      haptics.light();
      openVialModal();
    });
  }

  if (openNewVialFromCalcBtn) {
    openNewVialFromCalcBtn.addEventListener("click", () => {
      haptics.light();
      const selMgChip = document.querySelector("#calc-mg-chips .chip.sel");
      const selMlChip = document.querySelector("#calc-ml-chips .chip.sel");
      const mg = selMgChip ? parseFloat(selMgChip.dataset.v) : 5;
      const waterMl = selMlChip ? parseFloat(selMlChip.dataset.v) : 2;
      const pepSelect = document.getElementById("calc-peptide-select");
      let name = "";
      if (pepSelect && pepSelect.value && pepSelect.value !== "custom") {
        const selectedOpt = pepSelect.options[pepSelect.selectedIndex];
        name = selectedOpt ? selectedOpt.textContent.split(" (")[0].trim() : "";
      }
      openVialModal(null, { mg, waterMl, name });
    });
  }

  if (vialCloseBtn) {
    vialCloseBtn.addEventListener("click", closeVialModal);
  }

  if (vialHistoryCloseBtn) {
    vialHistoryCloseBtn.addEventListener("click", closeHistoryModal);
  }

  if (vialDeleteBtn) {
    vialDeleteBtn.addEventListener("click", () => {
      if (!editingVialId) return;
      if (confirm("Tem certeza que deseja excluir este frasco do inventário?")) {
        const inventory = storage.getInventory().filter((v) => v.id !== editingVialId);
        const res = storage.setInventory(inventory);
        if (!res.success) {
          alert("Erro ao excluir frasco: " + res.error);
          return;
        }
        haptics.warning();
        closeVialModal();
        renderInventoryList();
        if (typeof onInventoryChange === "function") onInventoryChange();
      }
    });
  }

  if (vialForm) {
    vialForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("vial-name-input")?.value?.trim() || "";
      const lot = document.getElementById("vial-lot-input")?.value?.trim() || "";
      const mg = parseFloat(document.getElementById("vial-mg-input")?.value) || 0;
      const waterMl = parseFloat(document.getElementById("vial-water-input")?.value) || 0;
      const reconDate = document.getElementById("vial-recon-date")?.value || new Date().toISOString().slice(0, 10);
      const expiryDate = document.getElementById("vial-expiry-date")?.value || null;
      const notes = document.getElementById("vial-notes-input")?.value?.trim() || "";

      const inventory = storage.getInventory();

      if (editingVialId) {
        const idx = inventory.findIndex((v) => v.id === editingVialId);
        if (idx !== -1) {
          const prev = inventory[idx];
          const updated = {
            ...prev,
            peptideName: name,
            lotNumber: lot,
            totalMg: mg,
            waterMl: waterMl,
            concentrationMcgPerMl: waterMl > 0 ? Math.round((mg * 1000) / waterMl * 100) / 100 : 0,
            reconstitutionDate: reconDate,
            expirationDate: expiryDate,
            notes: notes
          };
          const val = validateVial(updated);
          if (!val.valid) {
            alert(val.errors.join("\n"));
            return;
          }
          inventory[idx] = updated;
        }
      } else {
        const newVial = createVial({
          peptideName: name,
          lotNumber: lot,
          totalMg: mg,
          waterMl: waterMl,
          reconstitutionDate: reconDate,
          expirationDate: expiryDate,
          notes: notes
        });
        const val = validateVial(newVial);
        if (!val.valid) {
          alert(val.errors.join("\n"));
          return;
        }
        inventory.push(newVial);
      }

      const res = storage.setInventory(inventory);
      if (!res.success) {
        alert("Erro ao salvar frasco: " + res.error);
        return;
      }

      haptics.success();
      closeVialModal();
      renderInventoryList();
      if (typeof onInventoryChange === "function") onInventoryChange();
    });
  }

  // Render inicial
  renderInventoryList();

  return {
    renderInventoryList,
    openVialModal,
    openHistoryModal,
    closeVialModal
  };
}
