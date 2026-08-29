/**
 * Domínio de Internacionalização (i18n) — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Lógica Pura: Sem dependência do DOM ou APIs impuras.
 * - Local-First & Offline First: Dicionários estáticos embutidos sem rede.
 * - Resiliência e Fail-Closed: Fallback transparente para o locale padrão (pt-BR) e para a chave original.
 * - Segurança: Interpolação de parâmetros sem eval ou risco de injeção.
 */

import { ptBR } from "./locales/pt-BR.js";
import { en } from "./locales/en.js";
import { es } from "./locales/es.js";

export const SUPPORTED_LOCALES = ["pt-BR", "en", "es"];
export const DEFAULT_LOCALE = "pt-BR";

export const LOCALE_LABELS = {
  "pt-BR": "Português (Brasil)",
  en: "English",
  es: "Español"
};

export const LOCALES = {
  "pt-BR": ptBR,
  en: en,
  es: es
};

/**
 * Resolução pura de chave aninhada em um objeto (ex: "common.save" -> obj.common.save)
 * @param {Object} obj 
 * @param {string} keyPath 
 * @returns {string|null}
 */
export function resolveNestedKey(obj, keyPath) {
  if (!obj || typeof obj !== "object" || !keyPath || typeof keyPath !== "string") {
    return null;
  }

  const parts = keyPath.split(".");
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return typeof current === "string" ? current : null;
}

/**
 * Interpolação segura de parâmetros em template string (ex: "Olá {name}" com { name: "Maria" })
 * @param {string} template 
 * @param {Object} params 
 * @returns {string}
 */
export function interpolate(template, params = {}) {
  if (typeof template !== "string") return "";
  if (!params || typeof params !== "object") return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in params) {
      const val = params[key];
      return val !== null && val !== undefined ? String(val) : "";
    }
    return match;
  });
}

/**
 * Função de tradução pura
 * @param {string} key - Chave no formato "categoria.subchave" (ex: "common.save")
 * @param {Object} [params] - Variáveis para interpolação
 * @param {string} [locale=DEFAULT_LOCALE] - Código do idioma ("pt-BR", "en", "es")
 * @returns {string} Texto traduzido com fallback para pt-BR e depois para a própria chave
 */
export function t(key, params = {}, locale = DEFAULT_LOCALE) {
  if (!key || typeof key !== "string") return "";

  const activeLocale = normalizeLocale(locale);
  const dict = LOCALES[activeLocale] || LOCALES[DEFAULT_LOCALE];

  // 1. Tentar resolver no idioma solicitado
  let translation = resolveNestedKey(dict, key);

  // 2. Fallback para pt-BR se não encontrado no idioma solicitado
  if (translation === null && activeLocale !== DEFAULT_LOCALE) {
    translation = resolveNestedKey(LOCALES[DEFAULT_LOCALE], key);
  }

  // 3. Fallback para a chave se não existir em nenhum dicionário
  if (translation === null) {
    return key;
  }

  // 4. Interpolação de variáveis
  return interpolate(translation, params);
}

/**
 * Normaliza uma string de locale para um dos suportados
 * @param {string} rawLocale 
 * @param {string|null} [fallback=DEFAULT_LOCALE]
 * @returns {string|null} "pt-BR", "en", "es" ou fallback
 */
export function normalizeLocale(rawLocale, fallback = DEFAULT_LOCALE) {
  if (!rawLocale || typeof rawLocale !== "string") return fallback;

  const lower = rawLocale.toLowerCase().trim();

  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("es")) return "es";

  return fallback;
}

/**
 * Detecta o melhor idioma suportado a partir da lista de idiomas do dispositivo
 * @param {string[]|string} languages - Lista como navigator.languages ou navigator.language
 * @returns {string} Locale normalizado suportado
 */
export function detectDeviceLocale(languages) {
  if (!languages) return DEFAULT_LOCALE;

  const list = Array.isArray(languages) ? languages : [languages];

  for (const lang of list) {
    if (typeof lang === "string") {
      const norm = normalizeLocale(lang, null);
      if (norm && SUPPORTED_LOCALES.includes(norm)) {
        return norm;
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Retorna o rótulo legível do locale
 * @param {string} locale 
 * @returns {string}
 */
export function getLocaleLabel(locale) {
  const norm = normalizeLocale(locale);
  return LOCALE_LABELS[norm] || LOCALE_LABELS[DEFAULT_LOCALE];
}

/**
 * Formatação pura de data de acordo com o locale
 * @param {Date|string|number} date 
 * @param {string} [locale=DEFAULT_LOCALE] 
 * @param {Intl.DateTimeFormatOptions} [options] 
 * @returns {string}
 */
export function formatDateLocale(date, locale = DEFAULT_LOCALE, options = {}) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const norm = normalizeLocale(locale);
    return new Intl.DateTimeFormat(norm, options).format(d);
  } catch {
    return "";
  }
}

/**
 * Formatação pura de número de acordo com o locale
 * @param {number} number 
 * @param {string} [locale=DEFAULT_LOCALE] 
 * @param {Intl.NumberFormatOptions} [options] 
 * @returns {string}
 */
export function formatNumberLocale(number, locale = DEFAULT_LOCALE, options = {}) {
  try {
    if (typeof number !== "number" || isNaN(number)) return "0";
    const norm = normalizeLocale(locale);
    return new Intl.NumberFormat(norm, options).format(number);
  } catch {
    return String(number);
  }
}
