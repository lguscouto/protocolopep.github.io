/** Shared interpretation of recorded events. Missing entries never imply a missed dose. */
export const DOSE_STATUSES = Object.freeze(["applied", "skipped", "missed"]);

export function doseEntries(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

export function doseStatus(entry) {
  return entry && typeof entry === "object" ? (entry.status || "applied") : "applied";
}

export function summarizeDoseEntries(value, due = 1) {
  const entries = doseEntries(value);
  const applied = entries.filter(e => doseStatus(e) === "applied").length;
  const skipped = entries.filter(e => doseStatus(e) === "skipped").length;
  const missed = entries.filter(e => doseStatus(e) === "missed").length;
  const resolved = applied + skipped + missed;
  return { applied, skipped, missed, resolved, pending: Math.max(0, due - resolved) };
}

function normalizeDueCount(peptide) {
  const parsed = Number.parseInt(peptide?.perDay, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function scheduledTimes(peptide, total) {
  const configured = Array.isArray(peptide?.times) ? peptide.times : [];
  const fallback = typeof peptide?.time === "string" ? peptide.time.trim() : "";
  return Array.from({ length: total }, (_, index) => {
    const configuredTime = typeof configured[index] === "string" ? configured[index].trim() : "";
    return configuredTime || (index === 0 ? fallback : "") || null;
  });
}

function normalizeProgressRecord(entry, sourceIndex) {
  const record = entry && typeof entry === "object" ? { ...entry } : {};
  const status = doseStatus(entry);
  return {
    sourceIndex,
    id: typeof record.id === "string" ? record.id : null,
    status,
    time: typeof (record.time || record.t) === "string" ? (record.time || record.t) : null,
    reason: typeof record.statusReason === "string" && record.statusReason.trim() ? record.statusReason.trim() : null,
    isLegacy: !entry || typeof entry !== "object" || !Object.prototype.hasOwnProperty.call(record, "status")
  };
}

/**
 * Builds the factual progress of a routine for one day without inferring events.
 * Valid records resolve scheduled occurrences in their stored order. Unknown and
 * excess records remain visible, but never complete the routine.
 */
export function buildDailyApplicationProgress({ peptide, records } = {}) {
  const total = normalizeDueCount(peptide);
  const times = scheduledTimes(peptide, total);
  const source = Array.isArray(records) ? records : records ? [records] : [];
  const valid = [];
  const extras = [];

  source.forEach((entry, sourceIndex) => {
    const normalized = normalizeProgressRecord(entry, sourceIndex);
    if (!DOSE_STATUSES.includes(normalized.status)) {
      extras.push({ ...normalized, kind: "unknown" });
    } else if (valid.length < total) {
      valid.push(normalized);
    } else {
      extras.push({ ...normalized, kind: "excess" });
    }
  });

  const occurrences = Array.from({ length: total }, (_, index) => {
    const record = valid[index] || null;
    return {
      position: index + 1,
      scheduledTime: times[index],
      status: record?.status || "pending",
      effectiveTime: record?.time || null,
      reason: record?.reason || null,
      recordId: record?.id || null,
      sourceIndex: record?.sourceIndex ?? null,
      isLegacy: record?.isLegacy || false
    };
  });

  const applied = valid.filter((record) => record.status === "applied").length;
  const skipped = valid.filter((record) => record.status === "skipped").length;
  const missed = valid.filter((record) => record.status === "missed").length;
  const resolved = applied + skipped + missed;
  const pending = Math.max(0, total - resolved);
  const state = pending > 0
    ? "pending"
    : applied === total ? "all_applied" : "resolved_with_exceptions";

  return {
    total,
    applied,
    skipped,
    missed,
    resolved,
    pending,
    state,
    occurrences,
    extras
  };
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
