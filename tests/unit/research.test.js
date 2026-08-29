import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  searchCompounds,
  filterByCategory,
  getCompoundById,
  getCategories,
  formatCitation,
  normalizeSearchTerm
} from "../../src/domain/research/index.js";
import { RESEARCH_DATABASE } from "../../src/domain/research/database.js";
import { ResearchService } from "../../src/services/research.js";

describe("Research Domain & Logic (V17)", () => {
  it("contém uma base de dados estruturada com compostos e referências", () => {
    expect(RESEARCH_DATABASE.length).toBeGreaterThanOrEqual(10);
    RESEARCH_DATABASE.forEach((c) => {
      expect(c.id).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.category).toBeDefined();
      expect(c.halfLifeLiterature).toBeDefined();
      expect(c.literatureSummary).toBeDefined();
      expect(Array.isArray(c.references)).toBe(true);
      expect(c.references.length).toBeGreaterThan(0);
    });
  });

  it("normaliza termos de busca removendo acentos e maiúsculas", () => {
    expect(normalizeSearchTerm("Péptido")).toBe("peptido");
    expect(normalizeSearchTerm("  SEMÁGLUTIDA  ")).toBe("semaglutida");
    expect(normalizeSearchTerm(null)).toBe("");
    expect(normalizeSearchTerm(123)).toBe("");
  });

  it("busca compostos por nome exato e parcial", () => {
    const results = searchCompounds(RESEARCH_DATABASE, "bpc");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("BPC-157");

    const sema = searchCompounds(RESEARCH_DATABASE, "semaglut");
    expect(sema.length).toBe(1);
    expect(sema[0].id).toBe("semaglutide");
  });

  it("busca compostos por sinônimos e nomes comerciais conhecidos", () => {
    const bySynonym1 = searchCompounds(RESEARCH_DATABASE, "PL-10");
    expect(bySynonym1.some((c) => c.id === "bpc-157")).toBe(true);

    const bySynonym2 = searchCompounds(RESEARCH_DATABASE, "Ozempic");
    expect(bySynonym2.some((c) => c.id === "semaglutide")).toBe(true);

    const bySynonym3 = searchCompounds(RESEARCH_DATABASE, "Mounjaro");
    expect(bySynonym3.some((c) => c.id === "tirzepatide")).toBe(true);

    const bySynonym4 = searchCompounds(RESEARCH_DATABASE, "Epitalon");
    expect(bySynonym4.some((c) => c.id === "epithalon")).toBe(true);
  });

  it("retorna toda a base se a busca estiver vazia ou nula", () => {
    expect(searchCompounds(RESEARCH_DATABASE, "").length).toBe(RESEARCH_DATABASE.length);
    expect(searchCompounds(RESEARCH_DATABASE, "   ").length).toBe(RESEARCH_DATABASE.length);
    expect(searchCompounds(null, "bpc")).toEqual([]);
  });

  it("filtra compostos por categoria", () => {
    const tissue = filterByCategory(RESEARCH_DATABASE, "tissue-repair");
    expect(tissue.length).toBeGreaterThanOrEqual(2);
    expect(tissue.every((c) => c.category === "tissue-repair")).toBe(true);

    const all = filterByCategory(RESEARCH_DATABASE, "all");
    expect(all.length).toBe(RESEARCH_DATABASE.length);

    expect(filterByCategory(null, "all")).toEqual([]);
  });

  it("busca composto por ID canônico", () => {
    const comp = getCompoundById(RESEARCH_DATABASE, "bpc-157");
    expect(comp).not.toBeNull();
    expect(comp.name).toBe("BPC-157");

    const notFound = getCompoundById(RESEARCH_DATABASE, "inexistente");
    expect(notFound).toBeNull();
  });

  it("extrai categorias únicas com contagem", () => {
    const categories = getCategories(RESEARCH_DATABASE);
    expect(categories.length).toBeGreaterThan(0);
    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);
    expect(totalCount).toBe(RESEARCH_DATABASE.length);
  });

  it("formata citação bibliográfica corretamente", () => {
    const ref = {
      authors: "Sikiric P, et al.",
      title: "Stable gastric pentadecapeptide BPC 157",
      journal: "Curr Pharm Des",
      year: 2011,
      pmid: "21548867"
    };
    const formatted = formatCitation(ref);
    expect(formatted).toContain("Sikiric P, et al.");
    expect(formatted).toContain('"Stable gastric pentadecapeptide BPC 157"');
    expect(formatted).toContain("Curr Pharm Des");
    expect(formatted).toContain("(2011)");
    expect(formatted).toContain("PMID: 21548867");

    expect(formatCitation(null)).toBe("");
  });
});

describe("Research Service (V17)", () => {
  let mockStorage;
  let service;

  beforeEach(() => {
    const store = {};
    mockStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => {
        store[key] = String(val);
      }),
      removeItem: vi.fn((key) => {
        delete store[key];
      })
    };
    service = new ResearchService(mockStorage, RESEARCH_DATABASE);
  });

  it("busca combinando termo e categoria", () => {
    const results = service.search("bpc", "tissue-repair");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("bpc-157");

    const noMatch = service.search("bpc", "glp1-incretin");
    expect(noMatch.length).toBe(0);
  });

  it("gerencia favoritos com alternância e persistência", () => {
    expect(service.getFavorites()).toEqual([]);
    expect(service.isFavorite("bpc-157")).toBe(false);

    const isFavNow = service.toggleFavorite("bpc-157");
    expect(isFavNow).toBe(true);
    expect(service.isFavorite("bpc-157")).toBe(true);
    expect(service.getFavorites()).toEqual(["bpc-157"]);

    const removed = service.toggleFavorite("bpc-157");
    expect(removed).toBe(false);
    expect(service.isFavorite("bpc-157")).toBe(false);
    expect(service.getFavorites()).toEqual([]);
  });

  it("gerencia buscas recentes sem duplicatas e com limite", () => {
    expect(service.getRecentQueries()).toEqual([]);

    service.addRecentQuery("bpc 157");
    service.addRecentQuery("semaglutida");
    service.addRecentQuery("bpc 157"); // Re-adicionar move para o topo

    const recents = service.getRecentQueries();
    expect(recents[0]).toBe("bpc 157");
    expect(recents[1]).toBe("semaglutida");
    expect(recents.length).toBe(2);

    service.clearRecentQueries();
    expect(service.getRecentQueries()).toEqual([]);
  });

  it("opera com resiliência se o storage falhar", () => {
    mockStorage.getItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    mockStorage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(service.getFavorites()).toEqual([]);
    expect(() => service.toggleFavorite("bpc-157")).not.toThrow();
    expect(service.getRecentQueries()).toEqual([]);
    expect(() => service.addRecentQuery("test")).not.toThrow();
  });
});
