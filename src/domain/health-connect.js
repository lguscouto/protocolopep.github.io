import { isValidDateKey, isValidTime } from "./schedule.js";

/**
 * Status possíveis da integração com o Health Connect.
 */
export const HEALTH_CONNECT_STATUS = Object.freeze({
  CONNECTED: "CONNECTED",
  AVAILABLE: "AVAILABLE",
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  PARTIALLY_AUTHORIZED: "PARTIALLY_AUTHORIZED",
  UPDATE_REQUIRED: "UPDATE_REQUIRED",
  UNAVAILABLE: "UNAVAILABLE",
  ERROR: "ERROR",
  DISABLED: "DISABLED",
  // Aliases retrocompatíveis
  PERMISSION_REQUIRED: "PERMISSION_REQUIRED",
  NOT_INSTALLED: "NOT_INSTALLED",
  NOT_SUPPORTED: "NOT_SUPPORTED"
});

/**
 * Retorna o texto descritivo e amigável para o status do Health Connect.
 * @param {string} status
 * @returns {string}
 */
export function getHealthConnectStatusLabel(status) {
  switch (status) {
    case HEALTH_CONNECT_STATUS.CONNECTED:
      return "Conectado";
    case HEALTH_CONNECT_STATUS.AVAILABLE:
      return "Disponível";
    case HEALTH_CONNECT_STATUS.NOT_AUTHORIZED:
    case HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED:
      return "Permissão Necessária";
    case HEALTH_CONNECT_STATUS.PARTIALLY_AUTHORIZED:
      return "Permissão Parcial";
    case HEALTH_CONNECT_STATUS.UPDATE_REQUIRED:
      return "Atualização Necessária";
    case HEALTH_CONNECT_STATUS.UNAVAILABLE:
    case HEALTH_CONNECT_STATUS.NOT_INSTALLED:
      return "App Não Instalado";
    case HEALTH_CONNECT_STATUS.NOT_SUPPORTED:
      return "Não Suportado no Dispositivo";
    case HEALTH_CONNECT_STATUS.ERROR:
      return "Erro de Conexão";
    case HEALTH_CONNECT_STATUS.DISABLED:
    default:
      return "Desativado";
  }
}

/**
 * Converte data e hora locais (YYYY-MM-DD, HH:mm) em timestamp ISO Instant real.
 * Valida estritamente os componentes de data e hora contra calendário gregoriano real.
 * 
 * @param {string} dateStr - Formato YYYY-MM-DD
 * @param {string} timeStr - Formato HH:mm
 * @returns {string|null} Timestamp ISO 8601 UTC ou null se inválido
 */
export function localDateTimeToIso(dateStr, timeStr = "08:00") {
  if (!isValidDateKey(dateStr) || !isValidTime(timeStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;

  return dt.toISOString();
}

/**
 * Converte timestamp ISO Instant em componentes de data (YYYY-MM-DD) e hora (HH:mm).
 * Se zoneOffset histórico for fornecido (ex: "-03:00", "+01:00", "Z"), preserva o horário local original.
 *
 * @param {string} isoString
 * @param {string} [zoneOffset]
 * @returns {{ date: string, time: string } | null}
 */
export function isoToLocalDateTime(isoString, zoneOffset = null) {
  if (!isoString || typeof isoString !== "string") return null;
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return null;

  if (zoneOffset && typeof zoneOffset === "string" && /^([+-]\d{2}:\d{2}|Z)$/.test(zoneOffset)) {
    if (zoneOffset === "Z") {
      const year = dt.getUTCFullYear();
      const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const day = String(dt.getUTCDate()).padStart(2, "0");
      const hours = String(dt.getUTCHours()).padStart(2, "0");
      const minutes = String(dt.getUTCMinutes()).padStart(2, "0");
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
    }

    const sign = zoneOffset[0] === "-" ? -1 : 1;
    const [offH, offM] = zoneOffset.slice(1).split(":").map(Number);
    const offsetMs = sign * ((offH * 60) + offM) * 60 * 1000;
    const targetDt = new Date(dt.getTime() + offsetMs);

    const year = targetDt.getUTCFullYear();
    const month = String(targetDt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(targetDt.getUTCDate()).padStart(2, "0");
    const hours = String(targetDt.getUTCHours()).padStart(2, "0");
    const minutes = String(targetDt.getUTCMinutes()).padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  }

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
}

/**
 * Converte uma medição interna do Protocolo PEP para o formato de registro de peso do Health Connect.
 * Registros de origem externa ou sem peso válido NÃO são exportados (prevenção de Sync Echo).
 *
 * @param {Object} measurement - Entrada de medição do PEP
 * @returns {{ timestamp: string, time: string, weightKg: number, clientRecordId: string, clientRecordVersion: number, metadataId: string } | null}
 */
export function mapMeasurementToHealthRecord(measurement) {
  if (!measurement || typeof measurement !== "object") return null;

  // Prevenção de Sync Echo: jamais exportar registros originados externamente no Health Connect
  if (measurement.source === "health_connect" || measurement.ownership === "external") {
    return null;
  }

  const { weightKg, date, time, id, syncVersion, clientRecordVersion } = measurement;
  if (weightKg === null || weightKg === undefined || weightKg === "") return null;

  const weightNum = typeof weightKg === "number" ? weightKg : parseFloat(String(weightKg).replace(",", "."));
  if (Number.isNaN(weightNum) || !Number.isFinite(weightNum) || weightNum <= 0) {
    return null;
  }

  if (!date || !isValidDateKey(String(date))) {
    return null;
  }

  if (time && !isValidTime(String(time))) {
    return null;
  }

  const cleanTime = time && isValidTime(String(time)) ? String(time) : "08:00";
  const isoTime = localDateTimeToIso(String(date), cleanTime);
  if (!isoTime) return null;

  const recordId = id ? String(id) : `m_${date}_${cleanTime.replace(":", "")}`;
  const version = Math.max(1, parseInt(clientRecordVersion || syncVersion, 10) || 1);

  return {
    timestamp: isoTime,
    time: isoTime,
    weightKg: Math.round(weightNum * 100) / 100,
    clientRecordId: recordId,
    clientRecordVersion: version,
    metadataId: recordId
  };
}

/**
 * Converte um registro vindo do Health Connect para o formato de medição interna do Protocolo PEP.
 * Preserva identidade, dataOrigin, zoneOffset e versionamento nativo.
 *
 * @param {Object} record - Registro do Health Connect
 * @returns {Object|null}
 */
export function mapHealthRecordToMeasurement(record) {
  if (!record || typeof record !== "object") return null;

  const rawWeight = record.weightKg ?? record.weight;
  if (rawWeight === null || rawWeight === undefined) return null;

  const weightNum = typeof rawWeight === "number" ? rawWeight : parseFloat(String(rawWeight).replace(",", "."));
  if (Number.isNaN(weightNum) || !Number.isFinite(weightNum) || weightNum <= 0) {
    return null;
  }

  let dateStr = "";
  let timeStr = "08:00";

  const timeSource = record.timestamp || record.time;
  if (timeSource && typeof timeSource === "string") {
    const localComponents = isoToLocalDateTime(timeSource, record.zoneOffset);
    if (localComponents && isValidDateKey(localComponents.date) && isValidTime(localComponents.time)) {
      dateStr = localComponents.date;
      timeStr = localComponents.time;
    }
  }

  if (!dateStr && record.date && isValidDateKey(record.date)) {
    dateStr = record.date;
    if (record.time && isValidTime(record.time)) {
      timeStr = record.time;
    } else if (record.localTime && isValidTime(record.localTime)) {
      timeStr = record.localTime;
    }
  }

  if (!dateStr || !isValidDateKey(dateStr)) {
    return null; // Rejeição estrita de registros sem data válida
  }

  const hcRecId = record.healthConnectRecordId || record.metadataId || record.id || "";
  const clientRecId = record.clientRecordId || "";
  const originPkg = record.dataOrigin || "";
  // Item 6: Apenas o package com.protocolopep.app define ownership PEP (sem heurísticas por clientRecordId)
  const isPepOrigin = originPkg === "com.protocolopep.app";

  // Chave composta para registros externos evitando colisões de IDs idênticos entre apps distintos
  const resolvedId = isPepOrigin && clientRecId
    ? clientRecId
    : (hcRecId ? `hc_${originPkg || "ext"}_${hcRecId}` : `hc_${dateStr}_${timeStr.replace(":", "")}`);

  return {
    id: resolvedId,
    date: dateStr,
    time: timeStr,
    weightKg: Math.round(weightNum * 100) / 100,
    energyLevel: null,
    moodLevel: null,
    symptoms: [],
    notes: "Importado via Health Connect",
    source: "health_connect",
    ownership: isPepOrigin ? "pep" : "external",
    dataOrigin: originPkg || "unknown",
    healthConnectRecordId: hcRecId,
    clientRecordId: clientRecId,
    clientRecordVersion: parseInt(record.clientRecordVersion, 10) || 1,
    zoneOffset: record.zoneOffset || null,
    createdAt: timeSource || new Date().toISOString()
  };
}

/**
 * Mescla medições locais existentes com medições importadas do Health Connect.
 * Garante idempotência estrita: preserva anotações/sintomas do usuário e atualiza pesos com segurança.
 *
 * @param {Object[]} localMeasurements - Medições armazenadas localmente
 * @param {Object[]} importedRecords - Registros recebidos do Health Connect
 * @returns {Object[]} Lista combinada e ordenada por data decrescente
 */
export function mergeHealthMeasurements(localMeasurements = [], importedRecords = []) {
  const locals = Array.isArray(localMeasurements) ? [...localMeasurements] : [];
  const imported = Array.isArray(importedRecords) ? importedRecords : [];

  const resultMap = new Map();

  for (const item of locals) {
    if (item && item.id) {
      resultMap.set(item.id, { ...item });
    }
  }

  for (const raw of imported) {
    const parsed = mapHealthRecordToMeasurement(raw);
    if (!parsed) continue;

    let matchedId = null;
    for (const [id, localEntry] of resultMap.entries()) {
      const matchById = id === parsed.id || (raw.clientRecordId && id === raw.clientRecordId);
      const matchByDateTime = localEntry.date === parsed.date && localEntry.time === parsed.time;
      if (matchById || matchByDateTime) {
        matchedId = id;
        break;
      }
    }

    if (matchedId) {
      const existing = resultMap.get(matchedId);
      // Se a medição local veio do Health Connect ou não tinha peso definido, atualiza o peso
      if (existing.weightKg === null || existing.weightKg === undefined || existing.source === "health_connect") {
        resultMap.set(matchedId, {
          ...existing,
          weightKg: parsed.weightKg,
          source: existing.source || "health_connect",
          healthConnectRecordId: parsed.healthConnectRecordId || existing.healthConnectRecordId,
          dataOrigin: parsed.dataOrigin || existing.dataOrigin,
          zoneOffset: parsed.zoneOffset || existing.zoneOffset
        });
      }
    } else {
      resultMap.set(parsed.id, parsed);
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => {
    const dtA = `${a.date || ""} ${a.time || ""}`;
    const dtB = `${b.date || ""} ${b.time || ""}`;
    return dtB.localeCompare(dtA);
  });
}

/**
 * Verifica de forma auditável e profunda se duas listas de medições possuem diferenças de conteúdo.
 *
 * @param {Object[]} oldList
 * @param {Object[]} newList
 * @returns {boolean} True se houver alterações de conteúdo ou tamanho
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
    if (a.ownership !== b.ownership) return true;
    if (a.syncVersion !== b.syncVersion) return true;
    const symA = Array.isArray(a.symptoms) ? a.symptoms.join("|") : "";
    const symB = Array.isArray(b.symptoms) ? b.symptoms.join("|") : "";
    if (symA !== symB) return true;
  }
  return false;
}
