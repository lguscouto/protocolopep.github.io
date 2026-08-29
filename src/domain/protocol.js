/**
 * Domínio do Protocolo e Entidade de Peptídeo
 */

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

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
    list = times.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t.trim()));
  }
  if (list.length === 0 && typeof legacyTime === "string" && /^\d{2}:\d{2}$/.test(legacyTime.trim())) {
    list = [legacyTime.trim()];
  }
  return [...new Set(list)].sort();
}

export function createPeptide(data = {}) {
  const name = sanitizeString(data.name || "Novo Peptídeo", 80);
  const sub = sanitizeString(data.sub || "", 80);
  const dose = sanitizeString(data.dose || "", 40);
  const ui = Math.max(0, parseInt(data.ui, 10) || 0);
  const per = data.per === "semana" ? "semana" : "dia";
  const perDay = Math.min(6, Math.max(1, parseInt(data.perDay, 10) || 1));
  const accent = validateHexColor(data.accent, "#2CC5C0");
  const note = sanitizeString(data.note || "", 200);

  const days = validateDays(data.days);
  const interval = data.interval && Number.isInteger(parseInt(data.interval, 10)) && parseInt(data.interval, 10) > 1
    ? parseInt(data.interval, 10)
    : null;
  const start = data.start && /^\d{4}-\d{2}-\d{2}$/.test(data.start) ? data.start : null;

  const times = validateTimes(data.times, data.time);
  const time = times.length > 0 ? times[0] : (data.time || "");

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
    sub,
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
  return { valid: true };
}
