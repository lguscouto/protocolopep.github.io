import { describe, expect, it } from "vitest";
import { createPeptide, validatePeptide } from "../../src/domain/protocol.js";
import { createOralPackage, debitOralPackage, creditOralPackage } from "../../src/domain/inventory.js";
import { registerDoseState, undoDoseState, editDoseState } from "../../src/domain/dose-service.js";
import { migrateAppState } from "../../src/domain/migrations.js";

const date = "2026-09-10";

describe("Fase 8: vias de administração e estoque oral", () => {
  it("aceita oxandrolona oral fracionária, debita e estorna o pacote original", () => {
    const protocol = createPeptide({ id: "pep_oxa", name: "Oxandrolona", dose: "10 mg", compoundClass: "anabolic_steroid", administrationRoute: "oral", administrationQuantity: "1,5", administrationUnit: "tablet", ui: null });
    expect(validatePeptide(protocol).valid).toBe(true);
    const packageItem = createOralPackage({ id: "oral_1", peptideId: protocol.id, peptideName: protocol.name, presentation: "tablet", quantity: 10 });
    const result = registerDoseState({ peptides: [protocol], inventory: [packageItem], peptideId: protocol.id, scheduledDate: date, time: "08:00", dose: "10 mg" });
    expect(result.success).toBe(true);
    expect(result.doseLog).toMatchObject({ administrationRoute: "oral", administrationQuantity: 1.5, administrationUnit: "tablet", site: "", inventoryKind: "oral_package" });
    expect(result.inventory[0].remainingQuantity).toBe(8.5);
    const undone = undoDoseState({ logs: result.logs, inventory: result.inventory, peptideId: protocol.id, scheduledDate: date, doseLogId: result.doseLog.id });
    expect(undone.success).toBe(true);
    expect(undone.inventory[0].remainingQuantity).toBe(10);
  });

  it("rejeita combinações de via e unidade incompatíveis", () => {
    const oralUi = createPeptide({ name: "Teste", compoundClass: "custom", administrationRoute: "oral", administrationQuantity: 1, administrationUnit: "ui" });
    const imTablet = createPeptide({ name: "Teste", compoundClass: "custom", administrationRoute: "intramuscular", administrationQuantity: 1, administrationUnit: "tablet" });
    expect(validatePeptide(oralUi).valid).toBe(false);
    expect(validatePeptide(imTablet).valid).toBe(false);
  });

  it("exige local em protocolo IM moderno e não exige em oral", () => {
    const im = createPeptide({ id: "pep_im", name: "Teste IM", dose: "1 mg", compoundClass: "custom", administrationRoute: "intramuscular", administrationQuantity: 1, administrationUnit: "ml", ui: null });
    const oral = createPeptide({ id: "pep_oral", name: "Teste oral", dose: "1 mg", compoundClass: "custom", administrationRoute: "oral", administrationQuantity: 1, administrationUnit: "capsule", ui: null });
    expect(registerDoseState({ peptides: [im], peptideId: im.id, scheduledDate: date, time: "08:00", dose: "1 mg" })).toMatchObject({ success: false, error: "SITE_REQUIRED" });
    expect(registerDoseState({ peptides: [oral], peptideId: oral.id, scheduledDate: date, time: "08:00", dose: "1 mg", inventory: [], allowHistoryOnlyWithoutStock: true }).success).toBe(false);
  });

  it("corrige uma aplicação oral mantendo o pacote e a quantidade original", () => {
    const protocol = createPeptide({ id: "pep_edit", name: "Oral", dose: "1 mg", compoundClass: "custom", administrationRoute: "oral", administrationQuantity: 0.5, administrationUnit: "capsule", ui: null });
    const item = createOralPackage({ id: "oral_edit", peptideId: protocol.id, peptideName: protocol.name, presentation: "capsule", quantity: 3 });
    const registered = registerDoseState({ peptides: [protocol], inventory: [item], peptideId: protocol.id, scheduledDate: date, time: "08:00", dose: "1 mg" });
    const edited = editDoseState({ logs: registered.logs, inventory: registered.inventory, peptideId: protocol.id, scheduledDate: date, doseLogId: registered.doseLog.id, updates: { note: "Conferido" } });
    expect(edited.success).toBe(true); expect(edited.inventory[0].remainingQuantity).toBe(2.5);
  });

  it("não cria log nem movimento quando o pacote não tem saldo", () => {
    const protocol = createPeptide({ id: "pep_1", name: "Oral", compoundClass: "custom", administrationRoute: "oral", administrationQuantity: 2, administrationUnit: "tablet", dose: "1 mg", ui: null });
    const item = createOralPackage({ peptideId: protocol.id, peptideName: protocol.name, quantity: 1 });
    const result = registerDoseState({ peptides: [protocol], inventory: [item], peptideId: protocol.id, scheduledDate: date, time: "08:00", dose: "1 mg" });
    expect(result).toMatchObject({ success: false, error: "INSUFFICIENT_BALANCE" });
  });

  it("migra schema 11 sem alterar snapshots históricos legados", () => {
    const source = { version: 11, protocol: [{ id: "pep_old", name: "Legado", ui: 2.5, dose: "100 mcg" }], logs: { [date]: { pep_old: [{ id: "log_old", peptideId: "pep_old", scheduledDate: date, time: "08:00", ui: 2.5, dose: "100 mcg" }] } }, inventory: [{ id: "vial_old", peptideName: "Legado", totalMg: 1, waterMl: 1 }] };
    const once = migrateAppState(source); const twice = migrateAppState(once);
    expect(once.version).toBe(12);
    expect(once.protocol[0]).toMatchObject({ compoundClass: "peptide", administrationRoute: "subcutaneous", administrationUnit: "ui", administrationQuantity: 2.5, administrationLegacy: true });
    expect(once.inventory[0].kind).toBe("vial");
    expect(once.logs[date].pep_old[0].administrationRoute).toBeNull();
    expect(twice).toEqual(once);
  });

  it("opera o saldo oral sem arredondar frações", () => {
    const original = createOralPackage({ quantity: "2,25" });
    const debited = debitOralPackage(original, { quantity: "0,25" });
    expect(debited.package.remainingQuantity).toBe(2);
    const credited = creditOralPackage(debited.package, { quantity: "0,25" });
    expect(credited.package.remainingQuantity).toBe(2.25);
    expect(original.remainingQuantity).toBe(2.25);
  });
});
