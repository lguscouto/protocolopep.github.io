import { describe, it, expect, vi } from "vitest";
import { registerDoseState, undoDoseState, editDoseState } from "../../src/domain/dose-service.js";
import { createVial } from "../../src/domain/inventory.js";
import { createDoseLog, validateDoseLog, normalizeDoseEntry } from "../../src/domain/dose-log.js";
import { DoseService } from "../../src/services/dose-service.js";

const date = "2026-01-10";
const peptide = () => ({ id: "pep_test", name: "Composto original", sub: "Observação original", dose: "100 mcg", ui: 2.5, calculationSnapshot: { id: "calc_original", unitsUI: 2.5 } });
const vial = (id = "vial_original") => createVial({ id, peptideId: "pep_test", peptideName: "Composto original", totalMg: 1, waterMl: 1 });
const register = (options = {}) => registerDoseState({ peptides: [peptide()], inventory: [vial()], peptideId: "pep_test", scheduledDate: date, time: "08:00", ...options });
const undo = (result, options = {}) => undoDoseState({ logs: result.logs, inventory: result.inventory, peptideId: "pep_test", scheduledDate: date, doseLogId: result.doseLog.id, ...options });
const edit = (result, updates, options = {}) => editDoseState({ logs: result.logs, inventory: result.inventory, peptideId: "pep_test", scheduledDate: result.doseLog.scheduledDate, doseLogId: result.doseLog.id, updates, ...options });

 describe("Integridade de débito, snapshot e correção de doses", () => {
  it.each(["skipped", "missed"])("%s não debita, não exige saldo/concentração e não pode gerar crédito", status => {
    const inventory = [{ ...vial(), remainingMcg: 1, concentrationMcgPerMl: 0 }];
    const result = register({ inventory, status, dose: "50 UI", ui: 50 });
    expect(result.success).toBe(true);
    expect(result.inventory).toEqual(inventory);
    expect(result.doseLog).toMatchObject({ vialId: null, inventoryMovementId: null, debitedMcg: 0 });
    expect(undo(result)).toMatchObject({ success: true, creditedMcg: 0, inventory });
  });

  it.each([
    { scheduledDate: "2026-02-29" }, { scheduledDate: "2099-01-01" }, { time: "24:00" },
    { time: "" }, { status: "invalid" }, { status: null }, { ui: -1 }, { ui: "1,2,3" },
    { ui: NaN }, { ui: Infinity }, { ui: null }, { dose: "NaN" }, { dose: "Infinity" },
    { dose: "-1 mg" }, { dose: "0 mcg" }, { dose: "1.2.3 mg" }
  ])("rejeita entrada inválida sem mutar os dados: %j", updates => {
    const inventory = [vial()];
    const logs = {};
    const before = structuredClone({ inventory, logs });
    const result = register({ logs, inventory, ...updates });
    expect(result.success).toBe(false);
    expect({ inventory, logs }).toEqual(before);
  });

  it.each(["2,5", "2.5", 2.5])("preserva UI fracionária %s em dose, snapshot e saldo", ui => {
    const result = register({ ui, dose: "" });
    expect(result.success).toBe(true);
    expect(result.doseLog.ui).toBe(2.5);
    expect(result.doseLog.protocolSnapshot.ui).toBe(2.5);
    expect(result.debitedMcg).toBe(25);
    expect(undo(result).inventory[0].remainingMcg).toBe(1000);
  });

  it("não arredonda silenciosamente uma dose fora da precisão do estoque", () => {
    expect(register({ dose: "0.001 mcg" })).toMatchObject({ success: false, error: "INVALID_DOSE_PRECISION" });
    expect(register({ dose: "0.00001 UI" })).toMatchObject({ success: false, error: "INVALID_DOSE_PRECISION" });
  });

  it("massa conhecida dispensa concentração mesmo quando há UI informadas", () => {
    const result = register({ inventory: [{ ...vial(), concentrationMcgPerMl: 0 }], dose: "100 mcg", ui: 2.5 });
    expect(result.success).toBe(true);
    expect(result.debitedMcg).toBe(100);
  });

  it("captura a revisão vigente no horário efetivo e copia profundamente os dados", () => {
    const source = peptide();
    source.revisions = [
      { id: "r1", status: "active", effectiveFrom: new Date(`${date}T00:00:00`).toISOString(), config: { ...peptide(), dose: "100 mcg", ui: 2.5 } },
      { id: "r2", status: "active", effectiveFrom: new Date(`${date}T10:00:00`).toISOString(), config: { ...peptide(), name: "Composto renomeado", dose: "200 mcg", ui: 5 } }
    ];
    const early = register({ peptides: [source], time: "09:30", retroactive: false });
    const late = register({ peptides: [source], time: "10:30", retroactive: true });
    expect(early.doseLog.protocolSnapshot).toMatchObject({ revisionId: "r1", name: "Composto original", dose: "100 mcg", ui: 2.5 });
    expect(late.doseLog.protocolSnapshot).toMatchObject({ revisionId: "r2", name: "Composto renomeado", dose: "200 mcg", ui: 5 });
    expect(new Date(early.doseLog.takenAt).getHours()).toBe(9);
    source.revisions[0].config.calculationSnapshot.unitsUI = 99;
    expect(early.doseLog.protocolSnapshot.calculationSnapshot.unitsUI).toBe(2.5);
  });

  it("registro rápido resolve segundos reais sem voltar à revisão anterior do mesmo minuto", () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-01-10T09:30:45");
      vi.setSystemTime(now);
      const source = { ...peptide(), revisions: [
        { id: "r1", status: "active", effectiveFrom: new Date("2026-01-10T09:00:00").toISOString(), config: peptide() },
        { id: "r2", status: "active", effectiveFrom: new Date("2026-01-10T09:30:30").toISOString(), config: { ...peptide(), dose: "200 mcg" } }
      ] };
      const result = registerDoseState({ peptides: [source], peptideId: "pep_test" });
      expect(result.success).toBe(true);
      expect(result.doseLog.protocolSnapshot.revisionId).toBe("r2");
      expect(result.doseLog.dose).toBe("200 mcg");
      expect(result.doseLog.takenAt).toBe(now.toISOString());
    } finally { vi.useRealTimers(); }
  });

  it("não atribui configuração futura a registro anterior à primeira revisão", () => {
    const source = { ...peptide(), revisions: [{ id: "future", status: "active", effectiveFrom: new Date(`${date}T10:00:00`).toISOString(), config: peptide() }] };
    const result = register({ peptides: [source], inventory: [], time: "09:00", dose: "50 mcg", ui: 1.25 });
    expect(result.success).toBe(true);
    expect(result.doseLog.protocolSnapshot).toBeNull();
    expect(result.doseLog.historyIntegrity).toBe("legacy");
    expect(result.doseLog.dose).toBe("50 mcg");
  });

  it("protocolo com unidades legadas inválidas exige valores explicitamente conferidos", () => {
    const source = { ...peptide(), ui: 0, numericIntegrity: "needs_review" };
    expect(register({ peptides: [source] })).toMatchObject({ success: false, error: "VALIDATION_FAILED" });
    expect(register({ peptides: [source], dose: "100 mcg", ui: "2,5" }).success).toBe(true);
  });

  it("estorna o movimento original quando dose, UI e concentração atuais divergem", () => {
    const result = register({ dose: "10 UI", ui: 10 });
    const recorded = result.logs[date].pep_test[0];
    recorded.dose = "99 UI";
    recorded.ui = 99;
    result.inventory[0].concentrationMcgPerMl = 9000;
    const undone = undo(result);
    expect(undone.success).toBe(true);
    expect(undone.creditedMcg).toBe(100);
    expect(undone.inventory[0].remainingMcg).toBe(1000);
    expect(undone.inventory[0].movements.at(-1).reversesMovementId).toBe(recorded.inventoryMovementId);
  });

  it("aceita o débito registrado como evidência quando o ID do movimento legado não existe", () => {
    const result = register();
    result.logs[date].pep_test[0].inventoryMovementId = null;
    expect(undo(result)).toMatchObject({ success: true, creditedMcg: 100 });
  });

  it.each(["vial_missing", "movement_missing", "movement_foreign", "movement_wrong_type", "amount_mismatch", "no_original_amount", "already_reversed", "credit_clamped"])("preserva log e estoque com evidência inconsistente: %s", scenario => {
    const result = register();
    const log = result.logs[date].pep_test[0];
    const movement = result.inventory[0].movements.at(-1);
    if (scenario === "vial_missing") result.inventory = [];
    if (scenario === "movement_missing") result.inventory[0].movements = [];
    if (scenario === "movement_foreign") movement.doseLogId = "different_log";
    if (scenario === "movement_wrong_type") movement.type = "reconstitution";
    if (scenario === "amount_mismatch") log.debitedMcg = 120;
    if (scenario === "no_original_amount") { log.inventoryMovementId = null; log.debitedMcg = null; }
    if (scenario === "already_reversed") result.inventory[0].movements.push({ type: "undo_dose", reversesMovementId: movement.id, doseLogId: log.id });
    if (scenario === "credit_clamped") result.inventory[0].remainingMcg = 950;
    const before = structuredClone(result);
    expect(undo(result).success).toBe(false);
    expect(result).toEqual(before);
  });

  it("corrige valor, data e hora preservando identidade, snapshot e trilha de alterações", () => {
    const initial = register();
    const original = structuredClone(initial.doseLog);
    const corrected = edit(initial, { dose: "150 mcg", ui: 3.75, scheduledDate: "2026-01-11", time: "11:30", note: "Valor conferido" });
    expect(corrected.success).toBe(true);
    expect(corrected.inventory[0].remainingMcg).toBe(850);
    expect(corrected.logs[date]).toBeUndefined();
    expect(corrected.doseLog).toMatchObject({ id: original.id, createdAt: original.createdAt, dose: "150 mcg", ui: 3.75, note: "Valor conferido", time: "11:30" });
    expect(corrected.doseLog.protocolSnapshot).toMatchObject({ name: original.protocolSnapshot.name, revisionId: original.protocolSnapshot.revisionId, dose: "150 mcg", ui: 3.75, calculationSnapshot: null });
    expect(corrected.doseLog.editHistory[0].previous).toMatchObject({ dose: "100 mcg", ui: 2.5, protocolSnapshot: original.protocolSnapshot });
    expect(initial.doseLog).toEqual(original);
    expect(new Date(corrected.doseLog.takenAt).getHours()).toBe(11);
  });

  it("corrige UI usando a concentração histórica, sempre no frasco original", () => {
    const initial = register({ dose: "10 UI", ui: 10 });
    initial.inventory[0].concentrationMcgPerMl = 2000;
    initial.inventory.push(vial("vial_novo"));
    const corrected = edit(initial, { dose: "20 UI", ui: 20 });
    expect(corrected.success).toBe(true);
    expect(corrected.inventory[0].remainingMcg).toBe(800);
    expect(corrected.inventory[1].remainingMcg).toBe(1000);
    expect(corrected.doseLog.vialId).toBe("vial_original");
    expect(undo(corrected)).toMatchObject({ success: true, creditedMcg: 200 });
  });

  it("correções sucessivas mantêm o frasco original inclusive aplicada → pulada → aplicada", () => {
    const initial = register();
    const skipped = edit(initial, { status: "skipped", statusReason: "Correção" });
    expect(skipped.success).toBe(true);
    expect(skipped.inventory[0].remainingMcg).toBe(1000);
    expect(skipped.doseLog).toMatchObject({ vialId: null, debitedMcg: 0, status: "skipped" });
    skipped.inventory.push(vial("frasco_novo"));
    const applied = edit(skipped, { status: "applied", statusReason: "", dose: "200 mcg" });
    expect(applied.success).toBe(true);
    expect(applied.inventory[0].remainingMcg).toBe(800);
    expect(applied.inventory[1].remainingMcg).toBe(1000);
    expect(applied.doseLog.editHistory).toHaveLength(2);
    expect(undo(applied)).toMatchObject({ success: true, creditedMcg: 200 });
  });

  it("corrigir histórico sem débito não movimenta frasco aberto depois", () => {
    const result = register({ inventory: [] });
    const corrected = edit(result, { dose: "200 mcg", ui: 5 }, { inventory: [vial()] });
    expect(corrected.success).toBe(true);
    expect(corrected.inventory[0].remainingMcg).toBe(1000);
    expect(corrected.doseLog.vialId).toBeNull();
  });

  it("não inventa nome ou revisão ao corrigir registro legado sem snapshot", () => {
    const original = createDoseLog({ id: "legacy", peptideId: "pep_test", scheduledDate: date, time: "08:00", dose: "100 mcg", ui: 2.5 });
    const result = editDoseState({ logs: { [date]: { pep_test: [original] } }, inventory: [], peptideId: "pep_test", scheduledDate: date, doseLogId: original.id, updates: { note: "Anotação corrigida" } });
    expect(result.success).toBe(true);
    expect(result.doseLog.protocolSnapshot).toBeNull();
    expect(result.doseLog.historyIntegrity).toBe("legacy");
  });

  it("saldo insuficiente na correção não deixa estorno parcial nem modifica registro", () => {
    const initial = register();
    const before = structuredClone(initial);
    expect(edit(initial, { dose: "2000 mcg" })).toMatchObject({ success: false, error: "INSUFFICIENT_BALANCE" });
    expect(initial).toEqual(before);
  });

  it.each([undefined, null])("corrigir observação legada preserva unidades desconhecidas (%s)", ui => {
    const legacy = { id: "legacy", peptideId: "pep_test", scheduledDate: date, time: "08:00", status: "applied", ui, createdAt: "2026-01-10T12:00:00.000Z" };
    const result = editDoseState({ logs: { [date]: { pep_test: [legacy] } }, inventory: [], peptideId: "pep_test", scheduledDate: date, doseLogId: "legacy", updates: { note: "Conferido" } });
    expect(result.success).toBe(true);
    expect(result.doseLog.ui).toBe(ui);
    expect(result.doseLog.dose).toBeUndefined();
    expect(result.doseLog.protocolSnapshot).toBeNull();
  });

  it("correção de observação estorna exatamente débito legado sem reconstruir concentração", () => {
    const initial = register({ dose: "10 UI", ui: 10 });
    initial.logs[date].pep_test[0].protocolSnapshot = null;
    initial.inventory[0].concentrationMcgPerMl = 3000;
    const corrected = edit(initial, { note: "Conferido" });
    expect(corrected.success).toBe(true);
    expect(corrected.inventory[0].remainingMcg).toBe(900);
    expect(corrected.doseLog.protocolSnapshot).toBeNull();
    expect(edit(initial, { dose: "20 UI", ui: 20 })).toMatchObject({ success: false, error: "VIAL_MISSING_CONCENTRATION" });
  });

  it("não normaliza data/hora/unidades/status inválidos como dados válidos", () => {
    for (const data of [{ scheduledDate: "2026-02-29" }, { time: "24:00" }, { time: "" }, { ui: null }, { ui: Infinity }, { status: null }]) {
      expect(validateDoseLog(createDoseLog({ peptideId: "pep_test", ...data })).valid).toBe(false);
    }
  });

  it("normalização repetida preserva incerteza e nome já presente em registro legado", () => {
    const legacy = { id: "legacy", time: "08:30", name: "Nome registrado" };
    const first = normalizeDoseEntry(legacy, date, "pep_test");
    const second = normalizeDoseEntry(first, date, "pep_test");
    expect(second).toEqual(first);
    expect(second.ui).toBeUndefined();
    expect(second.dose).toBeUndefined();
    expect(second.name).toBe("Nome registrado");
    expect(second.protocolSnapshot).toBeNull();
  });
});

 describe("Persistência de doses confirma apenas o commit conjunto", () => {
  const storage = (result = { success: true }) => ({
    getLogs: () => ({}), getInventory: () => [vial()], getPeptides: () => [peptide()],
    commitDoseState: vi.fn(() => result), setLogs: vi.fn(), setInventory: vi.fn(), restoreSnapshot: vi.fn()
  });
  it("usa uma única operação de persistência para log e inventário", () => {
    const mock = storage();
    const result = new DoseService(mock).registerDose({ peptideId: "pep_test", scheduledDate: date, time: "08:00" });
    expect(result.success).toBe(true);
    expect(mock.commitDoseState).toHaveBeenCalledTimes(1);
    const state = mock.commitDoseState.mock.calls[0][0];
    expect(state.logs[date].pep_test[0].inventoryMovementId).toBe(state.inventory[0].movements.at(-1).id);
    expect(mock.setLogs).not.toHaveBeenCalled();
    expect(mock.setInventory).not.toHaveBeenCalled();
  });
  it.each(["failure", "throws", "missing"])("não confirma registro quando commit %s", scenario => {
    const mock = storage({ success: false, error: "QUOTA" });
    if (scenario === "throws") mock.commitDoseState.mockImplementation(() => { throw new Error("storage unavailable"); });
    if (scenario === "missing") delete mock.commitDoseState;
    const result = new DoseService(mock).registerDose({ peptideId: "pep_test", scheduledDate: date, time: "08:00" });
    expect(result.success).toBe(false);
    expect(result.doseLog).toBeUndefined();
    expect(mock.setLogs).not.toHaveBeenCalled();
    expect(mock.setInventory).not.toHaveBeenCalled();
    expect(mock.restoreSnapshot).not.toHaveBeenCalled();
  });
  it("não chama persistência para uma entrada inválida", () => {
    const mock = storage();
    expect(new DoseService(mock).registerDose({ peptideId: "pep_test", time: "99:99" }).success).toBe(false);
    expect(mock.commitDoseState).not.toHaveBeenCalled();
  });
});
