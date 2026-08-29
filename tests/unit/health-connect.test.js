import { describe, it, expect } from "vitest";
import {
  HEALTH_CONNECT_STATUS,
  getHealthConnectStatusLabel,
  mapMeasurementToHealthRecord,
  mapHealthRecordToMeasurement,
  mergeHealthMeasurements
} from "../../src/domain/health-connect.js";
import { HealthConnectService } from "../../src/services/health-connect.js";

describe("Health Connect Domain", () => {
  describe("getHealthConnectStatusLabel", () => {
    it("retorna rótulos em português para todos os estados", () => {
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.CONNECTED)).toBe("Conectado");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.AVAILABLE)).toBe("Disponível");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED)).toBe("Permissão Necessária");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.NOT_INSTALLED)).toBe("App Não Instalado");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.NOT_SUPPORTED)).toBe("Não Suportado no Dispositivo");
      expect(getHealthConnectStatusLabel(HEALTH_CONNECT_STATUS.DISABLED)).toBe("Desativado");
      expect(getHealthConnectStatusLabel("UNKNOWN")).toBe("Desativado");
    });
  });

  describe("mapMeasurementToHealthRecord", () => {
    it("converte medição válida com peso para registro Health Connect", () => {
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
      expect(record.time).toBe("2026-08-29T08:30:00.000Z");
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
    it("converte registro do Health Connect para medição interna do PEP", () => {
      const hcRecord = {
        id: "hc_record_1",
        time: "2026-08-29T08:30:00.000Z",
        weightKg: 83.2
      };

      const measurement = mapHealthRecordToMeasurement(hcRecord);
      expect(measurement).not.toBeNull();
      expect(measurement.date).toBe("2026-08-29");
      expect(measurement.weightKg).toBe(83.2);
      expect(measurement.source).toBe("health_connect");
      expect(measurement.notes).toContain("Health Connect");
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
          id: "m_local_1",
          time: "2026-08-28T08:00:00.000Z",
          weightKg: 84.2
        },
        {
          id: "hc_new_2",
          time: "2026-08-29T08:00:00.000Z",
          weightKg: 83.8
        }
      ];

      const merged = mergeHealthMeasurements(local, imported);
      expect(merged.length).toBe(2);
      // Ordenação decrescente: o dia 29 vem primeiro
      expect(merged[0].date).toBe("2026-08-29");
      expect(merged[0].weightKg).toBe(83.8);

      expect(merged[1].date).toBe("2026-08-28");
      expect(merged[1].symptoms).toEqual(["Fadiga"]);
      expect(merged[1].notes).toBe("Nota pessoal");
    });

    it("adiciona novos registros se não houver conflito de data/horário", () => {
      const local = [];
      const imported = [
        {
          id: "hc_1",
          time: "2026-08-27T08:00:00.000Z",
          weightKg: 82.5
        }
      ];

      const merged = mergeHealthMeasurements(local, imported);
      expect(merged.length).toBe(1);
      expect(merged[0].weightKg).toBe(82.5);
      expect(merged[0].date).toBe("2026-08-27");
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

      // Desativado -> retorna success false
      const syncDisabled = await service.syncMeasurements([{ weightKg: 80 }]);
      expect(syncDisabled.success).toBe(false);

      // Ativado -> executa sync
      service.setEnabled(true);
      const syncEnabled = await service.syncMeasurements([{ id: "m_1", date: "2026-08-29", time: "08:00", weightKg: 80 }]);
      expect(syncEnabled.success).toBe(true);
      expect(syncEnabled.exportedCount).toBe(1);
    });
  });
});

