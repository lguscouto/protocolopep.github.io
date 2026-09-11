/**
 * Validação, Serialização e Segurança de Backup JSON
 */

import { migrateAppState, CURRENT_SCHEMA_VERSION, sanitizeHealthConnectState } from "./migrations.js";
import { normalizeSyringeMaxUI } from "./syringe.js";
import { normalizeMeasurementGoals } from "./measurements.js";

export const MAX_BACKUP_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Gera uma cópia para exportação, preenchendo apenas snapshots de cálculo
 * legados. Nunca altera protocolo ou histórico mantidos no dispositivo.
 */
function normalizeSnapshotsForBackup(value) {
  if (Array.isArray(value)) return value.map(normalizeSnapshotsForBackup);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === "calculationSnapshot" ? normalizeCalculationSnapshotForExport(item) : normalizeSnapshotsForBackup(item)
  ]));
}

export function normalizeCalculationSnapshotForExport(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return { ...snapshot, syringeMaxUI: normalizeSyringeMaxUI(snapshot.syringeMaxUI) };
}

export function normalizeBackupTheme(theme) {
  const normalized = String(theme || "").trim().toLowerCase();
  return ["white", "branco", "light"].includes(normalized) ? "white" : "black";
}

export function createBackupPayload(
  protocol = [],
  logs = {},
  theme = "black",
  inventory = [],
  sites = [],
  measurements = [],
  healthConnectState = {},
  measurementGoals = {}
) {
  const payload = {
    app: "protocolo-pep",
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    protocol: normalizeSnapshotsForBackup(Array.isArray(protocol) ? protocol : []),
    logs: normalizeSnapshotsForBackup(logs && typeof logs === "object" ? logs : {}),
    inventory: Array.isArray(inventory) ? inventory : [],
    sites: Array.isArray(sites) ? sites : [],
    measurements: Array.isArray(measurements) ? measurements : [],
    healthConnectState: sanitizeHealthConnectState(healthConnectState),
    measurementGoals: normalizeMeasurementGoals(measurementGoals),
    theme: normalizeBackupTheme(theme)
  };

  return JSON.stringify(payload, null, 2);
}

export function validateAndParseBackup(jsonString) {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { valid: false, error: "Arquivo de backup vazio ou inválido." };
  }

  const byteLength = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(jsonString).length
    : (typeof Buffer !== "undefined" ? Buffer.byteLength(jsonString, "utf8") : jsonString.length);

  if (byteLength > MAX_BACKUP_SIZE_BYTES) {
    return { valid: false, error: "Arquivo de backup excede o tamanho máximo permitido (5 MB)." };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return { valid: false, error: "Formato JSON corrompido ou inválido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, error: "Estrutura raiz do backup deve ser um objeto." };
  }

  // Se versão for maior que a suportada
  const version = parseInt(parsed.version, 10) || 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Versão do backup (${version}) é mais recente que a versão suportada por este aplicativo.`
    };
  }

  // Executar migração e sanitização completa de domínio em bloco seguro fail-closed
  let cleanState;
  try {
    cleanState = migrateAppState(parsed);
  } catch (err) {
    return {
      valid: false,
      error: `Erro ao processar dados do backup: ${err?.message || "Estrutura semântica inválida."}`
    };
  }

  if (!cleanState || !Array.isArray(cleanState.protocol) || !cleanState.logs) {
    return { valid: false, error: "Estrutura de dados resultante do backup é inválida." };
  }

  // Calcular estatísticas para prévia
  const peptideCount = cleanState.protocol.length;
  const logDaysCount = Object.keys(cleanState.logs).length;
  const vialsCount = Array.isArray(cleanState.inventory) ? cleanState.inventory.length : 0;
  const sitesCount = Array.isArray(cleanState.sites) ? cleanState.sites.length : 0;
  const measurementsCount = Array.isArray(cleanState.measurements) ? cleanState.measurements.length : 0;
  const tombstonesCount = cleanState.healthConnectState?.tombstones?.length || 0;
  const hiddenMeasurementsCount = cleanState.healthConnectState?.hiddenMeasurementIds?.length || 0;
  let totalDosesCount = 0;

  Object.values(cleanState.logs).forEach((day) => {
    Object.values(day).forEach((pepLogs) => {
      if (Array.isArray(pepLogs)) {
        totalDosesCount += pepLogs.length;
      } else if (pepLogs && typeof pepLogs === "object") {
        totalDosesCount += 1;
      }
    });
  });

  return {
    valid: true,
    data: cleanState,
    stats: {
      peptideCount,
      logDaysCount,
      totalDosesCount,
      vialsCount,
      sitesCount,
      measurementsCount,
      tombstonesCount,
      hiddenMeasurementsCount,
      theme: cleanState.theme,
      exportedAt: cleanState.exportedAt
    }
  };
}
