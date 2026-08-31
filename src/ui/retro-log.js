/**
 * Módulo de Interface para Aplicações Retroativas (V19)
 */

import { escapeHtml } from "./dom.js";
import { getNextSite, getLastUsedSite } from "../domain/injection-sites.js";
import { dialogService } from "../services/dialog.js";

const esc = escapeHtml;

export function openRetroLogModal(prefillDate = null, prefillPepId = null, { storage, dateKey }) {
  const modal = document.getElementById("retro-log-modal");
  if (!modal) return;

  const peptides = storage.getPeptides();
  if (peptides.length === 0) {
    dialogService.alert({
      title: "Protocolo Vazio",
      message: "Cadastre ao menos um peptídeo no seu protocolo antes de registrar uma aplicação."
    });
    return;
  }

  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");

  const todayKey = dateKey(new Date());

  if (dateInput) {
    dateInput.max = todayKey;
    dateInput.value = prefillDate || todayKey;
  }

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (timeInput) {
    timeInput.value = nowTime;
  }

  if (pepSelect) {
    pepSelect.innerHTML = peptides.map((p) => `
      <option value="${esc(p.id)}" ${p.id === prefillPepId ? "selected" : ""}>
        ${esc(p.name)} (${esc(p.dose || "")}${p.ui ? ` · ${esc(String(p.ui))} UI` : ""})
      </option>
    `).join("");

    const updateDoseAndUi = () => {
      const selectedId = pepSelect.value;
      const p = peptides.find((x) => x.id === selectedId);
      if (p) {
        if (doseInput) doseInput.value = p.dose || "";
        if (uiInput) uiInput.value = p.ui !== undefined && p.ui !== null ? p.ui : "";
      }
      if (siteSelect) {
        const configuredSites = storage.getSites();
        const lastUsed = getLastUsedSite(storage.getLogs(), selectedId);
        const nextSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null);
        siteSelect.innerHTML = `
          <option value="">-- Não especificado --</option>
          ${configuredSites.map((s) => `<option value="${esc(s)}" ${s === nextSite ? "selected" : ""}>${esc(s)}</option>`).join("")}
        `;
      }
    };

    pepSelect.onchange = updateDoseAndUi;
    updateDoseAndUi();
  }

  if (noteInput) noteInput.value = "";

  modal.classList.add("on");
  modal.setAttribute("aria-hidden", "false");
}

export async function saveRetroLog({ doseService, dateKey, haptics, renderAll }) {
  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");

  const pepId = pepSelect ? pepSelect.value : "";
  const siteVal = siteSelect ? siteSelect.value.trim() : "";
  const dKey = dateInput ? dateInput.value : "";
  const timeVal = timeInput ? timeInput.value : "12:00";
  const doseVal = doseInput ? doseInput.value.trim() : "";
  const uiVal = uiInput ? parseInt(uiInput.value, 10) || 0 : 0;
  const noteVal = noteInput ? noteInput.value.trim() : "";

  if (!pepId) {
    dialogService.alert({
      title: "Campo Obrigatório",
      message: "Selecione um peptídeo da lista."
    });
    return;
  }

  if (!dKey) {
    dialogService.alert({
      title: "Campo Obrigatório",
      message: "Informe a data da aplicação."
    });
    return;
  }

  const todayKey = dateKey(new Date());
  if (dKey > todayKey) {
    dialogService.alert({
      title: "Data Inválida",
      message: "Não é possível registrar aplicações em datas futuras."
    });
    return;
  }

  let res = doseService.registerDose({
    peptideId: pepId,
    scheduledDate: dKey,
    time: timeVal,
    dose: doseVal,
    ui: uiVal,
    note: noteVal,
    site: siteVal,
    retroactive: dKey < todayKey
  });

  if (!res.success && res.error === "VIAL_MISSING_CONCENTRATION") {
    const confirmHistOnly = await dialogService.confirm({
      title: "Concentração Indefinida",
      message: `${res.message || "O frasco não possui concentração definida."}\n\nDeseja salvar a aplicação apenas no histórico sem debitar estoque?`,
      confirmText: "Salvar no Histórico",
      cancelText: "Cancelar",
      isDanger: false
    });
    if (confirmHistOnly) {
      res = doseService.registerDose({
        peptideId: pepId,
        scheduledDate: dKey,
        time: timeVal,
        dose: doseVal,
        ui: uiVal,
        note: noteVal,
        site: siteVal,
        retroactive: dKey < todayKey,
        allowHistoryOnlyWithoutStock: true
      });
    }
  }

  if (!res.success) {
    dialogService.alert({
      title: "Erro",
      message: "Não foi possível salvar a aplicação: " + (res.message || res.error || "armazenamento indisponível"),
      isDanger: true
    });
    return;
  }

  const modal = document.getElementById("retro-log-modal");
  if (modal) {
    modal.classList.remove("on");
    modal.setAttribute("aria-hidden", "true");
  }

  haptics.success();
  if (typeof renderAll === "function") {
    renderAll();
  }
}
