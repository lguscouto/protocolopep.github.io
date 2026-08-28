/**
 * Migrações de Esquema de Dados Local-First (Idempotentes)
 */

import { createPeptide } from "./protocol.js";

export const CURRENT_SCHEMA_VERSION = 2;

export function migratePeptides(rawPeptides = []) {
  if (!Array.isArray(rawPeptides)) return [];
  return rawPeptides.map((item) => createPeptide(item));
}

export function migrateLogs(rawLogs = {}) {
  if (!rawLogs || typeof rawLogs !== "object" || Array.isArray(rawLogs)) return {};
  const cleaned = {};

  Object.entries(rawLogs).forEach(([dateKey, rec]) => {
    // Validar dateKey YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return;

    cleaned[dateKey] = {};
    Object.entries(rec).forEach(([pepId, doseData]) => {
      if (Array.isArray(doseData)) {
        cleaned[dateKey][pepId] = doseData.filter((d) => d && typeof d === "object");
      } else if (doseData && typeof doseData === "object") {
        cleaned[dateKey][pepId] = doseData;
      }
    });
  });

  return cleaned;
}

export function migrateAppState(state = {}) {
  const version = parseInt(state.version, 10) || 1;
  const rawProtocol = state.protocol || state.peptides || [];
  const rawLogs = state.logs || {};

  const migratedProtocol = migratePeptides(rawProtocol);
  const migratedLogs = migrateLogs(rawLogs);

  return {
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: state.exportedAt || new Date().toISOString(),
    protocol: migratedProtocol,
    logs: migratedLogs,
    theme: state.theme === "white" || state.theme === "light" ? "white" : "black"
  };
}
