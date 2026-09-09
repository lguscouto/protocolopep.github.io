import { doseStatus } from "./dose-state.js";

export function buildLastSiteIndex(logs = {}) {
  const byPeptide = new Map();
  let latest = null;
  const dates = Object.keys(logs || {}).sort().reverse();

  for (const date of dates) {
    const day = logs[date];
    if (!day || typeof day !== "object") continue;
    for (const peptideId of Object.keys(day)) {
      if (byPeptide.has(peptideId)) continue;
      const entries = Array.isArray(day[peptideId]) ? day[peptideId] : [day[peptideId]];
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry || typeof entry !== "object" || doseStatus(entry) !== "applied") continue;
        const site = typeof entry.site === "string" ? entry.site.trim() : "";
        if (!site) continue;
        const result = { site, date, time: entry.time || "" };
        if (!byPeptide.has(peptideId)) byPeptide.set(peptideId, result);
        if (!latest) latest = result;
        break;
      }
    }
  }

  return Object.freeze({ byPeptide, latest });
}

export function createRevisionedPerformanceIndexes(getRevision) {
  let cachedRevision = -1;
  let cached = null;

  return {
    get({ logs = {}, inventory = [] } = {}) {
      const revision = Number(getRevision?.() ?? 0);
      if (cached && revision === cachedRevision) return cached;
      const recordsByDate = new Map(Object.entries(logs || {}));
      cachedRevision = revision;
      cached = Object.freeze({
        revision,
        lastSites: buildLastSiteIndex(logs),
        activeVials: buildActiveVialIndex(inventory),
        getRecordsForDate: (date) => recordsByDate.get(date) || null
      });
      return cached;
    }
  };
}

export function buildActiveVialIndex(inventory = []) {
  const byPeptideId = new Map();
  const byPeptideName = new Map();
  for (const vial of Array.isArray(inventory) ? inventory : []) {
    if (!vial || vial.status !== "active") continue;
    const id = String(vial.peptideId || "").trim().toLowerCase();
    const name = String(vial.peptideName || "").trim().toLowerCase();
    if (id && !byPeptideId.has(id)) byPeptideId.set(id, vial);
    if (name && !byPeptideName.has(name)) byPeptideName.set(name, vial);
  }
  return Object.freeze({
    find(peptideId, peptideName = "") {
      const id = String(peptideId || "").trim().toLowerCase();
      const name = String(peptideName || "").trim().toLowerCase();
      return byPeptideId.get(id) || byPeptideName.get(id) || byPeptideId.get(name) || byPeptideName.get(name) || null;
    }
  });
}
