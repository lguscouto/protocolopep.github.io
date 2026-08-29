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
  AVAILABLE: "AVAILABLE",
  NOT_INSTALLED: "NOT_INSTALLED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  CONNECTED: "CONNECTED",
  PERMISSION_REQUIRED: "PERMISSION_REQUIRED",
  DISABLED: "DISABLED"
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
    case HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED:
      return "Permissão Necessária";
    case HEALTH_CONNECT_STATUS.NOT_INSTALLED:
      return "App Não Instalado";
    case HEALTH_CONNECT_STATUS.NOT_SUPPORTED:
      return "Não Suportado no Dispositivo";
    case HEALTH_CONNECT_STATUS.DISABLED:
    default:
      return "Desativado";
  }
}

/**
 * Converte uma medição interna do Protocolo PEP para o formato de registro de peso do Health Connect.
 *
 * @param {Object} measurement - Entrada de medição do PEP
 * @returns {{ time: string, weightKg: number, metadataId: string } | null}
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

  const isoTime = `${cleanDate}T${cleanTime}:00.000Z`;

  return {
    time: isoTime,
    weightKg: Math.round(weightNum * 100) / 100,
    metadataId: id ? String(id) : `m_${cleanDate}_${cleanTime.replace(":", "")}`
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

  if (record.time && typeof record.time === "string") {
    try {
      const dt = new Date(record.time);
      if (!Number.isNaN(dt.getTime())) {
        dateStr = dt.toISOString().slice(0, 10);
        timeStr = dt.toTimeString().slice(0, 5);
      }
    } catch {
      dateStr = record.time.slice(0, 10);
    }
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = new Date().toISOString().slice(0, 10);
  }

  return {
    id: record.metadataId || record.id || `hc_${dateStr}_${timeStr.replace(":", "")}`,
    date: dateStr,
    time: timeStr,
    weightKg: Math.round(weightNum * 100) / 100,
    energyLevel: null,
    moodLevel: null,
    symptoms: [],
    notes: "Importado via Health Connect",
    source: "health_connect",
    createdAt: record.time || new Date().toISOString()
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
      if (id === parsed.id || (localEntry.date === parsed.date && localEntry.time === parsed.time)) {
        matchedId = id;
        break;
      }
    }

    if (matchedId) {
      const existing = resultMap.get(matchedId);
      if (existing.weightKg === null || existing.weightKg === undefined || existing.source === "health_connect") {
        resultMap.set(matchedId, {
          ...existing,
          weightKg: parsed.weightKg
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
