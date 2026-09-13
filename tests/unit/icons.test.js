import { describe, expect, it } from "vitest";
import { ICON_NAMES, renderIcon } from "../../src/ui/icons.js";

describe("ícones locais", () => {
  it("expõe somente nomes conhecidos e markup SVG confiável", () => {
    expect(ICON_NAMES).toEqual(["note", "warning"]);
    expect(renderIcon("note")).toContain("<svg");
    expect(renderIcon("unknown")).toBe("");
    expect(renderIcon("note", { label: "Nota" })).toContain('aria-label="Nota"');
  });
});

