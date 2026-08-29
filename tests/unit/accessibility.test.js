import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

describe("Acessibilidade e Navegação (V07)", () => {
  let htmlContent = "";

  beforeEach(() => {
    htmlContent = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf-8");
  });

  it("deve permitir zoom do usuário sem maximum-scale restritivo", () => {
    expect(htmlContent).not.toMatch(/maximum-scale\s*=\s*1(\.0)?/i);
    expect(htmlContent).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(htmlContent).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1\.0/);
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

  it("deve conter atributos role=dialog e aria-modal=true em todos os modais", () => {
    expect(htmlContent).toContain('id="edit-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="notif-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="retro-log-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="share-preview-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="backup-preview-modal" role="dialog" aria-modal="true"');
    expect(htmlContent).toContain('id="confirm-modal" role="dialog" aria-modal="true"');
  });

  it("deve associar labels aos inputs do formulário de peptídeos e registros", () => {
    expect(htmlContent).toContain('for="edit-name"');
    expect(htmlContent).toContain('id="edit-name"');
    expect(htmlContent).toContain('for="edit-dose"');
    expect(htmlContent).toContain('id="edit-dose"');
    expect(htmlContent).toContain('for="edit-ui"');
    expect(htmlContent).toContain('id="edit-ui"');
    expect(htmlContent).toContain('for="retro-date-input"');
    expect(htmlContent).toContain('id="retro-date-input"');
  });
});
