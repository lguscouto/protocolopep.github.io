/**
 * UI Controller: Sintomas, Peso e Medidas Autorrelatadas (V12)
 *
 * Princípios de Governança (AGENTS.md):
 * - Linguagem estritamente descritiva: "Variação autorrelatada", "Observações pessoais".
 * - Não prescritiva e não clínica.
 * - Sanitização estrita contra injeção de HTML.
 * - Confirmação de persistência antes de haptics.
 */

import {
  createMeasurementEntry,
  validateMeasurementEntry,
  calculateMeasurementStats,
  DEFAULT_SYMPTOM_SUGGESTIONS,
  formatSymptomLabel
} from "../domain/measurements.js";
import { escapeHtml, sanitizeId } from "./dom.js";
import { haptics } from "../services/haptics.js";
import { dialogService } from "../services/dialog.js";

const esc = escapeHtml;

export function setupMeasurementsUI({ storage, onMeasurementsChange = () => {} }) {
  const modal = document.getElementById("measurement-modal");
  const form = document.getElementById("measurement-form");
  const closeBtn = document.getElementById("measurement-modal-close");
  const openBtn = document.getElementById("open-measurement-modal-btn");
  const openFromDashBtn = document.getElementById("open-measurement-dash-btn");
  const deleteBtn = document.getElementById("measurement-delete-btn");

  const dateInput = document.getElementById("meas-date-input");
  const timeInput = document.getElementById("meas-time-input");
  const weightInput = document.getElementById("meas-weight-input");
  const notesInput = document.getElementById("meas-notes-input");
  const customSymptomInput = document.getElementById("meas-custom-symptom-input");
  const addSymptomBtn = document.getElementById("meas-add-symptom-btn");
  const chipsContainer = document.getElementById("meas-symptoms-chips");

  const trendSummaryEl = document.getElementById("measurements-trend-summary");
  const historyListEl = document.getElementById("measurements-history-list");

  let editingEntryId = null;
  let selectedSymptoms = new Set();
  let selectedEnergy = null;
  let selectedMood = null;

  function updateLevelButtons() {
    for (let i = 1; i <= 5; i++) {
      const btnE = document.getElementById(`meas-energy-${i}`);
      if (btnE) {
        if (selectedEnergy === i) {
          btnE.classList.add("selected");
          btnE.style.background = "var(--primary)";
          btnE.style.color = "#fff";
          btnE.style.borderColor = "var(--primary)";
        } else {
          btnE.classList.remove("selected");
          btnE.style.background = "var(--surface2)";
          btnE.style.color = "var(--text)";
          btnE.style.borderColor = "var(--border)";
        }
      }

      const btnM = document.getElementById(`meas-mood-${i}`);
      if (btnM) {
        if (selectedMood === i) {
          btnM.classList.add("selected");
          btnM.style.background = "var(--accent)";
          btnM.style.color = "#fff";
          btnM.style.borderColor = "var(--accent)";
        } else {
          btnM.classList.remove("selected");
          btnM.style.background = "var(--surface2)";
          btnM.style.color = "var(--text)";
          btnM.style.borderColor = "var(--border)";
        }
      }
    }
  }

  function renderSymptomChips() {
    if (!chipsContainer) return;
    const allAvailable = [...new Set([...DEFAULT_SYMPTOM_SUGGESTIONS, ...Array.from(selectedSymptoms)])];

    chipsContainer.innerHTML = allAvailable.map((symptom) => {
      const isSelected = selectedSymptoms.has(symptom);
      return `
        <button type="button" class="symptom-chip-btn ${isSelected ? "active" : ""}" data-symptom="${esc(symptom)}" style="padding:5px 10px;font-size:12px;border-radius:16px;border:1px solid ${isSelected ? "var(--primary)" : "var(--border2)"};background:${isSelected ? "rgba(99,102,241,0.15)" : "var(--surface2)"};color:${isSelected ? "var(--primary)" : "var(--text)"};cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
          ${isSelected ? "✓ " : "+ "}${esc(symptom)}
        </button>
      `;
    }).join("");
  }

  function openMeasurementModal(entry = null, prefillDate = null) {
    if (!modal) return;
    editingEntryId = entry ? entry.id : null;
    const isExternal = Boolean(entry && entry.ownership === "external");

    const titleEl = document.getElementById("measurement-modal-title");
    if (titleEl) {
      if (isExternal) {
        titleEl.textContent = "Registro Externo (Health Connect)";
      } else {
        titleEl.textContent = entry ? "Editar Registro Corporal / Sintomas" : "Novo Registro Corporal / Sintomas";
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (dateInput) {
      dateInput.max = todayStr;
      dateInput.value = entry ? entry.date : (prefillDate || todayStr);
      dateInput.disabled = isExternal;
    }
    if (timeInput) {
      timeInput.value = entry ? entry.time : nowTimeStr;
      timeInput.disabled = isExternal;
    }
    if (weightInput) {
      weightInput.value = entry && entry.weightKg !== null ? entry.weightKg : "";
      weightInput.disabled = isExternal;
      weightInput.title = isExternal
        ? "Registro importado do Health Connect. Para alterar peso ou horário, utilize o aplicativo de origem."
        : "";
    }
    if (notesInput) notesInput.value = entry ? (entry.notes || "") : "";

    selectedEnergy = entry ? entry.energyLevel : null;
    selectedMood = entry ? entry.moodLevel : null;
    selectedSymptoms = new Set(entry && Array.isArray(entry.symptoms) ? entry.symptoms : []);

    if (customSymptomInput) customSymptomInput.value = "";

    if (deleteBtn) {
      deleteBtn.style.display = entry ? "inline-block" : "none";
      deleteBtn.textContent = isExternal ? "Ocultar no PEP" : "Excluir";
      deleteBtn.title = isExternal ? "Oculta a exibição desta medição externa no Protocolo PEP" : "Excluir medição";
    }

    updateLevelButtons();
    renderSymptomChips();
    modal.classList.add("on");
  }

  function renderTrendSummary() {
    if (!trendSummaryEl) return;
    const measurements = storage.getMeasurements();
    const stats = calculateMeasurementStats(measurements);

    if (stats.totalEntries === 0) {
      trendSummaryEl.innerHTML = `
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">
          Nenhum registro de peso ou sintomas ainda.<br>
          Toque em <b>+ Registrar Medidas / Sintomas</b> para iniciar seu histórico pessoal.
        </div>`;
      return;
    }

    let weightDeltaBadge = "";
    if (stats.weightDelta !== null) {
      const isDown = stats.weightDelta < 0;
      const isUp = stats.weightDelta > 0;
      const deltaSign = isUp ? "+" : "";
      const deltaColor = isDown ? "#10b981" : isUp ? "#f59e0b" : "var(--muted)";
      weightDeltaBadge = `<span style="font-size:12px;font-weight:700;color:${deltaColor};margin-left:6px;">(${deltaSign}${stats.weightDelta} kg)</span>`;
    }

    trendSummaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:12px;">
        <div class="panel" style="padding:12px;text-align:center;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Último Peso</div>
          <div style="font-size:18px;font-weight:800;color:var(--primary);margin-top:4px;">
            ${stats.latestWeight !== null ? `${stats.latestWeight} kg` : "--"}
            ${weightDeltaBadge}
          </div>
          ${stats.minWeight !== null && stats.maxWeight !== null ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">Faixa: ${stats.minWeight} - ${stats.maxWeight} kg</div>` : ""}
        </div>

        <div class="panel" style="padding:12px;text-align:center;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Energia Média</div>
          <div style="font-size:18px;font-weight:800;color:var(--accent);margin-top:4px;">
            ${stats.averageEnergy !== null ? `⚡ ${stats.averageEnergy} / 5` : "--"}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${stats.totalEntries} registro${stats.totalEntries > 1 ? "s" : ""}</div>
        </div>

        ${stats.mostFrequentSymptom ? `
        <div class="panel" style="padding:12px;text-align:center;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Sintoma Frequente</div>
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(stats.mostFrequentSymptom.symptom)}">
            ${esc(stats.mostFrequentSymptom.symptom)}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Relatado ${stats.mostFrequentSymptom.count}x</div>
        </div>` : ""}
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.4;margin-bottom:16px;">
        * Registros autorrelatados informativos. Não constituem correlação clínica nem orientação médica.
      </div>
    `;
  }

  function renderMeasurementsHistory() {
    if (!historyListEl) return;
    const measurements = storage.getMeasurements();

    if (measurements.length === 0) {
      historyListEl.innerHTML = "";
      return;
    }

    // Ordenar do mais recente para o mais antigo
    const sorted = [...measurements].sort((a, b) => {
      const cmp = (b.date || "").localeCompare(a.date || "");
      if (cmp !== 0) return cmp;
      return (b.time || "").localeCompare(a.time || "");
    });

    historyListEl.innerHTML = `
      <div style="margin-top:16px;">
        <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
          Histórico de Medições & Sintomas (${sorted.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${sorted.map((m) => {
            const [y, mon, d] = (m.date || "").split("-");
            const fmtDate = y && mon && d ? `${d}/${mon}/${y}` : m.date;

            return `
              <div class="panel" style="padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                    <span style="font-size:13.5px;font-weight:700;color:var(--text);">${esc(fmtDate)} · ${esc(m.time || "")}</span>
                    ${m.weightKg !== null ? `<span class="chip-acc" style="background:rgba(99,102,241,0.12);color:var(--primary);font-size:11.5px;font-weight:700;">⚖️ ${m.weightKg} kg</span>` : ""}
                    ${m.energyLevel ? `<span class="chip-acc" style="background:rgba(234,179,8,0.12);color:#ca8a04;font-size:11.5px;font-weight:700;">⚡ Energia ${m.energyLevel}/5</span>` : ""}
                    ${m.moodLevel ? `<span class="chip-acc" style="background:rgba(14,133,128,0.12);color:var(--accent);font-size:11.5px;font-weight:700;">😊 Humor ${m.moodLevel}/5</span>` : ""}
                    ${m.ownership === "external" ? `<span class="chip-acc" style="background:rgba(59,130,246,0.12);color:#3b82f6;font-size:11px;font-weight:600;">🔗 Health Connect</span>` : ""}
                  </div>
                  ${m.symptoms && m.symptoms.length > 0 ? `
                    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">
                      ${m.symptoms.map((s) => `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);border:1px solid var(--border2);">${esc(s)}</span>`).join("")}
                    </div>` : ""}
                  ${m.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">💬 ${esc(m.notes)}</div>` : ""}
                </div>
                <button type="button" class="btn-meas-edit" data-id="${sanitizeId(m.id)}" style="padding:6px 10px;font-size:11.5px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);cursor:pointer;flex-shrink:0;">
                  Editar
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Event Listeners
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      haptics.selection();
      openMeasurementModal();
    });
  }

  if (openFromDashBtn) {
    openFromDashBtn.addEventListener("click", () => {
      haptics.selection();
      openMeasurementModal();
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
      if (e.target === modal) modal.classList.remove("on");
    });
  }

  // Level selector clicks
  for (let i = 1; i <= 5; i++) {
    const btnE = document.getElementById(`meas-energy-${i}`);
    if (btnE) {
      btnE.addEventListener("click", () => {
        haptics.selection();
        selectedEnergy = selectedEnergy === i ? null : i;
        updateLevelButtons();
      });
    }

    const btnM = document.getElementById(`meas-mood-${i}`);
    if (btnM) {
      btnM.addEventListener("click", () => {
        haptics.selection();
        selectedMood = selectedMood === i ? null : i;
        updateLevelButtons();
      });
    }
  }

  // Symptom chip toggles
  if (chipsContainer) {
    chipsContainer.addEventListener("click", (e) => {
      const chip = e.target.closest(".symptom-chip-btn");
      if (chip) {
        haptics.selection();
        const sym = chip.dataset.symptom;
        if (selectedSymptoms.has(sym)) {
          selectedSymptoms.delete(sym);
        } else {
          selectedSymptoms.add(sym);
        }
        renderSymptomChips();
      }
    });
  }

  // Add custom symptom
  function handleAddCustomSymptom() {
    if (!customSymptomInput) return;
    const formatted = formatSymptomLabel(customSymptomInput.value);
    if (!formatted) return;
    selectedSymptoms.add(formatted);
    customSymptomInput.value = "";
    haptics.light();
    renderSymptomChips();
  }

  if (addSymptomBtn) {
    addSymptomBtn.addEventListener("click", handleAddCustomSymptom);
  }

  if (customSymptomInput) {
    customSymptomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCustomSymptom();
      }
    });
  }

  // History item edit click
  if (historyListEl) {
    historyListEl.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".btn-meas-edit");
      if (editBtn) {
        haptics.selection();
        const id = editBtn.dataset.id;
        const entry = storage.getMeasurements().find((m) => m.id === id);
        if (entry) {
          openMeasurementModal(entry);
        }
      }
    });
  }

  // Delete / Ocultar measurement handler
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!editingEntryId) return;
      const target = storage.getMeasurements().find((m) => m.id === editingEntryId);
      const isExternal = Boolean(target && target.ownership === "external");
      const confirmTitle = isExternal ? "Ocultar Medição Externa" : "Excluir Medição";
      const confirmMsg = isExternal
        ? "Este registro foi importado do Health Connect. Deseja ocultá-lo da visualização do Protocolo PEP? (O registro original continuará preservado no Health Connect)"
        : "Deseja realmente excluir este registro corporal / sintomas?";

      const confirmed = await dialogService.confirm({
        title: confirmTitle,
        message: confirmMsg,
        confirmText: isExternal ? "Ocultar" : "Excluir",
        isDanger: true
      });

      if (confirmed) {
        const res = storage.deleteMeasurement(editingEntryId);
        if (res.success) {
          haptics.warning();
          modal.classList.remove("on");
          renderTrendSummary();
          renderMeasurementsHistory();
          onMeasurementsChange();
        } else {
          dialogService.alert({
            title: "Erro",
            message: "Erro ao excluir: " + (res.error || "Falha local"),
            isDanger: true
          });
        }
      }
    });
  }

  // Form submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const existing = editingEntryId ? storage.getMeasurements().find((m) => m.id === editingEntryId) : null;
      const isExternal = Boolean(existing && existing.ownership === "external");

      // P1 Item 13: Se o registro for externo, preservar os campos originais do Health Connect
      const dateVal = isExternal && existing ? existing.date : (dateInput ? dateInput.value : "");
      const timeVal = isExternal && existing ? existing.time : (timeInput ? timeInput.value : "08:00");
      const rawWeight = isExternal && existing ? existing.weightKg : (weightInput ? weightInput.value.trim() : "");
      const notesVal = notesInput ? notesInput.value.trim() : "";

      const entryPayload = {
        id: editingEntryId,
        date: dateVal,
        time: timeVal,
        weightKg: rawWeight !== null && rawWeight !== undefined && rawWeight !== "" ? rawWeight : null,
        energyLevel: selectedEnergy,
        moodLevel: selectedMood,
        symptoms: Array.from(selectedSymptoms),
        notes: notesVal
      };

      const res = storage.addMeasurement(entryPayload);
      if (!res.success) {
        dialogService.alert({
          title: "Dados Inválidos",
          message: "Erro ao salvar medição: " + (res.error || "Dados inválidos"),
          isDanger: true
        });
        return;
      }

      haptics.success();
      modal.classList.remove("on");
      renderTrendSummary();
      renderMeasurementsHistory();
      onMeasurementsChange();
    });
  }

  // Initial renders
  renderTrendSummary();
  renderMeasurementsHistory();

  return {
    openMeasurementModal,
    renderTrendSummary,
    renderMeasurementsHistory
  };
}
