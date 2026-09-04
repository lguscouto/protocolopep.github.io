import { describe, expect, it } from "vitest";
import {
  createInjectionSitePickerModel,
  getVisualSitePlacement
} from "../../src/ui/injection-site-picker.js";

describe("Seletor visual de locais de aplicação", () => {
  it("mapeia quadrantes do abdômen e flancos para pontos visuais estáveis", () => {
    expect(getVisualSitePlacement("Abdômen (Superior Direito)")).toBe("abdomen-upper-right");
    expect(getVisualSitePlacement("Abdômen (Superior Esquerdo)")).toBe("abdomen-upper-left");
    expect(getVisualSitePlacement("Abdômen (Inferior Direito)")).toBe("abdomen-lower-right");
    expect(getVisualSitePlacement("Abdômen (Inferior Esquerdo)")).toBe("abdomen-lower-left");
    expect(getVisualSitePlacement("Flanco (Direito)")).toBe("flank-right");
    expect(getVisualSitePlacement("Flanco (Esquerdo)")).toBe("flank-left");
    expect(getVisualSitePlacement("Abdômen (Direito)")).toBe("abdomen-right");
    expect(getVisualSitePlacement("Abdomen (Esquerdo)")).toBe("abdomen-left");
    expect(getVisualSitePlacement("Coxa (Direita)")).toBeNull();
  });

  it("mantém locais customizados disponíveis como alternativas textuais", () => {
    const model = createInjectionSitePickerModel([
      "Abdômen (Superior Direito)",
      "Coxa (Direita)",
      "Local personalizado"
    ]);

    expect(model[0].placement).toBe("abdomen-upper-right");
    expect(model[1].placement).toBeNull();
    expect(model[2]).toMatchObject({ label: "Local personalizado", placement: null });
  });

  it("evita sobrepor pontos legados quando a lista também possui quadrantes novos", () => {
    const model = createInjectionSitePickerModel([
      "Abdômen (Superior Direito)",
      "Abdômen (Direito)",
      "Abdômen (Esquerdo)"
    ]);

    expect(model[0].placement).toBe("abdomen-upper-right");
    expect(model[1].placement).toBeNull();
    expect(model[2].placement).toBe("abdomen-left");
  });

  it("distingue seleção, próximo da rotação e último registro", () => {
    const model = createInjectionSitePickerModel(
      ["Abdômen (Superior Direito)", "Abdômen (Superior Esquerdo)", "Coxa (Direita)"],
      {
        selectedSite: "Abdômen (Superior Esquerdo)",
        nextSite: "Abdômen (Superior Esquerdo)",
        lastSite: "Abdômen (Superior Direito)"
      }
    );

    expect(model[0]).toMatchObject({ selected: false, next: false, last: true });
    expect(model[1]).toMatchObject({ selected: true, next: true, last: false });
  });
});
