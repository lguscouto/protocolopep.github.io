/**
 * UI Controller: Bloqueio do App por Biometria / Credenciais do Dispositivo (V13)
 *
 * Princípios de Governança (AGENTS.md):
 * - Fail-Safe e Fail-Closed: Bloqueio opaco cobrindo dados confidenciais até confirmação de identidade.
 * - Confirmação prévia de identidade antes de ativar ou desativar a proteção.
 * - Haptics após confirmação.
 */

import { haptics } from "../services/haptics.js";

export function setupAppLockUI({ appLockService, onUnlock = () => {} }) {
  const overlay = document.getElementById("app-lock-overlay");
  const unlockBtn = document.getElementById("app-lock-unlock-btn");
  const toggle = document.getElementById("app-lock-toggle");
  const statusBadge = document.getElementById("app-lock-status-badge");
  const statusDesc = document.getElementById("app-lock-status-desc");

  function applyLockState(isLocked) {
    if (!overlay) return;
    if (isLocked) {
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      // Tentar autenticação biométrica imediata ao abrir o overlay
      setTimeout(() => {
        triggerAuthentication();
      }, 150);
    } else {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      onUnlock();
    }
  }

  async function triggerAuthentication() {
    if (!appLockService.isLocked) return;
    const res = await appLockService.authenticate({
      title: "Protocolo PEP",
      subtitle: "Confirme sua biometria ou PIN para desbloquear",
      reason: "Proteção de privacidade de dados locais do Protocolo PEP"
    });

    if (res.success) {
      haptics.success();
      applyLockState(false);
    } else {
      haptics.warning();
    }
  }

  async function updateSettingsLockCard() {
    const isEnabled = appLockService.isLockEnabled();
    const availability = await appLockService.checkBiometricAvailability();

    if (toggle) {
      toggle.checked = isEnabled;
    }

    if (statusBadge) {
      if (isEnabled) {
        statusBadge.textContent = "ATIVADO";
        statusBadge.className = "badge-status on";
      } else {
        statusBadge.textContent = "DESATIVADO";
        statusBadge.className = "badge-status off";
      }
    }

    if (statusDesc) {
      if (isEnabled) {
        statusDesc.textContent = "O app exige confirmação biométrica ou PIN do dispositivo ao abrir ou retornar do plano de fundo.";
      } else if (!availability.isAvailable && availability.isNative) {
        statusDesc.textContent = "Biometria ou bloqueio de tela não configurados no Android.";
      } else {
        statusDesc.textContent = "Exigir biometria ou PIN do dispositivo para abrir o aplicativo.";
      }
    }
  }

  // Event Listeners
  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => {
      haptics.selection();
      triggerAuthentication();
    });
  }

  if (toggle) {
    toggle.addEventListener("change", async (e) => {
      const targetState = toggle.checked;

      // Exigir autenticação prévia para mudar o estado de proteção
      const authRes = await appLockService.authenticate({
        title: "Segurança do Protocolo PEP",
        subtitle: targetState ? "Confirme para ativar o bloqueio" : "Confirme para desativar o bloqueio",
        reason: targetState ? "Confirme sua identidade para proteger o app." : "Confirme sua identidade para remover a proteção."
      });

      if (authRes.success) {
        appLockService.setLockEnabled(targetState);
        haptics.success();
        await updateSettingsLockCard();
      } else {
        // Reverte o toggle se a autenticação foi cancelada ou falhou
        toggle.checked = !targetState;
        haptics.warning();
        await updateSettingsLockCard();
      }
    });
  }

  // Inscrever nas mudanças do serviço
  appLockService.subscribe(({ isLocked }) => {
    applyLockState(isLocked);
    updateSettingsLockCard();
  });

  // Inicializar listeners de ciclo de vida
  appLockService.initLifecycleListeners();

  // Verificar bloqueio no arranque inicial
  if (appLockService.isLockEnabled()) {
    appLockService.lock();
  }

  return {
    updateSettingsLockCard,
    triggerAuthentication
  };
}
