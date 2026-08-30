/**
 * Protocolo PEP — Controlador de Interface de Acessibilidade (V18)
 * Configuração de Alto Contraste, Teclado e Foco.
 */

export function setupAccessibilityUI({
  accessibilityService,
  haptics,
  onCloseTopModal = () => {}
}) {
  const highContrastToggle = document.getElementById("high-contrast-toggle");

  function updateHighContrastToggleUI() {
    if (!highContrastToggle) return;
    const isEnabled = accessibilityService.getHighContrast();
    highContrastToggle.checked = isEnabled;
    highContrastToggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
  }

  if (highContrastToggle) {
    highContrastToggle.addEventListener("change", () => {
      const enabled = highContrastToggle.checked;
      accessibilityService.setHighContrast(enabled);
      highContrastToggle.setAttribute("aria-checked", enabled ? "true" : "false");
      if (haptics && typeof haptics.selection === "function") {
        haptics.selection();
      }
      accessibilityService.announce(
        enabled ? "Modo de alto contraste ativado" : "Modo de alto contraste desativado"
      );
    });
  }

  // Listener global de teclado (Esc fecha modal ativo)
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        onCloseTopModal();
      }
    });
  }

  // Inicializa estado
  const current = accessibilityService.getHighContrast();
  accessibilityService.applyHighContrastToDOM(current);
  updateHighContrastToggleUI();

  return {
    updateHighContrastToggleUI
  };
}
