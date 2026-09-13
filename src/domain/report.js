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

const DEFAULT_REPORT_LABELS = Object.freeze({
  statusApplied: "Aplicada", statusSkipped: "Pulada", statusMissed: "Esquecida", statusUnknown: "Não identificado", statusEnded: "Encerrado", statusPaused: "Pausado", statusActive: "Ativo",
  typeRetroactive: "Retroativo", typeRegular: "Regular", historyCaptured: "Dados preservados no registro", historyLegacy: "Legado: dados históricos incompletos",
  notInformed: "não informada", localSource: "Local", external: "Externa", pep: "PEP", noValue: "--", noDose: "Sem dose informada", vialNotInformed: "Frasco não informado",
  date: "Data", time: "Hora", compound: "Peptídeo", subtitle: "Subtítulo", dose: "Dose", syringe: "Seringa (UI)", type: "Tipo", notes: "Observações", status: "Estado", reason: "Motivo", site: "Local", vial: "Frasco", lot: "Lote", vialConcentration: "Concentração do frasco (mcg/mL)", historyIntegrity: "Integridade histórica", revision: "Revisão", ownership: "Propriedade", origin: "Origem", energy: "Energia", mood: "Humor", applications: "Aplicações", measurements: "Medições", reportedMeasurements: "Medições autorrelatadas", section: "Seção", field: "Campo", value: "Valor", summary: "Resumo", period: "Período", allHistoryShort: "Todo o histórico", warning: "Aviso", use: "Uso", noMeasurements: "Nenhuma medição encontrada para o período selecionado.", noApplications: "Nenhum registro de aplicação encontrado para o período selecionado.", noRevisions: "Nenhuma revisão no período.", protocolRevisions: "Revisões de protocolo", effectiveFrom: "Vigência", registeredConfiguration: "Configuração registrada", applicationsReportTitle: "Protocolo PEP — Relatório de Aplicações", issuedAt: "Emitido em", totalApplications: "Total de Aplicações", totalRecords: "Total de Registros", unknownState: "Estado não identificado", descriptiveSummary: "Resumo descritivo da rotina", descriptiveSummaryNote: "Este resumo descreve os registros no período e não avalia eficácia, segurança ou necessidade de ajuste.", measurementsTitle: "Medições autorrelatadas", circumferences: "Circunferências (cm)", latestWeight: "Último peso", weightDelta: "Variação no período", includedRecords: "Registros incluídos", averageEnergy: "Energia média", averageMood: "Humor médio", selfReportedWarning: "As medições são autorrelatadas e apresentadas sem correlação clínica com as aplicações.", metricAbdomen: "Abdômen", metricWaist: "Cintura", metricHips: "Quadril", protocolPrefix: "Protocolo", measurementEventTitle: "Medição autorrelatada", symptomEventTitle: "Sintomas autorrelatados", from: "A partir de", until: "Até", applicationPercent: "Aplicações registradas (%)", resolutionPercent: "Rotina resolvida (%)", pending: "Pendentes", completeDays: "Dias completos", extraApplications: "Aplicações extras", expectedApplications: "Aplicações previstas", confirmedApplications: "Aplicações confirmadas", resolvedRecords: "Registros resolvidos", scheduledDays: "Dias programados", skipped: "Puladas", missed: "Esquecidas", metricDelta: "Variação de {metric} (cm)", latestMetric: "Última medida de {metric} (cm)", syringeShort: "Seringa: {value} UI", disclaimer: "Registro Pessoal Autorrelatado: Este documento é um registro individual gerado localmente pelo usuário do aplicativo Protocolo PEP. Não substitui prontuário médico, receita nem avaliação clínica."
});

const REPORT_LOCALE_FALLBACKS = Object.freeze({
  en: Object.freeze({ statusEnded: "Ended", statusPaused: "Paused", statusActive: "Active", metricAbdomen: "Abdomen", metricWaist: "Waist", metricHips: "Hips", protocolPrefix: "Protocol", measurementEventTitle: "Self-reported measurement", symptomEventTitle: "Self-reported symptoms", from: "From", until: "Until" }),
  es: Object.freeze({ statusEnded: "Finalizado", statusPaused: "Pausado", statusActive: "Activo", metricAbdomen: "Abdomen", metricWaist: "Cintura", metricHips: "Caderas", protocolPrefix: "Protocolo", measurementEventTitle: "Medición autorreportada", symptomEventTitle: "Síntomas autorreportados", from: "Desde", until: "Hasta" })
});

function createReportTranslator({ locale = "pt-BR", t } = {}) {
  const translate = typeof t === "function" ? t : null;
  return (key, fallback = DEFAULT_REPORT_LABELS[key] || REPORT_LOCALE_FALLBACKS[locale]?.[key], params = {}) => {
    const localizedFallback = REPORT_LOCALE_FALLBACKS[locale]?.[key] || fallback;
    const path = `modals.report.${key}`;
    const value = translate ? translate(path, params) : localizedFallback;
    return value && value !== path ? value : (localizedFallback || key);
  };
}

function lowerLocale(value, locale = "pt-BR") {
  return String(value || "").toLocaleLowerCase(locale || "pt-BR");
}

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
  includeNotes = false,
  locale = "pt-BR",
  t = null
}) {
  const tx = createReportTranslator({ locale, t });
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
          statusLabel: status === "applied" ? tx("statusApplied") : status === "skipped" ? tx("statusSkipped") : status === "missed" ? tx("statusMissed") : tx("statusUnknown"),
          statusReason: includeNotes ? statusReason : "",
          site,
          vialId: display.vialId,
          vialLot: textValue(display.vial?.lotNumber),
          vialConcentrationMcgPerMl: display.vial?.concentrationMcgPerMl ?? null,
          historyIntegrity: display.historyIntegrity,
          revisionId: display.revisionId,
          syringeMaxUI: display.calculationSnapshot ? normalizeSyringeMaxUI(display.calculationSnapshot.syringeMaxUI) : null,
          retroactive: Boolean(retroactive),
          type: retroactive ? tx("typeRetroactive") : tx("typeRegular"),
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

const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
  compoundId = "all", eventType = "all", query = "", includeNotes = true,
  locale = "pt-BR", t = null
} = {}) {
  const tx = createReportTranslator({ locale, t });
  const applications = buildReportData({ protocol, logs, startDate, endDate, includeNotes, locale, t })
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
        peptideName: revision.config.name || item.name || tx("noValue"),
        status: revision.status, statusLabel: revision.status === "ended" ? tx("statusEnded", "Encerrado") : revision.status === "paused" ? tx("statusPaused", "Pausado") : tx("statusActive", "Ativo"),
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
    const measures = [entry.weightKg !== null ? `${entry.weightKg} kg` : "", entry.circumferencesCm.abdomen !== null ? `${tx("metricAbdomen", "Abdomen")} ${entry.circumferencesCm.abdomen} cm` : "", entry.circumferencesCm.waist !== null ? `${tx("metricWaist", "Waist")} ${entry.circumferencesCm.waist} cm` : "", entry.circumferencesCm.hips !== null ? `${tx("metricHips", "Hips")} ${entry.circumferencesCm.hips} cm` : "", entry.energyLevel ? `${tx("energy", "Energy")} ${entry.energyLevel}/5` : "", entry.moodLevel ? `${tx("mood", "Mood")} ${entry.moodLevel}/5` : ""].filter(Boolean);
    if (measures.length) events.push({ id: `measurement_${entry.id}`, type: "measurement", date: entry.date, time: entry.time, title: tx("measurementEventTitle", "Self-reported measurement"), subtitle: measures.join(" · "), notes: entry.notes, contextGeneral: compoundId !== "all", editableId: entry.id, data: entry });
    if (entry.symptomDetails.length) events.push({ id: `symptom_${entry.id}`, type: "symptom", date: entry.date, time: entry.time, title: tx("symptomEventTitle", "Self-reported symptoms"), subtitle: entry.symptomDetails.map((item) => `${item.name}${item.intensity ? ` (${item.intensity})` : ""}`).join(" · "), notes: entry.notes, contextGeneral: compoundId !== "all", editableId: entry.id, data: entry });
  });
  revisions.forEach((entry) => events.push({ id: `protocol_${entry.id}`, type: "protocol", date: entry.date, time: entry.time, title: entry.peptideName, subtitle: `${tx("protocolPrefix", "Protocol")} ${lowerLocale(entry.statusLabel, locale)}`, notes: "", compoundId: entry.peptideId, data: entry }));

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
  includeMeasurements = false,
  locale = "pt-BR", t = null
} = {}) {
  const model = buildReviewModel({ protocol, logs, measurements, startDate, endDate, includeNotes, locale, t });
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

export function generateReportCSV(entries = [], context = {}) {
  const tx = createReportTranslator(context);
  // UTF-8 BOM para compatibilidade com Microsoft Excel e planilhas em PT-BR
  const BOM = "\uFEFF";
  const headers = [tx("date", "Data"), tx("time", "Hora"), tx("compound", "Peptídeo"), tx("subtitle", "Subtítulo"), tx("dose", "Dose"), "UI", tx("syringe", "Seringa (UI)"), tx("type", "Tipo"), tx("notes", "Observações"),
    tx("status", "Estado"), tx("reason", "Motivo"), tx("site", "Local"), tx("vial", "Frasco"), tx("lot", "Lote"), tx("vialConcentration", "Concentração do frasco (mcg/mL)"), tx("historyIntegrity", "Integridade histórica"), tx("revision", "Revisão")];
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
      e.statusLabel || (doseStatus(e) === "applied" ? tx("statusApplied") : doseStatus(e) === "skipped" ? tx("statusSkipped") : doseStatus(e) === "missed" ? tx("statusMissed") : tx("statusUnknown")),
      e.statusReason,
      e.site,
      e.vialId,
      e.vialLot,
      e.vialConcentrationMcgPerMl,
      e.historyIntegrity === "captured" ? tx("historyCaptured") : tx("historyLegacy"),
      e.revisionId
    ].map(escapeCSV).join(";");
  });

  return BOM + [headerLine, ...lines].join("\r\n");
}

export function generateMeasurementsCSV(measurements = [], context = {}) {
  const tx = createReportTranslator(context);
  const headers = [tx("date", "Data"), tx("time", "Hora"), "Peso (kg)", tx("energy", "Energia") + " (1-5)", tx("mood", "Humor") + " (1-5)", "Sintomas", "Intensidades", tx("notes", "Observações"), tx("origin", "Origem"), tx("ownership", "Propriedade")];
  const lines = measurements.map((entry) => [
    formatReportDate(entry.date), entry.time, entry.weightKg, entry.energyLevel, entry.moodLevel,
    (entry.symptoms || []).join(" · "),
    (entry.symptomDetails || []).map((item) => `${item.name}: ${item.intensity || tx("notInformed")}`).join(" · "),
    entry.notes, entry.source || tx("localSource"), entry.ownership === "external" ? tx("external") : tx("pep")
  ].map(escapeCSV).join(";"));
  return "\uFEFF" + [headers.map(escapeCSV).join(";"), ...lines].join("\r\n");
}

function getReportEntryCSVRow(e, tx) {
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
    e.statusLabel || (doseStatus(e) === "applied" ? tx("statusApplied") : doseStatus(e) === "skipped" ? tx("statusSkipped") : doseStatus(e) === "missed" ? tx("statusMissed") : tx("statusUnknown")),
    e.statusReason,
    e.site,
    e.vialId,
    e.vialLot,
    e.vialConcentrationMcgPerMl,
    e.historyIntegrity === "captured" ? tx("historyCaptured") : tx("historyLegacy"),
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
  endDate = null,
  locale = "pt-BR",
  t = null
} = {}) {
  const tx = createReportTranslator({ locale, t });
  const lines = [];
  const addRow = (values) => lines.push(values.map(escapeCSV).join(";"));

  addRow([tx("section"), tx("field"), tx("value")]);
  if (adherence) {
    addRow([tx("summary"), tx("period"), startDate && endDate
      ? `${formatReportDate(startDate)} até ${formatReportDate(endDate)}`
      : tx("allHistoryShort")]);
    [
      [tx("scheduledDays"), adherence.scheduledDays], [tx("expectedApplications"), adherence.due], [tx("confirmedApplications"), adherence.applied], [tx("resolvedRecords"), adherence.resolved], [tx("pending"), adherence.pending], [tx("skipped"), adherence.skipped], [tx("missed"), adherence.missed], [tx("extraApplications"), adherence.extraApplied], [tx("applicationPercent"), adherence.applicationPercent], [tx("resolutionPercent"), adherence.resolutionPercent], [tx("completeDays"), adherence.completeDays], [tx("partialDays"), adherence.partialDays]
    ].forEach(([label, value]) => addRow([tx("summary"), label, value]));
  }

  if (measurementStats) {
    addRow([tx("measurements"), tx("includedRecords"), measurementStats.totalEntries]);
    addRow([tx("measurements"), tx("latestWeight"), measurementStats.latestWeight]);
    addRow([tx("measurements"), tx("weightDelta"), measurementStats.weightDelta]);
    addRow([tx("measurements"), tx("averageEnergy"), measurementStats.averageEnergy]);
    addRow([tx("measurements"), tx("averageMood"), measurementStats.averageMood]);
    Object.entries({ abdomen: tx("metricAbdomen", "Abdômen"), waist: tx("metricWaist", "Cintura"), hips: tx("metricHips", "Quadril") }).forEach(([key, label]) => {
      const metric = measurementStats.bodyMetrics?.[key];
      if (!metric?.count) return;
      addRow([tx("measurements"), tx("latestMetric", `Última medida de ${lowerLocale(label, locale)} (cm)`, { metric: lowerLocale(label, locale) }), metric.latest]);
      addRow([tx("measurements"), tx("metricDelta", `Variação de ${lowerLocale(label, locale)} (cm)`, { metric: lowerLocale(label, locale) }), metric.delta]);
    });
  }

  addRow([]);
  const doseHeaders = [tx("date"), tx("time"), tx("compound", "Peptídeo"), tx("subtitle"), tx("dose"), "UI", tx("syringe"), tx("type"), tx("notes"), tx("status"), tx("reason"), tx("site"), tx("vial"), tx("lot"), tx("vialConcentration"), tx("historyIntegrity"), tx("revision")];
  addRow([tx("applications"), ...doseHeaders]);
  entries.forEach((entry) => addRow([tx("applications"), ...getReportEntryCSVRow(entry, tx)]));

  if (measurements.length > 0) {
    addRow([]);
    addRow([tx("reportedMeasurements"), tx("date"), tx("time"), "Peso (kg)", `${tx("metricAbdomen", "Abdômen")} (cm)`, `${tx("metricWaist", "Cintura")} (cm)`, `${tx("metricHips", "Quadril")} (cm)`, `${tx("energy")} (1–5)`, `${tx("mood")} (1–5)`, "Sintomas", tx("notes"), tx("origin")]);
    measurements.forEach((measurement) => addRow([
      tx("reportedMeasurements"),
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
  addRow([tx("warning"), tx("use"), tx("selfReportedWarning")]);
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
  revisions = [],
  locale = "pt-BR",
  t = null
} = {}) {
  const tx = createReportTranslator({ locale, t });
  const dStr = escapeHTML(generatedAt.toLocaleDateString(locale));
  const tStr = escapeHTML(generatedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }));
  
  let periodText = tx("allHistoryShort", "Todo o Histórico");
  if (startDate && endDate) {
    periodText = `${startDate.split("-").reverse().join("/")} até ${endDate.split("-").reverse().join("/")}`;
  } else if (startDate) {
    periodText = `${tx("from", "A partir de")} ${startDate.split("-").reverse().join("/")}`;
  } else if (endDate) {
    periodText = `${tx("until", "Até")} ${endDate.split("-").reverse().join("/")}`;
  }
  const safePeriodText = escapeHTML(periodText);
  const summary = summarizeReportEntries(entries);

  const rows = entries.map((e) => {
    const [y, m, d] = (e.date || "").split("-");
    const dateFmt = d && m && y ? `${d}/${m}/${y}` : e.date;
    return `
      <tr>
        <td class="report-cell report-cell-date">${escapeHTML(dateFmt)}</td>
        <td class="report-cell">${escapeHTML(e.time)}</td>
        <td class="report-cell report-cell-name">${escapeHTML(e.peptideName)}${e.historyIntegrity !== "captured" ? `<div class="report-legacy">${escapeHTML(tx("historyLegacy"))}</div>` : ""}</td>
        <td class="report-cell">${escapeHTML(e.dose)}${e.administrationQuantity !== null && e.administrationQuantity !== undefined ? ` · ${escapeHTML(e.administrationQuantity)} ${escapeHTML(e.administrationUnit || "")}` : ""}${e.ui !== null && e.ui !== undefined ? ` (${escapeHTML(e.ui)} UI)` : (e.administrationQuantity === null || e.administrationQuantity === undefined ? " (-- UI)" : "")}${e.syringeMaxUI !== null && e.syringeMaxUI !== undefined ? `<br><span class="report-syringe">${escapeHTML(tx("syringeShort", `Seringa: ${e.syringeMaxUI} UI`, { value: e.syringeMaxUI }))}</span>` : ""}</td>
        <td class="report-cell">${escapeHTML(e.statusLabel || tx("statusUnknown"))}</td>
        <td class="report-cell">
          <span class="report-type-badge ${e.retroactive ? "is-retroactive" : "is-regular"}">${escapeHTML(e.type)}</span>
        </td>
        <td class="report-cell report-cell-meta">${escapeHTML(e.site || tx("noValue"))}<br>${escapeHTML(getReportVialLabel(e) || tx("vialNotInformed"))}</td>
        <td class="report-cell report-cell-notes">${escapeHTML(e.note || tx("noValue"))}${e.statusReason ? `<br>${escapeHTML(tx("reason"))}: ${escapeHTML(e.statusReason)}` : ""}</td>
      </tr>
    `;
  }).join("");

  const adherenceSection = adherenceSummary ? `
  <section class="personal-summary" aria-labelledby="personal-summary-title">
    <h2 id="personal-summary-title">${escapeHTML(tx("descriptiveSummary"))}</h2>
    <div class="personal-summary-grid">
      <div><span>${escapeHTML(tx("expectedApplications"))}</span><b>${escapeHTML(adherenceSummary.due)}</b></div>
      <div><span>${escapeHTML(tx("confirmedApplications"))}</span><b>${escapeHTML(adherenceSummary.applied)}</b></div>
      <div><span>${escapeHTML(tx("resolutionPercent"))}</span><b>${escapeHTML(adherenceSummary.resolutionPercent)}%</b></div>
      <div><span>${escapeHTML(tx("completeDays"))}</span><b>${escapeHTML(adherenceSummary.completeDays)}</b></div>
      <div><span>${escapeHTML(tx("pending"))}</span><b>${escapeHTML(adherenceSummary.pending)}</b></div>
      <div><span>${escapeHTML(tx("extraApplications"))}</span><b>${escapeHTML(adherenceSummary.extraApplied)}</b></div>
    </div>
    <p class="personal-summary-note">${escapeHTML(tx("descriptiveSummaryNote"))}</p>
  </section>` : "";

  const measurementRows = Array.isArray(measurements) ? measurements.map((measurement) => `
      <tr>
        <td>${escapeHTML(formatReportDate(measurement.date))}</td>
        <td>${escapeHTML(measurement.time || "--:--")}</td>
        <td>${escapeHTML(measurement.weightKg ?? "--")}</td>
        <td>${escapeHTML([[tx("metricAbdomen", "Abdômen"), measurement.circumferencesCm?.abdomen], [tx("metricWaist", "Cintura"), measurement.circumferencesCm?.waist], [tx("metricHips", "Quadril"), measurement.circumferencesCm?.hips]].filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => `${label}: ${value}`).join(" · ") || tx("noValue"))}</td>
        <td>${escapeHTML(measurement.energyLevel ?? tx("noValue"))}</td>
        <td>${escapeHTML(measurement.moodLevel ?? tx("noValue"))}</td>
        <td>${escapeHTML(Array.isArray(measurement.symptomDetails) && measurement.symptomDetails.length > 0 ? measurement.symptomDetails.map((item) => `${item.name}${item.intensity ? ` (${item.intensity})` : ""}`).join(" · ") : tx("noValue"))}</td>
        <td>${escapeHTML(measurement.notes || tx("noValue"))}</td>
        <td>${escapeHTML(measurement.source || tx("localSource"))}</td>
      </tr>
    `).join("") : "";
  const measurementsSection = includeMeasurements ? `
  <section class="measurements-section" aria-labelledby="measurements-title">
    <h2 id="measurements-title">${escapeHTML(tx("measurementsTitle"))}</h2>
    ${measurementStats ? `<div class="stats">
      <div class="stats-item">${escapeHTML(tx("includedRecords"))}: <b>${escapeHTML(measurementStats.totalEntries)}</b></div>
      ${measurementStats.latestWeight !== null ? `<div class="stats-item">${escapeHTML(tx("latestWeight"))}: <b>${escapeHTML(measurementStats.latestWeight)} kg</b></div>` : ""}
      ${measurementStats.weightDelta !== null ? `<div class="stats-item">${escapeHTML(tx("weightDelta"))}: <b>${escapeHTML(measurementStats.weightDelta)} kg</b></div>` : ""}
      ${Object.entries({ abdomen: tx("metricAbdomen", "Abdômen"), waist: tx("metricWaist", "Cintura"), hips: tx("metricHips", "Quadril") }).map(([key, label]) => measurementStats.bodyMetrics?.[key]?.count ? `<div class="stats-item">${escapeHTML(tx("latestMetric", `Último ${lowerLocale(label, locale)}`, { metric: lowerLocale(label, locale) }))}: <b>${escapeHTML(measurementStats.bodyMetrics[key].latest)} cm</b></div>` : "").join("")}
      ${measurementStats.averageEnergy !== null ? `<div class="stats-item">${escapeHTML(tx("averageEnergy"))}: <b>${escapeHTML(measurementStats.averageEnergy)} / 5</b></div>` : ""}
      ${measurementStats.averageMood !== null ? `<div class="stats-item">${escapeHTML(tx("averageMood"))}: <b>${escapeHTML(measurementStats.averageMood)} / 5</b></div>` : ""}
    </div>` : ""}
    <table>
      <thead><tr><th>${escapeHTML(tx("date"))}</th><th>${escapeHTML(tx("time"))}</th><th>Peso (kg)</th><th>${escapeHTML(tx("circumferences"))}</th><th>${escapeHTML(tx("energy"))}</th><th>${escapeHTML(tx("mood"))}</th><th>Sintomas</th><th>${escapeHTML(tx("notes"))}</th><th>${escapeHTML(tx("origin"))}</th></tr></thead>
      <tbody>${measurementRows || `<tr><td colspan="9" class="report-empty-cell">${escapeHTML(tx("noMeasurements"))}</td></tr>`}</tbody>
    </table>
    <p class="personal-summary-note">${escapeHTML(tx("selfReportedWarning"))}</p>
  </section>` : "";

  const revisionsSection = `<section class="protocol-section"><h2>${escapeHTML(tx("protocolRevisions"))}</h2><table><thead><tr><th>${escapeHTML(tx("effectiveFrom"))}</th><th>${escapeHTML(tx("compound"))}</th><th>${escapeHTML(tx("status"))}</th><th>${escapeHTML(tx("registeredConfiguration"))}</th></tr></thead><tbody>${(revisions || []).map((revision) => `<tr><td>${escapeHTML(formatReportDate(revision.date))} ${escapeHTML(revision.time)}</td><td>${escapeHTML(revision.peptideName)}</td><td>${escapeHTML(revision.statusLabel)}</td><td>${escapeHTML([revision.config?.dose, revision.config?.ui !== undefined ? `${revision.config.ui} UI` : "", revision.config?.per].filter(Boolean).join(" · ") || tx("noDose"))}</td></tr>`).join("") || `<tr><td colspan="4">${escapeHTML(tx("noRevisions"))}</td></tr>`}</tbody></table></section>`;

  return `<!DOCTYPE html>
<html lang="${escapeHTML(locale)}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(tx("applicationsReportTitle"))}</title>
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
    .report-cell { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
    .report-cell-date { font-weight: 600; }
    .report-cell-name { font-weight: 700; }
    .report-cell-meta, .report-cell-notes { font-size: 12px; }
    .report-cell-notes { color: #64748B; }
    .report-legacy { font-size: 10px; font-weight: 400; }
    .report-syringe { font-size: 11px; color: #64748B; }
    .report-type-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .report-type-badge.is-retroactive { background: #FEF3C7; color: #92400E; }
    .report-type-badge.is-regular { background: #E6FFFA; color: #047857; }
    .report-empty-cell { padding: 16px; text-align: center; color: #64748B; }
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
      <h1 class="title">${escapeHTML(tx("applicationsReportTitle"))}</h1>
      <div class="meta">${escapeHTML(tx("period"))}: <b>${safePeriodText}</b> · ${escapeHTML(tx("issuedAt"))}: <b>${dStr} ${locale === "pt-BR" ? "às" : "at"} ${tStr}</b></div>
    </div>
  </div>

  <div class="stats">
    <div class="stats-item">${escapeHTML(tx("totalApplications"))}: <b>${summary.applied}</b></div>
    <div class="stats-item">${escapeHTML(tx("skipped"))}: <b>${summary.skipped}</b></div>
    <div class="stats-item">${escapeHTML(tx("missed"))}: <b>${summary.missed}</b></div>
    <div class="stats-item">${escapeHTML(tx("totalRecords"))}: <b>${summary.total}</b></div>
    ${summary.unknown ? `<div class="stats-item">${escapeHTML(tx("unknownState"))}: <b>${summary.unknown}</b></div>` : ""}
  </div>

  ${adherenceSection}

  ${revisionsSection}

  <table>
    <thead>
      <tr>
        <th>${escapeHTML(tx("date"))}</th>
        <th>${escapeHTML(tx("time"))}</th>
        <th>${escapeHTML(tx("compound"))}</th>
        <th>${escapeHTML(tx("dose"))}</th>
        <th>${escapeHTML(tx("status"))}</th>
        <th>${escapeHTML(tx("type"))}</th>
        <th>${escapeHTML(tx("site"))} / ${escapeHTML(tx("vial"))}</th>
        <th>${escapeHTML(tx("notes"))}</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8" class="report-empty-cell">${escapeHTML(tx("noApplications"))}</td></tr>`}
    </tbody>
  </table>

  ${measurementsSection}

  <div class="disclaimer">
    <b>${escapeHTML(tx("disclaimer"))}</b>
  </div>
</body>
</html>`;
}
