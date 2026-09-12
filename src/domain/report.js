/**
 * Módulo de Geração e Estruturação de Relatórios de Doses (V08)
 */

import { doseStatus, summarizeDoseEntries } from "./dose-state.js";
import { calculateAdherenceSummary } from "./adherence.js";
import { calculateMeasurementStats, filterMeasurements, normalizeSymptomDetails } from "./measurements.js";
import { normalizeProtocolRevisions } from "./protocol-history.js";
import { getDoseDisplayData } from "./dose-display.js";
import { normalizeSyringeMaxUI } from "./syringe.js";
export { getDoseDisplayData } from "./dose-display.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const textValue = (value) => hasValue(value) ? String(value) : "";
const STATUS_LABELS = Object.freeze({ applied: "Aplicada", skipped: "Pulada", missed: "Esquecida" });

export function summarizeReportEntries(entries = []) {
  const { applied, skipped, missed } = summarizeDoseEntries(entries, 0);
  return { total: entries.length, applied, skipped, missed, unknown: entries.length - applied - skipped - missed };
}

export function getReportVialLabel(entry) {
  return [
    entry.vialId,
    entry.vialLot ? `Lote ${entry.vialLot}` : "",
    hasValue(entry.vialConcentrationMcgPerMl) ? `${entry.vialConcentrationMcgPerMl} mcg/mL` : ""
  ].filter(Boolean).join(" · ");
}

export function buildReportData({
  protocol = [],
  logs = {},
  startDate = null,
  endDate = null,
  includeNotes = false
}) {
  const pepMap = Object.create(null);
  if (Array.isArray(protocol)) {
    protocol.forEach((p) => {
      if (p && p.id) {
        pepMap[p.id] = p;
      }
    });
  }

  const entries = [];

  Object.entries(logs || {}).forEach(([dateStr, pepLogs]) => {
    if (startDate && dateStr < startDate) return;
    if (endDate && dateStr > endDate) return;

    Object.entries(pepLogs || {}).forEach(([pepId, val]) => {
      const pInfo = pepMap[pepId];
      const rawList = Array.isArray(val) ? val : (val ? [val] : []);

      rawList.forEach((entry, recordIndex) => {
        if (!entry || (typeof entry !== "string" && typeof entry !== "object")) return;
        const display = getDoseDisplayData(entry, pInfo);
        let time = "";
        let retroactive = false;
        let note = "";
        let statusReason = "";
        let site = "";

        if (typeof entry === "string") {
          time = entry;
        } else if (entry && typeof entry === "object") {
          time = entry.time || "";
          if (entry.retroactive) retroactive = true;
          if (entry.note) note = entry.note;
          statusReason = textValue(entry.statusReason);
          site = textValue(entry.site);
        }

        const status = doseStatus(entry);

        entries.push({
          id: typeof entry === "object" ? textValue(entry.id) : `${dateStr}_${pepId}_${recordIndex}`,
          recordIndex,
          date: dateStr,
          time: time || "--:--",
          effectiveTime: time || "--:--",
          scheduledTime: textValue(entry?.scheduledTime)
            || textValue(entry?.protocolSnapshot?.time)
            || (Array.isArray(entry?.protocolSnapshot?.times) ? textValue(entry.protocolSnapshot.times[0]) : ""),
          peptideId: pepId,
          peptideName: display.name,
          peptideSub: display.sub,
          dose: hasValue(display.dose) ? display.dose : "--",
          ui: display.ui,
          status,
          statusLabel: STATUS_LABELS[status] || "Não identificado",
          statusReason: includeNotes ? statusReason : "",
          site,
          vialId: display.vialId,
          vialLot: textValue(display.vial?.lotNumber),
          vialConcentrationMcgPerMl: display.vial?.concentrationMcgPerMl ?? null,
          historyIntegrity: display.historyIntegrity,
          revisionId: display.revisionId,
          syringeMaxUI: display.calculationSnapshot ? normalizeSyringeMaxUI(display.calculationSnapshot.syringeMaxUI) : null,
          retroactive: Boolean(retroactive),
          type: retroactive ? "Retroativo" : "Regular",
          note: includeNotes ? (note || "") : ""
        });
      });
    });
  });

  // Ordenar cronologicamente decrescente (mais recente primeiro)
  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time || "").localeCompare(a.time || "");
  });

  return entries;
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatReportDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(value || "");
}

function getReportDateBounds(entries = [], measurements = []) {
  const dates = [
    ...(Array.isArray(entries) ? entries : []).map((entry) => entry?.date),
    ...(Array.isArray(measurements) ? measurements : []).map((entry) => entry?.date)
  ].filter(isDateKey).sort();

  return dates.length > 0
    ? { startDate: dates[0], endDate: dates[dates.length - 1] }
    : { startDate: null, endDate: null };
}

function sanitizeMeasurementForReport(entry, includeNotes = false) {
  const measurement = entry && typeof entry === "object" ? entry : {};
  return {
    date: isDateKey(measurement.date) ? measurement.date : "",
    time: textValue(measurement.time),
    weightKg: typeof measurement.weightKg === "number" && Number.isFinite(measurement.weightKg)
      ? measurement.weightKg
      : null,
    circumferencesCm: {
      abdomen: Number.isFinite(measurement.circumferencesCm?.abdomen) ? measurement.circumferencesCm.abdomen : null,
      waist: Number.isFinite(measurement.circumferencesCm?.waist) ? measurement.circumferencesCm.waist : null,
      hips: Number.isFinite(measurement.circumferencesCm?.hips) ? measurement.circumferencesCm.hips : null
    },
    energyLevel: Number.isInteger(measurement.energyLevel) ? measurement.energyLevel : null,
    moodLevel: Number.isInteger(measurement.moodLevel) ? measurement.moodLevel : null,
    symptoms: Array.isArray(measurement.symptoms)
      ? measurement.symptoms.map(textValue).filter(Boolean)
      : [],
    symptomDetails: normalizeSymptomDetails(measurement.symptoms, measurement.symptomDetails),
    notes: includeNotes ? textValue(measurement.notes) : "",
    source: measurement.source === "health_connect" ? "Health Connect" : "Local"
    ,ownership: measurement.ownership === "external" ? "external" : "pep"
    ,id: textValue(measurement.id)
  };
}

const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function revisionLocalParts(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` };
}

/** Modelo canônico compartilhado pela tela, prévia, CSVs e PDF. */
export function buildReviewModel({
  protocol = [], logs = {}, measurements = [], startDate = null, endDate = null,
  compoundId = "all", eventType = "all", query = "", includeNotes = true
} = {}) {
  const applications = buildReportData({ protocol, logs, startDate, endDate, includeNotes })
    .filter((entry) => compoundId === "all" || entry.peptideId === compoundId);
  const measurementRecords = filterMeasurements(measurements, { startDate, endDate })
    .map((entry) => sanitizeMeasurementForReport(entry, includeNotes));
  const revisions = [];
  (Array.isArray(protocol) ? protocol : []).forEach((item) => {
    if (!item?.id || (compoundId !== "all" && item.id !== compoundId)) return;
    normalizeProtocolRevisions(item.revisions).filter((revision) => !revision.legacy).forEach((revision) => {
      const parts = revisionLocalParts(revision.effectiveFrom);
      if ((startDate && parts.date < startDate) || (endDate && parts.date > endDate)) return;
      revisions.push({
        id: revision.id, date: parts.date, time: parts.time, peptideId: item.id,
        peptideName: revision.config.name || item.name || "Protocolo sem identificação",
        status: revision.status, statusLabel: revision.status === "ended" ? "Encerrado" : revision.status === "paused" ? "Pausado" : "Ativo",
        effectiveFrom: revision.effectiveFrom, config: revision.config
      });
    });
  });

  const events = [];
  applications.forEach((entry) => events.push({
    id: `application_${entry.id || `${entry.date}_${entry.peptideId}_${entry.recordIndex}`}`,
    type: "application", date: entry.date, time: entry.effectiveTime, title: entry.peptideName,
    subtitle: `${entry.statusLabel} · ${entry.dose}${entry.ui !== null ? ` · ${entry.ui} UI` : ""}`,
    notes: [entry.note, entry.statusReason].filter(Boolean).join(" · "), compoundId: entry.peptideId,
    scheduledTime: entry.scheduledTime, effectiveTime: entry.effectiveTime, retroactive: entry.retroactive,
    editableId: entry.id, recordIndex: entry.recordIndex, data: entry
  }));
  measurementRecords.forEach((entry) => {
    const measures = [entry.weightKg !== null ? `${entry.weightKg} kg` : "", entry.circumferencesCm.abdomen !== null ? `Abdômen ${entry.circumferencesCm.abdomen} cm` : "", entry.circumferencesCm.waist !== null ? `Cintura ${entry.circumferencesCm.waist} cm` : "", entry.circumferencesCm.hips !== null ? `Quadril ${entry.circumferencesCm.hips} cm` : "", entry.energyLevel ? `Energia ${entry.energyLevel}/5` : "", entry.moodLevel ? `Humor ${entry.moodLevel}/5` : ""].filter(Boolean);
    if (measures.length) events.push({ id: `measurement_${entry.id}`, type: "measurement", date: entry.date, time: entry.time, title: "Medição autorrelatada", subtitle: measures.join(" · "), notes: entry.notes, contextGeneral: compoundId !== "all", editableId: entry.id, data: entry });
    if (entry.symptomDetails.length) events.push({ id: `symptom_${entry.id}`, type: "symptom", date: entry.date, time: entry.time, title: "Sintomas autorrelatados", subtitle: entry.symptomDetails.map((item) => `${item.name}${item.intensity ? ` (${item.intensity})` : ""}`).join(" · "), notes: entry.notes, contextGeneral: compoundId !== "all", editableId: entry.id, data: entry });
  });
  revisions.forEach((entry) => events.push({ id: `protocol_${entry.id}`, type: "protocol", date: entry.date, time: entry.time, title: entry.peptideName, subtitle: `Protocolo ${entry.statusLabel.toLocaleLowerCase("pt-BR")}`, notes: "", compoundId: entry.peptideId, data: entry }));

  const needle = normalizeSearch(query);
  const filteredEvents = events.filter((event) => {
    if (eventType !== "all" && event.type !== eventType) return false;
    return !needle || normalizeSearch([event.title, event.subtitle, event.notes].join(" ")).includes(needle);
  }).sort((a, b) => `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`));
  const stats = calculateMeasurementStats(measurementRecords);
  const observationDates = [...new Set(measurementRecords.filter((entry) => entry.notes || entry.symptoms.length).map((entry) => entry.date))].sort();
  const bounds = getReportDateBounds(applications, measurementRecords);
  const rangeStart = startDate || bounds.startDate;
  const rangeEnd = endDate || bounds.endDate;
  return {
    startDate: rangeStart, endDate: rangeEnd, compoundId, eventType, query,
    events: filteredEvents, applications, measurements: measurementRecords, revisions,
    adherence: rangeStart && rangeEnd ? calculateAdherenceSummary(protocol, logs, { startDate: rangeStart, endDate: rangeEnd }) : null,
    measurementStats: stats,
    observations: { count: observationDates.length, dates: observationDates },
    summary: { ...summarizeReportEntries(applications), revisions: revisions.length, measurements: measurementRecords.length, symptoms: measurementRecords.filter((entry) => entry.symptoms.length).length }
  };
}

/**
 * Monta um relatório pessoal com aplicações, consistência da rotina e, quando
 * solicitado, medições autorrelatadas. As métricas são descritivas e não
 * estabelecem correlação clínica entre os conjuntos de dados.
 */
export function buildPersonalReport({
  protocol = [],
  logs = {},
  measurements = [],
  startDate = null,
  endDate = null,
  includeNotes = false,
  includeMeasurements = false
} = {}) {
  const model = buildReviewModel({ protocol, logs, measurements, startDate, endDate, includeNotes });
  const reportMeasurements = model.measurements.map(({ id: _internalId, ...entry }) => entry);
  return {
    ...model,
    entries: model.applications,
    measurements: includeMeasurements ? reportMeasurements : [],
    measurementCount: model.measurements.length,
    measurementStats: includeMeasurements ? model.measurementStats : null
  };
}

export function escapeHTML(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Formula Injection prevention: se iniciar por =, +, -, @ ou \t, prefixa com '
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateReportCSV(entries = []) {
  // UTF-8 BOM para compatibilidade com Microsoft Excel e planilhas em PT-BR
  const BOM = "\uFEFF";
  const headers = ["Data", "Hora", "Peptídeo", "Subtítulo", "Dose", "UI", "Seringa (UI)", "Tipo", "Observações",
    "Estado", "Motivo", "Local", "Frasco", "Lote", "Concentração do frasco (mcg/mL)", "Integridade histórica", "Revisão"];
  const headerLine = headers.map(escapeCSV).join(";");

  const lines = entries.map((e) => {
    const [y, m, d] = (e.date || "").split("-");
    const formattedDate = d && m && y ? `${d}/${m}/${y}` : e.date;
    return [
      formattedDate,
      e.time,
      e.peptideName,
      e.peptideSub,
      e.dose,
      e.ui,
      e.syringeMaxUI,
      e.type,
      e.note,
      e.statusLabel || STATUS_LABELS[doseStatus(e)] || "Não identificado",
      e.statusReason,
      e.site,
      e.vialId,
      e.vialLot,
      e.vialConcentrationMcgPerMl,
      e.historyIntegrity === "captured" ? "Dados preservados no registro" : "Legado: dados históricos incompletos",
      e.revisionId
    ].map(escapeCSV).join(";");
  });

  return BOM + [headerLine, ...lines].join("\r\n");
}

export function generateMeasurementsCSV(measurements = []) {
  const headers = ["Data", "Hora", "Peso (kg)", "Energia (1-5)", "Humor (1-5)", "Sintomas", "Intensidades", "Observações", "Origem", "Propriedade"];
  const lines = measurements.map((entry) => [
    formatReportDate(entry.date), entry.time, entry.weightKg, entry.energyLevel, entry.moodLevel,
    (entry.symptoms || []).join(" · "),
    (entry.symptomDetails || []).map((item) => `${item.name}: ${item.intensity || "não informada"}`).join(" · "),
    entry.notes, entry.source, entry.ownership === "external" ? "Externa" : "PEP"
  ].map(escapeCSV).join(";"));
  return "\uFEFF" + [headers.map(escapeCSV).join(";"), ...lines].join("\r\n");
}

function getReportEntryCSVRow(e) {
  return [
    formatReportDate(e.date),
    e.time,
    e.peptideName,
    e.peptideSub,
    e.dose,
    e.ui,
    e.syringeMaxUI,
    e.type,
    e.note,
    e.statusLabel || STATUS_LABELS[doseStatus(e)] || "Não identificado",
    e.statusReason,
    e.site,
    e.vialId,
    e.vialLot,
    e.vialConcentrationMcgPerMl,
    e.historyIntegrity === "captured" ? "Dados preservados no registro" : "Legado: dados históricos incompletos",
    e.revisionId
  ];
}

/**
 * Gera um CSV em seções para o relatório pessoal completo. A função de CSV
 * histórico acima permanece estável para integrações que esperam somente
 * linhas de aplicações.
 */
export function generatePersonalReportCSV({
  entries = [],
  adherence = null,
  measurements = [],
  measurementStats = null,
  startDate = null,
  endDate = null
} = {}) {
  const lines = [];
  const addRow = (values) => lines.push(values.map(escapeCSV).join(";"));

  addRow(["Seção", "Campo", "Valor"]);
  if (adherence) {
    addRow(["Resumo", "Período", startDate && endDate
      ? `${formatReportDate(startDate)} até ${formatReportDate(endDate)}`
      : "Todo o histórico"]);
    [
      ["Dias programados", adherence.scheduledDays],
      ["Aplicações previstas", adherence.due],
      ["Aplicações confirmadas", adherence.applied],
      ["Registros resolvidos", adherence.resolved],
      ["Pendentes", adherence.pending],
      ["Puladas", adherence.skipped],
      ["Esquecidas", adherence.missed],
      ["Aplicações extras", adherence.extraApplied],
      ["Aplicações registradas (%)", adherence.applicationPercent],
      ["Rotina resolvida (%)", adherence.resolutionPercent],
      ["Dias completos", adherence.completeDays],
      ["Dias parciais", adherence.partialDays]
    ].forEach(([label, value]) => addRow(["Resumo", label, value]));
  }

  if (measurementStats) {
    addRow(["Medições", "Registros incluídos", measurementStats.totalEntries]);
    addRow(["Medições", "Último peso (kg)", measurementStats.latestWeight]);
    addRow(["Medições", "Variação de peso (kg)", measurementStats.weightDelta]);
    addRow(["Medições", "Energia média (1–5)", measurementStats.averageEnergy]);
    addRow(["Medições", "Humor médio (1–5)", measurementStats.averageMood]);
    Object.entries({ abdomen: "Abdômen", waist: "Cintura", hips: "Quadril" }).forEach(([key, label]) => {
      const metric = measurementStats.bodyMetrics?.[key];
      if (!metric?.count) return;
      addRow(["Medições", `Última medida de ${label.toLocaleLowerCase("pt-BR")} (cm)`, metric.latest]);
      addRow(["Medições", `Variação de ${label.toLocaleLowerCase("pt-BR")} (cm)`, metric.delta]);
    });
  }

  addRow([]);
  const doseHeaders = ["Data", "Hora", "Peptídeo", "Subtítulo", "Dose", "UI", "Seringa (UI)", "Tipo", "Observações",
    "Estado", "Motivo", "Local", "Frasco", "Lote", "Concentração do frasco (mcg/mL)", "Integridade histórica", "Revisão"];
  addRow(["Aplicações", ...doseHeaders]);
  entries.forEach((entry) => addRow(["Aplicações", ...getReportEntryCSVRow(entry)]));

  if (measurements.length > 0) {
    addRow([]);
    addRow(["Medições autorrelatadas", "Data", "Hora", "Peso (kg)", "Abdômen (cm)", "Cintura (cm)", "Quadril (cm)", "Energia (1–5)", "Humor (1–5)", "Sintomas", "Observações", "Origem"]);
    measurements.forEach((measurement) => addRow([
      "Medições autorrelatadas",
      formatReportDate(measurement.date),
      measurement.time,
      measurement.weightKg,
      measurement.circumferencesCm?.abdomen,
      measurement.circumferencesCm?.waist,
      measurement.circumferencesCm?.hips,
      measurement.energyLevel,
      measurement.moodLevel,
      Array.isArray(measurement.symptoms) ? measurement.symptoms.join(" · ") : "",
      measurement.notes,
      measurement.source
    ]));
  }

  addRow([]);
  addRow(["Aviso", "Uso", "Registro pessoal autorrelatado; não substitui prontuário, receita ou avaliação clínica e não estabelece correlação entre aplicações e medições."]);
  return "\uFEFF" + lines.join("\r\n");
}

export function generateReportHTML(entries = [], {
  startDate,
  endDate,
  generatedAt = new Date(),
  adherenceSummary = null,
  measurements = [],
  includeMeasurements = false,
  measurementStats = null,
  revisions = []
} = {}) {
  const dStr = escapeHTML(generatedAt.toLocaleDateString("pt-BR"));
  const tStr = escapeHTML(generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  
  let periodText = "Todo o Histórico";
  if (startDate && endDate) {
    periodText = `${startDate.split("-").reverse().join("/")} até ${endDate.split("-").reverse().join("/")}`;
  } else if (startDate) {
    periodText = `A partir de ${startDate.split("-").reverse().join("/")}`;
  } else if (endDate) {
    periodText = `Até ${endDate.split("-").reverse().join("/")}`;
  }
  const safePeriodText = escapeHTML(periodText);
  const summary = summarizeReportEntries(entries);

  const rows = entries.map((e) => {
    const [y, m, d] = (e.date || "").split("-");
    const dateFmt = d && m && y ? `${d}/${m}/${y}` : e.date;
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:600;">${escapeHTML(dateFmt)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">${escapeHTML(e.time)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-weight:700;">${escapeHTML(e.peptideName)}${e.historyIntegrity !== "captured" ? '<div style="font-size:10px;font-weight:400;">Legado: dados históricos incompletos</div>' : ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">${escapeHTML(e.dose)}${e.administrationQuantity !== null && e.administrationQuantity !== undefined ? ` · ${escapeHTML(e.administrationQuantity)} ${escapeHTML(e.administrationUnit || "")}` : ""}${e.ui !== null && e.ui !== undefined ? ` (${escapeHTML(e.ui)} UI)` : (e.administrationQuantity === null || e.administrationQuantity === undefined ? " (-- UI)" : "")}${e.syringeMaxUI !== null && e.syringeMaxUI !== undefined ? `<br><span style="font-size:11px;color:#64748B;">Seringa: ${escapeHTML(e.syringeMaxUI)} UI</span>` : ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">${escapeHTML(e.statusLabel || STATUS_LABELS[doseStatus(e)] || "Não identificado")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:${e.retroactive ? "#FEF3C7;color:#92400E" : "#E6FFFA;color:#047857"}">${escapeHTML(e.type)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:12px;">${escapeHTML(e.site || "--")}<br>${escapeHTML(getReportVialLabel(e) || "Frasco não informado")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;">${escapeHTML(e.note || "--")}${e.statusReason ? `<br>Motivo: ${escapeHTML(e.statusReason)}` : ""}</td>
      </tr>
    `;
  }).join("");

  const adherenceSection = adherenceSummary ? `
  <section class="personal-summary" aria-labelledby="personal-summary-title">
    <h2 id="personal-summary-title">Resumo descritivo da rotina</h2>
    <div class="personal-summary-grid">
      <div><span>Aplicações previstas</span><b>${escapeHTML(adherenceSummary.due)}</b></div>
      <div><span>Aplicações confirmadas</span><b>${escapeHTML(adherenceSummary.applied)}</b></div>
      <div><span>Rotina resolvida</span><b>${escapeHTML(adherenceSummary.resolutionPercent)}%</b></div>
      <div><span>Dias completos</span><b>${escapeHTML(adherenceSummary.completeDays)}</b></div>
      <div><span>Pendentes</span><b>${escapeHTML(adherenceSummary.pending)}</b></div>
      <div><span>Aplicações extras</span><b>${escapeHTML(adherenceSummary.extraApplied)}</b></div>
    </div>
    <p class="personal-summary-note">Este resumo descreve os registros no período e não avalia eficácia, segurança ou necessidade de ajuste.</p>
  </section>` : "";

  const measurementRows = Array.isArray(measurements) ? measurements.map((measurement) => `
      <tr>
        <td>${escapeHTML(formatReportDate(measurement.date))}</td>
        <td>${escapeHTML(measurement.time || "--:--")}</td>
        <td>${escapeHTML(measurement.weightKg ?? "--")}</td>
        <td>${escapeHTML([["Abdômen", measurement.circumferencesCm?.abdomen], ["Cintura", measurement.circumferencesCm?.waist], ["Quadril", measurement.circumferencesCm?.hips]].filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => `${label}: ${value}`).join(" · ") || "--")}</td>
        <td>${escapeHTML(measurement.energyLevel ?? "--")}</td>
        <td>${escapeHTML(measurement.moodLevel ?? "--")}</td>
        <td>${escapeHTML(Array.isArray(measurement.symptomDetails) && measurement.symptomDetails.length > 0 ? measurement.symptomDetails.map((item) => `${item.name}${item.intensity ? ` (${item.intensity})` : ""}`).join(" · ") : "--")}</td>
        <td>${escapeHTML(measurement.notes || "--")}</td>
        <td>${escapeHTML(measurement.source || "Local")}</td>
      </tr>
    `).join("") : "";
  const measurementsSection = includeMeasurements ? `
  <section class="measurements-section" aria-labelledby="measurements-title">
    <h2 id="measurements-title">Medições autorrelatadas</h2>
    ${measurementStats ? `<div class="stats">
      <div class="stats-item">Registros incluídos: <b>${escapeHTML(measurementStats.totalEntries)}</b></div>
      ${measurementStats.latestWeight !== null ? `<div class="stats-item">Último peso: <b>${escapeHTML(measurementStats.latestWeight)} kg</b></div>` : ""}
      ${measurementStats.weightDelta !== null ? `<div class="stats-item">Variação no período: <b>${escapeHTML(measurementStats.weightDelta)} kg</b></div>` : ""}
      ${Object.entries({ abdomen: "Abdômen", waist: "Cintura", hips: "Quadril" }).map(([key, label]) => measurementStats.bodyMetrics?.[key]?.count ? `<div class="stats-item">Último ${label.toLocaleLowerCase("pt-BR")}: <b>${escapeHTML(measurementStats.bodyMetrics[key].latest)} cm</b></div>` : "").join("")}
      ${measurementStats.averageEnergy !== null ? `<div class="stats-item">Energia média: <b>${escapeHTML(measurementStats.averageEnergy)} / 5</b></div>` : ""}
      ${measurementStats.averageMood !== null ? `<div class="stats-item">Humor médio: <b>${escapeHTML(measurementStats.averageMood)} / 5</b></div>` : ""}
    </div>` : ""}
    <table>
      <thead><tr><th>Data</th><th>Hora</th><th>Peso (kg)</th><th>Circunferências (cm)</th><th>Energia</th><th>Humor</th><th>Sintomas</th><th>Observações</th><th>Origem</th></tr></thead>
      <tbody>${measurementRows || '<tr><td colspan="9" style="padding:16px;text-align:center;color:#64748B;">Nenhuma medição encontrada para o período selecionado.</td></tr>'}</tbody>
    </table>
    <p class="personal-summary-note">As medições são autorrelatadas e apresentadas sem correlação clínica com as aplicações.</p>
  </section>` : "";

  const revisionsSection = `<section class="protocol-section"><h2>Revisões de protocolo</h2><table><thead><tr><th>Vigência</th><th>Composto</th><th>Estado</th><th>Configuração registrada</th></tr></thead><tbody>${(revisions || []).map((revision) => `<tr><td>${escapeHTML(formatReportDate(revision.date))} ${escapeHTML(revision.time)}</td><td>${escapeHTML(revision.peptideName)}</td><td>${escapeHTML(revision.statusLabel)}</td><td>${escapeHTML([revision.config?.dose, revision.config?.ui !== undefined ? `${revision.config.ui} UI` : "", revision.config?.per].filter(Boolean).join(" · ") || "Sem dose informada")}</td></tr>`).join("") || '<tr><td colspan="4">Nenhuma revisão no período.</td></tr>'}</tbody></table></section>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Protocolo PEP — Relatório de Aplicações</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #0F172A; background: #FFF; font-size: 13px; line-height: 1.5; }
    .header { border-bottom: 2px solid #0E8580; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 800; color: #0E8580; margin: 0; }
    .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .stats { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; background: #F8FAFC; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2E8F0; }
    .stats-item { font-size: 12px; }
    .stats-item b { color: #0E8580; font-size: 14px; }
    .personal-summary, .measurements-section, .protocol-section { margin: 16px 0 20px; }
    .personal-summary h2, .measurements-section h2, .protocol-section h2 { font-size: 15px; color: #0E8580; margin: 0 0 8px; }
    .personal-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; background: #F8FAFC; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 8px; }
    .personal-summary-grid div { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #64748B; }
    .personal-summary-grid b { color: #0F172A; font-size: 14px; }
    .personal-summary-note { color: #64748B; font-size: 11px; line-height: 1.4; margin: 8px 0 0; }
    table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px; }
    thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; }
    th { background: #F1F5F9; padding: 8px 10px; border-bottom: 2px solid #CBD5E1; font-weight: 700; font-size: 12px; color: #475569; }
    .disclaimer { font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; margin-top: 20px; line-height: 1.4; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Protocolo PEP — Relatório de Aplicações</h1>
      <div class="meta">Período: <b>${safePeriodText}</b> · Emitido em: <b>${dStr} às ${tStr}</b></div>
    </div>
  </div>

  <div class="stats">
    <div class="stats-item">Total de Aplicações: <b>${summary.applied}</b></div>
    <div class="stats-item">Puladas: <b>${summary.skipped}</b></div>
    <div class="stats-item">Esquecidas: <b>${summary.missed}</b></div>
    <div class="stats-item">Total de Registros: <b>${summary.total}</b></div>
    ${summary.unknown ? `<div class="stats-item">Estado não identificado: <b>${summary.unknown}</b></div>` : ""}
  </div>

  ${adherenceSection}

  ${revisionsSection}

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Hora</th>
        <th>Peptídeo</th>
        <th>Dose</th>
        <th>Estado</th>
        <th>Tipo</th>
        <th>Local / Frasco</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="padding:16px;text-align:center;color:#64748B;">Nenhum registro de aplicação encontrado para o período selecionado.</td></tr>'}
    </tbody>
  </table>

  ${measurementsSection}

  <div class="disclaimer">
    ⚠️ <b>Registro Pessoal Autorrelatado:</b> Este documento é um registro individual gerado localmente pelo usuário do aplicativo Protocolo PEP. Não substitui prontuário médico, receita nem avaliação clínica.
  </div>
</body>
</html>`;
}
