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

    // Salva novamente com valor equivalente em string sem alteração real
    const unchanged = storageInstance.addMeasurement({
      id: "m_test_1",
      date: "2026-08-29",
      time: "08:00",
      weightKg: "83.5",
      notes: "Anotação puramente local"
    });
    expect(unchanged.success).toBe(true);
    expect(unchanged.entry.syncVersion).toBe(2); // Não deve incrementar para 3
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

  // ─── P0 (CODEX v2.5.0): Campos temporais no upsert de medições ───

  describe("P0 — addMeasurement: timestamp/createdAt/updatedAt no upsert", () => {
    it("novo registro retroativo possui timestamp histórico e createdAt/updatedAt atuais", () => {
      storageInstance.init();
      const res = storageInstance.addMeasurement({
        id: "m_new_1",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 82.0
      });
      expect(res.success).toBe(true);
      expect(res.entry.timestamp).toBeDefined();
      expect(res.entry.createdAt).toBeDefined();
      expect(res.entry.updatedAt).toBeDefined();
      expect(res.entry.createdAt).not.toBe(res.entry.timestamp);
      expect(Date.parse(res.entry.createdAt)).toBeGreaterThan(Date.parse(res.entry.timestamp));
      expect(res.entry.updatedAt).toBe(res.entry.createdAt);
    });

    it("createdAt é preservado (imutável) após edição de peso", () => {
      storageInstance.init();
      const initial = storageInstance.addMeasurement({
        id: "m_edit_peso",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 82.0
      });
      const originalCreatedAt = initial.entry.createdAt;
      const originalTimestamp = initial.entry.timestamp;

      const edited = storageInstance.addMeasurement({
        id: "m_edit_peso",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 83.5 // apenas peso mudou
      });

      expect(edited.success).toBe(true);
      expect(edited.entry.createdAt).toBe(originalCreatedAt);
      // Timestamp preservado pois date/time não mudaram
      expect(edited.entry.timestamp).toBe(originalTimestamp);
    });

    it("updatedAt é atualizado na edição de peso (deve ser >= createdAt)", () => {
      storageInstance.init();
      const initial = storageInstance.addMeasurement({
        id: "m_upd_peso",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 82.0
      });

      const edited = storageInstance.addMeasurement({
        id: "m_upd_peso",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 84.0
      });

      expect(edited.success).toBe(true);
      expect(edited.entry.updatedAt >= initial.entry.createdAt).toBe(true);
    });

    it("timestamp é recalculado quando date muda", () => {
      storageInstance.init();
      const initial = storageInstance.addMeasurement({
        id: "m_edit_date",
        date: "2026-08-29",
        time: "09:00",
        weightKg: 82.0
      });
      const originalTimestamp = initial.entry.timestamp;
      const originalCreatedAt = initial.entry.createdAt;

      const edited = storageInstance.addMeasurement({
        id: "m_edit_date",
        date: "2026-08-30", // data mudou
        time: "09:00",
        weightKg: 82.0
      });

      expect(edited.success).toBe(true);
      // Timestamp deve refletir a nova data
      expect(edited.entry.timestamp).not.toBe(originalTimestamp);
      expect(edited.entry.timestamp).toContain("2026-08-30");
      // createdAt permanece imutável
      expect(edited.entry.createdAt).toBe(originalCreatedAt);
    });

    it("timestamp é recalculado quando time muda", () => {
      storageInstance.init();
      const initial = storageInstance.addMeasurement({
        id: "m_edit_time",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 82.0
      });
      const originalTimestamp = initial.entry.timestamp;
      const originalCreatedAt = initial.entry.createdAt;

      const edited = storageInstance.addMeasurement({
        id: "m_edit_time",
        date: "2026-08-29",
        time: "20:00", // horário mudou
        weightKg: 82.0
      });

      expect(edited.success).toBe(true);
      expect(edited.entry.timestamp).not.toBe(originalTimestamp);
      expect(edited.entry.createdAt).toBe(originalCreatedAt);
    });

    it("edição temporal preserva offset histórico ao simular viagem Rio → Japão", () => {
      storageInstance.init();
      const initial = storageInstance.addMeasurement({
        id: "m_rio_trip",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 82,
        zoneOffset: "-03:00",
        timestamp: "2026-08-29T11:00:00.000Z"
      });
      const edited = storageInstance.addMeasurement({
        id: "m_rio_trip",
        date: "2026-08-30",
        time: "10:00",
        weightKg: 82
      });

      expect(initial.success).toBe(true);
      expect(initial.entry.timeZoneId).toBeNull();
      expect(edited.success).toBe(true);
      expect(edited.entry.zoneOffset).toBe("-03:00");
      expect(edited.entry.timestamp).toBe("2026-08-30T13:00:00.000Z");
    });

    it("rejeita data/hora inválidas sem persistir medição falsa", () => {
      storageInstance.init();
      const invalidDate = storageInstance.addMeasurement({ date: "2026-99-99", weightKg: 80 });
      const invalidTime = storageInstance.addMeasurement({ date: "2026-08-29", time: "99:99", weightKg: 80 });

      expect(invalidDate.success).toBe(false);
      expect(invalidDate.code).toBe("INVALID_DATE");
      expect(invalidTime.success).toBe(false);
      expect(invalidTime.code).toBe("INVALID_TIME");
      expect(storageInstance.getMeasurements()).toEqual([]);
    });

    it("rejeita payload ausente sem lançar exceção", () => {
      storageInstance.init();
      const result = storageInstance.addMeasurement(null);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_MEASUREMENT");
      expect(storageInstance.getMeasurements()).toEqual([]);
    });

    it("backup e restore preservam hidden IDs e tombstones pendentes", () => {
      storageInstance.init();
      storageInstance.addHiddenMeasurementId("hc_external_hidden");
      storageInstance.addTombstone({
        id: "m_pending_delete",
        clientRecordId: "m_pending_delete",
        ownership: "pep",
        dataOrigin: "com.protocolopep.app"
      });

      const backup = storageInstance.exportBackup();
      const restored = new StorageService();
      restored.init();
      restored.clearHiddenMeasurementIds();
      restored.clearTombstones(["m_pending_delete"]);
      const result = restored.importBackup(backup);

      expect(result.success).toBe(true);
      expect(restored.getHiddenMeasurementIds()).toContain("hc_external_hidden");
      expect(restored.getTombstones()).toHaveLength(1);
      expect(restored.getTombstones()[0].ownership).toBe("pep");
    });

    it("Item 7: deleteMeasurement registra tombstone para registro PEP reimportado (source: health_connect, ownership: pep)", () => {
      storageInstance.init();
      storageInstance.addMeasurement({
        id: "m_reimported_pep",
        clientRecordId: "m_reimported_pep",
        healthConnectRecordId: "hc_rec_999",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 83.0,
        source: "health_connect",
        ownership: "pep",
        dataOrigin: "com.protocolopep.app"
      });

      const delRes = storageInstance.deleteMeasurement("m_reimported_pep");
      expect(delRes.success).toBe(true);

      const tombstones = storageInstance.getTombstones();
      expect(tombstones).toHaveLength(1);
      expect(tombstones[0].id).toBe("m_reimported_pep");
      expect(tombstones[0].clientRecordId).toBe("m_reimported_pep");
    });

    it("Item 14: deleteMeasurement em registro externo adiciona aos hiddenMeasurementIds", () => {
      storageInstance.init();
      storageInstance.addMeasurement({
        id: "hc_ext_fitbit_456",
        healthConnectRecordId: "hc_raw_fitbit_456",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 80.0,
        source: "health_connect",
        ownership: "external",
        dataOrigin: "com.fitbit.FitbitMobile"
      });

      const delRes = storageInstance.deleteMeasurement("hc_ext_fitbit_456");
      expect(delRes.success).toBe(true);

      // Não gera tombstone remoto
      expect(storageInstance.getTombstones()).toHaveLength(0);

      // Mas registra nos IDs ocultos locais
      const hidden = storageInstance.getHiddenMeasurementIds();
      expect(hidden).toContain("hc_ext_fitbit_456");
      expect(hidden).toContain("hc_raw_fitbit_456");
    });
  });
});
