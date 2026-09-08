import { describe, expect, it } from "vitest";
import { renderAdherenceSummaryHTML } from "../../src/ui/adherence.js";

const summary = {
  scheduledDays: 4,
  completeDays: 2,
  due: 5,
  applied: 3,
  resolved: 4,
  skipped: 1,
  missed: 0,
  pending: 1,
  applicationPercent: 60,
  resolutionPercent: 80
};

describe("Painel de consistência", () => {
  it("renderiza métricas e seletor de período com atributos acessíveis", () => {
    const html = renderAdherenceSummaryHTML(summary, { periodDays: 30, locale: "pt-BR" });

    expect(html).toContain("Consistência da rotina");
    expect(html).toContain("Últimos 30 dias");
    expect(html).toContain('data-adherence-days="7"');
    expect(html).toContain('data-adherence-days="30"');
    expect(html).toContain('aria-valuenow="60"');
    expect(html).toContain("2/4");
  });

  it("não exibe painel quando não existe agenda no período", () => {
    expect(renderAdherenceSummaryHTML({ scheduledDays: 0 })).toBe("");
  });

});
