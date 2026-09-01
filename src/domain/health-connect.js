import { isValidDateKey, isValidTime } from "./schedule.js";
import { haveMeasurementsChanged } from "./measurements.js";
import {
  isValidIsoTimestamp,
  isValidZoneOffset,
  localDateTimeToIso
} from "./time.js";

export { haveMeasurementsChanged, isValidIsoTimestamp, localDateTimeToIso };

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
 * Valida se uma string é um timestamp ISO 8601 válido e parseável.
 *
 * @param {string} str
 * @returns {boolean}
 */
/**
 * Converte uma medição interna do Protocolo PEP para o formato de registro de peso do Health Connect.
 * Registros de origem externa ou sem peso válido NÃO são exportados (prevenção de Sync Echo).
 * Preserva o instante temporal exato (timestamp) e o zoneOffset histórico sem recalcular por fuso atual.
 *
 * @param {Object} measurement - Entrada de medição do PEP
 * @returns {{ timestamp: string, time: string, zoneOffset: string|null, weightKg: number, clientRecordId: string, clientRecordVersion: number, metadataId: string } | null}
 */
export function mapMeasurementToHealthRecord(measurement) {
  if (!measurement || typeof measurement !== "object") return null;

  // P1 (CODEX v2.5.0 Item 6): Prevenção de Sync Echo baseada exclusivamente em ownership.
  // Registros externos (ownership === "external") nunca são exportados.
  // Registros do PEP (mesmo reimportados com source === "health_connect") continuam exportáveis.
  if (measurement.ownership === "external") {
    return null;
  }

  const { weightKg, date, time, id, syncVersion, clientRecordVersion, timestamp, zoneOffset, timeZoneId } = measurement;
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

  // Item 4 (P0): Usar measurement.timestamp diretamente se for válido (fonte de verdade do instante histórico)
  let isoTime = null;
  if (timestamp) {
    if (!isValidIsoTimestamp(timestamp)) {
      return null; // Rejeição estrita fail-closed de timestamp corrompido
    }
    isoTime = new Date(timestamp).toISOString();
  } else {
    isoTime = localDateTimeToIso(String(date), cleanTime, zoneOffset || null, timeZoneId || null);
  }

  if (!isoTime) return null;

  const recordId = id ? String(id) : `m_${date}_${cleanTime.replace(":", "")}`;
  const version = Math.max(1, parseInt(clientRecordVersion || syncVersion, 10) || 1);

  return {
    timestamp: isoTime,
    time: isoTime,
    zoneOffset: zoneOffset || null,
    timeZoneId: timeZoneId || null,
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

  const timeSource = record.timestamp || (isValidIsoTimestamp(record.time) ? record.time : null);
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

  const resolvedTimestamp = timeSource || localDateTimeToIso(
    dateStr,
    timeStr,
    isValidZoneOffset(record.zoneOffset) ? record.zoneOffset : null,
    record.timeZoneId || null
  );
  if (!resolvedTimestamp || !isValidIsoTimestamp(resolvedTimestamp)) return null;

  const hcRecId = record.healthConnectRecordId || record.metadataId || record.id || "";
  const clientRecId = record.clientRecordId || "";
  const originPkg = record.dataOrigin || "unknown";
  // Item 7: Apenas o package com.protocolopep.app define ownership PEP (sem qualquer inferência por clientRecordId)
  const isPepOrigin = originPkg === "com.protocolopep.app";

  // Chave composta para registros externos evitando colisões de IDs idênticos entre apps distintos
  const resolvedId = isPepOrigin && clientRecId
    ? clientRecId
    : (hcRecId ? `hc_${originPkg}_${hcRecId}` : `hc_${dateStr}_${timeStr.replace(":", "")}`);

  const importedAt = new Date().toISOString();
  const remoteVersion = Math.max(1, parseInt(record.clientRecordVersion, 10) || 1);

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
    dataOrigin: originPkg,
    healthConnectRecordId: hcRecId,
    clientRecordId: clientRecId,
    syncVersion: remoteVersion,
    clientRecordVersion: remoteVersion,
    zoneOffset: record.zoneOffset || null,
    timeZoneId: record.timeZoneId || null,
    // P0 (CODEX v2.5.0): timestamp = instante histórico do Health Connect
    timestamp: resolvedTimestamp,
    // createdAt local = momento em que o registro entrou no PEP.
    createdAt: importedAt,
    updatedAt: importedAt
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
      // 1. Correspondência por healthConnectRecordId nativo (se ambos possuírem)
      const matchByHcId = Boolean(
        localEntry.healthConnectRecordId &&
        parsed.healthConnectRecordId &&
        localEntry.healthConnectRecordId === parsed.healthConnectRecordId
      );

      // 2. Correspondência por clientRecordId
      let matchByClientRecId = false;
      if (raw.clientRecordId) {
        if (id === raw.clientRecordId) {
          matchByClientRecId = true;
        } else if (localEntry.clientRecordId && localEntry.clientRecordId === raw.clientRecordId) {
          if (!localEntry.dataOrigin || !parsed.dataOrigin || localEntry.dataOrigin === parsed.dataOrigin) {
            matchByClientRecId = true;
          }
        }
      }

      // 3. Correspondência por ID
      const matchById = id === parsed.id;

      if (matchByHcId || matchByClientRecId || matchById) {
        matchedId = id;
        break;
      }
    }

    if (matchedId) {
      const existing = resultMap.get(matchedId);
      if (existing.ownership === "external" || parsed.ownership === "external") {
        const remoteAuthoritative = {
          ...existing,
          date: parsed.date,
          time: parsed.time,
          timestamp: parsed.timestamp,
          zoneOffset: parsed.zoneOffset,
          timeZoneId: parsed.timeZoneId,
          weightKg: parsed.weightKg,
          source: "health_connect",
          ownership: "external",
          healthConnectRecordId: parsed.healthConnectRecordId,
          clientRecordId: parsed.clientRecordId,
          clientRecordVersion: parsed.clientRecordVersion,
          syncVersion: parsed.syncVersion,
          dataOrigin: parsed.dataOrigin,
          createdAt: existing.createdAt || parsed.createdAt,
          updatedAt: existing.updatedAt || existing.createdAt || parsed.createdAt
        };
        const changedRemotely = haveMeasurementsChanged(
          [{ ...existing, updatedAt: remoteAuthoritative.updatedAt }],
          [remoteAuthoritative]
        );
        resultMap.set(matchedId, {
          ...remoteAuthoritative,
          updatedAt: changedRemotely ? new Date().toISOString() : remoteAuthoritative.updatedAt
        });
      } else {
        // Registros do PEP preservam conteúdo local e apenas recebem identidade remota.
        resultMap.set(matchedId, {
          ...existing,
          healthConnectRecordId: parsed.healthConnectRecordId || existing.healthConnectRecordId,
          clientRecordId: parsed.clientRecordId || existing.clientRecordId,
          clientRecordVersion: parsed.clientRecordVersion || existing.clientRecordVersion,
          dataOrigin: parsed.dataOrigin || existing.dataOrigin,
          zoneOffset: existing.zoneOffset || parsed.zoneOffset,
          timeZoneId: existing.timeZoneId || parsed.timeZoneId,
          createdAt: existing.createdAt || parsed.createdAt,
          updatedAt: existing.updatedAt || existing.createdAt || parsed.createdAt
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
