import { describe, it, expect } from "vitest";
import { createPeptide } from "../../src/domain/protocol.js";
import { createVial } from "../../src/domain/inventory.js";
import { registerDoseState, undoDoseState } from "../../src/domain/dose-service.js";
import { calculateDayProgress, isScheduledOnDate } from "../../src/domain/schedule.js";
import { buildReportData } from "../../src/domain/report.js";

const peptide = () => createPeptide({ id: "pep_fixture", name: "Composto de teste", dose: "100 mcg", ui: 2.5 });
const vial = () => createVial({ id: "vial_fixture", peptideId: "pep_fixture", peptideName: "Composto de teste", totalMg: 1, waterMl: 1 });

describe("Fase 1: integridade de registros", () => {
  it.each(["skipped", "missed"])("%s não debita nem conta como aplicação", (status) => {
    const p = peptide();
    const inventory = [vial()];
    const result = registerDoseState({ peptides: [p], inventory, peptideId: p.id, scheduledDate: "2026-01-01", time: "08:00", status });
    expect(result.success).toBe(true);
    expect(result.inventory).toEqual(inventory);
    expect(result.debitedMcg).toBe(0);
    expect(result.doseLog.vialId).toBeNull();
    const progress = calculateDayProgress([p], result.logs, new Date(2026, 0, 1));
    expect(progress.totalTaken).toBe(0);
    expect(progress.scheduledTaken).toBe(0);
    expect(progress.pendingCount).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.isComplete).toBe(true);
  });
  it.each([{ days: null }, { days: [4] }, { interval: 2 }])("respeita início em todas as agendas: %j", (cadence) => {
    const p = createPeptide({ ...cadence, start: "2026-01-08" });
    expect(isScheduledOnDate(p, new Date(2026, 0, 1))).toBe(false);
    expect(isScheduledOnDate(p, new Date(2026, 0, 8))).toBe(true);
  });
  it.each([2.5, "2,5", "2.5", 0.25])("preserva unidades fracionárias %s", (ui) => {
    expect(createPeptide({ ui }).ui).toBe(Number(String(ui).replace(",", ".")));
  });
  it("novos registros preservam nome e dose após alterar ou remover cadastro", () => {
    const p = peptide();
    const result = registerDoseState({ peptides: [p], peptideId: p.id, scheduledDate: "2026-01-01", time: "08:00" });
    p.name = "Nome novo";
    p.dose = "200 mcg";
    const [withProtocol] = buildReportData({ protocol: [p], logs: result.logs });
    const [withoutProtocol] = buildReportData({ protocol: [], logs: result.logs });
    expect(withProtocol.peptideName).toBe("Composto de teste");
    expect(withoutProtocol.peptideName).toBe("Composto de teste");
    expect(withProtocol.dose).toBe("100 mcg");
    expect(withProtocol.ui).toBe(2.5);
  });
  it("relatório preserva estado, motivo e local", () => {
    const p = peptide();
    const result = registerDoseState({ peptides: [p], peptideId: p.id, scheduledDate: "2026-01-01", time: "08:00", status: "missed", statusReason: "Registro pessoal", site: "Local A" });
    const [entry] = buildReportData({ protocol: [p], logs: result.logs, includeNotes: true });
    expect(entry.status).toBe("missed");
    expect(entry.statusReason).toBe("Registro pessoal");
  });
  it("estorno usa o débito original mesmo se a concentração mudar", () => {
    const p = createPeptide({ id: "pep_fixture", name: "Composto de teste", dose: "10 UI", ui: 10 });
    const result = registerDoseState({ peptides: [p], inventory: [vial()], peptideId: p.id, scheduledDate: "2026-01-01", time: "08:00" });
    const changedInventory = result.inventory.map(v => ({ ...v, concentrationMcgPerMl: 2000 }));
    const undone = undoDoseState({ logs: result.logs, inventory: changedInventory, peptideId: p.id, scheduledDate: "2026-01-01" });
    expect(undone.creditedMcg).toBe(result.debitedMcg);
    expect(undone.inventory[0].remainingMcg).toBe(vial().remainingMcg);
  });
});
