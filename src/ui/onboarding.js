/**
 * Componente de Onboarding e Termo de Não Prescrição (V01)
 * Apresenta a proposta Local-First, privacidade e termos de responsabilidade pessoal.
 */

import { haptics } from "../services/haptics.js";
import { escapeHtml } from "./dom.js";
import { i18nService } from "../services/i18n.js";

export const ONBOARDING_VERSION = "1";
export const ONBOARDING_KEY = "pep_onboarding_version";

export const ONBOARDING_SLIDES = Object.freeze([
  Object.freeze({
    image: "/assets/illustrations/onboarding-welcome.png",
    imageAlt: "Ilustração amigável de organização e acompanhamento pessoal",
    title: "Bem-vindo ao PEP",
    subtitle: "Seu diário de aplicações",
    content: "Registre cada aplicação em poucos toques, receba um lembrete no dia certo e saiba onde você aplicou por último."
  }),
  Object.freeze({
    image: "/assets/illustrations/onboarding-private.png",
    imageAlt: "Celular protegido por um escudo e cadeado",
    title: "Seus dados ficam com você",
    subtitle: "Privacidade sem complicação",
    content: "O PEP funciona no seu aparelho, sem conta e sem depender da internet. Você pode salvar uma cópia dos seus registros quando quiser."
  }),
  Object.freeze({
    image: "/assets/illustrations/onboarding-responsible.png",
    imageAlt: "Calculadora, registro pessoal e balança representando uso responsável",
    title: "Um registro para sua rotina",
    subtitle: "Organização pessoal, sem prescrições",
    content: "O PEP registra o que você informa e não indica tratamentos ou doses. Confirme sua rotina e a segurança das aplicações com seu profissional de saúde."
  })
]);

export function getOnboardingSlides(i18n = i18nService) {
  return [
    {
      image: "/assets/illustrations/onboarding-welcome.png",
      imageAlt: i18n?.t("onboarding.slide1Alt") || "Ilustração amigável de organização e acompanhamento pessoal",
      title: i18n?.t("onboarding.slide1Title") || "Bem-vindo ao PEP",
      subtitle: i18n?.t("onboarding.slide1Subtitle") || "Seu diário de aplicações",
      content: i18n?.t("onboarding.slide1Content") || "Registre cada aplicação em poucos toques, receba um lembrete no dia certo e saiba onde você aplicou por último."
    },
    {
      image: "/assets/illustrations/onboarding-private.png",
      imageAlt: i18n?.t("onboarding.slide2Alt") || "Celular protegido por um escudo e cadeado",
      title: i18n?.t("onboarding.slide2Title") || "Seus dados ficam com você",
      subtitle: i18n?.t("onboarding.slide2Subtitle") || "Privacidade sem complicação",
      content: i18n?.t("onboarding.slide2Content") || "O PEP funciona no seu aparelho, sem conta e sem depender da internet. Você pode salvar uma cópia dos seus registros quando quiser."
    },
    {
      image: "/assets/illustrations/onboarding-responsible.png",
      imageAlt: i18n?.t("onboarding.slide3Alt") || "Calculadora, registro pessoal e balança representando uso responsável",
      title: i18n?.t("onboarding.slide3Title") || "Um registro para sua rotina",
      subtitle: i18n?.t("onboarding.slide3Subtitle") || "Organização pessoal, sem prescrições",
      content: i18n?.t("onboarding.slide3Content") || "O PEP registra o que você informa e não indica tratamentos ou doses. Confirme sua rotina e a segurança das aplicações com seu profissional de saúde."
    }
  ];
}

export function shouldShowOnboarding() {
  try {
    const saved = localStorage.getItem(ONBOARDING_KEY);
    return saved !== ONBOARDING_VERSION;
  } catch (e) {
    return true;
  }
}

export function markOnboardingAccepted() {
  try {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
  } catch (e) {
    console.error("Erro ao salvar aceite do onboarding", e);
  }
}

export function showOnboarding({ onComplete, isReview = false } = {}) {
  let existing = document.getElementById("onboarding-overlay");
  if (existing) existing.remove();

  let currentStep = 0;

  const slides = getOnboardingSlides(i18nService);

  const overlay = document.createElement("div");
  overlay.id = "onboarding-overlay";
  overlay.className = "onboarding-overlay";

  function render() {
    const slide = slides[currentStep];
    const isLast = currentStep === slides.length - 1;

    overlay.innerHTML = `
      <div class="onboarding-card" aria-live="polite">
        <div class="onboarding-header">
          <div class="onboarding-art">
            <img src="${escapeHtml(slide.image)}" alt="${escapeHtml(slide.imageAlt)}" decoding="async" />
          </div>
          <div class="onboarding-title">${escapeHtml(slide.title)}</div>
          <div class="onboarding-sub">${escapeHtml(slide.subtitle)}</div>
        </div>

        <div class="onboarding-body">
          <p class="onboarding-text">${escapeHtml(slide.content)}</p>
          
          ${isLast ? `
            <label class="onboarding-agree">
              <input type="checkbox" id="onboarding-check" ${isReview ? "checked" : ""} />
              <span>${escapeHtml(i18nService.t("onboarding.agreeTerms"))}</span>
            </label>
          ` : ""}
        </div>

        <div class="onboarding-indicators">
          ${slides.map((_, i) => `
            <span class="onboarding-dot ${i === currentStep ? "active" : ""}"></span>
          `).join("")}
        </div>

        <div class="onboarding-actions">
          ${currentStep > 0 ? `
            <button type="button" class="btn-ghost" id="onboarding-prev">${escapeHtml(i18nService.t("onboarding.back"))}</button>
          ` : (isReview ? `
            <button type="button" class="btn-ghost" id="onboarding-close">${escapeHtml(i18nService.t("onboarding.close"))}</button>
          ` : `<div></div>`)}

          ${!isLast ? `
            <button type="button" class="btn-primary" id="onboarding-next">${escapeHtml(i18nService.t("onboarding.next"))}</button>
          ` : `
            <button type="button" class="btn-primary" id="onboarding-finish" ${!isReview ? "disabled" : ""}>
              ${isReview ? escapeHtml(i18nService.t("onboarding.finishReview")) : escapeHtml(i18nService.t("onboarding.startUsing"))}
            </button>
          `}
        </div>
      </div>
    `;

    // Event listeners
    const nextBtn = overlay.querySelector("#onboarding-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        haptics.light();
        currentStep++;
        render();
      });
    }

    const prevBtn = overlay.querySelector("#onboarding-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        haptics.light();
        currentStep--;
        render();
      });
    }

    const closeBtn = overlay.querySelector("#onboarding-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        haptics.light();
        overlay.remove();
        if (typeof onComplete === "function") onComplete();
      });
    }

    const check = overlay.querySelector("#onboarding-check");
    const finishBtn = overlay.querySelector("#onboarding-finish");
    if (check && finishBtn && !isReview) {
      check.addEventListener("change", (e) => {
        finishBtn.disabled = !e.target.checked;
        haptics.selection();
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        haptics.success();
        markOnboardingAccepted();
        overlay.remove();
        if (typeof onComplete === "function") onComplete();
      });
    }
  }

  render();
  document.body.appendChild(overlay);
}
