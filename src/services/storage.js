import { DEFAULT_PROTOCOL } from "../data/default-library.js";
import { migrateAppState, migratePeptides, migrateLogs, CURRENT_SCHEMA_VERSION } from "../domain/migrations.js";
import { validateAndParseBackup, createBackupPayload } from "../domain/backup.js";

const KEYS = {
  PROTOCOL: "pep_protocol_v2",
  LOGS: "pep_logs_v2",
  SETTINGS: "pep_settings_v2",
  ROLLBACK_SNAPSHOT: "pep_rollback_snapshot",
  LEGACY_PROTO: "peptideos-protocolo-v1",
  LEGACY_LOGS: "peptideos-registro-v1"
};

export class StorageService {
  constructor() {
    this.peptides = [];
    this.logs = {};
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

    } catch (err) {
      console.error("[Storage] Erro ao inicializar storage local:", err);
      this.peptides = migratePeptides(DEFAULT_PROTOCOL);
      this.logs = {};
    }

    this.notify();
    return {
      peptides: this.peptides,
      logs: this.logs
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

  takeSnapshot() {
    return {
      peptides: JSON.parse(JSON.stringify(this.peptides)),
      logs: JSON.parse(JSON.stringify(this.logs))
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.peptides = snapshot.peptides || [];
    this.logs = snapshot.logs || {};
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
    } catch (e) {
      console.error("[Storage] Erro ao restaurar snapshot:", e);
    }
    this.notify();
  }

  exportBackup(theme = "black") {
    return createBackupPayload(this.peptides, this.logs, theme);
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

      const resProto = this.saveProtocol();
      const resLogs = this.saveLogs();

      if (!resProto.success || !resLogs.success) {
        throw new Error(resProto.error || resLogs.error || "Falha na escrita local");
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
          logs: this.logs
        });
      } catch (e) {
        console.error("[Storage] Listener error:", e);
      }
    }
  }
}

export const storage = new StorageService();
