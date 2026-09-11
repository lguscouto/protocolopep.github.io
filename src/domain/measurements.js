/**
 * Módulo de Domínio: Sintomas, Peso e Medidas Autorrelatadas (V12)
 *
 * Princípios de Governança (AGENTS.md):
 * - Linguagem estritamente descritiva e não prescritiva: 'Variação autorrelatada no período', 'Último registro'.
 * - Não clínica: nunca inferir causalidade entre aplicação de compostos e variações de peso/sintomas.
 * - Rigor com valores ausentes: distinção estrita entre ausente (null) e zero (0). Sem interpolação artificial.
 * - Funções puras, imutáveis e auditáveis.
 */

import { isValidDateKey, isValidTime } from "./schedule.js";
import {
  assessTemporalConsistency,
  getSystemTimeZoneId,
  getZoneOffsetForLocalDateTime,
  isValidIsoTimestamp,
  isValidTimeZoneId,
  isValidZoneOffset,
  localDateTimeToIso
} from "./time.js";

export class MeasurementValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MeasurementValidationError";
    this.code = code;
  }
}

/**
 * Calcula o offset de fuso horário atual no formato ISO (+HH:mm ou -HH:mm)
 * @param {Date} [date]
 * @returns {string}
 */
export function getCurrentZoneOffset(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export { getZoneOffsetForLocalDateTime, getSystemTimeZoneId };

function currentLocalDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function requireValidInstant(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  if (!isValidIsoTimestamp(String(value))) {
    throw new MeasurementValidationError(
      `INVALID_${fieldName.toUpperCase()}`,
      `${fieldName} deve ser um timestamp ISO 8601 válido.`
    );
  }
  return new Date(String(value)).toISOString();
}

export const DEFAULT_SYMPTOM_SUGGESTIONS = Object.freeze([
  "Disposição elevada",
  "Fadiga",
  "Dor de cabeça",
  "Náusea leve",
  "Apetite reduzido",
  "Apetite aumentado",
  "Sono reparador",
  "Insônia leve",
  "Sensibilidade no local da aplicação",
  "Recuperação muscular rápida"
]);

export const SYMPTOM_INTENSITIES = Object.freeze(["leve", "moderada", "intensa"]);

export const BODY_METRICS = Object.freeze({
  weight: Object.freeze({ key: "weight", label: "Peso", unit: "kg", path: "weightKg" }),
  abdomen: Object.freeze({ key: "abdomen", label: "Abdômen", unit: "cm", path: "circumferencesCm.abdomen" }),
  waist: Object.freeze({ key: "waist", label: "Cintura", unit: "cm", path: "circumferencesCm.waist" }),
  hips: Object.freeze({ key: "hips", label: "Quadril", unit: "cm", path: "circumferencesCm.hips" })
});

const CIRCUMFERENCE_KEYS = Object.freeze(["abdomen", "waist", "hips"]);
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

/** Normaliza a meta pessoal sem alterar o objeto recebido. */
export function normalizeMeasurementGoals(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const raw = source.goalWeightKg;
  if (raw === null || raw === undefined || raw === "") return { goalWeightKg: null };
  const parsed = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < MIN_WEIGHT_KG || parsed > MAX_WEIGHT_KG) {
    throw new MeasurementValidationError("INVALID_GOAL_WEIGHT", `A meta de peso deve estar entre ${MIN_WEIGHT_KG} kg e ${MAX_WEIGHT_KG} kg.`);
  }
  return { goalWeightKg: Math.round(parsed * 100) / 100 };
}

/**
 * Resume o peso diário registrado para indicadores descritivos, sem interpolar dias ausentes.
 */
export function calculateWeightGoalIndicators(entries, goals = {}) {
  const goalWeightKg = normalizeMeasurementGoals(goals).goalWeightKg;
  const daily = new Map();
  (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry && isValidDateKey(entry.date) && typeof entry.weightKg === "number" && Number.isFinite(entry.weightKg) && entry.weightKg > 0)
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date) || String(a.entry.time || "").localeCompare(String(b.entry.time || "")) || a.index - b.index)
    .forEach(({ entry }) => daily.set(entry.date, entry));
  const weights = [...daily.values()];
  if (!weights.length) return { goalWeightKg, dailyWeights: [], latestWeight: null, absoluteChangeKg: null, percentChange: null, weeklyObservedChangeKg: null, goalDifferenceKg: null, goalStatus: null };
  const first = weights[0];
  const latest = weights[weights.length - 1];
  const absoluteChangeKg = Math.round((latest.weightKg - first.weightKg) * 100) / 100;
  const percentChange = first.weightKg > 0 ? Math.round((absoluteChangeKg / first.weightKg) * 10000) / 100 : null;
  const firstTime = Date.UTC(...first.date.split("-").map((part, index) => index === 1 ? Number(part) - 1 : Number(part)));
  const latestTime = Date.UTC(...latest.date.split("-").map((part, index) => index === 1 ? Number(part) - 1 : Number(part)));
  const elapsedDays = Math.round((latestTime - firstTime) / 86400000);
  const weeklyObservedChangeKg = weights.length >= 2 && elapsedDays > 0 ? Math.round((absoluteChangeKg / elapsedDays) * 7 * 100) / 100 : null;
  const goalDifferenceKg = goalWeightKg === null ? null : Math.round((latest.weightKg - goalWeightKg) * 100) / 100;
  return {
    goalWeightKg,
    dailyWeights: weights.map((entry) => ({ id: entry.id, date: entry.date, time: entry.time || "", weightKg: entry.weightKg })),
    latestWeight: latest.weightKg,
    absoluteChangeKg,
    percentChange,
    weeklyObservedChangeKg,
    goalDifferenceKg,
    goalStatus: goalDifferenceKg === null ? null : (goalDifferenceKg === 0 ? "at_goal" : (goalDifferenceKg > 0 ? "above" : "below"))
  };
}

function parseOptionalCircumference(value, key) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 10 || parsed > 300) {
    const label = BODY_METRICS[key]?.label?.toLocaleLowerCase("pt-BR") || "circunferência";
    throw new MeasurementValidationError(
      `INVALID_CIRCUMFERENCE_${key.toUpperCase()}`,
      `A medida de ${label} deve estar entre 10 cm e 300 cm.`
    );
  }
  return Math.round(parsed * 100) / 100;
}

/** Normaliza as circunferências opcionais sem modificar o objeto recebido. */
export function normalizeCircumferencesCm(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    abdomen: parseOptionalCircumference(source.abdomen, "abdomen"),
    waist: parseOptionalCircumference(source.waist, "waist"),
    hips: parseOptionalCircumference(source.hips, "hips")
  };
}

/**
 * Sanitiza e valida o formato de texto de um sintoma.
 * @param {string} symptom
 * @returns {string}
 */
export function formatSymptomLabel(symptom) {
  if (!symptom || typeof symptom !== "string") return "";
  return symptom.trim().slice(0, 60);
}

export function normalizeSymptomDetails(symptoms = [], symptomDetails = []) {
  const detailMap = new Map();
  if (Array.isArray(symptomDetails)) {
    symptomDetails.forEach((item) => {
      const name = formatSymptomLabel(item?.name);
      const intensity = SYMPTOM_INTENSITIES.includes(item?.intensity) ? item.intensity : null;
      if (name) detailMap.set(name.toLocaleLowerCase("pt-BR"), { name, intensity });
    });
  }
  if (Array.isArray(symptoms)) {
    symptoms.forEach((item) => {
      const name = formatSymptomLabel(item);
      const key = name.toLocaleLowerCase("pt-BR");
      if (name && !detailMap.has(key)) detailMap.set(key, { name, intensity: null });
    });
  }
  return [...detailMap.values()];
}

/**
 * Cria um objeto padronizado de registro de medição / sintomas autorrelatados.
 *
 * Semântica dos campos temporais (P0 CODEX v2.5.0):
 * - `timestamp`  = instante real da medição (recalculado quando date/time mudam)
 * - `createdAt`  = quando o registro foi criado no PEP (imutável após criação)
 * - `updatedAt`  = última alteração local (atualizado a cada edição)
 *
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} params.date - Data no formato YYYY-MM-DD
 * @param {string} [params.time] - Horário no formato HH:mm
 * @param {number|null} [params.weightKg] - Peso em kg (ex: 82.5) ou null se não informado
 * @param {{abdomen?: number|null, waist?: number|null, hips?: number|null}} [params.circumferencesCm]
 * @param {number|null} [params.energyLevel] - Nível de energia de 1 a 5 ou null
 * @param {number|null} [params.moodLevel] - Nível de humor de 1 a 5 ou null
 * @param {string[]} [params.symptoms] - Lista de sintomas autorrelatados
 * @param {string} [params.notes] - Observações adicionais do usuário
 * @param {string} [params.source] - "local" | "health_connect"
 * @param {string} [params.ownership] - "pep" | "external"
 * @param {number} [params.syncVersion] - Versão incremental monotônica
 * @param {string|null} [params.clientRecordId]
 * @param {string|null} [params.healthConnectRecordId]
 * @param {string|null} [params.dataOrigin]
 * @param {string|null} [params.zoneOffset]
 * @param {string|null} [params.timestamp] - Instante real da medição (ISO UTC). Se null, calculado de date+time.
 * @param {string|null} [params.createdAt] - Quando o registro foi criado no PEP (imutável). Se null, calculado como now.
 * @param {string|null} [params.updatedAt] - Última alteração local. Se null, herda createdAt.
 * @returns {Object}
 */
export function createMeasurementEntry({
  id = null,
  clientRecordId = null,
  date = undefined,
  time = undefined,
  weightKg = null,
  circumferencesCm = {},
  energyLevel = null,
  moodLevel = null,
  symptoms = [],
  symptomDetails = [],
  notes = "",
  source = "local",
  ownership = null,
  syncVersion = 1,
  clientRecordVersion = 1,
  healthConnectRecordId = null,
  dataOrigin = null,
  zoneOffset = null,
  timeZoneId = null,
  timestamp = null,
  createdAt = null,
  updatedAt = null,
  temporalIntegrity = null,
  healthConnectLastModifiedTime = null,
  syncConflict = null
}) {
  const hasExplicitDate = date !== undefined && date !== null;
  const hasExplicitTime = time !== undefined && time !== null;

  if (hasExplicitDate && !isValidDateKey(String(date))) {
    throw new MeasurementValidationError(
      "INVALID_DATE",
      "Data da medição inválida ou inexistente no calendário gregoriano."
    );
  }
  if (hasExplicitTime && !isValidTime(String(time))) {
    throw new MeasurementValidationError(
      "INVALID_TIME",
      "Hora da medição inválida; informe um horário HH:mm válido."
    );
  }

  let parsedWeight = null;
  if (weightKg !== null && weightKg !== undefined && weightKg !== "") {
    const num = typeof weightKg === "number" ? weightKg : Number(String(weightKg).replace(",", "."));
    if (Number.isNaN(num) || !Number.isFinite(num) || num < 20 || num > 400) {
      throw new MeasurementValidationError("INVALID_WEIGHT", "O peso deve estar entre 20 kg e 400 kg.");
    }
    parsedWeight = Math.round(num * 100) / 100;
  }
  const normalizedCircumferences = normalizeCircumferencesCm(circumferencesCm);

  let parsedEnergy = null;
  if (energyLevel !== null && energyLevel !== undefined && energyLevel !== "") {
    const e = Number(energyLevel);
    if (!Number.isInteger(e) || e < 1 || e > 5) {
      throw new MeasurementValidationError("INVALID_ENERGY", "O nível de energia deve ser um número inteiro de 1 a 5.");
    }
    parsedEnergy = e;
  }

  let parsedMood = null;
  if (moodLevel !== null && moodLevel !== undefined && moodLevel !== "") {
    const m = Number(moodLevel);
    if (!Number.isInteger(m) || m < 1 || m > 5) {
      throw new MeasurementValidationError("INVALID_MOOD", "O nível de humor deve ser um número inteiro de 1 a 5.");
    }
    parsedMood = m;
  }

  if (!Array.isArray(symptoms)) {
    throw new MeasurementValidationError("INVALID_SYMPTOMS", "A lista de sintomas deve ser um array.");
  }

  if (symptomDetails !== undefined && !Array.isArray(symptomDetails)) {
    throw new MeasurementValidationError("INVALID_SYMPTOM_DETAILS", "Os detalhes dos sintomas devem ser um array.");
  }
  if (Array.isArray(symptomDetails) && symptomDetails.some((item) => item?.intensity && !SYMPTOM_INTENSITIES.includes(item.intensity))) {
    throw new MeasurementValidationError("INVALID_SYMPTOM_INTENSITY", "A intensidade deve ser leve, moderada, intensa ou não informada.");
  }
  const normalizedSymptomDetails = normalizeSymptomDetails(symptoms, symptomDetails);
  const uniqueSymptoms = normalizedSymptomDetails.map((item) => item.name);
  const cleanDate = hasExplicitDate ? String(date) : currentLocalDateKey();
  const cleanTime = hasExplicitTime ? String(time) : "08:00";
  const version = Math.max(1, parseInt(syncVersion || clientRecordVersion, 10) || 1);

  const hasExplicitZoneOffset = zoneOffset !== undefined && zoneOffset !== null && zoneOffset !== "";
  const cleanTimeZoneId = timeZoneId !== undefined && timeZoneId !== null && timeZoneId !== ""
    ? String(timeZoneId)
    : (source === "local" && !hasExplicitZoneOffset ? getSystemTimeZoneId() : null);
  if (cleanTimeZoneId && !isValidTimeZoneId(cleanTimeZoneId)) {
    throw new MeasurementValidationError("INVALID_TIME_ZONE", "Timezone IANA inválido.");
  }

  if (hasExplicitZoneOffset && !isValidZoneOffset(String(zoneOffset))) {
    throw new MeasurementValidationError("INVALID_ZONE_OFFSET", "Offset de fuso inválido; use +HH:mm, -HH:mm ou Z.");
  }

  const cleanZoneOffset = hasExplicitZoneOffset
    ? String(zoneOffset)
    : (source === "local"
      ? getZoneOffsetForLocalDateTime(cleanDate, cleanTime, cleanTimeZoneId)
      : null);

  let explicitTimestamp = null;
  if (temporalIntegrity === "needs_review" && timestamp && !isValidIsoTimestamp(String(timestamp))) {
    explicitTimestamp = String(timestamp);
  } else {
    explicitTimestamp = requireValidInstant(timestamp, "timestamp");
  }
  const cleanTimestamp = explicitTimestamp || localDateTimeToIso(
    cleanDate,
    cleanTime,
    cleanZoneOffset,
    cleanTimeZoneId
  );
  if (!cleanTimestamp) {
    throw new MeasurementValidationError(
      "INVALID_LOCAL_DATE_TIME",
      "A data e o horário não representam um instante válido no contexto de fuso informado."
    );
  }

  const temporalAssessment = assessTemporalConsistency({
    date: cleanDate,
    time: cleanTime,
    timestamp: cleanTimestamp,
    zoneOffset: cleanZoneOffset,
    timeZoneId: cleanTimeZoneId
  });
  const allowTemporalReview = temporalIntegrity === "needs_review" || (
    source === "health_connect" && !cleanZoneOffset && !cleanTimeZoneId
  );
  const cleanTemporalIntegrity = temporalAssessment.valid ? "valid" : "needs_review";
  if (!temporalAssessment.valid && !allowTemporalReview) {
    throw new MeasurementValidationError(
      "TEMPORAL_INCONSISTENCY",
      `Campos temporais inconsistentes: ${temporalAssessment.errors.join(", ")}.`
    );
  }

  const nowIso = new Date().toISOString();
  const cleanCreatedAt = requireValidInstant(createdAt, "createdAt") || nowIso;
  const cleanUpdatedAt = requireValidInstant(updatedAt, "updatedAt") || cleanCreatedAt;
  const resolvedOwnership = ownership === "pep" || ownership === "external"
    ? ownership
    : (dataOrigin === "com.protocolopep.app"
      ? "pep"
      : (source === "health_connect" ? "external" : "pep"));

  return {
    id: id || `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: cleanDate,
    time: cleanTime,
    weightKg: parsedWeight,
    circumferencesCm: normalizedCircumferences,
    energyLevel: parsedEnergy,
    moodLevel: parsedMood,
    symptoms: uniqueSymptoms,
    symptomDetails: normalizedSymptomDetails,
    notes: notes ? String(notes).trim().slice(0, 500) : "",
    source: source || "local",
    ownership: resolvedOwnership,
    syncVersion: version,
    clientRecordVersion: version,
    clientRecordId: clientRecordId || null,
    healthConnectRecordId: healthConnectRecordId || null,
    dataOrigin: dataOrigin || (source === "local" ? "com.protocolopep.app" : null),
    zoneOffset: cleanZoneOffset,
    timeZoneId: cleanTimeZoneId,
    timestamp: cleanTimestamp,
    temporalIntegrity: cleanTemporalIntegrity,
    healthConnectLastModifiedTime: requireValidInstant(
      healthConnectLastModifiedTime,
      "healthConnectLastModifiedTime"
    ),
    syncConflict: syncConflict && typeof syncConflict === "object"
      ? { ...syncConflict }
      : null,
    createdAt: cleanCreatedAt,
    updatedAt: cleanUpdatedAt
  };
}

/**
 * Valida os dados de um registro de medição.
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMeasurementEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["Registro de medição inválido."] };
  }

  if (!entry.date || !isValidDateKey(String(entry.date))) {
    errors.push("A data informada é inválida ou inexistente no calendário gregoriano.");
  }

  if (entry.time && !isValidTime(String(entry.time))) {
    errors.push("O horário informado deve estar no formato HH:mm válido.");
  }

  if (entry.weightKg !== null && entry.weightKg !== undefined) {
    if (typeof entry.weightKg !== "number" || Number.isNaN(entry.weightKg)) {
      errors.push("O peso informado deve ser um número válido.");
    } else if (entry.weightKg < 20 || entry.weightKg > 400) {
      errors.push("O peso deve estar entre 20 kg e 400 kg.");
    }
  }

  try {
    normalizeCircumferencesCm(entry.circumferencesCm);
  } catch (error) {
    errors.push(error.message || "As circunferências devem ser números válidos entre 10 cm e 300 cm.");
  }

  if (entry.energyLevel !== null && entry.energyLevel !== undefined) {
    if (!Number.isInteger(entry.energyLevel) || entry.energyLevel < 1 || entry.energyLevel > 5) {
      errors.push("O nível de energia deve ser um número inteiro de 1 a 5.");
    }
  }

  if (entry.moodLevel !== null && entry.moodLevel !== undefined) {
    if (!Number.isInteger(entry.moodLevel) || entry.moodLevel < 1 || entry.moodLevel > 5) {
      errors.push("O nível de humor deve ser um número inteiro de 1 a 5.");
    }
  }

  if (entry.symptoms && !Array.isArray(entry.symptoms)) {
    errors.push("A lista de sintomas deve ser um array.");
  }
  if (entry.symptomDetails && !Array.isArray(entry.symptomDetails)) {
    errors.push("Os detalhes dos sintomas devem ser um array.");
  } else if (Array.isArray(entry.symptomDetails) && entry.symptomDetails.some((item) => item?.intensity && !SYMPTOM_INTENSITIES.includes(item.intensity))) {
    errors.push("A intensidade deve ser leve, moderada, intensa ou não informada.");
  }
  const temporalAssessment = assessTemporalConsistency(entry);
  if (!temporalAssessment.valid && entry.temporalIntegrity !== "needs_review") {
    errors.push(`Campos temporais inconsistentes: ${temporalAssessment.errors.join(", ")}.`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calcula estatísticas descritivas agregadas a partir de registros de medição autorrelatados.
 * Sem interpolação ou fabricação de valores para dias sem dados.
 *
 * @param {Object[]} entries
 * @returns {Object}
 */
export function calculateMeasurementStats(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      totalEntries: 0,
      latestWeight: null,
      earliestWeight: null,
      weightDelta: null,
      minWeight: null,
      maxWeight: null,
      averageEnergy: null,
      averageMood: null,
      symptomsFrequency: {},
      mostFrequentSymptom: null,
      bodyMetrics: Object.fromEntries(["weight", ...CIRCUMFERENCE_KEYS].map((key) => [key, {
        count: 0, earliest: null, latest: null, delta: null, min: null, max: null
      }]))
    };
  }

  // Ordenação cronológica crescente (do mais antigo para o mais recente)
  const sorted = [...entries].sort((a, b) => {
    const cmp = (a.date || "").localeCompare(b.date || "");
    if (cmp !== 0) return cmp;
    return (a.time || "").localeCompare(b.time || "");
  });

  const weightEntries = sorted.filter(
    (e) => e.weightKg !== null && e.weightKg !== undefined && typeof e.weightKg === "number" && !Number.isNaN(e.weightKg)
  );
  const bodyMetrics = Object.fromEntries(CIRCUMFERENCE_KEYS.map((key) => {
    const metricEntries = sorted.filter((entry) => {
      const value = entry?.circumferencesCm?.[key];
      return typeof value === "number" && Number.isFinite(value) && value > 0;
    });
    const values = metricEntries.map((entry) => entry.circumferencesCm[key]);
    const earliest = values[0] ?? null;
    const latest = values[values.length - 1] ?? null;
    return [key, {
      count: values.length,
      earliest,
      latest,
      delta: values.length ? Math.round((latest - earliest) * 100) / 100 : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null
    }];
  }));

  let latestWeight = null;
  let earliestWeight = null;
  let weightDelta = null;
  let minWeight = null;
  let maxWeight = null;

  if (weightEntries.length > 0) {
    earliestWeight = weightEntries[0].weightKg;
    latestWeight = weightEntries[weightEntries.length - 1].weightKg;
    weightDelta = Math.round((latestWeight - earliestWeight) * 100) / 100;

    const weights = weightEntries.map((e) => e.weightKg);
    minWeight = Math.min(...weights);
    maxWeight = Math.max(...weights);
  }
  bodyMetrics.weight = {
    count: weightEntries.length,
    earliest: earliestWeight,
    latest: latestWeight,
    delta: weightDelta,
    min: minWeight,
    max: maxWeight
  };

  const energyEntries = sorted.filter((e) => typeof e.energyLevel === "number" && e.energyLevel >= 1 && e.energyLevel <= 5);
  const averageEnergy = energyEntries.length > 0
    ? Math.round((energyEntries.reduce((sum, e) => sum + e.energyLevel, 0) / energyEntries.length) * 10) / 10
    : null;

  const moodEntries = sorted.filter((e) => typeof e.moodLevel === "number" && e.moodLevel >= 1 && e.moodLevel <= 5);
  const averageMood = moodEntries.length > 0
    ? Math.round((moodEntries.reduce((sum, e) => sum + e.moodLevel, 0) / moodEntries.length) * 10) / 10
    : null;

  const symptomsFrequency = {};
  sorted.forEach((e) => {
    if (Array.isArray(e.symptoms)) {
      e.symptoms.forEach((sym) => {
        const key = formatSymptomLabel(sym);
        if (key) {
          symptomsFrequency[key] = (symptomsFrequency[key] || 0) + 1;
        }
      });
    }
  });

  let mostFrequentSymptom = null;
  let maxFreq = 0;
  Object.entries(symptomsFrequency).forEach(([sym, count]) => {
    if (count > maxFreq) {
      maxFreq = count;
      mostFrequentSymptom = { symptom: sym, count };
    }
  });

  return {
    totalEntries: sorted.length,
    latestWeight,
    earliestWeight,
    weightDelta,
    minWeight,
    maxWeight,
    averageEnergy,
    averageMood,
    symptomsFrequency,
    mostFrequentSymptom,
    bodyMetrics
  };
}

const WEIGHT_CHART_SIZE = Object.freeze({
  width: 720,
  height: 240,
  left: 58,
  right: 18,
  top: 18,
  bottom: 38
});

function dateKeyToUtcTime(value) {
  if (!isValidDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Constrói a geometria descritiva de uma métrica corporal sem interpolar registros.
 * Quando há mais de uma medida no mesmo dia, mantém o último registro daquele dia.
 *
 * @param {Object[]} measurements
 * @param {"weight"|"abdomen"|"waist"|"hips"} metricKey
 * @returns {Object}
 */
export function buildBodyMetricChartModel(measurements, metricKey = "weight") {
  const metric = BODY_METRICS[metricKey];
  if (!metric) throw new MeasurementValidationError("INVALID_BODY_METRIC", "Métrica corporal inválida.");
  const getValue = metricKey === "weight"
    ? (entry) => entry?.weightKg
    : (entry) => entry?.circumferencesCm?.[metricKey];
  const source = Array.isArray(measurements) ? measurements : [];
  const candidates = source
    .map((entry, inputIndex) => ({ entry, inputIndex }))
    .filter(({ entry }) => (
      entry && typeof entry === "object"
      && isValidDateKey(entry.date)
      && typeof getValue(entry) === "number"
      && Number.isFinite(getValue(entry))
      && getValue(entry) > 0
    ))
    .sort((a, b) => {
      const dateComparison = a.entry.date.localeCompare(b.entry.date);
      if (dateComparison !== 0) return dateComparison;
      const timeComparison = String(a.entry.time || "").localeCompare(String(b.entry.time || ""));
      return timeComparison !== 0 ? timeComparison : a.inputIndex - b.inputIndex;
    });

  const latestByDate = new Map();
  candidates.forEach(({ entry }) => latestByDate.set(entry.date, entry));
  const dailyEntries = [...latestByDate.values()];
  const { width, height, left, right, top, bottom } = WEIGHT_CHART_SIZE;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  if (dailyEntries.length === 0) {
    return {
      width,
      height,
      plot: { left, right, top, bottom, width: plotWidth, height: plotHeight },
      points: [],
      gridLines: [],
      linePath: "",
      areaPath: "",
      firstDate: null,
      lastDate: null,
      minValue: null,
      maxValue: null,
      metric
    };
  }

  const values = dailyEntries.map(getValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin;
  const yPadding = range > 0 ? Math.max(range * 0.12, 0.25) : Math.max(rawMin * 0.01, 0.5);
  const minWeight = Math.max(0, rawMin - yPadding);
  const maxWeight = rawMax + yPadding;
  const firstTime = dateKeyToUtcTime(dailyEntries[0].date);
  const lastTime = dateKeyToUtcTime(dailyEntries[dailyEntries.length - 1].date);
  const timeRange = lastTime - firstTime;

  const points = dailyEntries.map((entry) => {
    const entryTime = dateKeyToUtcTime(entry.date);
    const x = timeRange === 0
      ? left + plotWidth / 2
      : left + ((entryTime - firstTime) / timeRange) * plotWidth;
    const value = getValue(entry);
    const y = top + ((maxWeight - value) / (maxWeight - minWeight)) * plotHeight;
    return {
      id: String(entry.id || ""),
      date: entry.date,
      time: String(entry.time || ""),
      value,
      weightKg: metricKey === "weight" ? value : undefined,
      source: entry.source || "Local",
      ownership: entry.ownership === "external" ? "external" : "pep",
      x,
      y
    };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const baseline = top + plotHeight;
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
    : "";
  const gridLines = [0, 0.5, 1].map((ratio) => ({
    y: top + ratio * plotHeight,
    value: Math.round((maxWeight - ratio * (maxWeight - minWeight)) * 10) / 10,
    weightKg: metricKey === "weight" ? Math.round((maxWeight - ratio * (maxWeight - minWeight)) * 10) / 10 : undefined
  }));

  return {
    width,
    height,
    plot: { left, right, top, bottom, width: plotWidth, height: plotHeight },
    points,
    gridLines,
    linePath,
    areaPath,
    firstDate: points[0].date,
    lastDate: points[points.length - 1].date,
    minValue: rawMin,
    maxValue: rawMax,
    minWeight: metricKey === "weight" ? rawMin : undefined,
    maxWeight: metricKey === "weight" ? rawMax : undefined,
    metric
  };
}

export function buildWeightChartModel(measurements) {
  return buildBodyMetricChartModel(measurements, "weight");
}

/**
 * Filtra registros de medição por período e/ou sintoma.
 * @param {Object[]} entries
 * @param {Object} [filter]
 * @param {string} [filter.startDate]
 * @param {string} [filter.endDate]
 * @param {string} [filter.symptom]
 * @returns {Object[]}
 */
export function filterMeasurements(entries, { startDate = null, endDate = null, symptom = null } = {}) {
  if (!Array.isArray(entries)) return [];

  return entries.filter((e) => {
    if (!e || typeof e !== "object") return false;
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    if (symptom && Array.isArray(e.symptoms)) {
      const match = e.symptoms.some((s) => s.toLowerCase() === symptom.toLowerCase());
      if (!match) return false;
    }
    return true;
  });
}

/**
 * Verifica se duas listas de medições possuem diferenças em seus campos ou registros.
 * @param {Object[]} oldList
 * @param {Object[]} newList
 * @returns {boolean}
 */
export function haveMeasurementsChanged(oldList = [], newList = []) {
  if (!Array.isArray(oldList) || !Array.isArray(newList)) {
    return oldList !== newList;
  }
  const fingerprint = (entry) => JSON.stringify({
    id: entry?.id || null,
    date: entry?.date || null,
    time: entry?.time || null,
    timestamp: entry?.timestamp || null,
    zoneOffset: entry?.zoneOffset || null,
    timeZoneId: entry?.timeZoneId || null,
    weightKg: entry?.weightKg ?? null,
    energyLevel: entry?.energyLevel ?? null,
    moodLevel: entry?.moodLevel ?? null,
    symptoms: Array.isArray(entry?.symptoms) ? entry.symptoms : [],
    symptomDetails: normalizeSymptomDetails(entry?.symptoms, entry?.symptomDetails),
    notes: entry?.notes || "",
    source: entry?.source || null,
    ownership: entry?.ownership || null,
    syncVersion: entry?.syncVersion ?? null,
    clientRecordId: entry?.clientRecordId || null,
    clientRecordVersion: entry?.clientRecordVersion ?? null,
    healthConnectRecordId: entry?.healthConnectRecordId || null,
    dataOrigin: entry?.dataOrigin || null,
    temporalIntegrity: entry?.temporalIntegrity || null,
    healthConnectLastModifiedTime: entry?.healthConnectLastModifiedTime || null,
    syncConflict: entry?.syncConflict || null,
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null
  });
  const canonical = (list) => list
    .map(fingerprint)
    .sort();
  return JSON.stringify(canonical(oldList)) !== JSON.stringify(canonical(newList));
}
