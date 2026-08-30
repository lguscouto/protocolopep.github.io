/**
 * Protocolo PEP — Serviço de Acessibilidade Contínua (WCAG 2.1 AA)
 * Gerencia Focus Trap, Anunciador de Tela (aria-live), Alto Contraste e Redução de Movimento.
 */

const STORAGE_KEY_HIGH_CONTRAST = "pep_high_contrast";
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class AccessibilityService {
  constructor({ storage = null, announcerEl = null } = {}) {
    this.storage = storage || (typeof window !== "undefined" ? window.localStorage : null);
    this.announcerEl = announcerEl || (typeof document !== "undefined" ? document.getElementById("a11y-announcer") : null);
    this.previousFocusedElement = null;
    this.activeTrapCleanup = null;
  }

  /**
   * Obtém status do Modo de Alto Contraste
   * @returns {boolean}
   */
  getHighContrast() {
    if (!this.storage) return false;
    try {
      return this.storage.getItem(STORAGE_KEY_HIGH_CONTRAST) === "true";
    } catch {
      return false;
    }
  }

  /**
   * Define status do Modo de Alto Contraste
   * @param {boolean} enabled
   * @returns {boolean}
   */
  setHighContrast(enabled) {
    const val = Boolean(enabled);
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_HIGH_CONTRAST, String(val));
      } catch (err) {
        console.warn("[AccessibilityService] Falha ao persistir alto contraste:", err);
      }
    }
    this.applyHighContrastToDOM(val);
    return val;
  }

  /**
   * Alterna o status do Modo de Alto Contraste
   * @returns {boolean}
   */
  toggleHighContrast() {
    const next = !this.getHighContrast();
    return this.setHighContrast(next);
  }

  /**
   * Aplica a classe CSS de alto contraste ao elemento raiz
   * @param {boolean} enabled
   */
  applyHighContrastToDOM(enabled) {
    if (typeof document === "undefined" || !document.documentElement) return;
    if (enabled) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
  }

  /**
   * Verifica se o sistema operacional prefere redução de movimento
   * @returns {boolean}
   */
  prefersReducedMotion() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  /**
   * Emite anúncio dinâmico para leitores de tela via aria-live
   * @param {string} message
   * @param {'polite' | 'assertive'} priority
   */
  announce(message, priority = "polite") {
    if (!message) return;
    const announcer = this.announcerEl || (typeof document !== "undefined" ? document.getElementById("a11y-announcer") : null);
    if (!announcer) return;

    announcer.setAttribute("aria-live", priority === "assertive" ? "assertive" : "polite");
    
    // Limpa e atualiza em microtask para forçar leitura pelo TalkBack/Screen Reader
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = String(message).trim();
    }, 50);
  }

  /**
   * Prende o foco de navegação por teclado (Tab / Shift+Tab) dentro de um elemento modal
   * @param {HTMLElement} element
   * @returns {() => void} Função para remover o trap
   */
  trapFocus(element) {
    if (!element || typeof element.querySelectorAll !== "function") {
      return () => {};
    }

    if (this.activeTrapCleanup) {
      this.activeTrapCleanup();
    }

    if (typeof document !== "undefined" && document.activeElement) {
      this.previousFocusedElement = document.activeElement;
    }

    const focusableElements = Array.from(element.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const currentFocusables = Array.from(element.querySelectorAll(FOCUSABLE_SELECTOR));
      if (currentFocusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = currentFocusables[0];
      const lastEl = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    element.addEventListener("keydown", handleKeyDown);

    const cleanup = () => {
      element.removeEventListener("keydown", handleKeyDown);
      this.activeTrapCleanup = null;
    };

    this.activeTrapCleanup = cleanup;
    return cleanup;
  }

  /**
   * Restaura o foco para o elemento previamente ativo antes da abertura do modal
   */
  restoreFocus() {
    if (this.activeTrapCleanup) {
      this.activeTrapCleanup();
    }
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === "function") {
      try {
        this.previousFocusedElement.focus();
      } catch {
        // Ignora caso elemento tenha sido removido do DOM
      }
      this.previousFocusedElement = null;
    }
  }
}
