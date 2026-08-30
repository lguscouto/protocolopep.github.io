import { describe, expect, it } from "vitest";
import { createDoseCardViewModel, renderEmptyDashboardHTML } from "../../src/ui/dashboard.js";

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
});
