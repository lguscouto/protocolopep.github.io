import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  t,
  resolveNestedKey,
  interpolate,
  normalizeLocale,
  detectDeviceLocale,
  formatDateLocale,
  formatNumberLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALES
} from "../../src/domain/i18n/index.js";
import { I18nService } from "../../src/services/i18n.js";
import { ptBR } from "../../src/domain/i18n/locales/pt-BR.js";
import { en } from "../../src/domain/i18n/locales/en.js";
import { es } from "../../src/domain/i18n/locales/es.js";

describe("Domínio de Internacionalização (i18n)", () => {
  describe("Paridade de Estrutura dos Dicionários", () => {
    function getLeafKeys(obj, prefix = "") {
      let keys = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null) {
          keys = keys.concat(getLeafKeys(value, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    const ptKeys = getLeafKeys(ptBR).sort();
    const enKeys = getLeafKeys(en).sort();
    const esKeys = getLeafKeys(es).sort();

    it("possui o mesmo conjunto de chaves em pt-BR e en", () => {
      expect(enKeys).toEqual(ptKeys);
    });

    it("possui o mesmo conjunto de chaves em pt-BR e es", () => {
      expect(esKeys).toEqual(ptKeys);
    });
  });

  describe("resolveNestedKey", () => {
    it("resolve caminho válido de objeto aninhado", () => {
      const obj = { nav: { dashboard: "Painel" } };
      expect(resolveNestedKey(obj, "nav.dashboard")).toBe("Painel");
    });

    it("retorna null para chaves inexistentes ou parâmetros inválidos", () => {
      expect(resolveNestedKey(null, "nav.dashboard")).toBeNull();
      expect(resolveNestedKey({}, "nav.dashboard")).toBeNull();
      expect(resolveNestedKey({ nav: "string" }, "nav.dashboard")).toBeNull();
      expect(resolveNestedKey({ nav: {} }, "nav.missing")).toBeNull();
    });
  });

  describe("interpolate", () => {
    it("substitui múltiplos parâmetros no texto", () => {
      const template = "Dose de {dose} ({units} UI) para {name}";
      const res = interpolate(template, { dose: "250mcg", units: 10, name: "BPC-157" });
      expect(res).toBe("Dose de 250mcg (10 UI) para BPC-157");
    });

    it("mantém chaves não fornecidas sem estourar erro", () => {
      const template = "Olá {name}, seu saldo é {missing}";
      expect(interpolate(template, { name: "Carlos" })).toBe("Olá Carlos, seu saldo é {missing}");
    });

    it("lida graciosamente com tipos não-string", () => {
      expect(interpolate(null)).toBe("");
      expect(interpolate(123)).toBe("");
      expect(interpolate("Texto puro", null)).toBe("Texto puro");
    });
  });

  describe("t() Função de Tradução Pura", () => {
    it("traduz corretamente em pt-BR, en e es", () => {
      expect(t("common.save", {}, "pt-BR")).toBe("Salvar");
      expect(t("common.save", {}, "en")).toBe("Save");
      expect(t("common.save", {}, "es")).toBe("Guardar");
    });

    it("faz fallback para pt-BR se chave não existir no idioma ativo", () => {
      // Mockando chave ausente em en
      const customLocales = {
        "pt-BR": { test: { greeting: "Olá Mundo" } },
        en: { test: {} },
        es: { test: {} }
      };
      const originalPt = LOCALES["pt-BR"];
      LOCALES["pt-BR"] = customLocales["pt-BR"];
      LOCALES["en"] = customLocales["en"];

      expect(t("test.greeting", {}, "en")).toBe("Olá Mundo");

      // Restaurar
      LOCALES["pt-BR"] = originalPt;
      LOCALES["en"] = en;
    });

    it("faz fallback para a própria chave se ela não existir em lugar algum", () => {
      expect(t("inexistente.chave.xyz", {}, "en")).toBe("inexistente.chave.xyz");
    });

    it("interpola variáveis durante a tradução", () => {
      expect(t("week.dosesCount", { count: 3 }, "pt-BR")).toBe("3 aplicação(ões) programada(s)");
      expect(t("week.dosesCount", { count: 3 }, "en")).toBe("3 scheduled application(s)");
      expect(t("week.dosesCount", { count: 3 }, "es")).toBe("3 aplicación(es) programada(s)");
    });
  });

  describe("normalizeLocale e detectDeviceLocale", () => {
    it("normaliza variações comuns de identificadores de idioma", () => {
      expect(normalizeLocale("pt-BR")).toBe("pt-BR");
      expect(normalizeLocale("pt")).toBe("pt-BR");
      expect(normalizeLocale("PT-PT")).toBe("pt-BR");
      expect(normalizeLocale("en-US")).toBe("en");
      expect(normalizeLocale("en-GB")).toBe("en");
      expect(normalizeLocale("es-ES")).toBe("es");
      expect(normalizeLocale("es-MX")).toBe("es");
      expect(normalizeLocale("fr-FR")).toBe(DEFAULT_LOCALE);
      expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    });

    it("detecta idioma a partir de lista de idiomas do dispositivo", () => {
      expect(detectDeviceLocale(["fr", "en-US", "pt"])).toBe("en");
      expect(detectDeviceLocale(["es-419", "pt"])).toBe("es");
      expect(detectDeviceLocale(["ja", "ko"])).toBe(DEFAULT_LOCALE);
      expect(detectDeviceLocale(null)).toBe(DEFAULT_LOCALE);
    });
  });

  describe("formatDateLocale e formatNumberLocale", () => {
    it("formata datas de forma determinística", () => {
      const date = new Date("2026-08-29T12:00:00Z");
      const resPt = formatDateLocale(date, "pt-BR", { timeZone: "UTC" });
      const resEn = formatDateLocale(date, "en", { timeZone: "UTC" });
      expect(resPt).toBeTruthy();
      expect(resEn).toBeTruthy();
    });

    it("retorna string vazia para datas inválidas", () => {
      expect(formatDateLocale("data_invalida")).toBe("");
    });

    it("formata números respeitando o locale", () => {
      expect(formatNumberLocale(1250.5, "pt-BR")).toContain("1");
      expect(formatNumberLocale(NaN)).toBe("0");
    });
  });
});

describe("I18nService (Serviço de Internacionalização)", () => {
  let mockStorage;

  beforeEach(() => {
    const store = {};
    mockStorage = {
      getItem: vi.fn(k => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      })
    };
  });

  it("inicializa com locale salvo ou padrão", () => {
    mockStorage.setItem("pep_user_language", "en");
    const service = new I18nService(mockStorage);
    expect(service.getLocale()).toBe("en");
  });

  it("permite alterar idioma e persiste no storage", () => {
    const service = new I18nService(mockStorage);
    expect(service.getLocale()).toBe("pt-BR");

    const changed = service.setLocale("es");
    expect(changed).toBe(true);
    expect(service.getLocale()).toBe("es");
    expect(mockStorage.setItem).toHaveBeenCalledWith("pep_user_language", "es");
  });

  it("notifica observadores inscritos na mudança de idioma", () => {
    const service = new I18nService(mockStorage);
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    service.setLocale("en");
    expect(listener).toHaveBeenCalledWith("en");

    unsubscribe();
    service.setLocale("pt-BR");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("traduz e formata delegando para o domínio", () => {
    const service = new I18nService(mockStorage);
    service.setLocale("en");

    expect(service.t("common.save")).toBe("Save");
    expect(service.getSupportedLocales()).toEqual(SUPPORTED_LOCALES);
    expect(service.getLocaleLabel("en")).toBe("English");
  });
});
