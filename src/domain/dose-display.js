import { parseUnits } from "./dose-state.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const textValue = (value) => hasValue(value) ? String(value) : "";

export function getDoseDisplayData(entry, currentProtocol = null) {
  const log = entry && typeof entry === "object" ? entry : {};
  const snapshot = log.protocolSnapshot && typeof log.protocolSnapshot === "object"
    && !Array.isArray(log.protocolSnapshot) ? log.protocolSnapshot : null;
  const uiValue = hasValue(log.ui) ? log.ui : snapshot?.ui;
  return {
    name: textValue(snapshot?.name) || textValue(log.peptideName) || textValue(log.name) || textValue(currentProtocol?.name) || "Protocolo sem identificação",
    sub: textValue(snapshot ? snapshot.sub : (log.peptideSub ?? log.sub ?? currentProtocol?.sub)),
    dose: hasValue(log.dose) ? log.dose : (hasValue(snapshot?.dose) ? snapshot.dose : ""),
    ui: hasValue(uiValue) ? parseUnits(uiValue) : null,
    historyIntegrity: snapshot ? "captured" : "legacy",
    revisionId: snapshot?.revisionId || null,
    calculationSnapshot: snapshot?.calculationSnapshot || null,
    vial: snapshot?.vial && typeof snapshot.vial === "object" ? snapshot.vial : null,
    vialId: log.vialId || snapshot?.vial?.id || null
  };
}
