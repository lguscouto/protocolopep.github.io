import { DEFAULT_PROTOCOL } from "../data/default-library.js";
import { migrateAppState, migratePeptides, migrateLogs, migrateInventory, migrateSites, migrateMeasurements, CURRENT_SCHEMA_VERSION } from "../domain/migrations.js";
import { validateAndParseBackup, createBackupPayload } from "../domain/backup.js";
import { debitVialDose, creditVialDose } from "../domain/inventory.js";
import { getDefaultSites } from "../domain/injection-sites.js";
import { createMeasurementEntry, validateMeasurementEntry } from "../domain/measurements.js";

const KEYS = {
  PROTOCOL: "pep_protocol_v2",
  LOGS: "pep_logs_v2",
  INVENTORY: "pep_inventory_v2",
  SITES: "pep_sites_v2",
  MEASUREMENTS: "pep_measurements_v2",
  TOMBSTONES: "pep_hc_tombstones_v2",
  SETTINGS: "pep_settings_v2",
  ROLLBACK_SNAPSHOT: "pep_rollback_snapshot",
  LEGACY_PROTO: "peptideos-protocolo-v1",
  LEGACY_LOGS: "peptideos-registro-v1"
};

export function deepClone(data) {
  if (data === undefined || data === null) return data;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(data);
    } catch (e) {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(data));
}

export class StorageService {
  constructor() {
    this.peptides = [];
    this.logs = {};
    this.inventory = [];
    this.sites = getDefaultSites();
    this.measurements = [];
    this.tombstones = [];
    this.listeners = new Set();
  }

  init() {
    try {
      // 1. Carregar Protocolo
      let storedProto = localStorage.getItem(KEYS.PROTOCOL);
      if (!storedProto) {
        const legacyProto = localStorage.getItem(KEYS.LEGACY_PROTO);
        if (legacyProto) {
          try {
            const raw = JSON.parse(legacyProto);
            this.peptides = migratePeptides(raw);
          } catch (e) {
            this.peptides = migratePeptides(DEFAULT_PROTOCOL);
          }
        } else {
          this.peptides = migratePeptides(DEFAULT_PROTOCOL);
        }
        this.saveProtocol();
      } else {
        const raw = JSON.parse(storedProto);
        this.peptides = migratePeptides(raw);
      }

      // 2. Carregar Logs
      let storedLogs = localStorage.getItem(KEYS.LOGS);
      if (!storedLogs) {
        const legacyLogs = localStorage.getItem(KEYS.LEGACY_LOGS);
        if (legacyLogs) {
          try {
            const raw = JSON.parse(legacyLogs);
            this.logs = migrateLogs(raw);
          } catch (e) {
            this.logs = {};
          }
        } else {
          this.logs = {};
        }
        this.saveLogs();
      } else {
        const raw = JSON.parse(storedLogs);
        this.logs = migrateLogs(raw);
      }

      // 3. Carregar Inventário
      let storedInventory = localStorage.getItem(KEYS.INVENTORY);
      if (storedInventory) {
        try {
          const raw = JSON.parse(storedInventory);
          this.inventory = migrateInventory(raw);
        } catch (e) {
          this.inventory = [];
        }
      } else {
        this.inventory = [];
      }

      // 4. Carregar Sítios de Aplicação (V11)
      let storedSites = localStorage.getItem(KEYS.SITES);
      if (storedSites) {
        try {
          const raw = JSON.parse(storedSites);
          this.sites = migrateSites(raw);
        } catch (e) {
          this.sites = getDefaultSites();
        }
      } else {
        this.sites = getDefaultSites();
        this.saveSites();
      }

      // 5. Carregar Medições e Sintomas (V12)
      let storedMeasurements = localStorage.getItem(KEYS.MEASUREMENTS);
      if (storedMeasurements) {
        try {
          const raw = JSON.parse(storedMeasurements);
          this.measurements = migrateMeasurements(raw);
        } catch (e) {
          this.measurements = [];
        }
      } else {
        this.measurements = [];
      }

      // 6. Carregar Tombstones do Health Connect
      let storedTombstones = localStorage.getItem(KEYS.TOMBSTONES);
      if (storedTombstones) {
        try {
          const raw = JSON.parse(storedTombstones);
          this.tombstones = Array.isArray(raw) ? raw : [];
        } catch (e) {
          this.tombstones = [];
        }
      } else {
        this.tombstones = [];
      }

    } catch (err) {
      console.error("[Storage] Erro ao inicializar storage local:", err);
      this.peptides = migratePeptides(DEFAULT_PROTOCOL);
      this.logs = {};
      this.inventory = [];
      this.sites = getDefaultSites();
      this.measurements = [];
      this.tombstones = [];
    }

    this.notify();
    return {
      peptides: this.peptides,
      logs: this.logs,
      inventory: this.inventory,
      sites: this.sites,
      measurements: this.measurements
    };
  }

  getPeptides() {
    return deepClone(this.peptides);
  }

  setPeptides(newPeptides) {
    const backupSnapshot = this.takeSnapshot();
    this.peptides = migratePeptides(newPeptides);
    const res = this.saveProtocol();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true };
  }

  saveProtocol() {
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar protocolo:", e);
      return { success: false, error: e.message || "Falha ao gravar no armazenamento local" };
    }
  }

  getLogs() {
    return deepClone(this.logs);
  }

  setLogs(newLogs) {
    const backupSnapshot = this.takeSnapshot();
    this.logs = migrateLogs(newLogs);
    const res = this.saveLogs();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true };
  }

  saveLogs() {
    try {
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar logs:", e);
      return { success: false, error: e.message || "Falha ao gravar logs no armazenamento local" };
    }
  }

  getInventory() {
    return deepClone(this.inventory);
  }

  setInventory(newInventory) {
    const backupSnapshot = this.takeSnapshot();
    this.inventory = migrateInventory(newInventory);
    const res = this.saveInventory();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true };
  }

  saveInventory() {
    try {
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(this.inventory));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar inventário:", e);
      return { success: false, error: e.message || "Falha ao gravar inventário no armazenamento local" };
    }
  }

  findVialForPeptide(peptideIdOrName, fallbackName = "") {
    if (!Array.isArray(this.inventory)) return null;
    const target1 = peptideIdOrName ? String(peptideIdOrName).trim().toLowerCase() : "";
    const target2 = fallbackName ? String(fallbackName).trim().toLowerCase() : "";
    if (!target1 && !target2) return null;

    return this.inventory.find((v) => {
      if (v.status !== "active") return false;
      const vId = v.peptideId ? String(v.peptideId).trim().toLowerCase() : "";
      const vName = v.peptideName ? String(v.peptideName).trim().toLowerCase() : "";
      
      if (target1 && (vId === target1 || vName === target1)) return true;
      if (target2 && (vId === target2 || vName === target2)) return true;
      return false;
    }) || null;
  }

  debitDoseFromVial(vialId, doseData = {}) {
    const vialIndex = this.inventory.findIndex((v) => v.id === vialId);
    if (vialIndex === -1) return { success: false, error: "Frasco não encontrado no inventário." };

    const vial = this.inventory[vialIndex];
    const debitRes = debitVialDose(vial, doseData);
    if (!debitRes.success) return debitRes;

    const newInventory = [...this.inventory];
    newInventory[vialIndex] = debitRes.vial;
    const saveRes = this.setInventory(newInventory);
    if (!saveRes.success) return saveRes;

    return { success: true, vial: debitRes.vial, debitedMcg: debitRes.debitedMcg };
  }

  creditDoseToVial(vialId, doseData = {}) {
    const vialIndex = this.inventory.findIndex((v) => v.id === vialId);
    if (vialIndex === -1) return { success: false, error: "Frasco não encontrado no inventário." };

    const vial = this.inventory[vialIndex];
    const creditRes = creditVialDose(vial, doseData);
    if (!creditRes.success) return creditRes;

    const newInventory = [...this.inventory];
    newInventory[vialIndex] = creditRes.vial;
    const saveRes = this.setInventory(newInventory);
    if (!saveRes.success) return saveRes;

    return { success: true, vial: creditRes.vial, creditedMcg: creditRes.creditedMcg };
  }

  getSites() {
    return Array.isArray(this.sites) ? deepClone(this.sites) : getDefaultSites();
  }

  setSites(newSites) {
    const backupSnapshot = this.takeSnapshot();
    this.sites = migrateSites(newSites);
    const res = this.saveSites();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true, sites: this.sites };
  }

  saveSites() {
    try {
      localStorage.setItem(KEYS.SITES, JSON.stringify(this.sites));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar sítios:", e);
      return { success: false, error: e.message || "Falha ao gravar sítios no armazenamento local" };
    }
  }

  getMeasurements() {
    return Array.isArray(this.measurements) ? deepClone(this.measurements) : [];
  }

  setMeasurements(newMeasurements) {
    const backupSnapshot = this.takeSnapshot();
    this.measurements = migrateMeasurements(newMeasurements);
    const res = this.saveMeasurements();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true, measurements: this.measurements };
  }

  addMeasurement(entryData) {
    const backupSnapshot = this.takeSnapshot();
    const current = this.getMeasurements();
    const existingIdx = entryData && entryData.id ? current.findIndex((m) => m.id === entryData.id) : -1;
    const existing = existingIdx !== -1 ? current[existingIdx] : null;

    let syncVersion = 1;
    if (existing) {
      // Item 9: Normalizar valores numéricos e textos antes de comparar para evitar falso incremento de syncVersion
      const parseW = (w) => (w !== null && w !== undefined && w !== "" ? Math.round(Number(String(w).replace(",", ".")) * 100) / 100 : null);
      const prevW = parseW(existing.weightKg);
      const nextW = parseW(entryData.weightKg);
      const prevDate = String(existing.date || "");
      const nextDate = String(entryData.date || "");
      const prevTime = String(existing.time || "08:00");
      const nextTime = String(entryData.time || "08:00");

      const hasChanged = prevW !== nextW || prevDate !== nextDate || prevTime !== nextTime;
      syncVersion = hasChanged ? (existing.syncVersion || 1) + 1 : (existing.syncVersion || 1);

      // P0 (CODEX v2.5.0): timestamp é calculado de date+time, nunca de createdAt.
      // Se date ou time mudaram → passar timestamp=null para createMeasurementEntry recalcular de date+time.
      // Se não mudaram → preservar o instante histórico original.
      const dateChanged = prevDate !== nextDate;
      const timeChanged = prevTime !== nextTime;
      const preservedTimestamp = (dateChanged || timeChanged) ? null : (existing.timestamp || null);

      const payload = {
        ...entryData,
        syncVersion,
        clientRecordVersion: syncVersion,
        clientRecordId: existing.clientRecordId || entryData.clientRecordId || null,
        source: existing.source || entryData.source || "local",
        ownership: existing.ownership || entryData.ownership || "pep",
        healthConnectRecordId: existing.healthConnectRecordId || entryData.healthConnectRecordId,
        dataOrigin: existing.dataOrigin || entryData.dataOrigin,
        zoneOffset: existing.zoneOffset || entryData.zoneOffset,
        // Campos temporais (P0): createdAt imutável, updatedAt sempre agora, timestamp condicional
        timestamp: preservedTimestamp,
        createdAt: existing.createdAt || entryData.createdAt || null,
        updatedAt: new Date().toISOString()
      };

      const entry = createMeasurementEntry(payload);
      const validRes = validateMeasurementEntry(entry);
      if (!validRes.valid) {
        return { success: false, error: validRes.errors.join("; ") };
      }
      current[existingIdx] = entry;
      this.measurements = current;
      const res = this.saveMeasurements();
      if (!res.success) {
        this.restoreSnapshot(backupSnapshot);
        return res;
      }
      this.notify();
      return { success: true, entry, measurements: this.measurements };
    }

    // Novo registro: timestamp/createdAt/updatedAt serão calculados em createMeasurementEntry
    const newPayload = {
      ...entryData,
      syncVersion,
      clientRecordVersion: syncVersion,
      // Para novos registros oriundos do Health Connect, preservar o timestamp recebido
      timestamp: entryData.timestamp || null,
      createdAt: null,   // createMeasurementEntry inicializa como now
      updatedAt: null    // createMeasurementEntry inicializa como now
    };

    const entry = createMeasurementEntry(newPayload);
    const validRes = validateMeasurementEntry(entry);
    if (!validRes.valid) {
      return { success: false, error: validRes.errors.join("; ") };
    }

    current.push(entry);
    this.measurements = current;
    const res = this.saveMeasurements();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true, entry, measurements: this.measurements };
  }

  deleteMeasurement(id) {
    const backupSnapshot = this.takeSnapshot();
    const current = this.getMeasurements();
    const target = current.find((m) => m.id === id);

    // Se for medição originada pelo PEP com peso que possa estar no Health Connect, registra tombstone
    const isPepOwnership = target && target.ownership === "pep" && (target.dataOrigin === "com.protocolopep.app" || !target.dataOrigin) && target.source !== "health_connect";
    if (isPepOwnership && target.weightKg !== null && target.weightKg !== undefined) {
      this.addTombstone({
        id: target.id,
        clientRecordId: target.clientRecordId || target.id,
        healthConnectRecordId: target.healthConnectRecordId || null,
        deletedAt: new Date().toISOString()
      });
    }

    const filtered = current.filter((m) => m.id !== id);
    this.measurements = filtered;
    const res = this.saveMeasurements();
    if (!res.success) {
      this.restoreSnapshot(backupSnapshot);
      return res;
    }
    this.notify();
    return { success: true, measurements: this.measurements };
  }

  getTombstones() {
    return Array.isArray(this.tombstones) ? deepClone(this.tombstones) : [];
  }

  addTombstone(tombstone) {
    if (!tombstone || !tombstone.id) return;
    const current = this.getTombstones();
    if (!current.some((t) => t.id === tombstone.id)) {
      current.push(tombstone);
      this.tombstones = current;
      this.saveTombstones();
    }
  }

  clearTombstones(idsToClear = []) {
    if (!Array.isArray(idsToClear) || idsToClear.length === 0) return;
    const set = new Set(idsToClear);
    this.tombstones = this.tombstones.filter((t) => !set.has(t.id) && !set.has(t.clientRecordId));
    this.saveTombstones();
  }

  saveTombstones() {
    try {
      localStorage.setItem(KEYS.TOMBSTONES, JSON.stringify(this.tombstones));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar tombstones:", e);
      return { success: false, error: e.message };
    }
  }

  saveMeasurements() {
    try {
      localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify(this.measurements));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar medições:", e);
      return { success: false, error: e.message || "Falha ao gravar medições no armazenamento local" };
    }
  }

  takeSnapshot() {
    return {
      peptides: deepClone(this.peptides),
      logs: deepClone(this.logs),
      inventory: deepClone(this.inventory),
      sites: deepClone(this.sites),
      measurements: deepClone(this.measurements),
      tombstones: deepClone(this.tombstones)
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.peptides = snapshot.peptides || [];
    this.logs = snapshot.logs || {};
    this.inventory = snapshot.inventory || [];
    this.sites = snapshot.sites || getDefaultSites();
    this.measurements = snapshot.measurements || [];
    this.tombstones = snapshot.tombstones || [];
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(this.inventory));
      localStorage.setItem(KEYS.SITES, JSON.stringify(this.sites));
      localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify(this.measurements));
      localStorage.setItem(KEYS.TOMBSTONES, JSON.stringify(this.tombstones));
    } catch (e) {
      console.error("[Storage] Erro ao restaurar snapshot:", e);
    }
    this.notify();
  }

  exportBackup(theme = "black") {
    return createBackupPayload(this.peptides, this.logs, theme, this.inventory, this.sites, this.measurements);
  }

  importBackup(jsonString) {
    const validation = validateAndParseBackup(jsonString);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const snapshot = this.takeSnapshot();
    try {
      const clean = validation.data;
      this.peptides = clean.protocol;
      this.logs = clean.logs;
      this.inventory = clean.inventory || [];
      this.sites = clean.sites || getDefaultSites();
      this.measurements = clean.measurements || [];

      const resProto = this.saveProtocol();
      const resLogs = this.saveLogs();
      const resInv = this.saveInventory();
      const resSites = this.saveSites();
      const resMeas = this.saveMeasurements();

      if (!resProto.success || !resLogs.success || !resInv.success || !resSites.success || !resMeas.success) {
        throw new Error(resProto.error || resLogs.error || resInv.error || resSites.error || resMeas.error || "Falha na escrita local");
      }

      this.notify();
      return {
        success: true,
        stats: validation.stats,
        theme: clean.theme
      };
    } catch (err) {
      console.error("[Storage] Erro ao importar backup. Executando rollback:", err);
      this.restoreSnapshot(snapshot);
      return { success: false, error: err.message };
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const payload = {
      peptides: deepClone(this.peptides),
      logs: deepClone(this.logs),
      inventory: deepClone(this.inventory),
      sites: deepClone(this.sites),
      measurements: deepClone(this.measurements)
    };
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (e) {
        console.error("[Storage] Listener error:", e);
      }
    }
  }
}

export const storage = new StorageService();
