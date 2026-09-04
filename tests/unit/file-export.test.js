import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exportFile,
  shareExportedFile,
  downloadBlob,
  setFileExportPlugin
} from "../../src/services/export.js";
import { Capacitor } from "@capacitor/core";

describe("Serviço de Exportação Local-First (export.js)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setFileExportPlugin(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setFileExportPlugin(null);
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  it("deve falhar se fileName for vazio ou inválido", async () => {
    const res = await exportFile({ fileName: "", content: "{}" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("inválido");
  });

  it("deve falhar se content for null ou undefined", async () => {
    const res = await exportFile({ fileName: "test.json", content: null });
    expect(res.success).toBe(false);
    expect(res.error).toContain("nulo");
  });

  it("deve exportar via plugin nativo quando na plataforma Android", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const mockPlugin = {
      saveFile: vi.fn().mockResolvedValue({
        success: true,
        path: "Downloads/ProtocoloPEP/test.json",
        uri: "content://media/external/downloads/123"
      })
    };
    setFileExportPlugin(mockPlugin);

    const res = await exportFile({
      fileName: "test.json",
      content: '{"hello":"world"}',
      mimeType: "application/json",
      subDir: "ProtocoloPEP"
    });

    expect(res.success).toBe(true);
    expect(res.path).toBe("Downloads/ProtocoloPEP/test.json");
    expect(mockPlugin.saveFile).toHaveBeenCalledWith({
      fileName: "test.json",
      content: '{"hello":"world"}',
      mimeType: "application/json",
      subDir: "ProtocoloPEP"
    });
  });

  it("deve capturar falha no plugin nativo e retornar fail-closed", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const mockPlugin = {
      saveFile: vi.fn().mockRejectedValue(new Error("Permissão negada"))
    };
    setFileExportPlugin(mockPlugin);

    const res = await exportFile({
      fileName: "test.json",
      content: "{}"
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Permissão negada");
  });

  it("deve compartilhar via plugin nativo quando na plataforma Android", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const mockPlugin = {
      shareFile: vi.fn().mockResolvedValue({ success: true })
    };
    setFileExportPlugin(mockPlugin);

    const res = await shareExportedFile({
      fileName: "backup.json",
      content: "{}",
      mimeType: "application/json",
      title: "Meu Backup"
    });

    expect(res.success).toBe(true);
    expect(mockPlugin.shareFile).toHaveBeenCalledWith({
      fileName: "backup.json",
      content: "{}",
      mimeType: "application/json",
      title: "Meu Backup"
    });
  });

  it("deve usar showSaveFilePicker na Web se disponível", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);

    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const mockHandle = {
      name: "custom-backup.json",
      createWritable: vi.fn().mockResolvedValue(mockWritable)
    };

    global.window = {
      showSaveFilePicker: vi.fn().mockResolvedValue(mockHandle)
    };

    const res = await exportFile({
      fileName: "backup.json",
      content: '{"test":123}',
      mimeType: "application/json"
    });

    expect(res.success).toBe(true);
    expect(res.path).toBe("custom-backup.json");
    expect(mockWritable.write).toHaveBeenCalledWith('{"test":123}');
    expect(mockWritable.close).toHaveBeenCalled();
  });

  it("deve retornar aborted: true se usuário cancelar showSaveFilePicker", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    const abortErr = new Error("The user aborted a request.");
    abortErr.name = "AbortError";

    global.window = {
      showSaveFilePicker: vi.fn().mockRejectedValue(abortErr)
    };

    const res = await exportFile({
      fileName: "backup.json",
      content: "{}"
    });

    expect(res.success).toBe(false);
    expect(res.aborted).toBe(true);
  });

  it("deve realizar fallback para downloadBlob na Web quando showSaveFilePicker indisponível", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    global.window = {};

    const clickSpy = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      click: clickSpy
    };

    global.document = {
      createElement: vi.fn((tag) => (tag === "a" ? mockAnchor : {})),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
    };
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
      revokeObjectURL: vi.fn()
    };
    global.Blob = class {
      constructor(content, opts) {
        this.content = content;
        this.opts = opts;
      }
    };

    const res = await exportFile({
      fileName: "relatorio.csv",
      content: "a,b,c",
      mimeType: "text/csv"
    });

    expect(res.success).toBe(true);
    expect(res.path).toBe("Downloads/relatorio.csv");
    expect(clickSpy).toHaveBeenCalled();
  });
});
