/**
 * Módulo de Interface do Dashboard
 * Responsável por gerar view models e renderizar o fluxo diário e estado vazio.
 */

import { escapeHtml, sanitizeColor, sanitizeId } from "./dom.js";
import { t as translate } from "../domain/i18n/index.js";

const esc = escapeHtml;

/**
 * Cria uma view model estruturada para o card de dose do dia.
 */
export function createDoseCardViewModel({ peptide, takenCount = 0, nextSite = null, vialStatus = null }) {
  const dueCount = Math.max(1, Number.parseInt(peptide.perDay, 10) || 1);
  const isCompleted = takenCount >= dueCount;

  return {
    id: peptide.id,
    name: peptide.name || "Composto",
    sub: peptide.sub || "",
    time: peptide.time || null,
    dose: peptide.dose || null,
    unitsUI: peptide.ui || 0,
    color: peptide.color || "var(--primary)",
    takenCount,
    dueCount,
    status: isCompleted ? "completed" : "pending",
    isCompleted,
    nextSite: nextSite || null,
    vialStatus: vialStatus || null
  };
}

function normalizeTakenCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatUpcomingSummary(item, locale) {
  if (!item) return translate("dashboard.noUpcoming", {}, locale);
  const parts = typeof item.dateKey === "string" ? item.dateKey.split("-") : [];
  const date = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.dateKey || "";
  return translate("dashboard.nextSchedule", {
    date,
    time: item.time || "--:--",
    name: item.name || translate("dashboard.genericCompound", {}, locale)
  }, locale);
}

/**
 * Define a mensagem e a ação prioritária do dashboard sem prescrever conduta.
 * Os itens representam apenas o agendamento e os registros do próprio usuário.
 */
export function createDashboardFocusViewModel({ todayItems = [], upcoming = [], locale = "pt-BR" } = {}) {
  const normalizedItems = Array.isArray(todayItems)
    ? todayItems
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const dueCount = Math.max(1, Number.parseInt(item.perDay, 10) || 1);
        const takenCount = Math.min(dueCount, normalizeTakenCount(item.takenCount));
        return { ...item, dueCount, takenCount, pendingCount: dueCount - takenCount };
      })
      .sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"))
    : [];

  const nextPending = normalizedItems.find((item) => item.pendingCount > 0);
  const nextUpcoming = Array.isArray(upcoming) ? upcoming[0] : null;

  if (nextPending) {
    return {
      state: "pending",
      eyebrow: translate("dashboard.nextAction", {}, locale),
      title: nextPending.name || translate("dashboard.genericCompound", {}, locale),
      schedule: nextPending.time
        ? translate("dashboard.scheduledTodayAt", { time: nextPending.time }, locale)
        : translate("dashboard.scheduledToday", {}, locale),
      dose: nextPending.dose || "",
      unitsUI: nextPending.ui || 0,
      nextSite: nextPending.nextSite || "",
      action: nextPending.dueCount > 1 ? "add-dose" : "toggle-dose",
      actionLabel: nextPending.dueCount > 1
        ? translate("dashboard.registerNextDose", {}, locale)
        : translate("dashboard.registerApplication", {}, locale),
      peptideId: nextPending.id || ""
    };
  }

  if (normalizedItems.length > 0) {
    return {
      state: "complete",
      eyebrow: translate("dashboard.routineCurrent", {}, locale),
      title: translate("dashboard.allRecorded", {}, locale),
      schedule: formatUpcomingSummary(nextUpcoming, locale),
      dose: "",
      unitsUI: 0,
      nextSite: "",
      action: nextUpcoming ? "open-week" : "add-peptide",
      actionLabel: nextUpcoming
        ? translate("dashboard.viewWeek", {}, locale)
        : translate("dashboard.adjustProtocol", {}, locale),
      peptideId: ""
    };
  }

  return {
    state: "clear",
    eyebrow: translate("dashboard.today", {}, locale),
    title: translate("dashboard.noScheduledToday", {}, locale),
    schedule: formatUpcomingSummary(nextUpcoming, locale),
    dose: "",
    unitsUI: 0,
    nextSite: "",
    action: nextUpcoming ? "open-week" : "add-peptide",
    actionLabel: nextUpcoming
      ? translate("dashboard.viewWeek", {}, locale)
      : translate("dashboard.adjustProtocol", {}, locale),
    peptideId: ""
  };
}

/**
 * Renderiza o conteúdo do hero. Todos os dados variáveis são escapados.
 */
export function renderDashboardFocusHTML(viewModel) {
  if (!viewModel) return "";

  const detailItems = [];
  if (viewModel.dose) detailItems.push(`<span>${esc(viewModel.dose)}</span>`);
  if (viewModel.unitsUI) detailItems.push(`<span>${esc(String(viewModel.unitsUI))} UI</span>`);
  if (viewModel.nextSite) detailItems.push(`<span class="dash-focus-site">${esc(viewModel.nextSite)}</span>`);

  const icon = viewModel.state === "complete"
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`
    : viewModel.state === "pending"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>`;

  return `
    <div class="dash-focus-eyebrow"><span aria-hidden="true"></span>${esc(viewModel.eyebrow)}</div>
    <h3 class="dash-focus-title">${esc(viewModel.title)}</h3>
    <p class="dash-focus-schedule">${esc(viewModel.schedule)}</p>
    ${detailItems.length > 0 ? `<div class="dash-focus-details">${detailItems.join("")}</div>` : ""}
    <button type="button" class="dash-focus-action" id="dash-focus-action"
      data-action="${esc(viewModel.action)}" data-peptide-id="${sanitizeId(viewModel.peptideId)}">
      ${icon}<span>${esc(viewModel.actionLabel)}</span>
    </button>
  `;
}

/**
 * Renderiza o HTML do estado vazio do Dashboard (sem 0% ou 0/0).
 */
export function renderEmptyDashboardHTML() {
  return `
    <div class="dash-empty-card" id="dash-empty-state">
      <div class="dash-empty-icon" aria-hidden="true">🌱</div>
      <h3 class="dash-empty-title">Seu protocolo começa aqui</h3>
      <p class="dash-empty-desc">
        Cadastre os compostos da sua rotina para acompanhar horários, doses e rotação de aplicação de forma 100% privada e local.
      </p>
      <div class="dash-empty-actions">
        <button type="button" class="btn-primary" id="empty-add-pep-btn" data-action="create-protocol">
          + Criar meu protocolo
        </button>
        <button type="button" class="btn-secondary" id="empty-calc-btn" data-action="open-calc">
          Abrir calculadora
        </button>
      </div>
      <div class="dash-empty-privacy">
        🔒 Dados salvos exclusivamente neste aparelho
      </div>
    </div>
  `;
}

/**
 * Renderiza os cards das próximas ocorrências programadas.
 */
export function renderUpcomingHTML(upcomingList = []) {
  if (!Array.isArray(upcomingList) || upcomingList.length === 0) {
    return "";
  }

  const itemsHTML = upcomingList.map((item) => {
    const parts = item.dateKey.split("-");
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.dateKey;
    const accentColor = sanitizeColor(item.color);

    return `
      <div class="upcoming-item" style="border-left: 3px solid ${accentColor};">
        <div class="upcoming-date">${esc(formattedDate)}</div>
        <div class="upcoming-info">
          <div class="upcoming-name">${esc(item.name)}</div>
          <div class="upcoming-meta">${esc(item.time)}${item.dose ? ` · ${esc(item.dose)}` : ""}</div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="upcoming-section" aria-label="Próximas aplicações programadas">
      <div class="section-title-wrap" style="margin-top: 20px; margin-bottom: 10px;">
        <h3 class="section-title">Próximos</h3>
      </div>
      <div class="upcoming-list">
        ${itemsHTML}
      </div>
    </section>
  `;
}
