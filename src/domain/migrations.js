import { createPeptide } from "./protocol.js";
import { normalizeDoseEntry } from "./dose-log.js";
import { createVial } from "./inventory.js";
import { validateSitesList, getDefaultSites } from "./injection-sites.js";
import { createMeasurementEntry } from "./measurements.js";
import { isValidDateKey } from "./schedule.js";

export const CURRENT_SCHEMA_VERSION = 5;

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

export function migrateV1ToV2(state = {}) {
  const rawProtocol = state.protocol || state.peptides || [];
  return {
    ...state,
    version: 2,
    protocol: migratePeptides(rawProtocol)
  };
}

export function migrateV2ToV3(state = {}) {
  const rawLogs = state.logs || {};
  return {
    ...state,
    version: 3,
    logs: migrateLogs(rawLogs)
  };
}

export function migrateV3ToV4(state = {}) {
  const rawInventory = state.inventory || [];
  const rawSites = state.sites || state.injectionSites;
  const rawMeasurements = state.measurements || state.bodyMeasurements || [];
  return {
    ...state,
    version: 4,
    inventory: migrateInventory(rawInventory),
    sites: migrateSites(rawSites),
    measurements: migrateMeasurements(rawMeasurements)
  };
}

/**
 * V4 → V5: Adiciona campo `updatedAt` em medições legadas que não possuem o campo.
 * O valor inicial de `updatedAt` é herdado de `createdAt` (ou `timestamp` como fallback),
 * representando que o registro não foi editado desde a criação.
 * (P0 CODEX v2.5.0 — separação semântica de timestamp/createdAt/updatedAt)
 */
export function migrateV4ToV5(state = {}) {
  const rawMeasurements = state.measurements || [];
  const measurements = Array.isArray(rawMeasurements)
    ? rawMeasurements.map((m) => {
        if (!m || typeof m !== "object") return m;
        if (m.updatedAt) return m; // já possui o campo — não alterar
        return {
          ...m,
          updatedAt: m.createdAt || m.timestamp || new Date().toISOString()
        };
      })
    : [];
  return {
    ...state,
    version: 5,
    measurements
  };
}

export function migrateAppState(state = {}) {
  if (!state || typeof state !== "object") {
    state = {};
  }
  const version = parseInt(state.version, 10) || 1;
  let current = { ...state };

  if (version < 2) {
    current = migrateV1ToV2(current);
  }
  if (version < 3) {
    current = migrateV2ToV3(current);
  }
  if (version < 4) {
    current = migrateV3ToV4(current);
  }
  if (version < 5) {
    current = migrateV4ToV5(current);
  }

  const rawProtocol = current.protocol || current.peptides || [];
  const rawLogs = current.logs || {};
  const rawInventory = current.inventory || [];
  const rawSites = current.sites || current.injectionSites;
  const rawMeasurements = current.measurements || current.bodyMeasurements || [];

  return {
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: current.exportedAt || new Date().toISOString(),
    protocol: migratePeptides(rawProtocol),
    logs: migrateLogs(rawLogs),
    inventory: migrateInventory(rawInventory),
    sites: migrateSites(rawSites),
    measurements: migrateMeasurements(rawMeasurements),
    theme: current.theme === "white" || current.theme === "light" ? "white" : "black"
  };
}
