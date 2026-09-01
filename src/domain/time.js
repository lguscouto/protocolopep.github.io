import { isValidDateKey, isValidTime } from "./schedule.js";

const OFFSET_PATTERN = /^(Z|[+-]\d{2}:\d{2})$/;

export function formatZoneOffset(offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) return null;
  const rounded = Math.trunc(offsetMinutes);
  const sign = rounded >= 0 ? "+" : "-";
  const absolute = Math.abs(rounded);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function isValidZoneOffset(value) {
  if (typeof value !== "string" || !OFFSET_PATTERN.test(value)) return false;
  if (value === "Z") return true;
  const [hours, minutes] = value.slice(1).split(":").map(Number);
  return hours <= 14 && minutes <= 59 && (hours < 14 || minutes === 0);
}

export function isValidTimeZoneId(timeZoneId) {
  if (typeof timeZoneId !== "string" || !timeZoneId.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZoneId }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function getSystemTimeZoneId() {
  try {
    const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZoneId(timeZoneId) ? timeZoneId : null;
  } catch {
    return null;
  }
}

function localPartsForInstant(instantMs, timeZoneId) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = {};
  formatter.formatToParts(new Date(instantMs)).forEach(({ type, value }) => {
    if (type !== "literal") parts[type] = value;
  });
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function offsetMinutesAtInstant(instantMs, timeZoneId) {
  const parts = localPartsForInstant(instantMs, timeZoneId);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return Math.round((representedAsUtc - instantMs) / 60000);
}

function offsetMinutesFromString(zoneOffset) {
  if (!isValidZoneOffset(zoneOffset)) return null;
  if (zoneOffset === "Z") return 0;
  const sign = zoneOffset[0] === "-" ? -1 : 1;
  const [hours, minutes] = zoneOffset.slice(1).split(":").map(Number);
  return sign * ((hours * 60) + minutes);
}

function wallTimeForInstantAndOffset(instantMs, zoneOffset) {
  const offsetMinutes = offsetMinutesFromString(zoneOffset);
  if (offsetMinutes === null) return null;
  const shifted = new Date(instantMs + offsetMinutes * 60000);
  return {
    date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`,
    time: `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`
  };
}

function localDateTimeInZoneToInstant(dateKey, time, timeZoneId) {
  if (!isValidDateKey(dateKey) || !isValidTime(time) || !isValidTimeZoneId(timeZoneId)) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetWallTimeUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let instantMs = targetWallTimeUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offsetMinutes = offsetMinutesAtInstant(instantMs, timeZoneId);
    const nextInstantMs = targetWallTimeUtc - offsetMinutes * 60000;
    if (nextInstantMs === instantMs) break;
    instantMs = nextInstantMs;
  }

  const resolved = localPartsForInstant(instantMs, timeZoneId);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    return null;
  }

  return instantMs;
}

export function getZoneOffsetForLocalDateTime(dateKey, time = "08:00", timeZoneId = null) {
  if (!isValidDateKey(dateKey) || !isValidTime(time)) return null;

  if (timeZoneId !== null && timeZoneId !== undefined && timeZoneId !== "") {
    if (!isValidTimeZoneId(timeZoneId)) return null;
    const instantMs = localDateTimeInZoneToInstant(dateKey, time, timeZoneId);
    if (instantMs === null) return null;
    return formatZoneOffset(offsetMinutesAtInstant(instantMs, timeZoneId));
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(localDate.getTime())) return null;
  return formatZoneOffset(-localDate.getTimezoneOffset());
}

export function localDateTimeToIso(dateKey, time = "08:00", zoneOffset = null, timeZoneId = null) {
  if (!isValidDateKey(dateKey) || !isValidTime(time)) return null;

  if (zoneOffset !== null && zoneOffset !== undefined && zoneOffset !== "") {
    if (!isValidZoneOffset(zoneOffset)) return null;
    const normalizedOffset = zoneOffset === "Z" ? "Z" : zoneOffset;
    const instant = new Date(`${dateKey}T${time}:00${normalizedOffset}`);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }

  if (timeZoneId !== null && timeZoneId !== undefined && timeZoneId !== "") {
    const instantMs = localDateTimeInZoneToInstant(dateKey, time, timeZoneId);
    return instantMs === null ? null : new Date(instantMs).toISOString();
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(localDate.getTime()) ? null : localDate.toISOString();
}

export function isValidIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Verifica se os quatro campos temporais descrevem o mesmo horário civil e instante.
 * Em horários repetidos pelo DST, um offset explícito é aceito quando o instante
 * resultante também representa o mesmo horário na zona IANA.
 */
export function assessTemporalConsistency({
  date,
  time = "08:00",
  timestamp,
  zoneOffset = null,
  timeZoneId = null
} = {}) {
  const errors = [];
  if (!isValidDateKey(String(date || ""))) errors.push("INVALID_DATE");
  if (!isValidTime(String(time || ""))) errors.push("INVALID_TIME");
  if (!isValidIsoTimestamp(String(timestamp || ""))) errors.push("INVALID_TIMESTAMP");
  if (zoneOffset && !isValidZoneOffset(String(zoneOffset))) errors.push("INVALID_ZONE_OFFSET");
  if (timeZoneId && !isValidTimeZoneId(String(timeZoneId))) errors.push("INVALID_TIME_ZONE");
  if (errors.length > 0) return { valid: false, status: "needs_review", errors };

  const instantMs = new Date(timestamp).getTime();
  const expectedDate = String(date);
  const expectedTime = String(time);

  if (zoneOffset) {
    const wall = wallTimeForInstantAndOffset(instantMs, String(zoneOffset));
    if (!wall || wall.date !== expectedDate || wall.time !== expectedTime) {
      errors.push("TIMESTAMP_OFFSET_MISMATCH");
    }
  }

  if (timeZoneId) {
    const wall = localPartsForInstant(instantMs, String(timeZoneId));
    const zoneDate = `${wall.year}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
    const zoneTime = `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
    if (zoneDate !== expectedDate || zoneTime !== expectedTime) {
      errors.push("TIMESTAMP_TIME_ZONE_MISMATCH");
    }
    if (zoneOffset) {
      const actualOffset = formatZoneOffset(offsetMinutesAtInstant(instantMs, String(timeZoneId)));
      const normalizedOffset = zoneOffset === "Z" ? "+00:00" : String(zoneOffset);
      if (actualOffset !== normalizedOffset) errors.push("TIME_ZONE_OFFSET_MISMATCH");
    }
  }

  if (!zoneOffset && !timeZoneId) errors.push("MISSING_TIME_CONTEXT");

  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? "valid" : "needs_review",
    errors
  };
}
