import { createPeptide } from "./protocol.js";
import { normalizeDoseEntry } from "./dose-log.js";
import { createVial } from "./inventory.js";
import { validateSitesList, getDefaultSites } from "./injection-sites.js";
import { createMeasurementEntry } from "./measurements.js";
import { isValidDateKey } from "./schedule.js";

export const CURRENT_SCHEMA_VERSION = 4;

export function migratePeptides(rawPeptides = []) {
  if (!Array.isArray(rawPeptides)) return [];
  return rawPeptides.map((item) => createPeptide(item));
}

export function migrateLogs(rawLogs = {}) {
  if (!rawLogs || typeof rawLogs !== "object" || Array.isArray(rawLogs)) return {};
  const cleaned = {};

  Object.entries(rawLogs).forEach(([dateKey, rec]) => {
    // Validar dateKey YYYY-MM-DD
    if (!isValidDateKey(dateKey)) return;
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

export function migrateSites(rawSites) {
  if (!rawSites) return getDefaultSites();
  const res = validateSitesList(rawSites);
  return res.valid && res.sites.length > 0 ? res.sites : getDefaultSites();
}

export function migrateMeasurements(rawMeasurements = []) {
  if (!Array.isArray(rawMeasurements)) return [];
  return rawMeasurements
    .filter((item) => item && typeof item === "object")
    .map((item) => createMeasurementEntry(item));
}

export function migrateAppState(state = {}) {
  const version = parseInt(state.version, 10) || 1;
  const rawProtocol = state.protocol || state.peptides || [];
  const rawLogs = state.logs || {};
  const rawInventory = state.inventory || [];
  const rawSites = state.sites || state.injectionSites;
  const rawMeasurements = state.measurements || state.bodyMeasurements || [];

  const migratedProtocol = migratePeptides(rawProtocol);
  const migratedLogs = migrateLogs(rawLogs);
  const migratedInventory = migrateInventory(rawInventory);
  const migratedSites = migrateSites(rawSites);
  const migratedMeasurements = migrateMeasurements(rawMeasurements);

  return {
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: state.exportedAt || new Date().toISOString(),
    protocol: migratedProtocol,
    logs: migratedLogs,
    inventory: migratedInventory,
    sites: migratedSites,
    measurements: migratedMeasurements,
    theme: state.theme === "white" || state.theme === "light" ? "white" : "black"
  };
}
