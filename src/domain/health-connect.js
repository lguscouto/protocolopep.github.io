/**
 * Módulo de Domínio: Health Connect (V15)
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & Offline First: Sem dependências externas de rede ou APIs de terceiros.
 * - Mapeamento Puro e Auditável: Funções puras para conversão bidirecional entre o modelo de medições do PEP e os registros do Health Connect.
 * - Resiliência e Fail-Closed: Distinção estrita entre ausente (null) e zero (0), sem mutações de estado e com mesclagem idempotente.
 */

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
 * @param {string} dateStr - Formato YYYY-MM-DD
 * @param {string} timeStr - Formato HH:mm
 * @returns {string} Timestamp ISO 8601 UTC
 */
export function localDateTimeToIso(dateStr, timeStr) {
  const partsDate = (dateStr || "").split("-").map(Number);
  const partsTime = (timeStr || "08:00").split(":").map(Number);

  const year = partsDate[0] || new Date().getFullYear();
  const month = (partsDate[1] || 1) - 1;
  const day = partsDate[2] || 1;
  const hour = partsTime[0] || 0;
  const minute = partsTime[1] || 0;

  const dt = new Date(year, month, day, hour, minute, 0, 0);
  return dt.toISOString();
}

/**
 * Converte timestamp ISO Instant em componentes de data (YYYY-MM-DD) e hora (HH:mm) no fuso local do dispositivo.
 * @param {string} isoString
 * @returns {{ date: string, time: string } | null}
 */
export function isoToLocalDateTime(isoString) {
  if (!isoString || typeof isoString !== "string") return null;
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return null;

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
 *
 * @param {Object} measurement - Entrada de medição do PEP
 * @returns {{ timestamp: string, time: string, weightKg: number, clientRecordId: string, metadataId: string } | null}
 */
export function mapMeasurementToHealthRecord(measurement) {
  if (!measurement || typeof measurement !== "object") return null;

  const { weightKg, date, time, id } = measurement;
  if (weightKg === null || weightKg === undefined || weightKg === "") return null;

  const weightNum = typeof weightKg === "number" ? weightKg : parseFloat(String(weightKg).replace(",", "."));
  if (Number.isNaN(weightNum) || !Number.isFinite(weightNum) || weightNum <= 0) {
    return null;
  }

  const cleanDate = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))
    ? String(date)
    : new Date().toISOString().slice(0, 10);

  const cleanTime = time && /^\d{2}:\d{2}$/.test(String(time))
    ? String(time)
    : "08:00";

  const isoTime = localDateTimeToIso(cleanDate, cleanTime);
  const recordId = id ? String(id) : `m_${cleanDate}_${cleanTime.replace(":", "")}`;

  return {
    timestamp: isoTime,
    time: isoTime,
    weightKg: Math.round(weightNum * 100) / 100,
    clientRecordId: recordId,
    metadataId: recordId
  };
}

/**
 * Converte um registro vindo do Health Connect para o formato de medição interna do Protocolo PEP.
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
    const localComponents = isoToLocalDateTime(timeSource);
    if (localComponents) {
      dateStr = localComponents.date;
      timeStr = localComponents.time;
    }
  }

  if (!dateStr && record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    dateStr = record.date;
    if (record.time && /^\d{2}:\d{2}$/.test(record.time)) {
      timeStr = record.time;
    }
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  const resolvedId = record.clientRecordId || record.metadataId || record.id || `hc_${dateStr}_${timeStr.replace(":", "")}`;

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
    createdAt: timeSource || new Date().toISOString()
  };
}

/**
 * Mescla medições locais existentes com medições importadas do Health Connect.
 * Garante idempotência: se já existe um registro para a mesma data com peso, preserva notas/sintomas locais.
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
      if (existing.weightKg === null || existing.weightKg === undefined || existing.source === "health_connect") {
        resultMap.set(matchedId, {
          ...existing,
          weightKg: parsed.weightKg,
          source: existing.source || "health_connect"
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
    const symA = Array.isArray(a.symptoms) ? a.symptoms.join("|") : "";
    const symB = Array.isArray(b.symptoms) ? b.symptoms.join("|") : "";
    if (symA !== symB) return true;
  }
  return false;
}
