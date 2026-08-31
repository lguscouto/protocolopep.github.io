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
 * @param {string|null} [params.healthConnectRecordId]
 * @param {string|null} [params.dataOrigin]
 * @param {string|null} [params.zoneOffset]
 * @param {string} [params.createdAt] - Timestamp ISO de criação
 * @returns {Object}
 */
export function createMeasurementEntry({
  id = null,
  date,
  time = "08:00",
  weightKg = null,
  energyLevel = null,
  moodLevel = null,
  symptoms = [],
  notes = "",
  source = "local",
  ownership = "pep",
  syncVersion = 1,
  clientRecordVersion = 1,
  healthConnectRecordId = null,
  dataOrigin = null,
  zoneOffset = null,
  createdAt = null
}) {
  let parsedWeight = null;
  if (weightKg !== null && weightKg !== undefined && weightKg !== "") {
    const num = typeof weightKg === "number" ? weightKg : parseFloat(String(weightKg).replace(",", "."));
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      parsedWeight = Math.round(num * 100) / 100;
    }
  }

  let parsedEnergy = null;
  if (energyLevel !== null && energyLevel !== undefined && energyLevel !== "") {
    const e = parseInt(String(energyLevel), 10);
    if (!Number.isNaN(e) && e >= 1 && e <= 5) {
      parsedEnergy = e;
    }
  }

  let parsedMood = null;
  if (moodLevel !== null && moodLevel !== undefined && moodLevel !== "") {
    const m = parseInt(String(moodLevel), 10);
    if (!Number.isNaN(m) && m >= 1 && m <= 5) {
      parsedMood = m;
    }
  }

  const cleanedSymptoms = Array.isArray(symptoms)
    ? symptoms.map(formatSymptomLabel).filter((s) => s.length > 0)
    : [];

  const uniqueSymptoms = [...new Set(cleanedSymptoms)];
  const cleanDate = date && isValidDateKey(String(date)) ? String(date) : new Date().toISOString().slice(0, 10);
  const cleanTime = time && isValidTime(String(time)) ? String(time) : "08:00";
  const version = Math.max(1, parseInt(syncVersion || clientRecordVersion, 10) || 1);

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
    ownership: ownership || (source === "health_connect" ? "external" : "pep"),
    syncVersion: version,
    clientRecordVersion: version,
    healthConnectRecordId: healthConnectRecordId || null,
    dataOrigin: dataOrigin || (source === "local" ? "com.protocolopep.app" : null),
    zoneOffset: zoneOffset || null,
    createdAt: createdAt || new Date().toISOString()
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
  if (oldList.length !== newList.length) {
    return true;
  }
  for (let i = 0; i < oldList.length; i++) {
    const a = oldList[i];
    const b = newList[i];
    if (!a || !b) return true;
    if (a.id !== b.id) return true;
    if (a.date !== b.date) return true;
    if (a.time !== b.time) return true;
    if (a.weightKg !== b.weightKg) return true;
    if (a.energyLevel !== b.energyLevel) return true;
    if (a.moodLevel !== b.moodLevel) return true;
    if (a.notes !== b.notes) return true;
    if (a.source !== b.source) return true;
    const symA = Array.isArray(a.symptoms) ? a.symptoms.join("|") : "";
    const symB = Array.isArray(b.symptoms) ? b.symptoms.join("|") : "";
    if (symA !== symB) return true;
  }
  return false;
}
