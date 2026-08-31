import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageService } from "../../src/services/storage.js";

describe("Storage Service", () => {
  let mockStore = {};
  let storageInstance;

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: vi.fn((k) => mockStore[k] || null),
      setItem: vi.fn((k, v) => { mockStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete mockStore[k]; }),
      clear: vi.fn(() => { mockStore = {}; })
    };
    storageInstance = new StorageService();
  });

  it("inicializa com estado padrão e salva no storage", () => {
    const res = storageInstance.init();
    expect(res.peptides).toBeDefined();
    expect(res.logs).toEqual({});
  });

  it("retorna { success: true } ao salvar peptídeos com sucesso", () => {
    storageInstance.init();
    const res = storageInstance.setPeptides([{ name: "BPC-157", dose: "250 mcg" }]);
    expect(res.success).toBe(true);
    expect(storageInstance.getPeptides()).toHaveLength(1);
  });

  it("retorna { success: false } e executa rollback se localStorage falhar", () => {
    storageInstance.init();
    storageInstance.setPeptides([{ name: "Peptídeo Inicial", dose: "1 mg" }]);

    // Simula falha de quota excedida
    global.localStorage.setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });

    const res = storageInstance.setPeptides([{ name: "Novo Peptídeo Falho" }]);
    expect(res.success).toBe(false);
    expect(res.error).toContain("QuotaExceededError");
    // Estado anterior deve ser preservado pelo rollback
    expect(storageInstance.getPeptides()[0].name).toBe("Peptídeo Inicial");
  });

  it("importa backup válido e atualiza stores", () => {
    storageInstance.init();
    const backupJson = JSON.stringify({
      version: 2,
      protocol: [{ name: "Tirzepatida", dose: "2,5 mg" }],
      logs: { "2026-08-28": { "pep_1": { t: "08:00" } } },
      theme: "white"
    });

    const res = storageInstance.importBackup(backupJson);
    expect(res.success).toBe(true);
    expect(storageInstance.getPeptides()).toHaveLength(1);
    expect(storageInstance.getLogs()["2026-08-28"]).toBeDefined();
  });

  it("notify envia clone defensivo e protege o estado interno de mutações por listeners", () => {
    storageInstance.init();
    storageInstance.setPeptides([{ name: "BPC-157", dose: "250 mcg" }]);

    let receivedPayload = null;
    storageInstance.subscribe((payload) => {
      receivedPayload = payload;
      // Listener tenta mutar a lista recebida
      if (payload && payload.peptides && payload.peptides[0]) {
        payload.peptides[0].name = "MUTATED_BY_LISTENER";
        payload.peptides.push({ name: "INJECTED_PEPTIDE" });
      }
    });

    storageInstance.notify();

    expect(receivedPayload).not.toBeNull();
    // O estado interno do storage deve continuar intacto
    const internalPeptides = storageInstance.getPeptides();
    expect(internalPeptides[0].name).toBe("BPC-157");
    expect(internalPeptides).toHaveLength(1);
  });

  it("incrementa syncVersion ao editar uma medição existente", () => {
    storageInstance.init();
    const initial = storageInstance.addMeasurement({
      id: "m_test_1",
      date: "2026-08-29",
      time: "08:00",
      weightKg: 84.0
    });
    expect(initial.success).toBe(true);
    expect(initial.entry.syncVersion).toBe(1);

    // Edita o peso do mesmo ID
    const updated = storageInstance.addMeasurement({
      id: "m_test_1",
      date: "2026-08-29",
      time: "08:00",
      weightKg: 83.5
    });
    expect(updated.success).toBe(true);
    expect(updated.entry.syncVersion).toBe(2);
  });

  it("registra tombstone ao excluir uma medição local do PEP com peso", () => {
    storageInstance.init();
    storageInstance.addMeasurement({
      id: "m_to_delete",
      date: "2026-08-29",
      time: "08:00",
      weightKg: 80.0,
      source: "local",
      ownership: "pep"
    });

    expect(storageInstance.getTombstones()).toHaveLength(0);

    const delRes = storageInstance.deleteMeasurement("m_to_delete");
    expect(delRes.success).toBe(true);

    const tombstones = storageInstance.getTombstones();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].id).toBe("m_to_delete");

    // Limpar tombstones após sincronização
    storageInstance.clearTombstones(["m_to_delete"]);
    expect(storageInstance.getTombstones()).toHaveLength(0);
  });

  it("NÃO registra tombstone ao excluir uma medição externa importada", () => {
    storageInstance.init();
    storageInstance.addMeasurement({
      id: "hc_ext_samsung_123",
      date: "2026-08-29",
      time: "08:00",
      weightKg: 81.0,
      source: "health_connect",
      ownership: "external",
      dataOrigin: "com.sec.android.app.shealth"
    });

    expect(storageInstance.getTombstones()).toHaveLength(0);

    const delRes = storageInstance.deleteMeasurement("hc_ext_samsung_123");
    expect(delRes.success).toBe(true);

    // Medições externas removidas da visualização local nunca geram tombstone no Health Connect
    expect(storageInstance.getTombstones()).toHaveLength(0);
  });
});
