/** Pure, atomic transitions for dose records and their original vial movements. */
import { createDoseLog, normalizeDoseEntry, validateDoseLog } from "./dose-log.js";
import { debitVialDose, creditVialDose, debitOralPackage, creditOralPackage, extractDoseInMcg } from "./inventory.js";
import { dateToKey, isValidDateKey, isValidTime } from "./schedule.js";
import { parseUnits, DOSE_STATUSES } from "./dose-state.js";
import { resolveProtocolAt } from "./protocol-history.js";

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const fail = (error, message = error) => ({ success: false, error, message });
const equalAmount = (a, b) => Math.abs(a - b) < 0.0000001;
const entries = (value, date, id) => Array.isArray(value) ? [...value] : value && typeof value === "object" ? [normalizeDoseEntry(value, date, id)] : [];
const newId = () => `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

function validateInput({ peptideId, scheduledDate, time, status, ui, dose, administrationRoute = "subcutaneous", administrationQuantity = null, administrationUnit = "ui", site = "", requireSite = false, requireAdministration = false }) {
  if (typeof peptideId !== "string" || !peptideId.trim()) return fail("VALIDATION_FAILED", "Identificador do protocolo inválido.");
  if (!isValidDateKey(scheduledDate) || scheduledDate > dateToKey(new Date())) return fail("VALIDATION_FAILED", "Informe uma data válida, que não esteja no futuro.");
  if (!isValidTime(time)) return fail("VALIDATION_FAILED", "Informe um horário válido entre 00:00 e 23:59.");
  if (!DOSE_STATUSES.includes(status)) return fail("VALIDATION_FAILED", "Estado do registro inválido.");
  if (requireAdministration) {
    if (!["subcutaneous", "intramuscular", "oral"].includes(administrationRoute)) return fail("VALIDATION_FAILED", "Via de administração inválida.");
    if (administrationRoute === "oral" ? !["tablet", "capsule"].includes(administrationUnit) : !["ui", "ml"].includes(administrationUnit)) return fail("VALIDATION_FAILED", "Unidade incompatível com a via.");
    const quantity = Number(typeof administrationQuantity === "string" ? administrationQuantity.replace(",", ".") : administrationQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return fail("VALIDATION_FAILED", "Quantidade de administração inválida.");
    if (requireSite && administrationRoute !== "oral" && !String(site).trim()) return fail("SITE_REQUIRED", "Selecione um local para registrar a aplicação injetável.");
    if (administrationRoute !== "oral" && administrationUnit === "ui" && (ui === null || parseUnits(ui) === null)) return fail("VALIDATION_FAILED", "Unidades inválidas.");
  } else if (ui === null || parseUnits(ui) === null) return fail("VALIDATION_FAILED", "Unidades inválidas.");
  if (typeof dose !== "string" && typeof dose !== "number") return fail("VALIDATION_FAILED", "Dose inválida.");
  const value = String(dose).trim();
  // Free-text descriptions remain supported, but numerical entries must never be truncated.
  if (value && (/^[+\-\d.,]/.test(value) || /^(?:NaN|Infinity)\b/i.test(value))) {
    const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(mg|mcg|ui)?$/i);
    if (!match || !Number.isFinite(Number(match[1].replace(",", "."))) || Number(match[1].replace(",", ".")) <= 0) {
      return fail("VALIDATION_FAILED", "Informe uma dose positiva válida, sem arredondamento automático.");
    }
  }
  return null;
}

function captureProtocol(protocol, dose, ui, vial) {
  if (!protocol) return null;
  const injectableVial = vial?.kind === "oral_package" ? null : vial;
  return clone({
    name: protocol.name || "",
    sub: protocol.sub || "",
    dose,
    ui,
    compoundClass: protocol.compoundClass || "peptide",
    administrationRoute: protocol.administrationRoute || "subcutaneous",
    administrationQuantity: protocol.administrationQuantity ?? null,
    administrationUnit: protocol.administrationUnit || "ui",
    revisionId: protocol.revisionId || null,
    calculationSnapshot: protocol.calculationSnapshot || null,
    vial: injectableVial ? {
      id: injectableVial.id,
      peptideName: injectableVial.peptideName || "",
      lotNumber: injectableVial.lotNumber || "",
      concentrationMcgPerMl: injectableVial.concentrationMcgPerMl,
      totalMg: injectableVial.totalMg,
      waterMl: injectableVial.waterMl
    } : null
  });
}

function compatibleVial(vial, peptideId, name) {
  const normalize = value => String(value || "").trim().toLowerCase();
  const identities = [normalize(peptideId), normalize(name)].filter(Boolean);
  return vial && vial.kind !== "oral_package" && vial.status === "active" && identities.some(id => id === normalize(vial.peptideId) || id === normalize(vial.peptideName));
}

function compatibleOralPackage(item, peptideId, name, unit) {
  const normalize = value => String(value || "").trim().toLowerCase();
  const identities = [normalize(peptideId), normalize(name)].filter(Boolean);
  return item?.kind === "oral_package" && item.status === "active" && item.presentation === unit && identities.some(id => id === normalize(item.peptideId) || id === normalize(item.peptideName));
}

/** Only applied entries debit stock. Skipped/missed entries carry no stock linkage. */
export function registerDoseState({
  logs = {}, inventory = [], peptides = [], peptideId, scheduledDate, time, dose, ui,
  site = "", note = "", status = "applied", statusReason = "", retroactive,
  allowHistoryOnlyWithoutStock = false
}) {
  const now = new Date();
  const today = dateToKey(now);
  const targetDate = scheduledDate === undefined ? today : scheduledDate;
  const targetTime = time === undefined ? (targetDate === today ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "12:00") : time;
  // Validate the date and time before constructing an instant or resolving a revision.
  if (!isValidDateKey(targetDate) || !isValidTime(targetTime)) return fail("VALIDATION_FAILED", "Data ou horário inválido.");
  const source = peptides.find(p => p.id === peptideId);
  const takenAt = time === undefined && targetDate === today ? now : new Date(`${targetDate}T${targetTime}:00`);
  const resolved = resolveProtocolAt(source, takenAt);
  const peptide = resolved?.lifecycleStatus === "not_started" ? null : resolved;
  if (status === "applied" && peptide?.numericIntegrity === "needs_review" && (dose === undefined || ui === undefined)) {
    return fail("VALIDATION_FAILED", "Revise explicitamente a dose e as unidades do protocolo antes de registrar uma aplicação.");
  }
  const doseStr = dose === undefined ? (peptide?.dose || "") : dose;
  const route = peptide?.administrationRoute || "subcutaneous";
  const unit = peptide?.administrationUnit || "ui";
  const requireAdministration = peptide?.administrationLegacy === false;
  const quantity = peptide?.administrationQuantity ?? (unit === "ui" ? (peptide?.ui ?? ui) : null);
  const uiVal = route === "oral" || unit === "ml" ? null : (ui === undefined ? (peptide?.ui === undefined ? 0 : peptide.ui) : ui);
  const invalid = validateInput({ peptideId, scheduledDate: targetDate, time: targetTime, status, ui: uiVal, dose: doseStr, administrationRoute: route, administrationQuantity: quantity, administrationUnit: unit, site, requireSite: requireAdministration, requireAdministration });
  if (invalid) return invalid;
  const normalizedUnits = parseUnits(uiVal);
  const log = createDoseLog({
    id: newId(), peptideId, scheduledDate: targetDate, time: targetTime, takenAt: takenAt.toISOString(), dose: doseStr,
    ui: normalizedUnits, site: route === "oral" ? "" : site, note, status, statusReason, retroactive,
    compoundClass: peptide?.compoundClass || "peptide", administrationRoute: route, administrationQuantity: quantity, administrationUnit: unit,
    debitedMcg: 0, protocolSnapshot: captureProtocol(peptide, String(doseStr).trim(), normalizedUnits, null)
  });
  const targetIndex = status === "applied" ? inventory.findIndex(v => route === "oral" ? compatibleOralPackage(v, peptideId, peptide?.name, unit) : compatibleVial(v, peptideId, peptide?.name)) : -1;
  if (status === "applied" && route === "oral" && targetIndex < 0) return fail("ORAL_PACKAGE_NOT_FOUND", "Nenhum pacote oral ativo e compatível foi encontrado.");
  const result = applyStock(log, inventory, targetIndex, { allowHistoryOnlyWithoutStock });
  if (!result.success) return result;
  if (result.vial) log.protocolSnapshot = captureProtocol(peptide, log.dose, log.ui, result.vial);
  return appendLog(logs, result.inventory, log, result.vial, result.debitedMcg);
}

function applyStock(log, inventory, vialIndex, { allowHistoryOnlyWithoutStock = false, historicalVial = null, fixedAmount = null } = {}) {
  const updatedInventory = [...inventory];
  if (log.status !== "applied" || vialIndex < 0) return { success: true, inventory: updatedInventory, vial: null, debitedMcg: 0 };
  const vial = inventory[vialIndex];
  if (log.administrationRoute === "oral") {
    const debit = debitOralPackage(vial, { quantity: log.administrationQuantity, doseLogId: log.id, date: log.scheduledDate, note: log.protocolSnapshot?.name || "Aplicação oral registrada" });
    if (!debit.success) return fail(debit.error, "O pacote oral não possui saldo suficiente.");
    log.inventoryId = vial.id; log.inventoryKind = "oral_package"; log.inventoryMovementId = debit.movement.id; log.debitedQuantity = debit.debitedQuantity;
    updatedInventory[vialIndex] = debit.package;
    return { success: true, inventory: updatedInventory, vial: debit.package, debitedMcg: 0, debitedQuantity: debit.debitedQuantity };
  }
  if (!Number.isFinite(Number(vial.remainingMcg)) || Number(vial.remainingMcg) < 0) return fail("INVENTORY_LINK_INVALID", "Saldo do frasco inválido.");
  const input = log.dose || (log.ui > 0 ? `${log.ui} UI` : "");
  const isUiDose = /\bui\b/i.test(input);
  const conversionVial = historicalVial ? { ...vial, concentrationMcgPerMl: historicalVial.concentrationMcgPerMl } : vial;
  if (fixedAmount === null && isUiDose && (!Number.isFinite(Number(conversionVial.concentrationMcgPerMl)) || Number(conversionVial.concentrationMcgPerMl) <= 0)) {
    if (!allowHistoryOnlyWithoutStock) return fail("VIAL_MISSING_CONCENTRATION", "O frasco não possui concentração válida para converter UI em mcg. Reconstitua o frasco ou confirme o registro somente no histórico.");
    return { success: true, inventory: updatedInventory, vial: null, debitedMcg: 0 };
  }
  const parsed = input.match(/^(\d+(?:[.,]\d+)?)\s*(mg|mcg|ui)?$/i);
  const value = parsed ? Number(parsed[1].replace(",", ".")) : null;
  const unit = parsed?.[2]?.toLowerCase();
  const amount = fixedAmount !== null ? fixedAmount : parsed ? value * (unit === "mg" ? 1000 : unit === "ui" ? Number(conversionVial.concentrationMcgPerMl) / 100 : 1) : extractDoseInMcg(input, conversionVial);
  if (!Number.isFinite(amount) || amount <= 0) return fail("VALIDATION_FAILED", "Não foi possível calcular o débito da dose informada. Revise os dados antes de registrar.");
  // Inventory movements use hundredths of a microgram; reject loss rather than silently round.
  if (!equalAmount(amount, Math.round(amount * 100) / 100)) return fail("INVALID_DOSE_PRECISION", "A precisão informada excede a precisão do estoque; revise o valor sem arredondamento automático.");
  const debit = debitVialDose(vial, { doseMcg: amount, doseStr: input, doseLogId: log.id, date: log.scheduledDate, note: log.protocolSnapshot?.name || "Aplicação registrada" });
  if (!debit.success) return fail(debit.error, debit.message || debit.error);
  if (!equalAmount(Number(vial.remainingMcg) - debit.vial.remainingMcg, amount)) return fail("INVENTORY_LINK_INVALID", "O saldo do frasco não permite um débito exato.");
  log.vialId = vial.id;
  log.inventoryId = vial.id;
  log.inventoryKind = "vial";
  log.inventoryMovementId = debit.vial.movements.at(-1).id;
  log.debitedMcg = debit.debitedMcg;
  updatedInventory[vialIndex] = debit.vial;
  return { success: true, inventory: updatedInventory, vial: debit.vial, debitedMcg: debit.debitedMcg };
}

function appendLog(logs, inventory, doseLog, vial, debitedMcg) {
  const validation = validateDoseLog(doseLog);
  if (!validation.valid) return fail("VALIDATION_FAILED", validation.error);
  const day = { ...(logs[doseLog.scheduledDate] || {}) };
  const current = entries(day[doseLog.peptideId], doseLog.scheduledDate, doseLog.peptideId);
  day[doseLog.peptideId] = [...current, doseLog];
  return { success: true, logs: { ...logs, [doseLog.scheduledDate]: day }, inventory, doseLog, vial, debitedMcg };
}

/** Resolve the amount from original evidence, never from the current dose or concentration. */
function originalDebit(log, inventory) {
  const status = log.status === undefined ? "applied" : log.status;
  if (!DOSE_STATUSES.includes(status)) return fail("VALIDATION_FAILED", "Estado do registro inválido; corrija os dados antes de alterar o histórico.");
  if (status !== "applied") {
    if (log.vialId || log.inventoryMovementId || Number(log.debitedMcg) > 0) return fail("INVENTORY_LINK_INVALID", "Registro não aplicado com vínculo de estoque inconsistente. O histórico foi preservado.");
    return { success: true, amount: 0, vialIndex: -1, movementId: null };
  }
  if (!log.vialId) {
    if (log.inventoryMovementId || Number(log.debitedMcg) > 0) return fail("INVENTORY_LINK_INVALID", "O registro possui débito sem identificação do frasco original.");
    return { success: true, amount: 0, vialIndex: -1, movementId: null };
  }
  const vialIndex = inventory.findIndex(v => v.id === log.vialId);
  if (vialIndex < 0) return fail("ORIGINAL_VIAL_MISSING", "O frasco original não foi encontrado. O registro foi preservado para evitar um estorno incorreto.");
  const vial = inventory[vialIndex];
  const movements = Array.isArray(vial.movements) ? vial.movements : [];
  let amount = null;
  if (log.inventoryMovementId) {
    const candidates = movements.filter(m => m.id === log.inventoryMovementId);
    const movement = candidates[0];
    if (candidates.length !== 1 || movement.type !== "dose" || movement.doseLogId !== log.id || !Number.isFinite(movement.amountMcg) || movement.amountMcg >= 0) {
      return fail("INVENTORY_LINK_INVALID", "A movimentação original não corresponde ao registro. Nenhum dado foi alterado.");
    }
    amount = -movement.amountMcg;
    if (movements.some(m => m.type === "undo_dose" && (m.reversesMovementId === movement.id || (!m.reversesMovementId && m.doseLogId === log.id)))) {
      return fail("INVENTORY_LINK_INVALID", "O débito já possui um estorno ou uma correção sem vínculo verificável.");
    }
  }
  if (log.debitedMcg !== null && log.debitedMcg !== undefined) {
    if (!Number.isFinite(log.debitedMcg) || log.debitedMcg <= 0 || (amount !== null && !equalAmount(amount, log.debitedMcg))) return fail("INVENTORY_LINK_INVALID", "A quantidade debitada não corresponde à movimentação original.");
    amount = log.debitedMcg;
  }
  if (!Number.isFinite(amount) || amount <= 0) return fail("INVENTORY_LINK_INVALID", "A quantidade originalmente debitada não está disponível. O registro foi preservado.");
  return { success: true, amount, vialIndex, movementId: log.inventoryMovementId || null };
}

/** Undo is fail-closed: any missing or inconsistent original stock evidence preserves the entry. */
export function undoDoseState({ logs = {}, inventory = [], peptideId, scheduledDate, doseLogId = null }) {
  const targetDate = scheduledDate === undefined ? dateToKey(new Date()) : scheduledDate;
  if (!isValidDateKey(targetDate) || !peptideId) return fail("VALIDATION_FAILED", "Data ou protocolo inválido.");
  const day = { ...(logs[targetDate] || {}) };
  const arr = entries(day[peptideId], targetDate, peptideId);
  const index = doseLogId ? arr.findIndex(entry => entry?.id === doseLogId) : arr.length - 1;
  if (index < 0) return fail(doseLogId ? "DOSE_NOT_FOUND" : "NO_DOSE_TO_UNDO", "Nenhuma dose encontrada para desfazer.");
  const removedLog = arr[index];
  if (!removedLog || typeof removedLog !== "object") return fail("VALIDATION_FAILED", "Registro inválido.");
  if (removedLog.inventoryKind === "oral_package") {
    const packageIndex = inventory.findIndex(item => item.id === removedLog.inventoryId);
    const item = inventory[packageIndex];
    const movement = item?.movements?.find(entry => entry.id === removedLog.inventoryMovementId && entry.doseLogId === removedLog.id && entry.type === "dose");
    const amount = movement ? -Number(movement.amountQuantity) : Number(removedLog.debitedQuantity);
    if (packageIndex < 0 || !Number.isFinite(amount) || amount <= 0) return fail("INVENTORY_LINK_INVALID", "O movimento original do pacote oral não está disponível.");
    const credit = creditOralPackage(item, { quantity: amount, doseLogId: removedLog.id, date: targetDate, reversesMovementId: movement?.id || null });
    if (!credit.success || credit.creditedQuantity !== amount) return fail("INVENTORY_CREDIT_MISMATCH", "Não foi possível estornar exatamente o pacote oral.");
    const updatedInventory = [...inventory]; updatedInventory[packageIndex] = credit.package;
    arr.splice(index, 1); if (arr.length) day[peptideId] = arr; else delete day[peptideId];
    const updatedLogs = { ...logs }; if (Object.keys(day).length) updatedLogs[targetDate] = day; else delete updatedLogs[targetDate];
    return { success: true, logs: updatedLogs, inventory: updatedInventory, removedLog, vial: credit.package, creditedQuantity: credit.creditedQuantity };
  }
  const original = originalDebit(removedLog, inventory);
  if (!original.success) return original;
  const updatedInventory = [...inventory];
  let vial = null;
  let creditedMcg = 0;
  if (original.amount > 0) {
    const credit = creditVialDose(inventory[original.vialIndex], { doseMcg: original.amount, doseLogId: removedLog.id, date: targetDate, note: `Estorno de aplicação (${removedLog.id})` });
    if (!credit.success || !equalAmount(credit.creditedMcg, original.amount)) return fail("INVENTORY_CREDIT_MISMATCH", "O frasco não permite estornar exatamente o débito original. Nenhum dado foi alterado.");
    vial = credit.vial;
    vial.movements.at(-1).reversesMovementId = original.movementId;
    creditedMcg = credit.creditedMcg;
    updatedInventory[original.vialIndex] = vial;
  }
  arr.splice(index, 1);
  if (arr.length) day[peptideId] = arr;
  else delete day[peptideId];
  const updatedLogs = { ...logs };
  if (Object.keys(day).length) updatedLogs[targetDate] = day;
  else delete updatedLogs[targetDate];
  return { success: true, logs: updatedLogs, inventory: updatedInventory, removedLog, vial, creditedMcg };
}

export function deleteDoseState(options) { return undoDoseState(options); }

/** Correct one record as a single state transition; never switch it to another vial. */
export function editDoseState({ logs = {}, inventory = [], peptideId, scheduledDate, doseLogId, updates = {} }) {
  if (!doseLogId || !updates || typeof updates !== "object" || Array.isArray(updates)) return fail("VALIDATION_FAILED", "Correção de registro inválida.");
  const original = entries(logs[scheduledDate]?.[peptideId], scheduledDate, peptideId).find(entry => entry?.id === doseLogId);
  if (!original) return fail("DOSE_NOT_FOUND", "Dose não encontrada para corrigir.");
  const allowed = ["scheduledDate", "time", "dose", "ui", "site", "note", "status", "statusReason"];
  if (Object.keys(updates).some(key => !allowed.includes(key))) return fail("VALIDATION_FAILED", "A correção contém campos que não podem ser alterados.");
  const next = { ...clone(original), peptideId, scheduledDate, ...updates };
  const legacyUnknownUnits = !original.protocolSnapshot && original.ui == null && updates.ui === undefined;
  const legacyUnknownDose = !original.protocolSnapshot && original.dose == null && updates.dose === undefined;
  next.status = next.status === undefined ? "applied" : next.status;
  next.dose = legacyUnknownDose ? "" : next.dose === undefined ? "" : next.dose;
  next.ui = legacyUnknownUnits ? 0 : next.ui === undefined ? 0 : next.ui;
  const invalid = validateInput({ ...next, requireAdministration: next.administrationLegacy === false, requireSite: next.administrationLegacy === false && next.administrationRoute !== "oral" });
  if (invalid) return invalid;
  const undo = undoDoseState({ logs, inventory, peptideId, scheduledDate, doseLogId });
  if (!undo.success) return undo;
  const editedAt = new Date().toISOString();
  const previous = Object.fromEntries([...allowed, "takenAt", "protocolSnapshot", "inventoryMovementId", "vialId", "debitedMcg"].map(key => [key, clone(original[key] ?? null)]));
  const snapshot = original.protocolSnapshot ? { ...clone(original.protocolSnapshot), dose: String(next.dose).trim(), ui: parseUnits(next.ui) } : null;
  // A calculation snapshot belongs to its original values; retain it in the audit if dose values change.
  if (snapshot && (String(next.dose).trim() !== original.dose || parseUnits(next.ui) !== original.ui)) snapshot.calculationSnapshot = null;
  const corrected = createDoseLog({
    ...next, id: original.id, createdAt: original.createdAt, editedAt,
    takenAt: next.scheduledDate !== scheduledDate || next.time !== original.time ? new Date(`${next.scheduledDate}T${next.time}:00`).toISOString() : original.takenAt,
    retroactive: original.retroactive || next.scheduledDate < dateToKey(new Date()),
    protocolSnapshot: snapshot, vialId: null, inventoryMovementId: null, debitedMcg: 0,
    editHistory: [...(original.editHistory || []), { editedAt, previous }]
  });
  // A skipped correction may later become applied again: retain the previously confirmed vial.
  const originalStockRecord = [original, ...(original.editHistory || []).slice().reverse().map(edit => edit.previous)].find(entry => entry?.vialId || entry?.inventoryId);
  // A skipped/missed record has no original vial. When the user corrects it to
  // applied, choose the current active vial for this peptide exactly as a new
  // registration would; later edits still remain locked to this new vial.
  const referenceName = original.protocolSnapshot?.name || original.name || original.peptideName || "";
  const fallbackIndex = original.status !== "applied"
    ? undo.inventory.findIndex(v => v?.status === "active" && (corrected.administrationRoute !== "oral" || (v.kind === "oral_package" && v.presentation === corrected.administrationUnit)) && (String(v.peptideId || "") === String(peptideId) || String(v.peptideName || "").trim().toLowerCase() === String(referenceName).trim().toLowerCase()))
    : -1;
  const originalIndex = originalStockRecord ? undo.inventory.findIndex(v => v.id === (originalStockRecord.inventoryId || originalStockRecord.vialId)) : fallbackIndex;
  if (corrected.status === "applied" && original.status !== "applied" && originalIndex < 0) return fail("ORIGINAL_VIAL_MISSING", "Nenhum frasco ativo está vinculado a este protocolo para registrar a aplicação.");
  if (corrected.status === "applied" && originalStockRecord && originalIndex < 0) return fail("ORIGINAL_VIAL_MISSING", "O frasco original não foi encontrado para corrigir a aplicação.");
  const historicalVial = originalStockRecord?.protocolSnapshot?.vial || (originalStockRecord ? { concentrationMcgPerMl: null } : null);
  const quantityUnchanged = (updates.dose === undefined || String(updates.dose).trim() === originalStockRecord?.dose)
    && (updates.ui === undefined || parseUnits(updates.ui) === parseUnits(originalStockRecord?.ui));
  const fixedAmount = quantityUnchanged && original.vialId ? undo.creditedMcg : null;
  const result = applyStock(corrected, undo.inventory, originalIndex, { historicalVial, fixedAmount });
  if (!result.success) return result;
  if (corrected.protocolSnapshot) {
    corrected.protocolSnapshot.vial = result.vial
      ? clone(originalStockRecord?.protocolSnapshot?.vial || {
          id: result.vial.id, peptideName: result.vial.peptideName || referenceName,
          lotNumber: result.vial.lotNumber || "", concentrationMcgPerMl: result.vial.concentrationMcgPerMl,
          totalMg: result.vial.totalMg, waterMl: result.vial.waterMl
        })
      : null;
  }
  const appended = appendLog(undo.logs, result.inventory, corrected, result.vial || undo.vial, result.debitedMcg);
  if (legacyUnknownUnits) {
    if (original.ui === undefined) delete corrected.ui;
    else corrected.ui = original.ui;
  }
  if (legacyUnknownDose) {
    if (original.dose === undefined) delete corrected.dose;
    else corrected.dose = original.dose;
  }
  return { ...appended, previousLog: clone(original), creditedMcg: undo.creditedMcg };
}

/** Explicit user-confirmed backfill only; never moves present stock. */
export function backfillPeptideDoseLogs(logs = {}, peptide = {}, backfillDates = []) {
  if (!peptide?.id || !Array.isArray(backfillDates)) return { logs, addedCount: 0, datesAdded: [] };
  let updatedLogs = { ...logs };
  let addedCount = 0;
  const datesAdded = [];
  for (const item of backfillDates) {
    const dateKey = item.dateKey;
    if (!isValidDateKey(dateKey) || entries(updatedLogs[dateKey]?.[peptide.id], dateKey, peptide.id).length) continue;
    const times = Array.isArray(item.times) && item.times.length ? item.times : [peptide.time || "08:00"];
    let dayAdded = false;
    for (const time of times) {
      const result = registerDoseState({ logs: updatedLogs, peptides: [peptide], peptideId: peptide.id, scheduledDate: dateKey, time, note: "Início do protocolo (retroativo)", retroactive: true });
      if (!result.success) continue;
      updatedLogs = result.logs;
      addedCount++;
      dayAdded = true;
    }
    if (dayAdded) datesAdded.push(dateKey);
  }
  return { logs: updatedLogs, addedCount, datesAdded };
}
