/**
 * Módulo de Interface do Dashboard
 * Responsável por gerar view models e renderizar o fluxo diário e estado vazio.
 */

import { escapeHtml, sanitizeColor, sanitizeId } from "./dom.js";

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
