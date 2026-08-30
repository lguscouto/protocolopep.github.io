import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { AccessibilityService } from "../../src/services/accessibility.js";

describe("Acessibilidade e Navegação (WCAG 2.1 AA - V18)", () => {
  let htmlContent = "";

  beforeEach(() => {
    htmlContent = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf-8");
  });

  it("deve permitir zoom do usuário sem maximum-scale restritivo", () => {
    expect(htmlContent).not.toMatch(/maximum-scale\s*=\s*1(\.0)?/i);
    expect(htmlContent).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(htmlContent).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1\.0/);
  });

  it("deve conter elemento de anúncio para leitores de tela (#a11y-announcer)", () => {
    expect(htmlContent).toContain('id="a11y-announcer"');
    expect(htmlContent).toContain('class="sr-only"');
    expect(htmlContent).toContain('role="status"');
    expect(htmlContent).toContain('aria-live="polite"');
  });

  it("deve conter landmarks e roles de tabs na navegação principal", () => {
    expect(htmlContent).toContain('role="tablist"');
    expect(htmlContent).toContain('data-tab="today" role="tab"');
    expect(htmlContent).toContain('data-tab="week" role="tab"');
    expect(htmlContent).toContain('data-tab="history" role="tab"');
    expect(htmlContent).toContain('data-tab="calc" role="tab"');
    expect(htmlContent).toContain('data-tab="settings" role="tab"');
  });

  it("deve conter role tabpanel em todas as seções de abas", () => {
    expect(htmlContent).toContain('id="view-today" role="tabpanel"');
    expect(htmlContent).toContain('id="view-week" role="tabpanel"');
    expect(htmlContent).toContain('id="view-history" role="tabpanel"');
    expect(htmlContent).toContain('id="view-calc" role="tabpanel"');
    expect(htmlContent).toContain('id="view-settings" role="tabpanel"');
  });

  it("deve conter atributos role=dialog e aria-modal=true em todos os modais da aplicação", () => {
    expect(htmlContent).toContain('id="edit-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="notif-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="retro-log-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="share-preview-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="backup-preview-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="report-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="diag-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="confirm-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="research-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="compound-detail-modal" role="dialog" aria-modal="true"');
  });

  it("deve associar labels aos inputs do formulário de peptídeos e registros", () => {
    expect(htmlContent).toContain('for="edit-name"');
    expect(htmlContent).toContain('id="edit-name"');
    expect(htmlContent).toContain('for="edit-dose"');
    expect(htmlContent).toContain('id="edit-dose"');
    expect(htmlContent).toContain('for="edit-ui"');
    expect(htmlContent).toContain('id="edit-ui"');
    expect(htmlContent).toContain('for="high-contrast-toggle"');
    expect(htmlContent).toContain('id="high-contrast-toggle"');
  });
});

describe("AccessibilityService (Serviço de Acessibilidade)", () => {
  let mockStorage;
  let mockAnnouncer;
  let service;

  beforeEach(() => {
    const store = {};
    mockStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => {
        store[key] = String(val);
      })
    };
    mockAnnouncer = {
      textContent: "",
      setAttribute: vi.fn()
    };
    service = new AccessibilityService({
      storage: mockStorage,
      announcerEl: mockAnnouncer
    });
  });

  it("deve inicializar com alto contraste desativado por padrão", () => {
    expect(service.getHighContrast()).toBe(false);
  });

  it("deve permitir ativar e desativar alto contraste com persistência", () => {
    service.setHighContrast(true);
    expect(service.getHighContrast()).toBe(true);
    expect(mockStorage.setItem).toHaveBeenCalledWith("pep_high_contrast", "true");

    const toggled = service.toggleHighContrast();
    expect(toggled).toBe(false);
    expect(service.getHighContrast()).toBe(false);
  });

  it("deve emitir anúncios para leitor de tela via aria-live", async () => {
    service.announce("Dose confirmada com sucesso");
    expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith("aria-live", "polite");

    await new Promise((r) => setTimeout(r, 60));
    expect(mockAnnouncer.textContent).toBe("Dose confirmada com sucesso");
  });

  it("deve permitir anúncios assertivos para alertas críticos", async () => {
    service.announce("Atenção: erro ao gravar", "assertive");
    expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith("aria-live", "assertive");

    await new Promise((r) => setTimeout(r, 60));
    expect(mockAnnouncer.textContent).toBe("Atenção: erro ao gravar");
  });

  it("deve gerenciar focus trap sem quebrar quando elemento não possui filhos focáveis", () => {
    const emptyEl = { querySelectorAll: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const cleanup = service.trapFocus(emptyEl);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("deve ser resiliente se storage falhar (fail-closed)", () => {
    const failingStorage = {
      getItem: () => { throw new Error("Storage blocked"); },
      setItem: () => { throw new Error("QuotaExceededError"); }
    };
    const resilientService = new AccessibilityService({ storage: failingStorage, announcerEl: mockAnnouncer });
    expect(resilientService.getHighContrast()).toBe(false);
    expect(() => resilientService.setHighContrast(true)).not.toThrow();
  });
});

