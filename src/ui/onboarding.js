/**
 * Componente de Onboarding e Termo de Não Prescrição (V01)
 * Apresenta a proposta Local-First, privacidade e termos de responsabilidade pessoal.
 */

import { haptics } from "../services/haptics.js";
import { escapeHtml } from "./dom.js";

export const ONBOARDING_VERSION = "1";
export const ONBOARDING_KEY = "pep_onboarding_version";

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

  const slides = [
    {
      icon: "🧪",
      title: "Bem-vindo ao Protocolo PEP",
      subtitle: "Acompanhamento e organização de protocolos",
      content: "Uma ferramenta prática desenvolvida para facilitar o registro pessoal diário de aplicações e cálculos matemáticos de reconstituição de peptídeos."
    },
    {
      icon: "🔒",
      title: "100% Local & Desconectado",
      subtitle: "Privacidade e soberania dos seus dados",
      content: "Nenhuma informação sai deste aparelho. O app não exige conta, não utiliza servidores em nuvem e não faz rastreamento. Você pode exportar e fazer backup dos seus dados quando desejar."
    },
    {
      icon: "⚖️",
      title: "Uso Pessoal & Não Prescrição",
      subtitle: "Ferramenta matemática e de registro",
      content: "O Protocolo PEP não realiza prescrições médicas nem indica dosagens terapêuticas. Todos os dados e cálculos inseridos são de sua responsabilidade exclusiva. Confirme doses e segurança com seu médico de confiança."
    }
  ];

  const overlay = document.createElement("div");
  overlay.id = "onboarding-overlay";
  overlay.className = "onboarding-overlay";

  function render() {
    const slide = slides[currentStep];
    const isLast = currentStep === slides.length - 1;

    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <span class="onboarding-icon">${slide.icon}</span>
          <div class="onboarding-title">${escapeHtml(slide.title)}</div>
          <div class="onboarding-sub">${escapeHtml(slide.subtitle)}</div>
        </div>

        <div class="onboarding-body">
          <p class="onboarding-text">${escapeHtml(slide.content)}</p>
          
          ${isLast ? `
            <label class="onboarding-agree">
              <input type="checkbox" id="onboarding-check" ${isReview ? "checked" : ""} />
              <span>Estou ciente e concordo com os termos de uso pessoal e não prescrição.</span>
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
            <button type="button" class="btn-ghost" id="onboarding-prev">Voltar</button>
          ` : (isReview ? `
            <button type="button" class="btn-ghost" id="onboarding-close">Fechar</button>
          ` : `<div></div>`)}

          ${!isLast ? `
            <button type="button" class="btn-primary" id="onboarding-next">Avançar</button>
          ` : `
            <button type="button" class="btn-primary" id="onboarding-finish" ${!isReview ? "disabled" : ""}>
              ${isReview ? "Concluir Revisão" : "Começar a Usar"}
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
