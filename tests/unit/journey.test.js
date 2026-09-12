import { describe, expect, it } from "vitest";
import { normalizeTabTarget } from "../../src/ui/journey.js";

describe("aliases da Jornada", () => {
  it("preserva atalhos antigos", () => {
    expect(normalizeTabTarget("week")).toEqual({ tab: "journey", segment: "upcoming" });
    expect(normalizeTabTarget("history")).toEqual({ tab: "journey", segment: "history" });
  });

  it("mantém o segmento atual ao abrir Jornada", () => {
    expect(normalizeTabTarget("journey", "history")).toEqual({ tab: "journey", segment: "history" });
  });
});
