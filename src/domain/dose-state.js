/** Shared interpretation of recorded events. Missing entries never imply a missed dose. */
export const DOSE_STATUSES = Object.freeze(["applied", "skipped", "missed"]);

export function doseEntries(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

export function doseStatus(entry) {
  return typeof entry === "object" ? (entry.status || "applied") : "applied";
}

export function summarizeDoseEntries(value, due = 1) {
  const entries = doseEntries(value);
  const applied = entries.filter(e => doseStatus(e) === "applied").length;
  const skipped = entries.filter(e => doseStatus(e) === "skipped").length;
  const missed = entries.filter(e => doseStatus(e) === "missed").length;
  const resolved = applied + skipped + missed;
  return { applied, skipped, missed, resolved, pending: Math.max(0, due - resolved) };
}

/** Optional absent value is zero; invalid input remains distinguishable from zero. */
export function parseUnits(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
