/**
 * Serviço de Internacionalização (i18n) — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First: Persistência local transparente no storage do dispositivo.
 * - Resiliência e Fail-Closed: Inicialização segura com fallback automático.
 */

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  detectDeviceLocale,
  t as domainTranslate,
  formatDateLocale,
  formatNumberLocale,
  getLocaleLabel
} from "../domain/i18n/index.js";

const LOCALE_STORAGE_KEY = "pep_user_language";

export class I18nService {
  /**
   * @param {Object} [storage=localStorage] - Mecanismo de persistência compatível com Storage API
   */
  constructor(storage = typeof localStorage !== "undefined" ? localStorage : null) {
    this.storage = storage;
    this.listeners = new Set();
    this.currentLocale = this.loadLocale();
  }

  /**
   * Carrega o locale inicial (persistência ou detecção do sistema)
   * @returns {string}
   */
  loadLocale() {
    try {
      if (this.storage) {
        const saved = this.storage.getItem(LOCALE_STORAGE_KEY);
        if (saved && typeof saved === "string") {
          return normalizeLocale(saved);
        }
      }
    } catch (e) {
      console.warn("[i18n] Falha ao ler preferência de idioma:", e);
    }

    // Detecção pelo sistema do dispositivo
    try {
      if (typeof navigator !== "undefined" && navigator.languages) {
        return detectDeviceLocale(navigator.languages);
      }
    } catch {
      // Fallback para padrão
    }

    return DEFAULT_LOCALE;
  }

  /**
   * Obtém o código do idioma ativo
   * @returns {string}
   */
  getLocale() {
    return this.currentLocale;
  }

  /**
   * Retorna os idiomas suportados
   * @returns {string[]}
   */
  getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Retorna o nome legível de um locale
   * @param {string} [locale]
   * @returns {string}
   */
  getLocaleLabel(locale = this.currentLocale) {
    return getLocaleLabel(locale);
  }

  /**
   * Define e persiste um novo idioma
   * @param {string} newLocale 
   * @returns {boolean}
   */
  setLocale(newLocale) {
    const normalized = normalizeLocale(newLocale);
    if (this.currentLocale === normalized) {
      return false;
    }

    this.currentLocale = normalized;

    try {
      if (this.storage) {
        this.storage.setItem(LOCALE_STORAGE_KEY, normalized);
      }
    } catch (e) {
      console.warn("[i18n] Falha ao persistir preferência de idioma:", e);
    }

    // Notificar observadores
    this.notifyListeners();
    return true;
  }

  /**
   * Traduz uma chave usando o locale atual
   * @param {string} key 
   * @param {Object} [params] 
   * @returns {string}
   */
  t(key, params = {}) {
    return domainTranslate(key, params, this.currentLocale);
  }

  /**
   * Formata data de acordo com o idioma ativo
   * @param {Date|string|number} date 
   * @param {Intl.DateTimeFormatOptions} [options] 
   * @returns {string}
   */
  formatDate(date, options = {}) {
    return formatDateLocale(date, this.currentLocale, options);
  }

  /**
   * Formata número de acordo com o idioma ativo
   * @param {number} number 
   * @param {Intl.NumberFormatOptions} [options] 
   * @returns {string}
   */
  formatNumber(number, options = {}) {
    return formatNumberLocale(number, this.currentLocale, options);
  }

  /**
   * Inscreve um callback para mudanças de idioma
   * @param {Function} callback 
   * @returns {Function} Função de unsubscribe
   */
  subscribe(callback) {
    if (typeof callback === "function") {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }
    return () => {};
  }

  /**
   * Notifica todos os listeners registrados
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentLocale);
      } catch (e) {
        console.error("[i18n] Erro no listener de mudança de idioma:", e);
      }
    }
  }
}

export const i18nService = new I18nService();
