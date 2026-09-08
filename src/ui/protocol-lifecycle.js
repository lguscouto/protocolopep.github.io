import { resolveProtocolAt, reviseProtocol, cancelFutureRevision } from "../domain/protocol-history.js";
import { dateToKey, getUpcomingDoseTimes } from "../domain/schedule.js";
import { escapeHtml as esc, sanitizeId } from "./dom.js";
import { i18nService } from "../services/i18n.js";
import { dialogService } from "../services/dialog.js";

const t = (key, args) => i18nService.t(`phase1.${key}`, args);

export function renderProtocolList(container, peptides, openEdit) {
  const details = document.createElement("details");
  details.className = "protocol-management";
  details.innerHTML = `<summary>${esc(t("manageProtocols"))} (${peptides.length})</summary><div class="protocol-management-list">${peptides.map(p => {
    const current = resolveProtocolAt(p);
    return `<button type="button" class="protocol-manage-item" data-id="${sanitizeId(p.id)}"><strong>${esc(current.name)}</strong><span>${esc(t(current.lifecycleStatus))} · ${esc(t("manage"))}</span></button>`;
  }).join("")}</div>`;
  details.querySelectorAll("button").forEach(button => button.addEventListener("click", () => openEdit(button.dataset.id)));
  container.append(details);
}

export async function changeProtocolStatus(protocol, status, { storage, onSaved }) {
  const now = new Date();
  const current = resolveProtocolAt(protocol, now);
  let updated;
  try {
    updated = reviseProtocol(protocol, current, { status, now });
  } catch (error) {
    await dialogService.alert({ title: t("cannotChange"), message: error.message, isDanger: true });
    return;
  }
  let message = t(status === "paused" ? "pauseDescription" : status === "ended" ? "endDescription" : "resumeDescription");
  if (status === "active") {
    // The interval anchor stays unchanged. Show the schedule after resuming;
    // past occurrences are never materialized as doses or catch-up reminders.
    const upcoming = getUpcomingDoseTimes([updated], now);
    message += "\n\n" + t("resumePreview") + "\n" + (upcoming.map(item => `${item.date.toLocaleDateString(i18nService.getLocale())} · ${item.time}`).join("\n") || t("noUpcoming"));
  }
  if (!await dialogService.confirm({ title: t(status === "active" ? "resume" : status === "paused" ? "pause" : "end"), message, confirmText: t("confirm"), isDanger: status === "ended" })) return;
  // Confirmations can stay open across minutes; use the actual confirmation instant.
  updated = reviseProtocol(protocol, current, { status, now: new Date() });
  const result = storage.setPeptides(storage.getPeptides().map(p => p.id === protocol.id ? updated : p));
  if (!result.success) {
    await dialogService.alert({ title: t("cannotChange"), message: result.error, isDanger: true });
    return;
  }
  onSaved();
}

export function renderProtocolControls(protocol, { storage, onSaved }) {
  let host = document.getElementById("protocol-lifecycle-controls");
  if (!host) {
    host = document.createElement("div");
    host.id = "protocol-lifecycle-controls";
    host.className = "form-field protocol-lifecycle-controls";
    document.getElementById("edit-name").closest(".form-field").before(host);
  }
  host.innerHTML = "";
  host.hidden = !protocol;
  const save = document.getElementById("edit-save");
  if (save) save.disabled = false;
  if (!protocol) return;
  const now = new Date();
  const current = resolveProtocolAt(protocol, now);
  const future = (protocol.revisions || []).find(r => Date.parse(r.effectiveFrom) > now.getTime());
  if (save) save.disabled = Boolean(future) || current.lifecycleStatus === "ended";
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  host.innerHTML = `<strong>${esc(t(current.lifecycleStatus))}</strong>
    <p class="form-field-help">${esc(t("historyPreserved"))}</p>
    ${future ? `<p>${esc(t("futureChange"))}: ${esc(new Date(future.effectiveFrom).toLocaleString(i18nService.getLocale()))}</p><button type="button" class="btn-secondary" id="protocol-cancel-future">${esc(t("cancelFuture"))}</button>` : current.lifecycleStatus !== "ended" ? `<label for="edit-effective-date" class="form-field-label">${esc(t("effectiveDate"))}</label><input type="date" id="edit-effective-date" class="form-field-control" min="${dateToKey(tomorrow)}"><p class="form-field-help">${esc(t("effectiveHelp"))}</p><button type="button" class="btn-secondary" id="protocol-toggle-status">${esc(t(current.lifecycleStatus === "paused" ? "resume" : "pause"))}</button>` : `<button type="button" class="btn-secondary" id="protocol-toggle-status">${esc(t("resume"))}</button>`}`;
  host.querySelector("#protocol-toggle-status")?.addEventListener("click", () => changeProtocolStatus(protocol, current.lifecycleStatus === "paused" ? "active" : "paused", { storage, onSaved }));
  host.querySelector("#protocol-cancel-future")?.addEventListener("click", () => {
    const next = cancelFutureRevision(protocol);
    const result = storage.setPeptides(storage.getPeptides().map(p => p.id === protocol.id ? next : p));
    if (result.success) onSaved();
    else void dialogService.alert({ title: t("cannotChange"), message: result.error, isDanger: true });
  });
}
