/**
 * Domínio do Protocolo e Entidade de Peptídeo
 */

import { isValidTime, isValidDateKey } from "./schedule.js";
import { parseUnits } from "./dose-state.js";
import { normalizeProtocolRevisions, PROTOCOL_STATUSES } from "./protocol-history.js";

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
export const COMPOUND_CLASSES = Object.freeze(["peptide", "hormone", "anabolic_steroid", "ancillary", "custom"]);
export const ADMINISTRATION_ROUTES = Object.freeze(["subcutaneous", "intramuscular", "oral"]);
export const ADMINISTRATION_UNITS = Object.freeze(["ui", "ml", "tablet", "capsule"]);

export function parseAdministrationQuantity(value) {
  const parsed = typeof value === "string" ? Number(value.trim().replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isAdministrationUnitCompatible(route, unit) {
  return route === "oral" ? unit === "tablet" || unit === "capsule" : unit === "ui" || unit === "ml";
}

export function sanitizeString(str, maxLen = 120) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

export function validateHexColor(color, fallback = "#2CC5C0") {
  if (typeof color === "string" && HEX_COLOR_REGEX.test(color)) {
    return color;
  }
  return fallback;
}

export function validateDays(days) {
  if (days === null || days === undefined) return null;
  if (!Array.isArray(days)) return null;
  const valid = days
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const unique = [...new Set(valid)].sort((a, b) => a - b);
  return unique.length === 7 || unique.length === 0 ? null : unique;
}

export function validateTimes(times, legacyTime = "") {
  let list = [];
  if (Array.isArray(times) && times.length > 0) {
    list = times.filter((t) => typeof t === "string" && isValidTime(t.trim()));
  }
  if (list.length === 0 && typeof legacyTime === "string" && isValidTime(legacyTime.trim())) {
    list = [legacyTime.trim()];
  }
  return [...new Set(list)].sort();
}

export function normalizeRemindersEnabled(data = {}) {
  const hasValidTime = validateTimes(data.times, data.time).length > 0;
  if (!hasValidTime) return false;
  return data.remindersEnabled !== false;
}

export function createPeptide(data = {}) {
  const name = sanitizeString(data.name || "Novo Peptídeo", 80);
  const sub = sanitizeString(data.sub || "", 80);
  const dose = sanitizeString(data.dose || "", 40);
  const compoundClass = COMPOUND_CLASSES.includes(data.compoundClass) ? data.compoundClass : "peptide";
  const administrationRoute = ADMINISTRATION_ROUTES.includes(data.administrationRoute) ? data.administrationRoute : "subcutaneous";
  const legacyAdministration = data.administrationLegacy === true || data.administrationQuantity === undefined || data.administrationUnit === undefined;
  const administrationUnit = ADMINISTRATION_UNITS.includes(data.administrationUnit)
    ? data.administrationUnit
    : (administrationRoute === "oral" ? "tablet" : "ui");
  const administrationQuantity = parseAdministrationQuantity(data.administrationQuantity ?? (administrationUnit === "ui" ? data.ui : null));
  const ui = administrationRoute === "oral" || administrationUnit === "ml"
    ? null
    : (data.ui === null && data.numericIntegrity === "needs_review" ? null : parseUnits(data.ui));
  const per = data.per === "semana" ? "semana" : "dia";
  const perDay = Math.min(6, Math.max(1, parseInt(data.perDay, 10) || 1));
  const accent = validateHexColor(data.accent, "#2CC5C0");
  const note = sanitizeString(data.note || "", 200);

  const days = validateDays(data.days);
  const interval = data.interval && Number.isInteger(parseInt(data.interval, 10)) && parseInt(data.interval, 10) > 1
    ? parseInt(data.interval, 10)
    : null;
  const start = data.start && isValidDateKey(data.start) ? data.start : null;

  const times = validateTimes(data.times, data.time);
  const time = times.length > 0 ? times[0] : (isValidTime(data.time) ? data.time : "");
  const remindersEnabled = normalizeRemindersEnabled({ ...data, times, time });

  // Rótulo amigável calculado se não fornecido
  let freq = sanitizeString(data.freq || "", 60);
  if (!freq) {
    if (interval) {
      freq = `A cada ${interval} dias`;
    } else if (days) {
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      freq = days.map((d) => dayNames[d]).join(" · ");
    } else {
      freq = "Todos os dias";
    }
  }

  return {
    id: data.id && typeof data.id === "string" && data.id.startsWith("pep_")
      ? data.id
      : `pep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    numericIntegrity: administrationRoute !== "oral" && administrationUnit === "ui" && (ui === null || data.numericIntegrity === "needs_review") ? "needs_review" : "valid",
    lifecycleStatus: PROTOCOL_STATUSES.includes(data.lifecycleStatus) ? data.lifecycleStatus : "active",
    revisions: normalizeProtocolRevisions(data.revisions),
    sub,
    compoundClass,
    administrationRoute,
    administrationQuantity,
    administrationUnit,
    administrationLegacy: legacyAdministration,
    dose,
    ui,
    per,
    freq,
    days,
    interval,
    start,
    perDay,
    times,
    time,
    remindersEnabled,
    note,
    accent,
    calculationSnapshot: data.calculationSnapshot ? { ...data.calculationSnapshot } : null
  };
}

export function validatePeptide(p) {
  if (!p || typeof p !== "object") return { valid: false, error: "Objeto inválido" };
  if (!p.name || typeof p.name !== "string" || !p.name.trim()) {
    return { valid: false, error: "Nome do peptídeo é obrigatório" };
  }
  const legacyAdministration = p.administrationLegacy === true || (p.administrationQuantity === undefined && p.administrationUnit === undefined && p.administrationRoute === undefined && p.compoundClass === undefined);
  const compoundClass = p.compoundClass === undefined ? "peptide" : p.compoundClass;
  const administrationRoute = p.administrationRoute === undefined ? "subcutaneous" : p.administrationRoute;
  const administrationUnit = p.administrationUnit === undefined ? "ui" : p.administrationUnit;
  if (!COMPOUND_CLASSES.includes(compoundClass) || !ADMINISTRATION_ROUTES.includes(administrationRoute) || !ADMINISTRATION_UNITS.includes(administrationUnit)) {
    return { valid: false, error: "Classe, via ou unidade de administração inválida." };
  }
  if (!isAdministrationUnitCompatible(administrationRoute, administrationUnit)) {
    return { valid: false, error: "A unidade de administração não é compatível com a via escolhida." };
  }
  if (!legacyAdministration && parseAdministrationQuantity(p.administrationQuantity) === null) {
    return { valid: false, error: "Informe uma quantidade de administração positiva." };
  }
  if (administrationRoute === "oral" && p.ui != null) {
    return { valid: false, error: "Aplicações orais não usam unidades de seringa." };
  }
  if (administrationRoute !== "oral" && administrationUnit === "ui" && (p.numericIntegrity === "needs_review" || parseUnits(p.ui) === null)) {
    return { valid: false, error: "Informe unidades válidas, sem arredondamento automático." };
  }
  return { valid: true };
}
