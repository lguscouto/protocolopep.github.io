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

/**
 * Sanitiza e valida o formato de texto de um sintoma.
 * @param {string} symptom
 * @returns {string}
 */
export function formatSymptomLabel(symptom) {
  if (!symptom || typeof symptom !== "string") return "";
  return symptom.trim().slice(0, 60);
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
  energyLevel = null,
  moodLevel = null,
  symptoms = [],
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
  updatedAt = null
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

  const cleanedSymptoms = Array.isArray(symptoms)
    ? symptoms.map(formatSymptomLabel).filter((s) => s.length > 0)
    : [];

  const uniqueSymptoms = [...new Set(cleanedSymptoms)];
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

  const explicitTimestamp = requireValidInstant(timestamp, "timestamp");
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
    energyLevel: parsedEnergy,
    moodLevel: parsedMood,
    symptoms: uniqueSymptoms,
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
      mostFrequentSymptom: null
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
    mostFrequentSymptom
  };
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
    notes: entry?.notes || "",
    source: entry?.source || null,
    ownership: entry?.ownership || null,
    syncVersion: entry?.syncVersion ?? null,
    clientRecordId: entry?.clientRecordId || null,
    clientRecordVersion: entry?.clientRecordVersion ?? null,
    healthConnectRecordId: entry?.healthConnectRecordId || null,
    dataOrigin: entry?.dataOrigin || null,
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null
  });
  const canonical = (list) => list
    .map(fingerprint)
    .sort();
  return JSON.stringify(canonical(oldList)) !== JSON.stringify(canonical(newList));
}
