import { describe, expect, it } from "vitest";
import {
  createDoseCardViewModel,
  createDashboardFocusViewModel,
  renderDashboardFocusHTML,
  renderEmptyDashboardHTML
} from "../../src/ui/dashboard.js";

describe("Dashboard UI Module", () => {
  it("cria view model correta para dose pendente", () => {
    const peptide = {
      id: "pep-1",
      name: "BPC-157",
      dose: "250 mcg",
      ui: 10,
      perDay: 2,
      time: "08:00",
      color: "#2CC5C0"
    };

    const vm = createDoseCardViewModel({
      peptide,
      takenCount: 0,
      nextSite: "Abdômen (E)",
      vialStatus: { remainingDoses: 15, isLow: false }
    });

    expect(vm.id).toBe("pep-1");
    expect(vm.name).toBe("BPC-157");
    expect(vm.takenCount).toBe(0);
    expect(vm.dueCount).toBe(2);
    expect(vm.status).toBe("pending");
    expect(vm.isCompleted).toBe(false);
    expect(vm.nextSite).toBe("Abdômen (E)");
    expect(vm.vialStatus.remainingDoses).toBe(15);
  });

  it("cria view model correta para dose concluída", () => {
    const peptide = {
      id: "pep-2",
      name: "TB-500",
      dose: "500 mcg",
      ui: 20,
      perDay: 1,
      time: "20:00"
    };

    const vm = createDoseCardViewModel({
      peptide,
      takenCount: 1,
      nextSite: "Coxa (D)",
      vialStatus: null
    });

    expect(vm.status).toBe("completed");
    expect(vm.isCompleted).toBe(true);
    expect(vm.takenCount).toBe(1);
    expect(vm.dueCount).toBe(1);
  });

  it("produz HTML para o estado vazio sem 0% ou 0/0", () => {
    const html = renderEmptyDashboardHTML();
    expect(html).toContain("Seu protocolo começa aqui");
    expect(html).toContain("data-action=\"create-protocol\"");
    expect(html).not.toContain("0 / 0");
    expect(html).not.toContain("dash-ring");
  });

  it("prioriza a primeira aplicação pendente pelo horário", () => {
    const model = createDashboardFocusViewModel({
      todayItems: [
        { id: "night", name: "Noturno", time: "20:00", perDay: 1, takenCount: 0 },
        { id: "morning", name: "Matinal", time: "08:00", dose: "250 mcg", ui: 10, perDay: 1, takenCount: 0, nextSite: "Abdômen (Direito)" }
      ]
    });

    expect(model).toMatchObject({
      state: "pending",
      title: "Matinal",
      action: "toggle-dose",
      actionLabel: "Registrar aplicação"
    });
    expect(renderDashboardFocusHTML(model)).toContain("Abdômen (Direito)");
  });

  it("avança para a próxima dose de um protocolo multidose", () => {
    const model = createDashboardFocusViewModel({
      todayItems: [{ id: "multi", name: "Multidose", perDay: 2, takenCount: 1 }]
    });

    expect(model).toMatchObject({ action: "add-dose", actionLabel: "Registrar próxima dose" });
  });

  it("exibe conclusão factual quando toda a rotina do dia foi registrada", () => {
    const model = createDashboardFocusViewModel({
      todayItems: [{ id: "done", name: "Concluído", perDay: 1, takenCount: 1 }],
      upcoming: [{ dateKey: "2026-09-03", time: "08:00", name: "Concluído" }]
    });

    expect(model).toMatchObject({ state: "complete", action: "open-week" });
    expect(model.schedule).toBe("Próxima: 03/09 às 08:00 · Concluído");
  });

  it("localiza a próxima ação para o idioma ativo", () => {
    const model = createDashboardFocusViewModel({
      locale: "en",
      todayItems: [{ id: "item", name: "Morning compound", time: "08:00", perDay: 1, takenCount: 0 }]
    });

    expect(model.eyebrow).toBe("Next action");
    expect(model.schedule).toBe("Scheduled for today at 08:00");
    expect(model.actionLabel).toBe("Record application");
  });
});
