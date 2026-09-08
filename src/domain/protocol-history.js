/** Append-only configuration revisions. No medical defaults or synthetic dose history. */
const FIELDS = ["name", "sub", "dose", "ui", "per", "freq", "days", "interval", "start", "perDay", "times", "time", "note", "accent", "calculationSnapshot", "numericIntegrity"];
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export const PROTOCOL_STATUSES = Object.freeze(["active", "paused", "ended"]);
const validInstant = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

export function protocolConfig(protocol) {
  return Object.fromEntries(FIELDS.filter(key => protocol[key] !== undefined).map(key => [key, copy(protocol[key])]));
}

export function normalizeProtocolRevisions(revisions) {
  if (!Array.isArray(revisions)) return [];
  return revisions.filter(r => r && validInstant(r.effectiveFrom) && PROTOCOL_STATUSES.includes(r.status) && r.config && typeof r.config === "object")
    .map(r => ({ id: String(r.id || r.effectiveFrom), effectiveFrom: new Date(r.effectiveFrom).toISOString(), status: r.status, config: protocolConfig(r.config), legacy: Boolean(r.legacy) }))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function resolveProtocolAt(protocol, at = new Date()) {
  if (!protocol) return null;
  const instant = new Date(at).getTime();
  const revisions = normalizeProtocolRevisions(protocol.revisions);
  if (!revisions.length) return { ...protocol, revisions: [], lifecycleStatus: protocol.lifecycleStatus || "active", revisionId: null };
  const revision = revisions.filter(r => Date.parse(r.effectiveFrom) <= instant).at(-1);
  if (!revision) return { ...protocol, revisions: [], lifecycleStatus: "not_started", revisionId: null };
  return { ...protocol, ...copy(revision.config), revisions: [], lifecycleStatus: revision.status, revisionId: revision.id };
}

/** Date views use the current instant today, otherwise the end of the selected date. */
export function resolveProtocolForDay(protocol, date = new Date(), now = new Date()) {
  const reference = new Date(date);
  if (reference.toDateString() === new Date(now).toDateString()) return resolveProtocolAt(protocol, now);
  reference.setHours(23, 59, 59, 999);
  return resolveProtocolAt(protocol, reference);
}

export function reviseProtocol(existing, next, { effectiveFrom = null, status = null, now = new Date() } = {}) {
  effectiveFrom ??= new Date(now).toISOString();
  if (!validInstant(effectiveFrom)) throw new Error("Data de vigência inválida.");
  const at = new Date(effectiveFrom).toISOString();
  if (Date.parse(at) < new Date(now).getTime()) throw new Error("A alteração não pode reescrever uma vigência passada.");
  const revisions = normalizeProtocolRevisions(existing?.revisions);
  // A known current legacy configuration is retained, explicitly marked as legacy.
  if (existing && !revisions.length) revisions.push({ id: `${existing.id}_legacy`, effectiveFrom: "1900-01-01T00:00:00.000Z", status: existing.lifecycleStatus || "active", config: protocolConfig(existing), legacy: true });
  if (revisions.some(r => Date.parse(r.effectiveFrom) > new Date(now).getTime())) throw new Error("Já existe uma alteração futura. Cancele-a antes de programar outra alteração.");
  const nextStatus = status || resolveProtocolAt(existing, now)?.lifecycleStatus || "active";
  if (!PROTOCOL_STATUSES.includes(nextStatus)) throw new Error("Estado de protocolo inválido.");
  const id = existing?.id || next.id;
  const revision = { id: `${id}_r${revisions.length + 1}_${Date.parse(at)}`, effectiveFrom: at, status: nextStatus, config: protocolConfig(next), legacy: false };
  return { ...copy(next), id, lifecycleStatus: nextStatus, revisions: [...revisions, revision] };
}

export function cancelFutureRevision(protocol, now = new Date()) {
  const revisions = normalizeProtocolRevisions(protocol.revisions).filter(r => Date.parse(r.effectiveFrom) <= new Date(now).getTime());
  const last = revisions.at(-1);
  if (!last) throw new Error("Nenhuma revisão vigente disponível.");
  return { ...copy(protocol), ...copy(last.config), lifecycleStatus: last.status, revisions };
}
