import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  HEALTH_CONNECT_STATUS,
  mapMeasurementToHealthRecord,
  mapHealthRecordToMeasurement,
  mergeHealthMeasurements
} from "../domain/health-connect.js";

const PepHealthConnect = registerPlugin("PepHealthConnect", {
  web: () => ({
    checkAvailability: async () => ({ available: true, status: "AVAILABLE", message: "Health Connect ativo." }),
    requestPermissions: async () => ({ granted: true, status: "CONNECTED" }),
    readRecords: async () => ({ records: [] }),
    writeRecords: async () => ({ success: true }),
    openSettings: async () => {}
  })
});
const HC_ENABLED_KEY = "pep_health_connect_enabled";

export class HealthConnectService {
  constructor(storage = typeof window !== "undefined" && window.localStorage ? window.localStorage : null) {
    this.storage = storage;
  }

  isNativeAndroid() {
    try {
      if (typeof Capacitor === "undefined") return false;
      if (typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) return true;
      if (typeof Capacitor.getPlatform === "function" && Capacitor.getPlatform() === "android") return true;
      return false;
    } catch {
      return false;
    }
  }

  isEnabled() {
    try {
      const s = this.storage || (typeof window !== "undefined" ? window.localStorage : null);
      return s ? s.getItem(HC_ENABLED_KEY) === "true" : false;
    } catch {
      return false;
    }
  }

  setEnabled(enabled) {
    try {
      const s = this.storage || (typeof window !== "undefined" ? window.localStorage : null);
      if (s) {
        s.setItem(HC_ENABLED_KEY, enabled ? "true" : "false");
      }
      return true;
    } catch {
      return false;
    }
  }

  async checkAvailability() {
    try {
      const res = await PepHealthConnect.checkAvailability();
      return {
        available: res && res.available === true,
        status: (res && res.status) || HEALTH_CONNECT_STATUS.AVAILABLE,
        message: (res && res.message) || ""
      };
    } catch (e) {
      console.warn("[HealthConnect] Falha ao verificar disponibilidade:", e);
      return {
        available: false,
        status: HEALTH_CONNECT_STATUS.NOT_SUPPORTED,
        message: e.message || "Erro ao consultar Health Connect."
      };
    }
  }

  async requestPermissions() {
    try {
      const res = await PepHealthConnect.requestPermissions();
      return {
        granted: res && res.granted === true,
        status: res && res.granted ? HEALTH_CONNECT_STATUS.CONNECTED : HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED
      };
    } catch (e) {
      console.warn("[HealthConnect] Erro ao solicitar permissões:", e);
      return { granted: false, reason: e.message || "Permissão negada ou cancelada." };
    }
  }

  async openHealthConnectSettings() {
    try {
      await PepHealthConnect.openSettings();
      return true;
    } catch {
      return false;
    }
  }

  async syncMeasurements(localMeasurements = []) {
    if (!this.isEnabled()) {
      return { success: false, reason: "Health Connect desativado pelo usuário.", measurements: localMeasurements };
    }

    try {
      // 1. Exportar medições locais que tenham peso
      const exportRecords = [];
      for (const m of localMeasurements) {
        const r = mapMeasurementToHealthRecord(m);
        if (r) exportRecords.push(r);
      }

      if (exportRecords.length > 0) {
        await PepHealthConnect.writeRecords({ records: exportRecords });
      }

      // 2. Importar registros dos últimos 90 dias do Health Connect
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const readRes = await PepHealthConnect.readRecords({
        startTime: ninetyDaysAgo,
        endTime: new Date().toISOString()
      });

      const imported = Array.isArray(readRes.records) ? readRes.records : [];
      const merged = mergeHealthMeasurements(localMeasurements, imported);

      return {
        success: true,
        exportedCount: exportRecords.length,
        importedCount: imported.length,
        measurements: merged
      };
    } catch (e) {
      console.warn("[HealthConnect] Erro durante sincronização:", e);
      return {
        success: false,
        reason: e.message || "Erro ao sincronizar com o Health Connect.",
        measurements: localMeasurements
      };
    }
  }
}

export const healthConnect = new HealthConnectService();
