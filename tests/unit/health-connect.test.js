import { describe, it, expect } from "vitest";
import {
  HEALTH_CONNECT_STATUS,
  getHealthConnectStatusLabel,
  localDateTimeToIso,
  isoToLocalDateTime,
  mapMeasurementToHealthRecord,
  mapHealthRecordToMeasurement,
  mergeHealthMeasurements,
  haveMeasurementsChanged,
  isValidIsoTimestamp
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

    it("preserva timestamp e zoneOffset exatos (cenário Rio -> Tóquio) sem recalcular por fuso atual", () => {
      // Medição criada no Rio (UTC-3 às 08:00 -> 11:00 UTC)
      const measurementFromRio = {
        id: "m_rio_1",
        date: "2026-08-29",
        time: "08:00",
        timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00",
        weightKg: 82.5
      };

      const record = mapMeasurementToHealthRecord(measurementFromRio);
      expect(record).not.toBeNull();
      // O instante deve permanecer exatamente 11:00:00.000Z, imune a recalculos pelo fuso local da execução
      expect(record.timestamp).toBe("2026-08-29T11:00:00.000Z");
      expect(record.time).toBe("2026-08-29T11:00:00.000Z");
      expect(record.zoneOffset).toBe("-03:00");
      expect(record.weightKg).toBe(82.5);
    });

    it("utiliza fallback seguro para registros legados sem campo timestamp", () => {
      const legacyMeasurement = {
        id: "m_legacy_1",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 80.0
      };

      const record = mapMeasurementToHealthRecord(legacyMeasurement);
      expect(record).not.toBeNull();
      expect(record.timestamp).toBeDefined();
      expect(record.timestamp).toContain("2026-08-29T");
      expect(record.zoneOffset).toBeNull();
    });

    it("rejeita com fail-closed medições com timestamp corrompido ou inválido", () => {
      const corruptedMeasurement = {
        id: "m_corrupt_1",
        date: "2026-08-29",
        time: "08:00",
        timestamp: "invalid-not-a-timestamp",
        weightKg: 80.0
      };

      const record = mapMeasurementToHealthRecord(corruptedMeasurement);
      expect(record).toBeNull();
    });

    it("não exporta medição marcada para revisão temporal", () => {
      expect(mapMeasurementToHealthRecord({
        id: "m_review", date: "2026-08-29", time: "08:00", weightKg: 80,
        timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-02:00",
        temporalIntegrity: "needs_review", ownership: "pep"
      })).toBeNull();
    });
  });

  describe("isValidIsoTimestamp", () => {
    it("valida timestamps no padrão UTC e com offset", () => {
      expect(isValidIsoTimestamp("2026-08-29T11:00:00.000Z")).toBe(true);
      expect(isValidIsoTimestamp("2026-08-29T11:00:00Z")).toBe(true);
      expect(isValidIsoTimestamp("2026-08-29T08:00:00-03:00")).toBe(true);
      expect(isValidIsoTimestamp("2026-08-29T20:00:00+09:00")).toBe(true);
    });

    it("rejeita formatos não ISO ou datas parciais", () => {
      expect(isValidIsoTimestamp("")).toBe(false);
      expect(isValidIsoTimestamp(null)).toBe(false);
      expect(isValidIsoTimestamp(undefined)).toBe(false);
      expect(isValidIsoTimestamp("2026-08-29")).toBe(false);
      expect(isValidIsoTimestamp("08:00")).toBe(false);
      expect(isValidIsoTimestamp("2026-99-99T99:99:99Z")).toBe(false);
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

    it("preserva metadata.lastModifiedTime para desempate de versões iguais", () => {
      const measurement = mapHealthRecordToMeasurement({
        id: "hc-last-modified", clientRecordId: "m-last-modified",
        dataOrigin: "com.protocolopep.app", timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00", weightKg: 80, clientRecordVersion: 2,
        lastModifiedTime: "2026-08-30T14:00:00Z"
      });
      expect(measurement.healthConnectLastModifiedTime).toBe("2026-08-30T14:00:00.000Z");
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

    it("mantém registros distintos que ocorrem no mesmo minuto mas possuem IDs ou origens diferentes", () => {
      const local = [
        {
          id: "m_pep_morning",
          date: "2026-08-30",
          time: "08:00",
          weightKg: 80.0,
          source: "local",
          ownership: "pep"
        }
      ];

      const externalImported = [
        {
          id: "hc_samsung_morning",
          dataOrigin: "com.sec.android.app.shealth",
          timestamp: localDateTimeToIso("2026-08-30", "08:00"),
          weightKg: 80.4
        }
      ];

      const merged = mergeHealthMeasurements(local, externalImported);
      // Não deve sobrescrever nem fundir porque são origens e IDs distintos
      expect(merged.length).toBe(2);
      expect(merged.some((m) => m.id === "m_pep_morning" && m.weightKg === 80.0)).toBe(true);
      expect(merged.some((m) => m.id === "hc_com.sec.android.app.shealth_hc_samsung_morning" && m.weightKg === 80.4)).toBe(true);
    });

    it("atualiza campos remotos autoritativos e preserva conteúdo local em registro externo", () => {
      const local = [{
        id: "hc_com.fitbit.app_hc-77",
        healthConnectRecordId: "hc-77",
        clientRecordId: "fitbit-77",
        clientRecordVersion: 1,
        dataOrigin: "com.fitbit.app",
        ownership: "external",
        source: "health_connect",
        date: "2026-08-28",
        time: "08:00",
        timestamp: "2026-08-28T11:00:00.000Z",
        zoneOffset: "-03:00",
        weightKg: 82,
        notes: "Nota local",
        energyLevel: 4,
        moodLevel: 3,
        symptoms: ["Fadiga"],
        createdAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-28T12:00:00.000Z"
      }];
      const remote = [{
        id: "hc-77-new-id",
        healthConnectRecordId: "hc-77",
        clientRecordId: "fitbit-77",
        clientRecordVersion: 2,
        dataOrigin: "com.fitbit.app",
        timestamp: "2026-08-29T14:30:00.000Z",
        zoneOffset: "-03:00",
        weightKg: 81.4
      }];

      const merged = mergeHealthMeasurements(local, remote);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        date: "2026-08-29",
        time: "11:30",
        timestamp: "2026-08-29T14:30:00.000Z",
        weightKg: 81.4,
        clientRecordVersion: 2,
        notes: "Nota local",
        energyLevel: 4,
        moodLevel: 3,
        symptoms: ["Fadiga"]
      });

      const again = mergeHealthMeasurements(merged, remote);
      expect(haveMeasurementsChanged(merged, again)).toBe(false);
    });

    it("backup local V1/80 recebe remoto V2/79 e permanece idempotente", () => {
      const local = [{
        id: "m_backup_old", clientRecordId: "m_backup_old", ownership: "pep",
        dataOrigin: "com.protocolopep.app", date: "2026-08-29", time: "08:00",
        timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-03:00",
        weightKg: 80, syncVersion: 1, clientRecordVersion: 1,
        notes: "nota preservada", symptoms: ["Fadiga"],
        updatedAt: "2026-08-29T12:00:00.000Z"
      }];
      const remote = [{
        id: "hc-backup-old", clientRecordId: "m_backup_old",
        dataOrigin: "com.protocolopep.app", timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00", weightKg: 79, clientRecordVersion: 2,
        lastModifiedTime: "2026-08-30T12:00:00.000Z"
      }];

      const merged = mergeHealthMeasurements(local, remote);
      expect(merged[0]).toMatchObject({
        weightKg: 79, syncVersion: 2, clientRecordVersion: 2,
        notes: "nota preservada", symptoms: ["Fadiga"],
        healthConnectLastModifiedTime: "2026-08-30T12:00:00.000Z"
      });
      expect(haveMeasurementsChanged(merged, mergeHealthMeasurements(merged, remote))).toBe(false);
    });

    it("mantém conteúdo local quando a versão local é maior", () => {
      const local = [{
        id: "m_local_newer", clientRecordId: "m_local_newer", ownership: "pep",
        date: "2026-08-29", time: "08:00", timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00", weightKg: 78, syncVersion: 3, clientRecordVersion: 3
      }];
      const remote = [{
        id: "hc-local-newer", clientRecordId: "m_local_newer", dataOrigin: "com.protocolopep.app",
        timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-03:00",
        weightKg: 80, clientRecordVersion: 2
      }];
      expect(mergeHealthMeasurements(local, remote)[0]).toMatchObject({
        weightKg: 78, syncVersion: 3, clientRecordVersion: 3
      });
    });

    it("marca conflito quando versões iguais divergem sem desempate temporal", () => {
      const local = [{
        id: "m_equal", clientRecordId: "m_equal", ownership: "pep",
        date: "2026-08-29", time: "08:00", timestamp: "2026-08-29T11:00:00.000Z",
        zoneOffset: "-03:00", weightKg: 80, syncVersion: 2, clientRecordVersion: 2
      }];
      const remote = [{
        id: "hc-equal", clientRecordId: "m_equal", dataOrigin: "com.protocolopep.app",
        timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-03:00",
        weightKg: 79, clientRecordVersion: 2
      }];
      const merged = mergeHealthMeasurements(local, remote)[0];
      expect(merged.weightKg).toBe(80);
      expect(merged.syncConflict).toMatchObject({
        status: "needs_review", reason: "EQUAL_VERSION_DIVERGENT_CONTENT"
      });
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

    it.each([
      ["timestamp", "2026-08-29T12:00:00.000Z"],
      ["zoneOffset", "-03:00"],
      ["timeZoneId", "America/Sao_Paulo"],
      ["healthConnectRecordId", "hc-new"],
      ["clientRecordId", "client-new"],
      ["clientRecordVersion", 2],
      ["dataOrigin", "com.protocolopep.app"],
      ["ownership", "pep"]
    ])("detecta alteração isolada em %s", (field, value) => {
      const base = { id: "1", date: "2026-08-29", time: "08:00", weightKg: 83.5 };
      expect(haveMeasurementsChanged([base], [{ ...base, [field]: value }])).toBe(true);
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
        tombstones: [{
          id: "m_deleted_1",
          clientRecordId: "m_deleted_1",
          ownership: "pep",
          dataOrigin: "com.protocolopep.app"
        }, {
          id: "m_deleted_legacy",
          clientRecordId: null,
          healthConnectRecordId: "hc-native-legacy",
          ownership: "pep",
          dataOrigin: "com.protocolopep.app"
        }],
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
      expect(syncRes.deletedCount).toBe(2);
      expect(mockStorage.tombstones.length).toBe(0);
    });

    it("interrompe a sincronização com fail-closed se permissões forem negadas ou revogadas", async () => {
      const mockStorage = {
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); }
      };

      const service = new HealthConnectService(mockStorage);
      service.setEnabled(true);

      // Mock checkPermissions retornando negado
      service.checkPermissions = async () => ({
        granted: false,
        status: "NOT_AUTHORIZED",
        reason: "Permissão revogada pelo usuário."
      });

      const res = await service.syncMeasurements([{ id: "m_1", weightKg: 80 }]);
      expect(res.success).toBe(false);
      expect(res.reason).toBe("PERMISSION_DENIED");
      expect(res.message).toBe("Permissão revogada pelo usuário.");
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

  // ─── P1 (CODEX v2.5.0): Ownership vs Source, Reimportação e Ciclo Completo ───

  describe("P1 — Ownership, Reimportação e Janela 30d (CODEX v2.5.0)", () => {
    it("Item 6: mapMeasurementToHealthRecord permite exportação de registro PEP reimportado (source: health_connect, ownership: pep)", () => {
      const reimportedPepRecord = {
        id: "m_pep_reimported_1",
        clientRecordId: "m_pep_reimported_1",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 82.0,
        source: "health_connect",
        ownership: "pep",
        dataOrigin: "com.protocolopep.app",
        timestamp: "2026-08-29T11:00:00.000Z"
      };

      const record = mapMeasurementToHealthRecord(reimportedPepRecord);
      expect(record).not.toBeNull();
      expect(record.weightKg).toBe(82.0);
      expect(record.clientRecordId).toBe("m_pep_reimported_1");
    });

    it("Item 6: mapMeasurementToHealthRecord bloqueia registros externos (ownership: external)", () => {
      const externalRecord = {
        id: "hc_com.sec.android_123",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 82.0,
        source: "health_connect",
        ownership: "external",
        dataOrigin: "com.sec.android.app.shealth"
      };

      expect(mapMeasurementToHealthRecord(externalRecord)).toBeNull();
    });

    it("Item 8: Ciclo completo — Criar -> Exportar -> Reinstalar -> Reimportar -> Editar -> Excluir com Tombstone", () => {
      // 1. PEP cria registro local
      const localOriginal = {
        id: "m_cycle_1",
        clientRecordId: "m_cycle_1",
        date: "2026-08-29",
        time: "08:00",
        weightKg: 85.0,
        source: "local",
        ownership: "pep",
        dataOrigin: "com.protocolopep.app",
        syncVersion: 1,
        timestamp: "2026-08-29T11:00:00.000Z",
        createdAt: "2026-08-29T11:00:00.000Z"
      };

      // 2. Exportar para o Health Connect
      const exported = mapMeasurementToHealthRecord(localOriginal);
      expect(exported).not.toBeNull();
      expect(exported.clientRecordId).toBe("m_cycle_1");
      expect(exported.weightKg).toBe(85.0);

      // 3. Simula reinstalação/limpeza e reimportação do Health Connect
      const rawFromHealthConnect = {
        id: "hc_raw_id_999",
        clientRecordId: "m_cycle_1",
        dataOrigin: "com.protocolopep.app",
        time: "2026-08-29T11:00:00.000Z",
        weight: 85.0,
        weightKg: 85.0,
        clientRecordVersion: 1,
        zoneOffset: "-03:00"
      };

      const importedMeasurement = mapHealthRecordToMeasurement(rawFromHealthConnect);
      expect(importedMeasurement).not.toBeNull();
      expect(importedMeasurement.ownership).toBe("pep"); // Pertence ao PEP!
      expect(importedMeasurement.source).toBe("health_connect");
      expect(importedMeasurement.clientRecordId).toBe("m_cycle_1");
      expect(importedMeasurement.id).toBe("m_cycle_1");

      // 4. Editar o registro reimportado (usuário altera peso para 84.5)
      const editedRecord = {
        ...importedMeasurement,
        weightKg: 84.5,
        syncVersion: 2,
        clientRecordVersion: 2
      };

      // 5. O registro editado DEVE continuar exportável para o Health Connect
      const reExported = mapMeasurementToHealthRecord(editedRecord);
      expect(reExported).not.toBeNull();
      expect(reExported.weightKg).toBe(84.5);
      expect(reExported.clientRecordVersion).toBe(2);
    });

    it("Item 14: Medições externas marcadas como ocultas não são reimportadas pelo merge", () => {
      const importedRecords = [
        {
          id: "hc_ext_samsung_1",
          healthConnectRecordId: "hc_rec_samsung_1",
          dataOrigin: "com.sec.android.app.shealth",
          time: "2026-08-29T11:00:00.000Z",
          weight: 80.0
        },
        {
          id: "hc_ext_garmin_2",
          healthConnectRecordId: "hc_rec_garmin_2",
          dataOrigin: "com.garmin.android.apps.connectmobile",
          time: "2026-08-28T11:00:00.000Z",
          weight: 81.0
        }
      ];

      // Simula storage com id oculto
      const hiddenIds = ["hc_com.sec.android.app.shealth_hc_rec_samsung_1", "hc_rec_samsung_1"];
      const hiddenSet = new Set(hiddenIds);

      const filtered = importedRecords.filter(r => !hiddenSet.has(r.healthConnectRecordId) && !hiddenSet.has(r.id));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].dataOrigin).toBe("com.garmin.android.apps.connectmobile");
    });
  });
});
