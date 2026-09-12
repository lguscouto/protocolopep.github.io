import { escapeHtml, sanitizeId } from "./dom.js";
import { i18nService } from "../services/i18n.js";

const ICONS = Object.freeze({
  application: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6M12 6l6 6M4 20l5-1 10-10-4-4L5 15l-1 5Z"/></svg>',
  weight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v16H3V5a2 2 0 0 1 2-2Z"/><path d="M9 8a3 3 0 0 1 6 0M12 8l2-2"/></svg>',
  symptom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"/><path d="M8 13h2l1-3 2 6 1-3h2"/></svg>',
  measurement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16M8 16v-3M12 16V8M16 16v-6M20 16V6"/></svg>'
});

export function setupQuickRegister({ getContext, onApplication, onMeasurement, onEmpty }) {
  const modal = document.getElementById("quick-register-modal");
  const body = document.getElementById("quick-register-body");
  const fab = document.getElementById("quick-register-fab");
  let opener = null;

  const close = () => {
    modal?.classList.remove("on");
    modal?.setAttribute("aria-hidden", "true");
    opener?.focus?.({ preventScroll: true });
  };

  const openApplication = () => {
    const context = getContext();
    if (context.empty) {
      close();
      onEmpty();
      return;
    }
    if (context.pending.length <= 1) {
      close();
      onApplication(context.selectedId, context.date);
      return;
    }
    body.innerHTML = `<p class="quick-register-hint">${escapeHtml(i18nService.t("experience.choosePending"))}</p><div class="quick-register-list">${context.pending.map((item) => `<button type="button" class="quick-register-treatment" data-treatment-id="${sanitizeId(item.id)}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml([item.dose, item.time].filter(Boolean).join(" · "))}</span></button>`).join("")}</div>`;
  };

  const render = () => {
    body.innerHTML = `<p class="quick-register-hint">${escapeHtml(i18nService.t("experience.registerPrompt"))}</p><div class="quick-register-grid">
      <button type="button" class="quick-register-option" data-register="application">${ICONS.application}<span>${escapeHtml(i18nService.t("experience.application"))}</span></button>
      <button type="button" class="quick-register-option" data-register="weight">${ICONS.weight}<span>${escapeHtml(i18nService.t("experience.weight"))}</span></button>
      <button type="button" class="quick-register-option" data-register="symptom">${ICONS.symptom}<span>${escapeHtml(i18nService.t("experience.symptom"))}</span></button>
      <button type="button" class="quick-register-option" data-register="full">${ICONS.measurement}<span>${escapeHtml(i18nService.t("experience.measurements"))}</span></button>
    </div>`;
  };

  const open = (trigger = fab) => {
    opener = trigger;
    render();
    modal.classList.add("on");
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => body.querySelector("button")?.focus({ preventScroll: true }));
  };

  fab?.addEventListener("click", () => open(fab));
  document.getElementById("quick-register-close")?.addEventListener("click", close);
  modal?.addEventListener("click", (event) => { if (event.target === modal) close(); });
  body?.addEventListener("click", (event) => {
    const treatment = event.target.closest("[data-treatment-id]");
    if (treatment) {
      const { date } = getContext();
      close();
      onApplication(treatment.dataset.treatmentId, date);
      return;
    }
    const action = event.target.closest("[data-register]")?.dataset.register;
    if (action === "application") openApplication();
    else if (action) {
      close();
      onMeasurement(action);
    }
  });
  return { open, close };
}
