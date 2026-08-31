import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createVial,
  validateVial,
  extractDoseInMcg,
  debitVialDose,
  creditVialDose,
  calculateRemainingDoses,
  getExpirationStatus
} from "../../src/domain/inventory.js";
import { StorageService } from "../../src/services/storage.js";

describe("Inventory Domain & Logic (V10)", () => {
  it("cria um frasco com concentração e saldo calculados corretamente", () => {
    const vial = createVial({
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      reconstitutionDate: "2026-08-29",
      expirationDate: "2026-09-29"
    });

    expect(vial.id).toBeDefined();
    expect(vial.peptideName).toBe("BPC-157");
    expect(vial.totalMg).toBe(5);
    expect(vial.waterMl).toBe(2);
    expect(vial.concentrationMcgPerMl).toBe(2500); // 5000 mcg / 2 ml = 2500 mcg/ml
    expect(vial.initialMcg).toBe(5000);
    expect(vial.remainingMcg).toBe(5000);
    expect(vial.status).toBe("active");
    expect(vial.movements.length).toBe(1);
    expect(vial.movements[0].type).toBe("reconstitution");
  });

  it("valida dados obrigatórios e impede valores negativos", () => {
    expect(validateVial(null).valid).toBe(false);
    expect(validateVial({}).valid).toBe(false);
    expect(validateVial({ peptideName: "TB-500", totalMg: -5, waterMl: 2 }).valid).toBe(false);
    expect(validateVial({ peptideName: "TB-500", totalMg: 5, waterMl: 0 }).valid).toBe(false);
    
    const valid = validateVial({ peptideName: "TB-500", totalMg: 5, waterMl: 2, remainingMcg: 5000 });
    expect(valid.valid).toBe(true);
    expect(valid.errors.length).toBe(0);
  });

  it("extrai dose em mcg de strings em mcg e mg com precisão", () => {
    expect(extractDoseInMcg("250 mcg")).toBe(250);
    expect(extractDoseInMcg("250mcg")).toBe(250);
    expect(extractDoseInMcg("0.5 mg")).toBe(500);
    expect(extractDoseInMcg("1 mg")).toBe(1000);
    expect(extractDoseInMcg(300)).toBe(300);
    expect(extractDoseInMcg("")).toBe(0);
    expect(extractDoseInMcg(null)).toBe(0);
  });

  it("debita doses sucessivas, registra trilha de movimentação e finaliza frasco ao zerar", () => {
    const vial = createVial({
      peptideName: "BPC-157",
      totalMg: 1, // 1000 mcg
      waterMl: 1
    });

    const res1 = debitVialDose(vial, { doseMcg: 400, note: "Dose matutina" });
    expect(res1.success).toBe(true);
    expect(res1.vial.remainingMcg).toBe(600);
    expect(res1.vial.status).toBe("active");
    expect(res1.vial.movements.length).toBe(2);

    const res2 = debitVialDose(res1.vial, { doseMcg: 600, note: "Dose noturna" });
    expect(res2.success).toBe(true);
    expect(res2.vial.remainingMcg).toBe(0);
    expect(res2.vial.status).toBe("finished");
    expect(res2.isFinished).toBe(true);
  });

  it("rejeita débito se a dose for maior que o saldo disponível (P1 - Sec 12)", () => {
    const vial = createVial({
      peptideName: "Semaglutida",
      totalMg: 1, // 1000 mcg
      waterMl: 1,
      remainingMcg: 200
    });

    const res = debitVialDose(vial, { doseMcg: 500 });
    expect(res.success).toBe(false);
    expect(res.error).toBe("INSUFFICIENT_BALANCE");
    expect(res.vial.remainingMcg).toBe(200); // Saldo inalterado
  });

  it("estorna dose com sucesso e reativa frasco se estava finalizado", () => {
    const finishedVial = createVial({
      peptideName: "BPC-157",
      totalMg: 1,
      waterMl: 1,
      remainingMcg: 0,
      status: "finished"
    });

    const res = creditVialDose(finishedVial, { doseMcg: 250, note: "Estorno de dose desmarcada" });
    expect(res.success).toBe(true);
    expect(res.vial.remainingMcg).toBe(250);
    expect(res.vial.status).toBe("active");
    expect(res.vial.movements.length).toBe(2);
    expect(res.vial.movements[1].type).toBe("undo_dose");
  });

  it("calcula doses restantes com base na dose especificada", () => {
    const vial = createVial({
      peptideName: "BPC-157",
      totalMg: 5, // 5000 mcg
      waterMl: 2,
      remainingMcg: 3750
    });

    expect(calculateRemainingDoses(vial, "250 mcg")).toBe(15);
    expect(calculateRemainingDoses(vial, "500 mcg")).toBe(7);
    expect(calculateRemainingDoses(vial, "0 mcg")).toBe(0);
  });

  it("converte dose em UI para mcg quando frasco com concentração conhecida for fornecido", () => {
    const vial = createVial({
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2 // 2500 mcg/ml
    });

    // Seringa U-100: 10 UI = 0.1 ml -> 0.1 * 2500 = 250 mcg
    expect(extractDoseInMcg("10 UI", vial)).toBe(250);
    expect(extractDoseInMcg("10ui", vial)).toBe(250);
    expect(extractDoseInMcg("5 UI", vial)).toBe(125);
    // Sem frasco ou sem concentração, retorna 0 para não assumir valores arbitrários
    expect(extractDoseInMcg("10 UI", null)).toBe(0);
    expect(extractDoseInMcg("10 UI", { concentrationMcgPerMl: 0 })).toBe(0);
  });

  it("protege frascos com histórico contra alteração estrutural de mg e mL (P1 - Sec 13)", async () => {
    const { hasVialHistory, updateVial, canDeleteVialPhysically, archiveVial } = await import("../../src/domain/inventory.js");

    const vial = createVial({
      id: "vial-hist",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2
    });

    // 1. Antes de qualquer dose, pode atualizar livremente
    expect(hasVialHistory(vial)).toBe(false);
    expect(canDeleteVialPhysically(vial)).toBe(true);

    const update1 = updateVial(vial, { totalMg: 10, waterMl: 2 });
    expect(update1.success).toBe(true);
    expect(update1.vial.totalMg).toBe(10);
    expect(update1.vial.concentrationMcgPerMl).toBe(5000);

    // 2. Após registrar uma dose
    const debited = debitVialDose(update1.vial, { doseMcg: 250 });
    expect(hasVialHistory(debited.vial)).toBe(true);
    expect(canDeleteVialPhysically(debited.vial)).toBe(false);

    // 3. Tentar mudar mg ou mL em frasco com histórico deve falhar
    const failUpdate = updateVial(debited.vial, { totalMg: 20 });
    expect(failUpdate.success).toBe(false);
    expect(failUpdate.error).toBe("PROTECTED_HISTORICAL_VIAL");

    // 4. Mas editar campos descritivos deve ser permitido
    const okUpdate = updateVial(debited.vial, { lotNumber: "LOTE-2026-X", notes: "Guardado no freezer" });
    expect(okUpdate.success).toBe(true);
    expect(okUpdate.vial.lotNumber).toBe("LOTE-2026-X");
    expect(okUpdate.vial.notes).toBe("Guardado no freezer");

    // 5. Arquivar / descartar (soft-delete)
    const archived = archiveVial(debited.vial, "discarded");
    expect(archived.status).toBe("discarded");
    expect(archived.archivedAt).toBeTruthy();
  });

  it("avalia status de validade e alertas de vencimento próximo", () => {
    const today = new Date(2026, 7, 29); // 29 de Agosto de 2026

    const vialOk = createVial({ peptideName: "BPC-157", totalMg: 5, waterMl: 2, expirationDate: "2026-09-29" });
    expect(getExpirationStatus(vialOk, today).status).toBe("ok");

    const vialSoon = createVial({ peptideName: "BPC-157", totalMg: 5, waterMl: 2, expirationDate: "2026-09-02" });
    expect(getExpirationStatus(vialSoon, today).status).toBe("expiring_soon");

    const vialExpired = createVial({ peptideName: "BPC-157", totalMg: 5, waterMl: 2, expirationDate: "2026-08-20" });
    expect(getExpirationStatus(vialExpired, today).status).toBe("expired");

    const vialNoDate = createVial({ peptideName: "BPC-157", totalMg: 5, waterMl: 2, expirationDate: null });
    expect(getExpirationStatus(vialNoDate, today).status).toBe("unknown");
  });
});

describe("Storage Service - Inventory & Rollback", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: vi.fn((k) => mockStore[k] || null),
      setItem: vi.fn((k, v) => { mockStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete mockStore[k]; }),
      clear: vi.fn(() => { mockStore = {}; })
    };
  });

  it("persiste, consulta e encontra frascos vinculados a peptídeos", () => {
    const storage = new StorageService();
    storage.init();

    const vial = createVial({
      peptideId: "pep-123",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2
    });

    const setRes = storage.setInventory([vial]);
    expect(setRes.success).toBe(true);
    expect(storage.getInventory().length).toBe(1);

    const foundById = storage.findVialForPeptide("pep-123");
    expect(foundById).not.toBeNull();
    expect(foundById.id).toBe(vial.id);

    const foundByName = storage.findVialForPeptide("bpc-157");
    expect(foundByName).not.toBeNull();
    expect(foundByName.id).toBe(vial.id);
  });

  it("debita e estorna doses diretamente pelo storage service", () => {
    const storage = new StorageService();
    storage.init();

    const vial = createVial({
      id: "vial-abc",
      peptideName: "GHK-Cu",
      totalMg: 50,
      waterMl: 2
    });
    storage.setInventory([vial]);

    // Débito
    const debitRes = storage.debitDoseFromVial("vial-abc", { doseMcg: 2000, note: "Dose teste" });
    expect(debitRes.success).toBe(true);
    expect(storage.getInventory()[0].remainingMcg).toBe(48000);

    // Estorno
    const creditRes = storage.creditDoseToVial("vial-abc", { doseMcg: 2000, note: "Estorno teste" });
    expect(creditRes.success).toBe(true);
    expect(storage.getInventory()[0].remainingMcg).toBe(50000);
  });
});
