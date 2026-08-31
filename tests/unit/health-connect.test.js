import { describe, it, expect } from "vitest";
import {
  HEALTH_CONNECT_STATUS,
  getHealthConnectStatusLabel,
  localDateTimeToIso,
  isoToLocalDateTime,
  mapMeasurementToHealthRecord,
  mapHealthRecordToMeasurement,
  mergeHealthMeasurements,
  haveMeasurementsChanged
} from "../../src/domain/health-connect.js";
import { HealthConnectService } from "../../src/services/health-connect.js";

describe("Health Connect Domain", () => {
  describe("getHealthConnectStatusLabel", () => {
    it("retorna rótulos em português para todos os estados", () => {
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.CONNECTED)).toBe("Conectado");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.AVAILABLE)).toBe("Disponível");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.NOT_AUTHORIZED)).toBe("Permissão Necessária");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED)).toBe("Permissão Necessária");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.PARTIALLY_AUTHORIZED)).toBe("Permissão Parcial");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.UPDATE_REQUIRED)).toBe("Atualização Necessária");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.UNAVAILABLE)).toBe("App Não Instalado");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.NOT_INSTALLED)).toBe("App Não Instalado");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.NOT_SUPPORTED)).toBe("Não Suportado no Dispositivo");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.ERROR)).toBe("Erro de Conexão");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.DISABLED)).toBe("Desativado");
      expect(getHealthConnectStatusLabel("UNKNOWN")).toBe("Desativado");
    });
  });

  describe("localDateTimeToIso e isoToLocalDateTime", () => {
    it("converte data e hora local para ISO e reverte mantendo integridade", () => {
      const date = "2026-08-29";
      const time = "08:30";
      const iso = localDateTimeToIso(date, time);
      expect(typeof iso).toBe("string");
      expect(iso).toContain("T");

      const reversed = isoToLocalDateTime(iso);
      expect(reversed).not.toBeNull();
      expect(reversed.date).toBe(date);
      expect(reversed.time).toBe(time);
    });

    it("preserva data e hora em registros próximos à meia-noite", () => {
      const nearMidnightStart = "2026-08-29";
      const timeStart = "00:05";
      const isoStart = localDateTimeToIso(nearMidnightStart, timeStart);
      const resStart = isoToLocalDateTime(isoStart);
      expect(resStart.date).toBe(nearMidnightStart);
      expect(resStart.time).toBe(timeStart);

      const nearMidnightEnd = "2026-08-29";
      const timeEnd = "23:55";
      const isoEnd = localDateTimeToIso(nearMidnightEnd, timeEnd);
      const resEnd = isoToLocalDateTime(isoEnd);
      expect(resEnd.date).toBe(nearMidnightEnd);
      expect(resEnd.time).toBe(timeEnd);
    });

    it("retorna null para strings ISO inválidas", () => {
      expect(isoToLocalDateTime("")).toBeNull();
      expect(isoToLocalDateTime(null)).toBeNull();
      expect(isoToLocalDateTime("invalid-date")).toBeNull();
    });
  });

  describe("mapMeasurementToHealthRecord", () => {
    it("converte medição válida com peso para registro Health Connect com clientRecordId", () => {
      const measurement = {
        id: "m_123",
        date: "2026-08-29",
        time: "08:30",
        weightKg: 84.5,
        symptoms: ["Disposição elevada"]
      };

      const record = mapMeasurementToHealthRecord(measurement);
      expect(record).not.toBeNull();
      expect(record.weightKg).toBe(84.5);
      expect(record.timestamp).toBeDefined();
      expect(record.clientRecordId).toBe("m_123");
      expect(record.metadataId).toBe("m_123");
    });

    it("converte strings de peso com vírgula para número", () => {
      const measurement = {
        id: "m_456",
        date: "2026-08-29",
        time: "09:00",
        weightKg: "75,25"
      };

      const record = mapMeasurementToHealthRecord(measurement);
      expect(record).not.toBeNull();
      expect(record.weightKg).toBe(75.25);
    });

    it("retorna null se a medição não tiver peso ou tiver valores inválidos/zero/negativos", () => {
      expect(mapMeasurementToHealthRecord(null)).toBeNull();
      expect(mapMeasurementToHealthRecord({})).toBeNull();
      expect(mapMeasurementToHealthRecord({ weightKg: null })).toBeNull();
      expect(mapMeasurementToHealthRecord({ weightKg: "" })).toBeNull();
      expect(mapMeasurementToHealthRecord({ weightKg: 0 })).toBeNull();
      expect(mapMeasurementToHealthRecord({ weightKg: -10 })).toBeNull();
      expect(mapMeasurementToHealthRecord({ weightKg: NaN })).toBeNull();
    });
  });

  describe("mapHealthRecordToMeasurement", () => {
    it("converte registro do PEP Health Connect para medição interna com ownership 'pep'", () => {
      const hcRecord = {
        id: "hc_raw_id_999",
        clientRecordId: "m_local_123",
        dataOrigin: "com.protocolopep.app",
        timestamp: localDateTimeToIso("2026-08-29", "08:30"),
        weightKg: 83.2
      };

      const measurement = mapHealthRecordToMeasurement(hcRecord);
      expect(measurement).not.toBeNull();
      expect(measurement.id).toBe("m_local_123");
      expect(measurement.ownership).toBe("pep");
      expect(measurement.dataOrigin).toBe("com.protocolopep.app");
      expect(measurement.date).toBe("2026-08-29");
      expect(measurement.time).toBe("08:30");
      expect(measurement.weightKg).toBe(83.2);
      expect(measurement.source).toBe("health_connect");
    });

    it("atribui ownership 'external' para apps de terceiros mesmo que possuam clientRecordId", () => {
      const externalWithClientRecordId = {
        id: "hc_samsung_raw_777",
        clientRecordId: "custom_samsung_id_abc",
        dataOrigin: "com.sec.android.app.shealth",
        timestamp: localDateTimeToIso("2026-08-29", "08:30"),
        weightKg: 80.5
      };

      const measurement = mapHealthRecordToMeasurement(externalWithClientRecordId);
      expect(measurement).not.toBeNull();
      expect(measurement.ownership).toBe("external");
      expect(measurement.dataOrigin).toBe("com.sec.android.app.shealth");
      // ID deve ser composto com a origem externa, sem assumir ID de cliente local
      expect(measurement.id).toBe("hc_com.sec.android.app.shealth_hc_samsung_raw_777");
    });

    it("converte registro com date e localTime diretamente", () => {
      const hcRecord = {
        id: "hc_item_1",
        date: "2026-08-29",
        time: "14:15",
        weightKg: 81.0
      };

      const measurement = mapHealthRecordToMeasurement(hcRecord);
      expect(measurement).not.toBeNull();
      expect(measurement.date).toBe("2026-08-29");
      expect(measurement.time).toBe("14:15");
      expect(measurement.weightKg).toBe(81.0);
    });

    it("retorna null para registros inválidos ou sem peso", () => {
      expect(mapHealthRecordToMeasurement(null)).toBeNull();
      expect(mapHealthRecordToMeasurement({})).toBeNull();
      expect(mapHealthRecordToMeasurement({ weightKg: 0 })).toBeNull();
      expect(mapHealthRecordToMeasurement({ weightKg: -5 })).toBeNull();
    });
  });

  describe("mergeHealthMeasurements", () => {
    it("mescla medições locais e registros importados sem duplicar", () => {
      const local = [
        {
          id: "m_local_1",
          date: "2026-08-28",
          time: "08:00",
          weightKg: 84.0,
          symptoms: ["Fadiga"],
          notes: "Nota pessoal",
          source: "manual"
        }
      ];

      const imported = [
        {
          id: "hc_1",
          clientRecordId: "m_local_1",
          timestamp: localDateTimeToIso("2026-08-28", "08:00"),
          weightKg: 84.2
        },
        {
          id: "hc_new_2",
          timestamp: localDateTimeToIso("2026-08-29", "08:00"),
          weightKg: 83.8
        }
      ];

      const merged = mergeHealthMeasurements(local, imported);
      expect(merged.length).toBe(2);
      expect(merged[0].date).toBe("2026-08-29");
      expect(merged[0].weightKg).toBe(83.8);

      expect(merged[1].date).toBe("2026-08-28");
      expect(merged[1].symptoms).toEqual(["Fadiga"]);
      expect(merged[1].notes).toBe("Nota pessoal");
    });

    it("é idempotente em 1x, 2x e 10x sincronizações sucessivas", () => {
      let state = [
        { id: "m_initial", date: "2026-08-25", time: "07:30", weightKg: 85.0 }
      ];

      const importedBatch = [
        { id: "hc_1", clientRecordId: "m_initial", timestamp: localDateTimeToIso("2026-08-25", "07:30"), weightKg: 85.0 },
        { id: "hc_2", timestamp: localDateTimeToIso("2026-08-26", "08:00"), weightKg: 84.5 },
        { id: "hc_3", timestamp: localDateTimeToIso("2026-08-27", "08:15"), weightKg: 84.2 }
      ];

      // 1x sync
      state = mergeHealthMeasurements(state, importedBatch);
      expect(state.length).toBe(3);

      // 2x sync
      state = mergeHealthMeasurements(state, importedBatch);
      expect(state.length).toBe(3);

      // 10x sync
      for (let i = 0; i < 8; i++) {
        state = mergeHealthMeasurements(state, importedBatch);
      }
      expect(state.length).toBe(3);
    });
  });

  describe("haveMeasurementsChanged", () => {
    it("retorna false para listas idênticas", () => {
      const listA = [
        { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5, symptoms: ["Fadiga"], notes: "ok" }
      ];
      const listB = [
        { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5, symptoms: ["Fadiga"], notes: "ok" }
      ];
      expect(haveMeasurementsChanged(listA, listB)).toBe(false);
    });

    it("detecta alteração de peso mantendo a mesma quantidade de registros (caso 1 -> 1)", () => {
      const before = [
        { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5, symptoms: [], notes: "" }
      ];
      const after = [
        { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.2, symptoms: [], notes: "" }
      ];
      expect(haveMeasurementsChanged(before, after)).toBe(true);
    });

    it("detecta alteração de data ou horário", () => {
      const listA = [{ id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5 }];
      const listB = [{ id: "1", date: "2026-08-29", time: "08:30", weightKg: 83.5 }];
      expect(haveMeasurementsChanged(listA, listB)).toBe(true);
    });

    it("detecta alteração no tamanho das listas", () => {
      const listA = [{ id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5 }];
      const listB = [
        { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5 },
        { id: "2", date: "2026-08-30", time: "08:00", weightKg: 83.0 }
      ];
      expect(haveMeasurementsChanged(listA, listB)).toBe(true);
    });
  });

  describe("HealthConnectService (Fallback & Storage)", () => {
    it("gerencia preferência enabled no storage", () => {
      const mockStorage = {
        store: {},
        getItem(k) {
          return this.store[k] || null;
        },
        setItem(k, v) {
          this.store[k] = String(v);
        }
      };

      const service = new HealthConnectService(mockStorage);

      expect(service.isEnabled()).toBe(false);
      service.setEnabled(true);
      expect(service.isEnabled()).toBe(true);
      service.setEnabled(false);
      expect(service.isEnabled()).toBe(false);
    });

    it("retorna status e executa operações com fallback", async () => {
      const mockStorage = {
        store: {},
        getItem(k) {
          return this.store[k] || null;
        },
        setItem(k, v) {
          this.store[k] = String(v);
        }
      };

      const service = new HealthConnectService(mockStorage);

      const availability = await service.checkAvailability();
      expect(availability.available).toBe(true);

      const perm = await service.requestPermissions();
      expect(perm.granted).toBe(true);

      const checkPerm = await service.checkPermissions();
      expect(checkPerm.granted).toBe(true);
      expect(checkPerm.status).toBe(HEALTH_CONNECT_STATUS.CONNECTED);

      // Desativado -> retorna success false
      const syncDisabled = await service.syncMeasurements([{ weightKg: 80 }]);
      expect(syncDisabled.success).toBe(false);

      // Ativado -> executa sync
      service.setEnabled(true);
      const syncEnabled = await service.syncMeasurements([{ id: "m_1", date: "2026-08-29", time: "08:00", weightKg: 80, source: "local", ownership: "pep" }]);
      expect(syncEnabled.success).toBe(true);
      expect(syncEnabled.exportedCount).toBe(1);
    });

    it("prevenção de Sync Echo: não reexporta medições de origem externa do Health Connect", async () => {
      const mockStorage = {
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); }
      };

      const service = new HealthConnectService(mockStorage);
      service.setEnabled(true);

      const localListWithExternal = [
        { id: "m_pep_1", date: "2026-08-29", time: "08:00", weightKg: 82.5, source: "local", ownership: "pep" },
        { id: "hc_ext_999", date: "2026-08-28", time: "08:00", weightKg: 83.0, source: "health_connect", ownership: "external" }
      ];

      const syncRes = await service.syncMeasurements(localListWithExternal);
      expect(syncRes.success).toBe(true);
      // Apenas o registro do PEP deve ser exportado; o externo é ignorado
      expect(syncRes.exportedCount).toBe(1);
    });

    it("processa tombstones de exclusão durante a sincronização", async () => {
      const mockStorage = {
        tombstones: [{ id: "m_deleted_1", clientRecordId: "m_deleted_1" }],
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); },
        getTombstones() { return [...this.tombstones]; },
        clearTombstones(ids) {
          this.tombstones = this.tombstones.filter((t) => !ids.includes(t.id));
        }
      };

      const service = new HealthConnectService(mockStorage);
      service.setEnabled(true);

      const syncRes = await service.syncMeasurements([]);
      expect(syncRes.success).toBe(true);
      expect(syncRes.deletedCount).toBe(1);
      expect(mockStorage.tombstones.length).toBe(0);
    });
  });

  describe("Validação Estrita de Timestamps e Datas (Fail-Closed)", () => {
    it("rejeita datas inexistentes como 2026-99-99 ou 2026-02-29 em ano não bissexto", () => {
      expect(localDateTimeToIso("2026-99-99", "08:00")).toBeNull();
      expect(localDateTimeToIso("2026-02-29", "08:00")).toBeNull();
      expect(localDateTimeToIso("2026-04-31", "08:00")).toBeNull();
      expect(localDateTimeToIso("2024-02-29", "08:00")).not.toBeNull(); // 2024 é bissexto
    });

    it("rejeita horários inválidos como 24:00 ou 99:99", () => {
      expect(localDateTimeToIso("2026-08-29", "24:00")).toBeNull();
      expect(localDateTimeToIso("2026-08-29", "99:99")).toBeNull();
      expect(localDateTimeToIso("2026-08-29", "12:60")).toBeNull();
    });

    it("mapMeasurementToHealthRecord rejeita datas ou horários inválidos", () => {
      const invalidDateMeas = { id: "m_inv_1", date: "2026-99-99", time: "08:00", weightKg: 80 };
      expect(mapMeasurementToHealthRecord(invalidDateMeas)).toBeNull();

      const invalidTimeMeas = { id: "m_inv_2", date: "2026-08-29", time: "24:00", weightKg: 80 };
      expect(mapMeasurementToHealthRecord(invalidTimeMeas)).toBeNull();
    });
  });

  describe("Identidade Completa e Preservação de ZoneOffset", () => {
    it("preserva zoneOffset histórico em registros lidos", () => {
      const hcRecord = {
        id: "hc_record_rio",
        timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00",
        weightKg: 81.5,
        dataOrigin: "com.other.app"
      };

      const meas = mapHealthRecordToMeasurement(hcRecord);
      expect(meas).not.toBeNull();
      expect(meas.time).toBe("08:00"); // 11:00 UTC - 3h = 08:00
      expect(meas.zoneOffset).toBe("-03:00");
      expect(meas.dataOrigin).toBe("com.other.app");
      expect(meas.ownership).toBe("external");
      expect(meas.id).toBe("hc_com.other.app_hc_record_rio");
    });

    it("evita colisão de IDs idênticos vindos de dataOrigins diferentes", () => {
      const recA = { id: "rec_1", timestamp: "2026-08-29T12:00:00.000Z", weightKg: 80, dataOrigin: "com.app.a" };
      const recB = { id: "rec_1", timestamp: "2026-08-29T12:00:00.000Z", weightKg: 82, dataOrigin: "com.app.b" };

      const measA = mapHealthRecordToMeasurement(recA);
      const measB = mapHealthRecordToMeasurement(recB);

      expect(measA.id).not.toBe(measB.id);
      expect(measA.id).toBe("hc_com.app.a_rec_1");
      expect(measB.id).toBe("hc_com.app.b_rec_1");
    });

    it("inclui clientRecordVersion ao mapear medição do PEP para Health Connect", () => {
      const meas = {
        id: "m_versioned_1",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 83.5,
        syncVersion: 3,
        source: "local",
        ownership: "pep"
      };

      const record = mapMeasurementToHealthRecord(meas);
      expect(record).not.toBeNull();
      expect(record.clientRecordVersion).toBe(3);
    });
  });
});

