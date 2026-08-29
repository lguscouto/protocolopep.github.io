import { createPeptide } from "./protocol.js";
import { normalizeDoseEntry } from "./dose-log.js";
import { createVial } from "./inventory.js";

export const CURRENT_SCHEMA_VERSION = 3;

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
        cleaned[dateKey][pepId] = doseData
          .map((d) => normalizeDoseEntry(d, dateKey, pepId))
          .filter(Boolean);
      } else if (doseData && typeof doseData === "object") {
        const norm = normalizeDoseEntry(doseData, dateKey, pepId);
        if (norm) cleaned[dateKey][pepId] = [norm];
      }
    });
  });

  return cleaned;
}

export function migrateInventory(rawInventory = []) {
  if (!Array.isArray(rawInventory)) return [];
  return rawInventory.map((item) => createVial(item));
}

export function migrateAppState(state = {}) {
  const version = parseInt(state.version, 10) || 1;
  const rawProtocol = state.protocol || state.peptides || [];
  const rawLogs = state.logs || {};
  const rawInventory = state.inventory || [];

  const migratedProtocol = migratePeptides(rawProtocol);
  const migratedLogs = migrateLogs(rawLogs);
  const migratedInventory = migrateInventory(rawInventory);

  return {
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: state.exportedAt || new Date().toISOString(),
    protocol: migratedProtocol,
    logs: migratedLogs,
    inventory: migratedInventory,
    theme: state.theme === "white" || state.theme === "light" ? "white" : "black"
  };
}
