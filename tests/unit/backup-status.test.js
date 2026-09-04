import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { recordBackupExport, recordBackupRestore, getBackupStatus, renderBackupStatusUI } from "../../src/ui/backup-status.js";

describe("Backup Status & Operations History (V15)", () => {
  let mockStore = {};
  let mockArea = null;

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };

    mockArea = { innerHTML: "" };
    global.document = {
      getElementById: (id) => (id === "backup-status-area" ? mockArea : null)
    };
  });

  afterEach(() => {
    delete global.document;
  });

  it("deve iniciar sem status de exportação e restauração", () => {
    const status = getBackupStatus();
    expect(status.lastExport).toBeNull();
    expect(status.lastRestore).toBeNull();
  });

  it("deve registrar e recuperar timestamp e caminho da última exportação", () => {
    recordBackupExport("Downloads/ProtocoloPEP/protocolo-pep-backup-2026-09-04.json");
    const status = getBackupStatus();
    expect(status.lastExport).toBeDefined();
    expect(status.lastExport.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(status.lastExport.path).toBe("Downloads/ProtocoloPEP/protocolo-pep-backup-2026-09-04.json");
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

  it("deve renderizar a interface de status com o caminho do arquivo sanitizado", () => {
    recordBackupExport("Downloads/ProtocoloPEP/<script>alert(1)</script>.json");
    renderBackupStatusUI();
    expect(mockArea.innerHTML).toContain("Downloads/ProtocoloPEP/&lt;script&gt;alert(1)&lt;/script&gt;.json");
    expect(mockArea.innerHTML).not.toContain("<script>alert(1)</script>");
  });
});
