import { DEFAULT_PROTOCOL } from "../data/default-library.js";
import { migrateAppState, migratePeptides, migrateLogs, migrateInventory, CURRENT_SCHEMA_VERSION } from "../domain/migrations.js";
import { validateAndParseBackup, createBackupPayload } from "../domain/backup.js";
import { debitVialDose, creditVialDose } from "../domain/inventory.js";

const KEYS = {
  PROTOCOL: "pep_protocol_v2",
  LOGS: "pep_logs_v2",
  INVENTORY: "pep_inventory_v2",
  SETTINGS: "pep_settings_v2",
  ROLLBACK_SNAPSHOT: "pep_rollback_snapshot",
  LEGACY_PROTO: "peptideos-protocolo-v1",
  LEGACY_LOGS: "peptideos-registro-v1"
};

export class StorageService {
  constructor() {
    this.peptides = [];
    this.logs = {};
    this.inventory = [];
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

    } catch (err) {
      console.error("[Storage] Erro ao inicializar storage local:", err);
      this.peptides = migratePeptides(DEFAULT_PROTOCOL);
      this.logs = {};
      this.inventory = [];
    }

    this.notify();
    return {
      peptides: this.peptides,
      logs: this.logs,
      inventory: this.inventory
    };
  }

  getPeptides() {
    return this.peptides;
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
    return this.logs;
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
    return this.inventory;
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

  takeSnapshot() {
    return {
      peptides: JSON.parse(JSON.stringify(this.peptides)),
      logs: JSON.parse(JSON.stringify(this.logs)),
      inventory: JSON.parse(JSON.stringify(this.inventory))
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.peptides = snapshot.peptides || [];
    this.logs = snapshot.logs || {};
    this.inventory = snapshot.inventory || [];
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(this.inventory));
    } catch (e) {
      console.error("[Storage] Erro ao restaurar snapshot:", e);
    }
    this.notify();
  }

  exportBackup(theme = "black") {
    return createBackupPayload(this.peptides, this.logs, theme, this.inventory);
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

      const resProto = this.saveProtocol();
      const resLogs = this.saveLogs();
      const resInv = this.saveInventory();

      if (!resProto.success || !resLogs.success || !resInv.success) {
        throw new Error(resProto.error || resLogs.error || resInv.error || "Falha na escrita local");
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
    for (const listener of this.listeners) {
      try {
        listener({
          peptides: this.peptides,
          logs: this.logs,
          inventory: this.inventory
        });
      } catch (e) {
        console.error("[Storage] Listener error:", e);
      }
    }
  }
}

export const storage = new StorageService();
