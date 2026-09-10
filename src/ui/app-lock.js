/**
 * UI Controller: Bloqueio do App por Biometria / Credenciais do Dispositivo (V13)
 *
 * Princípios de Governança (AGENTS.md):
 * - Fail-Safe e Fail-Closed: Bloqueio opaco cobrindo dados confidenciais até confirmação de identidade.
 * - Confirmação prévia de identidade antes de ativar ou desativar a proteção.
 * - Haptics após confirmação.
 */

import { haptics } from "../services/haptics.js";
import { i18nService } from "../services/i18n.js";

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
      title: i18nService.t("appLock.authTitle"),
      subtitle: i18nService.t("appLock.authSubtitle"),
      reason: i18nService.t("appLock.reasonAccess")
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
        statusBadge.textContent = i18nService.t("common.enabled").toUpperCase();
        statusBadge.className = "badge-status on";
      } else {
        statusBadge.textContent = i18nService.t("common.disabled").toUpperCase();
        statusBadge.className = "badge-status off";
      }
    }

    if (statusDesc) {
      if (isEnabled) {
        statusDesc.textContent = i18nService.t("appLock.statusActive");
      } else if (!availability.isAvailable && availability.isNative) {
        statusDesc.textContent = i18nService.t("appLock.statusNotAvailable");
      } else {
        statusDesc.textContent = i18nService.t("appLock.statusDescDefault");
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
        title: i18nService.t("appLock.authTitle"),
        subtitle: targetState ? i18nService.t("appLock.reasonEnable") : i18nService.t("appLock.reasonDisable"),
        reason: targetState ? i18nService.t("appLock.reasonEnable") : i18nService.t("appLock.reasonDisable")
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
