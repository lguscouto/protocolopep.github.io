import { DEFAULT_PROTOCOL } from "../data/default-library.js";
import {
  migratePeptides,
  migrateLogs,
  migrateInventory,
  migrateSites,
  migrateMeasurements,
  sanitizeHealthConnectState
} from "../domain/migrations.js";
import { validateAndParseBackup, createBackupPayload } from "../domain/backup.js";
import { debitVialDose, creditVialDose } from "../domain/inventory.js";
import { getDefaultSites, migrateLegacyDefaultSites } from "../domain/injection-sites.js";
import { createMeasurementEntry, validateMeasurementEntry } from "../domain/measurements.js";

const KEYS = {
  PROTOCOL: "pep_protocol_v2",
  LOGS: "pep_logs_v2",
  INVENTORY: "pep_inventory_v2",
  SITES: "pep_sites_v3",
  MEASUREMENTS: "pep_measurements_v2",
  TOMBSTONES: "pep_hc_tombstones_v2",
  HIDDEN_MEASUREMENTS: "pep_hidden_measurements_v2",
  SETTINGS: "pep_settings_v2",
  ROLLBACK_SNAPSHOT: "pep_rollback_snapshot",
  LEGACY_PROTO: "peptideos-protocolo-v1",
  LEGACY_LOGS: "peptideos-registro-v1",
  LEGACY_SITES: "pep_sites_v2"
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
    this.hiddenMeasurementIds = [];
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
        const legacySites = localStorage.getItem(KEYS.LEGACY_SITES);
        if (legacySites) {
          try {
            this.sites = migrateLegacyDefaultSites(JSON.parse(legacySites));
          } catch (e) {
            this.sites = getDefaultSites();
          }
        } else {
          this.sites = getDefaultSites();
        }
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
          const legacySafe = Array.isArray(raw)
            ? raw.map((item) => ({
                ...item,
                ownership: item?.ownership || "pep",
                dataOrigin: item?.dataOrigin || "com.protocolopep.app"
              }))
            : [];
          this.tombstones = sanitizeHealthConnectState({ tombstones: legacySafe }).tombstones;
        } catch (e) {
          this.tombstones = [];
        }
      } else {
        this.tombstones = [];
      }

      // 7. Carregar IDs de Medições Ocultadas (P1 Item 14)
      let storedHidden = localStorage.getItem(KEYS.HIDDEN_MEASUREMENTS);
      if (storedHidden) {
        try {
          const raw = JSON.parse(storedHidden);
          this.hiddenMeasurementIds = sanitizeHealthConnectState({ hiddenMeasurementIds: raw }).hiddenMeasurementIds;
        } catch (e) {
          this.hiddenMeasurementIds = [];
        }
      } else {
        this.hiddenMeasurementIds = [];
      }

    } catch (err) {
      console.error("[Storage] Erro ao inicializar storage local:", err);
      this.peptides = migratePeptides(DEFAULT_PROTOCOL);
      this.logs = {};
      this.inventory = [];
      this.sites = getDefaultSites();
      this.measurements = [];
      this.tombstones = [];
      this.hiddenMeasurementIds = [];
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
    try {
      this.measurements = migrateMeasurements(newMeasurements);
    } catch (error) {
      this.restoreSnapshot(backupSnapshot);
      return { success: false, error: error?.message || "Medições inválidas." };
    }
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
    if (!entryData || typeof entryData !== "object" || Array.isArray(entryData)) {
      return { success: false, error: "Medição inválida.", code: "INVALID_MEASUREMENT" };
    }
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
      const temporalChanged = dateChanged || timeChanged;
      const preservedTimestamp = temporalChanged ? null : (existing.timestamp || null);
      const historicalTimeZoneId = entryData.timeZoneId !== undefined
        ? entryData.timeZoneId
        : (existing.timeZoneId || null);
      const historicalZoneOffset = entryData.zoneOffset !== undefined
        ? entryData.zoneOffset
        : (existing.zoneOffset || null);

      const payload = {
        ...entryData,
        syncVersion,
        clientRecordVersion: syncVersion,
        clientRecordId: entryData.clientRecordId ?? existing.clientRecordId ?? null,
        source: entryData.source ?? existing.source ?? "local",
        ownership: entryData.ownership ?? existing.ownership ?? null,
        healthConnectRecordId: entryData.healthConnectRecordId ?? existing.healthConnectRecordId ?? null,
        dataOrigin: entryData.dataOrigin ?? existing.dataOrigin ?? null,
        // Uma zona IANA permite recalcular o offset correto para a nova data (inclusive DST).
        // Sem timeZoneId, o offset histórico fixo é preservado para evitar usar o fuso atual do aparelho.
        zoneOffset: temporalChanged && historicalTimeZoneId ? null : historicalZoneOffset,
        timeZoneId: historicalTimeZoneId,
        // Campos temporais (P0): createdAt imutável, updatedAt sempre agora, timestamp condicional
        timestamp: preservedTimestamp,
        createdAt: existing.createdAt || entryData.createdAt || null,
        updatedAt: new Date().toISOString()
      };

      let entry;
      try {
        entry = createMeasurementEntry(payload);
      } catch (error) {
        return { success: false, error: error?.message || "Medição inválida.", code: error?.code || "INVALID_MEASUREMENT" };
      }
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

    // Novo registro: timestamp representa a medição; createdAt/updatedAt representam o momento local de criação.
    const newPayload = {
      ...entryData,
      syncVersion,
      clientRecordVersion: syncVersion,
      // Para novos registros oriundos do Health Connect, preservar o timestamp recebido
      timestamp: entryData.timestamp || null,
      createdAt: entryData.createdAt || null,
      updatedAt: entryData.updatedAt || null
    };

    let entry;
    try {
      entry = createMeasurementEntry(newPayload);
    } catch (error) {
      return { success: false, error: error?.message || "Medição inválida.", code: error?.code || "INVALID_MEASUREMENT" };
    }
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

    // P1 (CODEX v2.5.0 Item 7): Tombstone baseado estritamente em ownership, NÃO bloqueado por source.
    // Registros PEP reimportados (source: "health_connect", ownership: "pep") devem gerar tombstone ao serem excluídos.
    const isPepOwnership = target && target.ownership === "pep" && (target.dataOrigin === "com.protocolopep.app" || !target.dataOrigin);
    const hasRemoteIdentity = Boolean(target?.clientRecordId || target?.healthConnectRecordId);
    if (isPepOwnership && hasRemoteIdentity && target.weightKg !== null && target.weightKg !== undefined) {
      this.addTombstone({
        id: target.id,
        clientRecordId: target.clientRecordId || null,
        healthConnectRecordId: target.healthConnectRecordId || null,
        ownership: "pep",
        dataOrigin: "com.protocolopep.app",
        deletedAt: new Date().toISOString()
      });
    } else if (target && target.ownership === "external") {
      // P1 Item 14: Registros externos excluídos no PEP são adicionados aos IDs ocultos para não reaparecerem no sync
      this.addHiddenMeasurementId(target.id);
      if (target.healthConnectRecordId) {
        this.addHiddenMeasurementId(target.healthConnectRecordId);
      }
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
    const normalized = sanitizeHealthConnectState({
      tombstones: [{
        ...tombstone,
        ownership: tombstone?.ownership || "pep",
        dataOrigin: tombstone?.dataOrigin || "com.protocolopep.app"
      }]
    }).tombstones[0];
    if (!normalized) return;
    const current = this.getTombstones();
    if (!current.some((t) => t.id === normalized.id)) {
      current.push(normalized);
      this.tombstones = current;
      this.saveTombstones();
    }
  }

  clearTombstones(idsToClear = []) {
    if (!Array.isArray(idsToClear) || idsToClear.length === 0) return;
    const set = new Set(idsToClear);
    this.tombstones = this.tombstones.filter((t) =>
      !set.has(t.id) &&
      !set.has(t.clientRecordId) &&
      !set.has(t.healthConnectRecordId)
    );
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

  getHiddenMeasurementIds() {
    return Array.isArray(this.hiddenMeasurementIds) ? deepClone(this.hiddenMeasurementIds) : [];
  }

  addHiddenMeasurementId(id) {
    const normalized = sanitizeHealthConnectState({ hiddenMeasurementIds: [id] }).hiddenMeasurementIds[0];
    if (!normalized) return;
    const current = this.getHiddenMeasurementIds();
    if (!current.includes(normalized)) {
      current.push(normalized);
      this.hiddenMeasurementIds = current;
      this.saveHiddenMeasurementIds();
    }
  }

  clearHiddenMeasurementIds() {
    this.hiddenMeasurementIds = [];
    this.saveHiddenMeasurementIds();
  }

  saveHiddenMeasurementIds() {
    try {
      localStorage.setItem(KEYS.HIDDEN_MEASUREMENTS, JSON.stringify(this.hiddenMeasurementIds));
      return { success: true };
    } catch (e) {
      console.error("[Storage] Erro ao salvar medições ocultas:", e);
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
      tombstones: deepClone(this.tombstones),
      hiddenMeasurementIds: deepClone(this.hiddenMeasurementIds)
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
    this.hiddenMeasurementIds = snapshot.hiddenMeasurementIds || [];
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(this.inventory));
      localStorage.setItem(KEYS.SITES, JSON.stringify(this.sites));
      localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify(this.measurements));
      localStorage.setItem(KEYS.TOMBSTONES, JSON.stringify(this.tombstones));
      localStorage.setItem(KEYS.HIDDEN_MEASUREMENTS, JSON.stringify(this.hiddenMeasurementIds));
    } catch (e) {
      console.error("[Storage] Erro ao restaurar snapshot:", e);
    }
    this.notify();
  }

  exportBackup(theme = "black") {
    return createBackupPayload(
      this.peptides,
      this.logs,
      theme,
      this.inventory,
      this.sites,
      this.measurements,
      {
        tombstones: this.tombstones,
        hiddenMeasurementIds: this.hiddenMeasurementIds
      }
    );
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
      this.tombstones = clean.healthConnectState?.tombstones || [];
      this.hiddenMeasurementIds = clean.healthConnectState?.hiddenMeasurementIds || [];

      const resProto = this.saveProtocol();
      const resLogs = this.saveLogs();
      const resInv = this.saveInventory();
      const resSites = this.saveSites();
      const resMeas = this.saveMeasurements();
      const resTomb = this.saveTombstones();
      const resHidden = this.saveHiddenMeasurementIds();

      if (!resProto.success || !resLogs.success || !resInv.success || !resSites.success || !resMeas.success || !resTomb.success || !resHidden.success) {
        throw new Error(
          resProto.error || resLogs.error || resInv.error || resSites.error || resMeas.error ||
          resTomb.error || resHidden.error || "Falha na escrita local"
        );
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
