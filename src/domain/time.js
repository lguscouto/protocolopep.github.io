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
