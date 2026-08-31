import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerDoseState, undoDoseState, deleteDoseState } from "../../src/domain/dose-service.js";
import { DoseService } from "../../src/services/dose-service.js";
import { StorageService } from "../../src/services/storage.js";
import { createVial } from "../../src/domain/inventory.js";

describe("DoseService & Integridade Dose ↔ Inventário (P0 / P1)", () => {
  let mockStore = {};
  let mockStorage;
  let doseService;

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: vi.fn((k) => mockStore[k] || null),
      setItem: vi.fn((k, v) => { mockStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete mockStore[k]; }),
      clear: vi.fn(() => { mockStore = {}; })
    };
    mockStorage = new StorageService();
    mockStorage.init();
    doseService = new DoseService(mockStorage);
  });

  it("deve registrar dose debitando inventário e vinculando vialId e inventoryMovementId", () => {
    const vial = createVial({
      id: "vial-1",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 5000,
      status: "active"
    });

    const peptides = [{ id: "pep-1", name: "BPC-157", dose: "250 mcg", ui: 10 }];
    mockStorage.setPeptides(peptides);
    mockStorage.setInventory([vial]);

    const res = doseService.registerDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-30",
      dose: "250 mcg",
      ui: 10,
      site: "Abdomen Direito"
    });

    expect(res.success).toBe(true);
    expect(res.doseLog.vialId).toBe("vial-1");
    expect(res.doseLog.inventoryMovementId).toBeTruthy();
    expect(res.debitedMcg).toBe(250);

    const updatedInv = mockStorage.getInventory();
    expect(updatedInv[0].remainingMcg).toBe(4750);
    expect(updatedInv[0].movements.length).toBe(2);

    const logs = mockStorage.getLogs();
    expect(logs["2026-08-30"]["pep-1"].length).toBe(1);
    expect(logs["2026-08-30"]["pep-1"][0].vialId).toBe("vial-1");
  });

  it("deve rejeitar registro se saldo for insuficiente e não gerar log órfão (P1 - Sec 12)", () => {
    const vial = createVial({
      id: "vial-1",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 100, // Menor que a dose de 250 mcg
      status: "active"
    });

    const peptides = [{ id: "pep-1", name: "BPC-157", dose: "250 mcg", ui: 10 }];
    mockStorage.setPeptides(peptides);
    mockStorage.setInventory([vial]);

    const res = doseService.registerDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-30",
      dose: "250 mcg"
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("INSUFFICIENT_BALANCE");

    // Inventário permanece intacto
    const updatedInv = mockStorage.getInventory();
    expect(updatedInv[0].remainingMcg).toBe(100);

    // Nenhum log foi gravado
    const logs = mockStorage.getLogs();
    expect(logs["2026-08-30"]).toBeUndefined();
  });

  it("deve desfazer dose da última aplicação de um frasco finalizado (finished) e reabri-lo como active (P0 - Sec 4)", () => {
    const vial = createVial({
      id: "vial-1",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 250, // Exatamente uma dose restante
      status: "active"
    });

    const peptides = [{ id: "pep-1", name: "BPC-157", dose: "250 mcg", ui: 10 }];
    mockStorage.setPeptides(peptides);
    mockStorage.setInventory([vial]);

    // 1. Aplica a última dose
    const regRes = doseService.registerDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-30",
      dose: "250 mcg"
    });
    expect(regRes.success).toBe(true);

    let inv = mockStorage.getInventory();
    expect(inv[0].remainingMcg).toBe(0);
    expect(inv[0].status).toBe("finished");

    // 2. Desfaz a dose
    const undoRes = doseService.undoDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-30",
      doseLogId: regRes.doseLog.id
    });

    expect(undoRes.success).toBe(true);
    expect(undoRes.creditedMcg).toBe(250);

    inv = mockStorage.getInventory();
    expect(inv[0].remainingMcg).toBe(250);
    expect(inv[0].status).toBe("active"); // Frasco reaberto!
    expect(inv[0].finishedAt).toBeNull();

    const logs = mockStorage.getLogs();
    expect(logs["2026-08-30"]).toBeUndefined();
  });

  it("deve desestornar no frasco original mesmo se um novo frasco ativo tiver sido aberto depois", () => {
    const vialOld = createVial({
      id: "vial-old",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 250,
      status: "active"
    });

    const peptides = [{ id: "pep-1", name: "BPC-157", dose: "250 mcg" }];
    mockStorage.setPeptides(peptides);
    mockStorage.setInventory([vialOld]);

    // 1. Aplica dose que finaliza vial-old
    const dose1 = doseService.registerDose({ peptideId: "pep-1", scheduledDate: "2026-08-29", dose: "250 mcg" });
    expect(mockStorage.getInventory()[0].status).toBe("finished");

    // 2. Usuário abre novo frasco ativo
    const vialNew = createVial({
      id: "vial-new",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 5000,
      status: "active"
    });
    mockStorage.setInventory([mockStorage.getInventory()[0], vialNew]);

    // 3. Aplica dose do frasco novo
    const dose2 = doseService.registerDose({ peptideId: "pep-1", scheduledDate: "2026-08-30", dose: "250 mcg" });
    expect(mockStorage.getInventory()[1].remainingMcg).toBe(4750);

    // 4. Desfaz a dose 1 (do frasco antigo vial-old)
    const undoOld = doseService.undoDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-29",
      doseLogId: dose1.doseLog.id
    });

    expect(undoOld.success).toBe(true);

    const finalInv = mockStorage.getInventory();
    const oldFound = finalInv.find((v) => v.id === "vial-old");
    const newFound = finalInv.find((v) => v.id === "vial-new");

    // O crédito foi no frasco antigo, sem inflar o frasco novo!
    expect(oldFound.remainingMcg).toBe(250);
    expect(oldFound.status).toBe("active");
    expect(newFound.remainingMcg).toBe(4750);
  });

  it("excluir dose retroativa que não debitou estoque não pode gerar crédito fantasma (P0 - Sec 3)", () => {
    // Sem frascos no inventário
    mockStorage.setInventory([]);

    // Registra dose retroativa sem frasco
    const regRes = doseService.registerDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-15",
      dose: "500 mcg",
      retroactive: true
    });

    expect(regRes.success).toBe(true);
    expect(regRes.doseLog.vialId).toBeNull();

    // Agora adiciona um frasco qualquer no inventário
    const vial = createVial({
      id: "vial-1",
      peptideId: "pep-1",
      peptideName: "BPC-157",
      totalMg: 5,
      waterMl: 2,
      remainingMcg: 3000,
      status: "active"
    });
    mockStorage.setInventory([vial]);

    // Exclui a dose retroativa antiga
    const delRes = doseService.deleteDose({
      peptideId: "pep-1",
      scheduledDate: "2026-08-15",
      doseLogId: regRes.doseLog.id
    });

    expect(delRes.success).toBe(true);

    // O frasco não pode ter sido creditado
    const inv = mockStorage.getInventory();
    expect(inv[0].remainingMcg).toBe(3000);
    expect(inv[0].movements.length).toBe(1); // Somente a reconstituição inicial
  });

  it("storage getters devem retornar clones profundos impedindo mutações externas acidentais (P0 - Sec 5)", () => {
    mockStorage.setLogs({
      "2026-08-30": {
        "pep-1": [{ id: "log-1", dose: "250 mcg" }]
      }
    });

    const logsCopy = mockStorage.getLogs();
    logsCopy["2026-08-30"]["pep-1"].push({ id: "log-corrupted", dose: "999 mcg" });

    // O storage interno não pode ter sido afetado
    const originalLogs = mockStorage.getLogs();
    expect(originalLogs["2026-08-30"]["pep-1"].length).toBe(1);
    expect(originalLogs["2026-08-30"]["pep-1"][0].id).toBe("log-1");
  });
});
