/** Renderização do resumo de consistência da rotina (Fase 2). */

import { t as translate } from "../domain/i18n/index.js";
import { escapeHtml } from "./dom.js";

const esc = escapeHtml;

function text(key, params, locale) {
  return translate(`phase2.${key}`, params, locale);
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/**
 * Cria o painel descritivo de consistência para o histórico.
 * Os dados já devem vir agregados pelo domínio; nenhum dado é persistido aqui.
 */
export function renderAdherenceSummaryHTML(summary, { periodDays = 7, locale = "pt-BR" } = {}) {
  if (!summary || safeNumber(summary.scheduledDays) === 0) return "";

  const selectedPeriod = Number(periodDays) === 30 ? 30 : 7;
  const applied = safeNumber(summary.applied);
  const due = safeNumber(summary.due);
  const resolved = safeNumber(summary.resolved);
  const pending = safeNumber(summary.pending);
  const completeDays = safeNumber(summary.completeDays);
  const scheduledDays = safeNumber(summary.scheduledDays);
  const applicationPercent = Math.min(100, Math.max(0, safeNumber(summary.applicationPercent)));
  const resolutionPercent = Math.min(100, Math.max(0, safeNumber(summary.resolutionPercent)));

  return `
    <section class="adherence-summary" aria-labelledby="adherence-summary-title">
      <div class="adherence-summary-head">
        <div>
          <div class="adherence-summary-eyebrow">${esc(text("eyebrow", {}, locale))}</div>
          <h3 id="adherence-summary-title">${esc(text("title", {}, locale))}</h3>
          <p>${esc(text("periodDescription", { days: selectedPeriod }, locale))}</p>
        </div>
        <div class="adherence-period" role="group" aria-label="${esc(text("periodLabel", {}, locale))}">
          <button type="button" class="adherence-period-btn ${selectedPeriod === 7 ? "is-selected" : ""}"
            data-adherence-days="7" aria-pressed="${selectedPeriod === 7 ? "true" : "false"}">
            ${esc(text("last7", {}, locale))}
          </button>
          <button type="button" class="adherence-period-btn ${selectedPeriod === 30 ? "is-selected" : ""}"
            data-adherence-days="30" aria-pressed="${selectedPeriod === 30 ? "true" : "false"}">
            ${esc(text("last30", {}, locale))}
          </button>
        </div>
      </div>

      <div class="adherence-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${applicationPercent}" aria-label="${esc(text("applicationProgress", { percent: applicationPercent }, locale))}">
        <span style="width:${applicationPercent}%"></span>
      </div>
      <div class="adherence-progress-label">
        <strong>${esc(`${applied}/${due}`)}</strong>
        <span>${esc(text("applicationsApplied", {}, locale))}</span>
        <span>${esc(text("resolutionPercent", { percent: resolutionPercent }, locale))}</span>
      </div>

      <div class="adherence-metrics">
        <div class="adherence-metric">
          <strong>${esc(`${completeDays}/${scheduledDays}`)}</strong>
          <span>${esc(text("completeDays", {}, locale))}</span>
        </div>
        <div class="adherence-metric">
          <strong>${esc(String(pending))}</strong>
          <span>${esc(text("pending", {}, locale))}</span>
        </div>
        <div class="adherence-metric">
          <strong>${esc(String(safeNumber(summary.skipped) + safeNumber(summary.missed)))}</strong>
          <span>${esc(text("notApplied", {}, locale))}</span>
        </div>
        <div class="adherence-metric">
          <strong>${esc(String(resolved))}</strong>
          <span>${esc(text("resolved", {}, locale))}</span>
        </div>
      </div>

      <p class="adherence-disclaimer">${esc(text("disclaimer", {}, locale))}</p>
    </section>
  `;
}
