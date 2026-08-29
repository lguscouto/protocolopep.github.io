import { describe, it, expect, beforeEach } from "vitest";
import { recordBackupExport, recordBackupRestore, getBackupStatus } from "../../src/ui/backup-status.js";

describe("Backup Status & Operations History (V06)", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };
  });

  it("deve iniciar sem status de exportação e restauração", () => {
    const status = getBackupStatus();
    expect(status.lastExport).toBeNull();
    expect(status.lastRestore).toBeNull();
  });

  it("deve registrar e recuperar timestamp da última exportação", () => {
    recordBackupExport();
    const status = getBackupStatus();
    expect(status.lastExport).toBeDefined();
    expect(status.lastExport.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("deve registrar e recuperar estatísticas da última restauração", () => {
    const stats = {
      peptideCount: 3,
      logDaysCount: 5,
      totalDosesCount: 12
    };

    recordBackupRestore(stats);
    const status = getBackupStatus();
    expect(status.lastRestore).toBeDefined();
    expect(status.lastRestore.stats.peptideCount).toBe(3);
    expect(status.lastRestore.stats.logDaysCount).toBe(5);
    expect(status.lastRestore.stats.totalDosesCount).toBe(12);
  });
});
