import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  HEALTH_CONNECT_STATUS,
  mapMeasurementToHealthRecord,
  mapHealthRecordToMeasurement,
  mergeHealthMeasurements
} from "../domain/health-connect.js";
import { storage as defaultStorage } from "./storage.js";

const PepHealthConnect = registerPlugin("PepHealthConnect", {
  web: () => ({
    checkAvailability: async () => ({ available: true, status: HEALTH_CONNECT_STATUS.AVAILABLE, message: "Health Connect ativo." }),
    checkPermissions: async () => ({ granted: true, status: HEALTH_CONNECT_STATUS.CONNECTED }),
    requestPermissions: async () => ({ granted: true, status: HEALTH_CONNECT_STATUS.CONNECTED }),
    readRecords: async () => ({ success: true, records: [] }),
    writeRecords: async () => ({ success: true, count: 0 }),
    deleteRecords: async () => ({ success: true, deletedCount: 0 }),
    openSettings: async () => {}
  })
});

const HC_ENABLED_KEY = "pep_health_connect_enabled";

export class HealthConnectService {
  constructor(storage = defaultStorage) {
    this.storage = storage;
    this.isSyncing = false;
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
      if (this.storage && typeof this.storage.getItem === "function") {
        return this.storage.getItem(HC_ENABLED_KEY) === "true";
      }
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(HC_ENABLED_KEY) === "true";
      }
      return false;
    } catch {
      return false;
    }
  }

  setEnabled(enabled) {
    try {
      if (this.storage && typeof this.storage.setItem === "function") {
        this.storage.setItem(HC_ENABLED_KEY, enabled ? "true" : "false");
      } else if (typeof localStorage !== "undefined") {
        localStorage.setItem(HC_ENABLED_KEY, enabled ? "true" : "false");
      }
      return true;
    } catch {
      return false;
    }
  }

  async checkAvailability() {
    try {
      const res = await PepHealthConnect.checkAvailability();
      const status = (res && res.status) || (res && res.available ? HEALTH_CONNECT_STATUS.AVAILABLE : HEALTH_CONNECT_STATUS.UNAVAILABLE);
      return {
        available: res && res.available === true,
        status,
        message: (res && res.message) || ""
      };
    } catch (e) {
      console.warn("[HealthConnect] Falha ao verificar disponibilidade:", e);
      return {
        available: false,
        status: HEALTH_CONNECT_STATUS.UNAVAILABLE,
        message: e.message || "Erro ao consultar Health Connect."
      };
    }
  }

  async checkPermissions() {
    try {
      if (typeof PepHealthConnect.checkPermissions === "function") {
        const res = await PepHealthConnect.checkPermissions();
        return {
          granted: res && res.granted === true,
          status: (res && res.status) || (res && res.granted ? HEALTH_CONNECT_STATUS.CONNECTED : HEALTH_CONNECT_STATUS.NOT_AUTHORIZED)
        };
      }
      return this.requestPermissions();
    } catch (e) {
      console.warn("[HealthConnect] Erro ao checar permissões:", e);
      return { granted: false, status: HEALTH_CONNECT_STATUS.ERROR, reason: e.message };
    }
  }

  async requestPermissions() {
    try {
      const res = await PepHealthConnect.requestPermissions();
      const granted = res && res.granted === true;
      const status = (res && res.status) || (granted ? HEALTH_CONNECT_STATUS.CONNECTED : HEALTH_CONNECT_STATUS.NOT_AUTHORIZED);
      return {
        granted,
        status,
        reason: (res && res.reason) || ""
      };
    } catch (e) {
      console.warn("[HealthConnect] Erro ao solicitar permissões:", e);
      return { granted: false, status: HEALTH_CONNECT_STATUS.ERROR, reason: e.message || "Permissão negada ou cancelada." };
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

    if (this.isSyncing) {
      return { success: false, reason: "SYNC_IN_PROGRESS", message: "Sincronização já em andamento.", measurements: localMeasurements };
    }

    this.isSyncing = true;
    try {
      // Item 10: Verificar permissões reais no sistema antes de iniciar qualquer operação de sync
      const permStatus = await this.checkPermissions();
      if (!permStatus.granted) {
        return {
          success: false,
          reason: "PERMISSION_DENIED",
          message: permStatus.reason || "Permissão do Health Connect não autorizada ou revogada.",
          measurements: localMeasurements
        };
      }

      // 1. Processar e sincronizar exclusões com tombstones locais
      let deletedCount = 0;
      const tombstones = this.storage && typeof this.storage.getTombstones === "function"
        ? this.storage.getTombstones()
        : [];

      if (tombstones.length > 0) {
        const safeTombstones = tombstones.filter((t) =>
          t &&
          t.ownership === "pep" &&
          (!t.dataOrigin || t.dataOrigin === "com.protocolopep.app")
        );
        const recordIds = [...new Set(safeTombstones.map((t) => t.healthConnectRecordId).filter(Boolean))];
        const clientRecordIds = [...new Set(safeTombstones.map((t) => t.clientRecordId).filter(Boolean))];
        if (recordIds.length > 0 || clientRecordIds.length > 0) {
          const deleteResult = await PepHealthConnect.deleteRecords({ recordIds, clientRecordIds });
          if (deleteResult && deleteResult.success === false) {
            throw new Error(deleteResult.error || deleteResult.message || "HEALTH_CONNECT_DELETE_FAILED");
          }
          deletedCount = safeTombstones.length;
          if (this.storage && typeof this.storage.clearTombstones === "function") {
            this.storage.clearTombstones(safeTombstones.map((t) => t.id));
          }
        }
      }

      // 2. Exportar medições do PEP (P1 Item 6: direito de exportação baseado em ownership, não source)
      const exportRecords = [];
      for (const m of localMeasurements) {
        if (!m || m.ownership === "external") continue;
        const r = mapMeasurementToHealthRecord(m);
        if (r) exportRecords.push(r);
      }

      if (exportRecords.length > 0) {
        await PepHealthConnect.writeRecords({ records: exportRecords });
      }

      // 3. Importar registros dos últimos 30 dias do Health Connect (P1 Item 9: janela padrão segura sem requerer permissão de histórico ampliado)
      const SYNC_WINDOW_DAYS = 30;
      const syncWindowStart = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const readRes = await PepHealthConnect.readRecords({
        startTime: syncWindowStart,
        endTime: new Date().toISOString()
      });

      // Fail-closed: se a leitura falhar ou retornar erro, não mascara como lista vazia
      if (!readRes || readRes.success === false || readRes.error) {
        throw new Error(readRes?.error || readRes?.message || "HEALTH_CONNECT_READ_FAILED");
      }

      const importedRaw = Array.isArray(readRes.records) ? readRes.records : [];
      // P1 Item 14: Filtrar medições externas que o usuário optou por ocultar no PEP
      const hiddenIds = this.storage && typeof this.storage.getHiddenMeasurementIds === "function"
        ? this.storage.getHiddenMeasurementIds()
        : [];
      const hiddenSet = new Set(hiddenIds);
      const imported = importedRaw.filter((r) => {
        if (!r) return false;
        const recId = r.healthConnectRecordId || r.metadataId || r.id;
        const clientRecId = r.clientRecordId;
        return !hiddenSet.has(recId) && (!clientRecId || !hiddenSet.has(clientRecId));
      });

      const merged = mergeHealthMeasurements(localMeasurements, imported);

      return {
        success: true,
        exportedCount: exportRecords.length,
        importedCount: imported.length,
        deletedCount,
        measurements: merged
      };
    } catch (e) {
      console.warn("[HealthConnect] Erro durante sincronização:", e);
      return {
        success: false,
        reason: e.message || "Erro ao sincronizar com o Health Connect.",
        measurements: localMeasurements
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const healthConnect = new HealthConnectService(defaultStorage);
