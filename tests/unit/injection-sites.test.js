import { describe, it, expect } from "vitest";
import {
  DEFAULT_INJECTION_SITES,
  LEGACY_DEFAULT_INJECTION_SITES,
  getDefaultSites,
  migrateLegacyDefaultSites,
  formatSiteLabel,
  validateSitesList,
  getNextSite,
  getLastUsedSite
} from "../../src/domain/injection-sites.js";

describe("Módulo de Domínio: Rotação de Sítios de Aplicação (V11)", () => {
  it("deve fornecer a lista padrão de sítios de aplicação", () => {
    const defaults = getDefaultSites();
    expect(Array.isArray(defaults)).toBe(true);
    expect(defaults.length).toBe(10);
    expect(defaults.slice(0, 6)).toEqual([
      "Abdômen (Superior Direito)",
      "Abdômen (Superior Esquerdo)",
      "Abdômen (Inferior Direito)",
      "Abdômen (Inferior Esquerdo)",
      "Flanco (Direito)",
      "Flanco (Esquerdo)"
    ]);
    expect(defaults).toEqual(DEFAULT_INJECTION_SITES);
  });

  it("migra apenas a lista padrão legada e preserva configurações personalizadas", () => {
    expect(migrateLegacyDefaultSites(LEGACY_DEFAULT_INJECTION_SITES)).toEqual(DEFAULT_INJECTION_SITES);
    expect(migrateLegacyDefaultSites(DEFAULT_INJECTION_SITES)).toEqual(DEFAULT_INJECTION_SITES);

    const custom = ["Abdômen (Direito)", "Local personalizado"];
    expect(migrateLegacyDefaultSites(custom)).toEqual(custom);
  });

  it("deve sanitizar e limitar nomes de sítios com formatSiteLabel", () => {
    expect(formatSiteLabel("  Abdômen Direito  ")).toBe("Abdômen Direito");
    expect(formatSiteLabel("")).toBe("");
    expect(formatSiteLabel(null)).toBe("");
    expect(formatSiteLabel(undefined)).toBe("");
    expect(formatSiteLabel(123)).toBe("");

    const longName = "A".repeat(100);
    expect(formatSiteLabel(longName).length).toBe(50);
  });

  it("deve validar e limpar listas de sítios com validateSitesList", () => {
    const validRes = validateSitesList(["Abdômen", "Coxa", "Braço"]);
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toHaveLength(0);
    expect(validRes.sites).toEqual(["Abdômen", "Coxa", "Braço"]);

    const nonArrayRes = validateSitesList("não array");
    expect(nonArrayRes.valid).toBe(false);

    const dupRes = validateSitesList(["Abdômen", "coxa", "abdômen"]);
    expect(dupRes.valid).toBe(false);
    expect(dupRes.errors.length).toBeGreaterThan(0);

    const blankRes = validateSitesList(["Abdômen", "  ", "Coxa"]);
    expect(blankRes.valid).toBe(false);
    expect(blankRes.sites).toEqual(["Abdômen", "Coxa"]);
  });

  it("deve calcular o próximo sítio circularmente com getNextSite", () => {
    const sites = ["Sítio A", "Sítio B", "Sítio C"];

    // Sem último sítio registrado -> primeiro
    expect(getNextSite(sites, null)).toBe("Sítio A");
    expect(getNextSite(sites, "")).toBe("Sítio A");

    // Do primeiro para o segundo
    expect(getNextSite(sites, "Sítio A")).toBe("Sítio B");
    expect(getNextSite(sites, "sítio a")).toBe("Sítio B"); // Case-insensitive

    // Do segundo para o terceiro
    expect(getNextSite(sites, "Sítio B")).toBe("Sítio C");

    // Do último para o primeiro (rotação circular completa)
    expect(getNextSite(sites, "Sítio C")).toBe("Sítio A");

    // Sítio removido ou não pertencente à lista -> recomeça do primeiro
    expect(getNextSite(sites, "Sítio X Inexistente")).toBe("Sítio A");
    expect(getNextSite(getDefaultSites(), "Abdômen (Direito)")).toBe(getDefaultSites()[0]);

    // Lista vazia -> null
    expect(getNextSite([], "Sítio A")).toBeNull();
    expect(getNextSite(null, "Sítio A")).toBeNull();
  });

  it("deve encontrar o último sítio registrado nos logs com getLastUsedSite", () => {
    const logs = {
      "2026-08-27": {
        "pep_1": [{ site: "Abdômen (Direito)", time: "08:00" }]
      },
      "2026-08-28": {
        "pep_1": [{ site: "Abdômen (Esquerdo)", time: "08:15" }]
      },
      "2026-08-29": {
        "pep_1": [{ site: "Coxa (Direita)", time: "09:00" }],
        "pep_2": [{ site: "Deltoide (Direito)", time: "09:30" }]
      }
    };

    // Último geral
    const lastGeneral = getLastUsedSite(logs);
    expect(lastGeneral).not.toBeNull();
    expect(["Coxa (Direita)", "Deltoide (Direito)"]).toContain(lastGeneral.site);

    // Filtrado por peptídeo pep_1
    const lastPep1 = getLastUsedSite(logs, "pep_1");
    expect(lastPep1).toEqual({
      site: "Coxa (Direita)",
      date: "2026-08-29",
      time: "09:00"
    });

    // Logs vazios
    expect(getLastUsedSite({})).toBeNull();
    expect(getLastUsedSite(null)).toBeNull();

    // Logs sem campo site
    const logsNoSite = {
      "2026-08-29": {
        "pep_1": [{ time: "08:00" }]
      }
    };
    expect(getLastUsedSite(logsNoSite)).toBeNull();
  });
});
