import { describe, it, expect } from "vitest";
import { formatNotificationContent, getNotificationVisualState } from "../../src/domain/notification-formatter.js";

describe("Notification Formatter & Visual State (V05)", () => {
  const mockPeptide = {
    name: "BPC-157",
    dose: "500 mcg",
    ui: 10,
    sub: "reparo"
  };

  it("deve formatar texto com conteúdo discreto por padrão (ocultando nomes e doses)", () => {
    const res = formatNotificationContent(mockPeptide, { discreteMode: true });
    expect(res.title).toBe("Protocolo PEP");
    expect(res.body).toBe("Horário de aplicação programada");
    expect(res.body).not.toContain("BPC-157");
    expect(res.body).not.toContain("500 mcg");
  });

  it("deve formatar com detalhes completos quando o modo discreto estiver desativado", () => {
    const res = formatNotificationContent(mockPeptide, { discreteMode: false });
    expect(res.title).toBe("Lembrete: BPC-157");
    expect(res.body).toContain("10 UI");
    expect(res.body).toContain("500 mcg");
  });

  it("deve avaliar estado de permissão negada corretamente", () => {
    const state = getNotificationVisualState({
      enabled: true,
      permission: "denied",
      pendingCount: 0
    });

    expect(state.state).toBe("denied");
    expect(state.canSchedule).toBe(false);
    expect(state.label).toContain("Negada");
    expect(state.badgeClass).toBe("badge-danger");
  });

  it("deve avaliar estado desativado corretamente", () => {
    const state = getNotificationVisualState({
      enabled: false,
      permission: "granted",
      pendingCount: 0
    });

    expect(state.state).toBe("disabled");
    expect(state.canSchedule).toBe(false);
    expect(state.label).toContain("Desativados");
    expect(state.badgeClass).toBe("badge-neutral");
  });

  it("deve avaliar estado ativo com contagem de lembretes pendentes", () => {
    const state = getNotificationVisualState({
      enabled: true,
      permission: "granted",
      pendingCount: 14,
      horizonDays: 14
    });

    expect(state.state).toBe("active");
    expect(state.canSchedule).toBe(true);
    expect(state.label).toContain("Ativo");
    expect(state.message).toContain("14 lembretes agendados");
    expect(state.badgeClass).toBe("badge-success");
  });
});
