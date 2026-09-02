import { describe, expect, it } from "vitest";
import {
  createInjectionSitePickerModel,
  getVisualSitePlacement
} from "../../src/ui/injection-site-picker.js";

describe("Seletor visual de locais de aplicação", () => {
  it("mapeia os lados anatômicos do abdômen para pontos visuais estáveis", () => {
    expect(getVisualSitePlacement("Abdômen (Direito)")).toBe("abdomen-right");
    expect(getVisualSitePlacement("Abdômen (Esquerdo)")).toBe("abdomen-left");
    expect(getVisualSitePlacement("Coxa (Direita)")).toBeNull();
  });

  it("mantém locais customizados disponíveis como alternativas textuais", () => {
    const model = createInjectionSitePickerModel([
      "Abdômen (Direito)",
      "Coxa (Direita)",
      "Local personalizado"
    ]);

    expect(model[0].placement).toBe("abdomen-right");
    expect(model[1].placement).toBeNull();
    expect(model[2]).toMatchObject({ label: "Local personalizado", placement: null });
  });

  it("distingue seleção, próximo da rotação e último registro", () => {
    const model = createInjectionSitePickerModel(
      ["Abdômen (Direito)", "Abdômen (Esquerdo)", "Coxa (Direita)"],
      {
        selectedSite: "Abdômen (Esquerdo)",
        nextSite: "Abdômen (Esquerdo)",
        lastSite: "Abdômen (Direito)"
      }
    );

    expect(model[0]).toMatchObject({ selected: false, next: false, last: true });
    expect(model[1]).toMatchObject({ selected: true, next: true, last: false });
  });
});
