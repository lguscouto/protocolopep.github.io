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
});
