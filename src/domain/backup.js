/**
 * Validação, Serialização e Segurança de Backup JSON
 */

import { migrateAppState, CURRENT_SCHEMA_VERSION } from "./migrations.js";

export const MAX_BACKUP_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function createBackupPayload(protocol = [], logs = {}, theme = "black", inventory = [], sites = [], measurements = []) {
  const payload = {
    app: "protocolo-pep",
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    protocol: Array.isArray(protocol) ? protocol : [],
    logs: logs && typeof logs === "object" ? logs : {},
    inventory: Array.isArray(inventory) ? inventory : [],
    sites: Array.isArray(sites) ? sites : [],
    measurements: Array.isArray(measurements) ? measurements : [],
    theme: theme === "white" ? "white" : "black"
  };

  return JSON.stringify(payload, null, 2);
}

export function validateAndParseBackup(jsonString) {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { valid: false, error: "Arquivo de backup vazio ou inválido." };
  }

  if (jsonString.length > MAX_BACKUP_SIZE_BYTES) {
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

  // Executar migração e sanitização completa de domínio
  const cleanState = migrateAppState(parsed);

  // Calcular estatísticas para prévia
  const peptideCount = cleanState.protocol.length;
  const logDaysCount = Object.keys(cleanState.logs).length;
  const vialsCount = Array.isArray(cleanState.inventory) ? cleanState.inventory.length : 0;
  const sitesCount = Array.isArray(cleanState.sites) ? cleanState.sites.length : 0;
  const measurementsCount = Array.isArray(cleanState.measurements) ? cleanState.measurements.length : 0;
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
      theme: cleanState.theme,
      exportedAt: cleanState.exportedAt
    }
  };
}
