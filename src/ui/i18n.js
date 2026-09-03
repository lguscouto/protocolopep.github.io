/**
 * UI Controller: Internacionalização (i18n) — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Manipulação segura do DOM: Prevenção contra XSS em interpolações.
 * - Atualização reativa de elementos anotados com data-i18n.
 * - Haptics e feedback acessível na troca de idioma.
 */

import { haptics } from "../services/haptics.js";

/**
 * Aplica traduções a todos os elementos anotados na árvore do DOM
 * @param {HTMLElement|Document} [root=document] 
 * @param {import('../services/i18n.js').I18nService} i18n 
 */
export function applyTranslations(root = document, i18n) {
  if (!root || !i18n) return;

  // 1. Textos puros (textContent)
  const textElements = root.querySelectorAll("[data-i18n]");
  textElements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = i18n.t(key);
    }
  });

  // 2. Textos formatados com tags inline seguras (b, br, span)
  const htmlElements = root.querySelectorAll("[data-i18n-html]");
  htmlElements.forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (key) {
      el.innerHTML = i18n.t(key);
    }
  });

  // 3. Placeholders de input
  const placeholderElements = root.querySelectorAll("[data-i18n-placeholder]");
  placeholderElements.forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", i18n.t(key));
    }
  });

  // 4. Atributos title
  const titleElements = root.querySelectorAll("[data-i18n-title]");
  titleElements.forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.setAttribute("title", i18n.t(key));
    }
  });

  // 5. Atributos aria-label para acessibilidade
  const ariaElements = root.querySelectorAll("[data-i18n-aria]");
  ariaElements.forEach(el => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) {
      el.setAttribute("aria-label", i18n.t(key));
    }
  });

  // Atualizar atributo lang na tag <html>
  if (document.documentElement) {
    document.documentElement.setAttribute("lang", i18n.getLocale());
  }
}

/**
 * Configura o painel seletor de idiomas na aba Ajustes
 * @param {Object} options
 * @param {import('../services/i18n.js').I18nService} options.i18nService
 * @param {Function} [options.onLocaleChange]
 */
export function setupI18nUI({ i18nService, onLocaleChange = () => {} }) {
  const langButtons = document.querySelectorAll(".lang-select-btn");
  const currentLangBadge = document.getElementById("current-lang-badge");

  function updateActiveLangUI(locale) {
    if (langButtons) {
      langButtons.forEach(btn => {
        const btnLang = btn.getAttribute("data-lang");
        const isActive = btnLang === locale;
        if (isActive) {
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
        } else {
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        }
      });
    }

    if (currentLangBadge) {
      currentLangBadge.textContent = i18nService.getLocaleLabel(locale).toUpperCase();
    }
  }

  // Inicializar estado dos botões
  updateActiveLangUI(i18nService.getLocale());

  // Registrar listeners de clique nos seletores
  const btnPt = document.getElementById("lang-btn-pt");
  const btnEn = document.getElementById("lang-btn-en");
  const btnEs = document.getElementById("lang-btn-es");

  if (btnPt) {
    btnPt.addEventListener("click", (e) => {
      e.stopPropagation();
      haptics.selection();
      i18nService.setLocale("pt-BR");
    });
  }

  if (btnEn) {
    btnEn.addEventListener("click", (e) => {
      e.stopPropagation();
      haptics.selection();
      i18nService.setLocale("en");
    });
  }

  if (btnEs) {
    btnEs.addEventListener("click", (e) => {
      e.stopPropagation();
      haptics.selection();
      i18nService.setLocale("es");
    });
  }

  // Escutar mudanças no serviço
  i18nService.subscribe(newLocale => {
    updateActiveLangUI(newLocale);
    applyTranslations(document, i18nService);
    onLocaleChange(newLocale);
  });

  return {
    updateActiveLangUI,
    applyTranslations: (root = document) => applyTranslations(root, i18nService)
  };
}
