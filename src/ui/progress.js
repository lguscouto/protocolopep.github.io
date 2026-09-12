import { escapeHtml } from "./dom.js";
import { i18nService } from "../services/i18n.js";

const signed = (value, suffix = "") => value === null ? "—" : `${value > 0 ? "+" : ""}${value}${suffix}`;

export function renderProgressOverviewHTML(model) {
  const weight = model.weightCount
    ? `<section class="progress-summary"><span>${escapeHtml(i18nService.t("experience.yourProgress"))}</span><strong>${escapeHtml(String(model.firstWeight))} kg → ${escapeHtml(String(model.latestWeight))} kg</strong><div><b>${signed(model.absoluteChangeKg, " kg")}</b><b>${signed(model.percentChange, "%")}</b></div></section>`
    : `<section class="progress-empty"><strong>${escapeHtml(i18nService.t("experience.trackEvolution"))}</strong><p>${escapeHtml(i18nService.t("experience.weightEmpty"))}</p><button type="button" class="btn-primary" data-progress-register="weight">${escapeHtml(i18nService.t("experience.recordWeight"))}</button></section>`;
  const doses = model.doseContexts.length ? `<section class="progress-context"><h3>${escapeHtml(i18nService.t("experience.currentDoses"))}</h3>${model.doseContexts.map((item) => `<div><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.dose)}</small></span><span>${escapeHtml(i18nService.t("experience.recordsInConfiguration", { count: item.matchingRecords }))}</span></div>`).join("")}</section>` : "";
  const symptoms = model.symptomFrequency.length ? `<section class="progress-context"><h3>${escapeHtml(i18nService.t("experience.symptomsRecorded"))}</h3>${model.symptomFrequency.slice(0, 3).map(([name, count]) => `<div><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`).join("")}<details><summary>${escapeHtml(i18nService.t("experience.viewAll"))}</summary>${model.symptomFrequency.map(([name, count]) => `<p>${escapeHtml(name)} · ${count}</p>`).join("")}</details></section>` : "";
  const details = doses || symptoms ? `<details class="progress-details"><summary>${escapeHtml(i18nService.t("experience.viewMoreDetails"))}</summary>${doses}${symptoms}</details>` : "";
  return weight + details;
}
