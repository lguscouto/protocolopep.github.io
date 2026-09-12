/**
 * Módulo de Interface para Aplicações Retroativas (V19)
 */

import { escapeHtml } from "./dom.js";
import { getNextSite, getLastUsedSite } from "../domain/injection-sites.js";
import { dialogService } from "../services/dialog.js";
import { renderInjectionSitePicker } from "./injection-site-picker.js";
import { DOSE_STATUSES, parseUnits } from "../domain/dose-state.js";
import { getDoseDisplayData } from "../domain/dose-display.js";
import { isValidDateKey, isValidTime } from "../domain/schedule.js";
import { i18nService } from "../services/i18n.js";
import { resolveProtocolAt } from "../domain/protocol-history.js";

const esc = escapeHtml;
let editingContext = null;
let saving = false;

export function openRetroLogModal(prefillDate = null, prefillPepId = null, { storage, dateKey, editingLog = null, requireSiteSelection = false, initialStatus = "applied" }) {
  const modal = document.getElementById("retro-log-modal");
  if (!modal || saving) return;
  if (!modal.dataset) modal.dataset = {};
  modal.dataset.requireSiteSelection = requireSiteSelection && !editingLog ? "true" : "false";

  editingContext = editingLog?.id ? {
    log: JSON.parse(JSON.stringify(editingLog)),
    peptideId: prefillPepId || editingLog.peptideId,
    scheduledDate: prefillDate || editingLog.scheduledDate
  } : null;

  const peptides = storage.getPeptides();
  if (peptides.length === 0 && !editingContext) {
    dialogService.alert({
      title: "Protocolo Vazio",
      message: "Cadastre ao menos um peptídeo no seu protocolo antes de registrar uma aplicação."
    });
    return;
  }

  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const sitePicker = document.getElementById("retro-site-picker");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");
  const statusSelect = document.getElementById("retro-status-select");
  const reasonInput = document.getElementById("retro-reason-input");
  const historyPanel = document.getElementById("retro-edit-history");
  const title = document.getElementById("retro-modal-title");
  if (title) title.textContent = editingContext ? i18nService.t("phase1.editRecord") : i18nService.t("modals.retro.title");

  const todayKey = dateKey(new Date());

  if (dateInput) {
    dateInput.max = todayKey;
    dateInput.value = editingContext?.scheduledDate || prefillDate || todayKey;
    dateInput.disabled = Boolean(editingContext);
  }

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (timeInput) {
    timeInput.value = editingContext?.log.time || nowTime;
  }

  if (pepSelect) {
    const display = editingContext ? getDoseDisplayData(editingContext.log, peptides.find((p) => p.id === editingContext.peptideId)) : null;
    const options = editingContext ? [{ id: editingContext.peptideId, ...display }] : peptides;
    pepSelect.innerHTML = options.map((p) => `
      <option value="${esc(p.id)}" ${p.id === prefillPepId ? "selected" : ""}>
        ${esc(p.name)} (${esc(p.dose || "")}${p.ui ? ` · ${esc(String(p.ui))} UI` : ""})
      </option>
    `).join("");
    pepSelect.disabled = Boolean(editingContext);
    if (editingContext?.peptideId || prefillPepId) pepSelect.value = editingContext?.peptideId || prefillPepId;

    let doseEdited = false;
    let unitsEdited = false;
    if (doseInput) doseInput.oninput = () => { doseEdited = true; };
    if (uiInput) uiInput.oninput = () => { unitsEdited = true; };
    const updateDoseAndUi = () => {
      const selectedId = pepSelect.value;
      const selected = peptides.find((x) => x.id === selectedId);
      const at = isValidDateKey(dateInput?.value) && isValidTime(timeInput?.value)
        ? new Date(`${dateInput.value}T${timeInput.value}:00`) : new Date();
      const p = editingContext ? display : resolveProtocolAt(selected, at);
      if (p) {
        if (doseInput && !doseEdited) doseInput.value = p.lifecycleStatus === "not_started" ? "" : (p.dose ?? "");
        if (uiInput && !unitsEdited) uiInput.value = p.lifecycleStatus === "not_started" ? "" : (p.ui ?? "");
      }
      const route = p?.administrationRoute || editingContext?.log.administrationRoute || "subcutaneous";
      const siteField = document.getElementById("retro-site-field");
      const isOral = route === "oral";
      if (siteField) siteField.hidden = isOral;
      if (uiInput && typeof uiInput.closest === "function") uiInput.closest(".form-field")?.toggleAttribute("hidden", isOral || p?.administrationUnit === "ml");
      if (siteSelect && !isOral) {
        const configuredSites = route === "intramuscular" ? [...storage.getIntramuscularSites()] : [...storage.getSites()];
        const historicalSite = editingContext?.log.site || "";
        if (historicalSite && !configuredSites.includes(historicalSite)) configuredSites.push(historicalSite);
        const lastUsed = getLastUsedSite(storage.getLogs(), selectedId);
        const nextSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null);
        const selectedSite = editingContext
          ? historicalSite
          : (requireSiteSelection ? "" : (nextSite || ""));
        siteSelect.innerHTML = `
          <option value="">-- Não especificado --</option>
          ${configuredSites.map((s) => `<option value="${esc(s)}" ${s === selectedSite ? "selected" : ""}>${esc(s)}</option>`).join("")}
        `;
        siteSelect.value = selectedSite;
        renderInjectionSitePicker({
          container: sitePicker,
          select: siteSelect,
          sites: configuredSites,
          selectedSite,
          nextSite: nextSite || "",
          lastSite: lastUsed?.site || ""
        });
      }
    };

    pepSelect.onchange = () => { doseEdited = false; unitsEdited = false; updateDoseAndUi(); };
    if (dateInput) dateInput.onchange = editingContext ? null : updateDoseAndUi;
    if (timeInput) timeInput.onchange = editingContext ? null : updateDoseAndUi;
    updateDoseAndUi();
  }

  if (noteInput) noteInput.value = editingContext?.log.note || "";
  if (reasonInput) reasonInput.value = editingContext?.log.statusReason || "";
  if (statusSelect) {
    statusSelect.innerHTML = DOSE_STATUSES.map((status) => `<option value="${status}">${esc(i18nService.t(`phase1.${status}`))}</option>`).join("");
    statusSelect.value = editingContext?.log.status || initialStatus || "applied";
    const updateStatusFields = () => {
      const applied = statusSelect.value === "applied";
      const siteField = document.getElementById("retro-site-field");
      const reasonField = document.getElementById("retro-reason-field");
      const selected = editingContext ? { administrationRoute: editingContext.log.administrationRoute || "subcutaneous" } : resolveProtocolAt(peptides.find((entry) => entry.id === pepSelect?.value));
      if (siteField) siteField.hidden = !applied || selected?.administrationRoute === "oral";
      if (reasonField) reasonField.hidden = applied;
    };
    statusSelect.onchange = updateStatusFields;
    updateStatusFields();
  }
  if (historyPanel) {
    const history = editingContext?.log.editHistory || [];
    const currentVial = editingContext?.log.vialId;
    historyPanel.hidden = !editingContext;
    historyPanel.innerHTML = editingContext ? `
      ${currentVial ? `<p>${esc(i18nService.t("phase1.vial"))}: ${esc(currentVial)}</p>` : ""}
      ${displayLegacyHint(editingContext.log)}
      <b>${esc(i18nService.t("phase1.editHistory"))}</b>
      ${history.length ? `<ol>${history.map((item) => {
        const previous = item.previous || {};
        const editedDate = new Date(item.editedAt);
        const when = Number.isNaN(editedDate.getTime()) ? "Data não informada" : editedDate.toLocaleString(i18nService.getLocale());
        const prior = getDoseDisplayData(previous);
        const status = DOSE_STATUSES.includes(previous.status) ? i18nService.t(`phase1.${previous.status}`) : "Estado não informado";
        return `<li>${esc(when)}: ${esc(status)} · ${esc(previous.time || "--:--")} · ${esc(prior.dose === "" ? "--" : prior.dose)} (${esc(prior.ui ?? "--")} UI)${previous.site ? ` · ${esc(previous.site)}` : ""}${previous.note ? `<br>${esc(i18nService.t("modals.retro.prevNote"))} ${esc(previous.note)}` : ""}${previous.statusReason ? `<br>${esc(i18nService.t("modals.retro.prevReason"))} ${esc(previous.statusReason)}` : ""}</li>`;
      }).join("")}</ol>` : `<p>${esc(i18nService.t("modals.retro.noPriorCorrections"))}</p>`}
    ` : "";
  }

  modal.classList.add("on");
  modal.setAttribute("aria-hidden", "false");
}

function displayLegacyHint(log) {
  return getDoseDisplayData(log).historyIntegrity === "legacy"
    ? `<p>${esc(i18nService.t("phase1.legacy"))}</p>` : "";
}

export async function saveRetroLog({ doseService, storage: storageForRoute, dateKey, haptics, renderAll }) {
  if (saving) return;
  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");
  const statusSelect = document.getElementById("retro-status-select");
  const reasonInput = document.getElementById("retro-reason-input");

  const pepId = pepSelect ? pepSelect.value : "";
  const siteVal = siteSelect ? siteSelect.value.trim() : "";
  const dKey = dateInput ? dateInput.value : "";
  const timeVal = timeInput ? timeInput.value : "12:00";
  const doseVal = doseInput ? doseInput.value.trim() : "";
  const uiVal = parseUnits(uiInput?.value ?? "");
  const noteVal = noteInput ? noteInput.value.trim() : "";
  const status = statusSelect ? statusSelect.value : "applied";
  const statusReason = status !== "applied" ? (reasonInput?.value || "").trim() : "";

  const modal = document.getElementById("retro-log-modal");
  const selectedProtocol = storageForRoute?.getPeptides?.().find((p) => p.id === pepId);
  const isOral = (selectedProtocol?.administrationRoute || editingContext?.log.administrationRoute) === "oral";
  if (status === "applied" && !isOral && modal?.dataset.requireSiteSelection === "true" && !siteVal) {
    void dialogService.alert({
      title: "Escolha o local",
      message: "Confirme onde você aplicou para manter seu histórico organizado. Se não souber, use o registro retroativo no Histórico.",
      isDanger: false
    });
    return;
  }

  if (!pepId) {
    dialogService.alert({
      title: "Campo Obrigatório",
      message: "Selecione um peptídeo da lista."
    });
    return;
  }

  if (!editingContext && status === "applied" && !doseVal) {
    void dialogService.alert({
      title: "Dose obrigatória",
      message: "Informe a dose registrada antes de salvar a aplicação.",
      isDanger: true
    });
    return;
  }

  if (!isValidDateKey(dKey)) {
    dialogService.alert({
      title: "Campo Obrigatório",
      message: "Informe a data da aplicação."
    });
    return;
  }

  if (!isValidTime(timeVal) || (!isOral && selectedProtocol?.administrationUnit !== "ml" && uiVal === null) || !DOSE_STATUSES.includes(status)) {
    void dialogService.alert({ title: "Dados inválidos", message: "Confira o horário, o estado e as unidades informadas." });
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

  const updates = {
    time: timeVal,
    dose: doseVal,
    ui: uiVal,
    note: noteVal,
    site: status === "applied" && !isOral ? siteVal : "",
    status,
    statusReason
  };
  const registerData = {
    peptideId: pepId,
    scheduledDate: dKey,
    ...updates,
    retroactive: dKey < todayKey
  };
  const context = editingContext;
  if (context && uiInput?.value === "" && (context.log.ui === undefined || context.log.ui === null)) delete updates.ui;
  if (context && doseVal === "" && (context.log.dose === undefined || context.log.dose === null)) delete updates.dose;
  const saveBtn = document.getElementById("retro-save");
  saving = true;
  if (saveBtn) saveBtn.disabled = true;
  try {
    let res = context
      ? await doseService.editDose({ peptideId: context.peptideId, scheduledDate: context.scheduledDate, doseLogId: context.log.id, updates })
      : await doseService.registerDose(registerData);

    if (!context && !res.success && res.error === "VIAL_MISSING_CONCENTRATION") {
      const confirmHistOnly = await dialogService.confirm({
        title: "Concentração Indefinida",
        message: `${res.message || "O frasco não possui concentração definida."}\n\nDeseja salvar a aplicação apenas no histórico sem debitar estoque?`,
        confirmText: "Salvar no Histórico",
        cancelText: "Cancelar",
        isDanger: false
      });
      if (confirmHistOnly) {
        res = await doseService.registerDose({
          ...registerData,
          allowHistoryOnlyWithoutStock: true
        });
      } else return;
    }

    if (!res.success) {
      dialogService.alert({
        title: "Erro",
        message: "Não foi possível salvar o registro: " + (res.message || res.error || "armazenamento indisponível"),
        isDanger: true
      });
      return;
    }

    const modal = document.getElementById("retro-log-modal");
    if (modal) {
      modal.classList.remove("on");
      modal.setAttribute("aria-hidden", "true");
    }
    editingContext = null;

    haptics.success();
    if (typeof renderAll === "function") {
      renderAll();
    }
  } catch (error) {
    void dialogService.alert({ title: i18nService.t("common.error"), message: i18nService.t("dialogs.saveErrorMsg") + (error?.message || ""), isDanger: true });
  } finally {
    saving = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}
