import { normalizeProtocolRevisions } from "./protocol-history.js";

function dateKeyToUtcTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  return Number.isFinite(time) ? time : null;
}

const revisionStatusLabel = (status) => status === "ended" ? "Encerrado" : status === "paused" ? "Pausado" : "Ativo";

/** Produz marcadores de revisões explícitas persistidas, sem reconstruir o passado. */
export function buildProtocolRevisionMarkerModel(protocols, compoundId, chart, { startDate = null, endDate = null } = {}) {
  if (!compoundId || !chart?.plot || !Array.isArray(protocols)) return [];
  const protocol = protocols.find((item) => item?.id === compoundId);
  if (!protocol) return [];
  const from = dateKeyToUtcTime(startDate || chart.firstDate);
  const until = dateKeyToUtcTime(endDate || chart.lastDate);
  if (from === null || until === null || until < from) return [];
  const range = until - from;
  const candidates = normalizeProtocolRevisions(protocol.revisions)
    .filter((revision) => !revision.legacy)
    .map((revision) => {
      const date = new Date(revision.effectiveFrom);
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      return { revision, date: localDate, time };
    })
    .filter((item) => item.date >= (startDate || chart.firstDate) && item.date <= (endDate || chart.lastDate))
    .sort((a, b) => a.revision.effectiveFrom.localeCompare(b.revision.effectiveFrom));
  const perDate = new Map();
  candidates.forEach((item) => perDate.set(item.date, [...(perDate.get(item.date) || []), item]));
  return candidates.map((item) => {
    const siblings = perDate.get(item.date);
    const index = siblings.indexOf(item);
    const dateTime = dateKeyToUtcTime(item.date);
    const center = range === 0 ? chart.plot.left + chart.plot.width / 2 : chart.plot.left + ((dateTime - from) / range) * chart.plot.width;
    const offset = (index - (siblings.length - 1) / 2) * 8;
    const config = item.revision.config || {};
    return {
      id: String(item.revision.id), date: item.date, time: item.time, status: item.revision.status,
      statusLabel: revisionStatusLabel(item.revision.status), x: center + offset,
      config: {
        name: String(config.name || protocol.name || "Protocolo sem identificação"), dose: config.dose ?? "", ui: config.ui ?? null,
        freq: config.freq ?? "", perDay: config.perDay ?? null,
        times: Array.isArray(config.times) ? [...config.times] : (config.time ? [config.time] : []),
        remindersEnabled: config.remindersEnabled === true
      }
    };
  });
}
