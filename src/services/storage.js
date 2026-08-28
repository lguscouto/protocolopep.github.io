import { DEFAULT_PROTOCOL } from "../data/default-library.js";

const KEYS = {
  PROTOCOL: "pep_protocol_v2",
  LOGS: "pep_logs_v2",
  PATIENTS: "pep_patients_v2",
  PROFILE: "pep_profile_v2",
  SETTINGS: "pep_settings_v2",
  LEGACY_PROTO: "peptideos-protocolo-v1",
  LEGACY_LOGS: "peptideos-registro-v1"
};

class StorageService {
  constructor() {
    this.peptides = [];
    this.logs = {};
    this.patients = [];
    this.profile = { nickname: "", email: "" };
    this.listeners = new Set();
  }

  async init() {
    try {
      // 1. Carregar Protocolo
      let storedProto = localStorage.getItem(KEYS.PROTOCOL);
      if (!storedProto) {
        // Tentar migrar de chave antiga v1 se existir
        const legacyProto = localStorage.getItem(KEYS.LEGACY_PROTO);
        if (legacyProto) {
          try {
            this.peptides = JSON.parse(legacyProto);
          } catch (e) {
            this.peptides = [...DEFAULT_PROTOCOL];
          }
        } else {
          this.peptides = [...DEFAULT_PROTOCOL];
        }
        this.saveProtocol();
      } else {
        this.peptides = JSON.parse(storedProto);
      }

      // 2. Carregar Logs
      let storedLogs = localStorage.getItem(KEYS.LOGS);
      if (!storedLogs) {
        const legacyLogs = localStorage.getItem(KEYS.LEGACY_LOGS);
        if (legacyLogs) {
          try {
            this.logs = JSON.parse(legacyLogs);
          } catch (e) {
            this.logs = {};
          }
        } else {
          this.logs = {};
        }
        this.saveLogs();
      } else {
        this.logs = JSON.parse(storedLogs);
      }

      // 3. Carregar Pacientes / Protocolos salvos
      let storedPatients = localStorage.getItem(KEYS.PATIENTS);
      this.patients = storedPatients ? JSON.parse(storedPatients) : [];

      // 4. Carregar Perfil Local
      let storedProfile = localStorage.getItem(KEYS.PROFILE);
      this.profile = storedProfile ? JSON.parse(storedProfile) : { nickname: "", email: "" };

    } catch (err) {
      console.error("[Storage] Erro ao inicializar storage local:", err);
      this.peptides = [...DEFAULT_PROTOCOL];
      this.logs = {};
    }

    this.notify();
    return {
      peptides: this.peptides,
      logs: this.logs,
      patients: this.patients,
      profile: this.profile
    };
  }

  getPeptides() {
    return this.peptides;
  }

  setPeptides(newPeptides) {
    this.peptides = Array.isArray(newPeptides) ? newPeptides : [];
    this.saveProtocol();
    this.notify();
  }

  saveProtocol() {
    try {
      localStorage.setItem(KEYS.PROTOCOL, JSON.stringify(this.peptides));
    } catch (e) {
      console.warn("[Storage] Erro salvando protocolo:", e);
    }
  }

  getLogs() {
    return this.logs;
  }

  setLogs(newLogs) {
    this.logs = newLogs && typeof newLogs === "object" ? newLogs : {};
    this.saveLogs();
    this.notify();
  }

  saveLogs() {
    try {
      localStorage.setItem(KEYS.LOGS, JSON.stringify(this.logs));
    } catch (e) {
      console.warn("[Storage] Erro salvando logs:", e);
    }
  }

  getPatients() {
    return this.patients;
  }

  savePatients(patients) {
    this.patients = Array.isArray(patients) ? patients : [];
    try {
      localStorage.setItem(KEYS.PATIENTS, JSON.stringify(this.patients));
    } catch (e) {
      console.warn("[Storage] Erro salvando pacientes:", e);
    }
    this.notify();
  }

  getProfile() {
    return this.profile;
  }

  saveProfile(profile) {
    this.profile = { ...this.profile, ...profile };
    try {
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(this.profile));
    } catch (e) {
      console.warn("[Storage] Erro salvando perfil:", e);
    }
    this.notify();
  }

  exportBackup() {
    return {
      version: "2.0",
      app: "Protocolo PEP Android",
      exportedAt: new Date().toISOString(),
      profile: this.profile,
      protocol: this.peptides,
      logs: this.logs,
      patients: this.patients
    };
  }

  importBackup(backupData) {
    if (!backupData || !Array.isArray(backupData.protocol)) {
      throw new Error("Formato de backup inválido.");
    }
    this.peptides = backupData.protocol;
    this.logs = backupData.logs && typeof backupData.logs === "object" ? backupData.logs : {};
    if (Array.isArray(backupData.patients)) {
      this.patients = backupData.patients;
      this.savePatients(this.patients);
    }
    if (backupData.profile) {
      this.profile = { ...this.profile, ...backupData.profile };
      this.saveProfile(this.profile);
    }
    this.saveProtocol();
    this.saveLogs();
    this.notify();
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
          patients: this.patients,
          profile: this.profile
        });
      } catch (e) {
        console.error("[Storage] Listener error:", e);
      }
    }
  }
}

export const storage = new StorageService();
