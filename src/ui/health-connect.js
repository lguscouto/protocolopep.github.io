import {
  HEALTH_CONNECT_STATUS,
  getHealthConnectStatusLabel,
  haveMeasurementsChanged
} from "../domain/health-connect.js";
import { accessibilityService } from "../services/accessibility.js";

/**
 * Configura os controles e listeners da interface do Health Connect.
 *
 * @param {Object} options
 * @param {Object} options.healthConnectService
 * @param {Object} options.storage
 * @param {Function} [options.onSyncComplete]
 * @param {Function} [options.showToast]
 * @param {Object} [options.haptics]
 * @returns {{ updateSettingsCard: Function, triggerAutoSync: Function }}
 */
export function setupHealthConnectUI({
  healthConnectService,
  storage,
  onSyncComplete = () => {},
  showToast = () => {},
  haptics = { selection: () => {}, success: () => {}, warning: () => {} }
}) {
  const toggle = document.getElementById("hc-enable-toggle");
  const statusBadge = document.getElementById("hc-status-badge");
  const syncBtn = document.getElementById("hc-sync-btn");
  const settingsBtn = document.getElementById("hc-settings-btn");
  let autoSyncDebounceTimer = null;

  async function updateSettingsCard() {
    if (!statusBadge) return;

    const isEnabled = healthConnectService.isEnabled();
    if (toggle) {
      toggle.checked = isEnabled;
      toggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
    }

    if (!isEnabled) {
      statusBadge.textContent = "DESATIVADO";
      statusBadge.className = "badge-status off";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "none";
      return;
    }

    const avail = await healthConnectService.checkAvailability();
    if (!avail.available) {
      statusBadge.textContent = getHealthConnectStatusLabel(avail.status).toUpperCase();
      statusBadge.className = "badge-status pending";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "inline-flex";
      return;
    }

    const perm = await healthConnectService.checkPermissions();
    if (!perm.granted) {
      statusBadge.textContent = getHealthConnectStatusLabel(perm.status).toUpperCase();
      statusBadge.className = "badge-status pending";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "inline-flex";
      return;
    }

    statusBadge.textContent = "CONECTADO";
    statusBadge.className = "badge-status on";
    if (syncBtn) syncBtn.style.display = "inline-flex";
    if (settingsBtn) settingsBtn.style.display = "inline-flex";
  }

  async function handleToggleChange() {
    if (!toggle) return;
    const shouldEnable = toggle.checked;
    toggle.setAttribute("aria-checked", shouldEnable ? "true" : "false");

    if (shouldEnable) {
      const avail = await healthConnectService.checkAvailability();
      if (!avail.available) {
        showToast(avail.message || "Health Connect não disponível neste dispositivo.");
        haptics.warning();
        toggle.checked = false;
        toggle.setAttribute("aria-checked", "false");
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      const perm = await healthConnectService.requestPermissions();
      if (!perm.granted) {
        showToast("Permissões de saúde não concedidas.");
        haptics.warning();
        toggle.checked = false;
        toggle.setAttribute("aria-checked", "false");
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      healthConnectService.setEnabled(true);
      haptics.success();
      showToast("Health Connect ativado com sucesso.");
      accessibilityService.announce("Health Connect ativado e conectado.");
      await updateSettingsCard();
      await triggerAutoSync(true);
    } else {
      healthConnectService.setEnabled(false);
      haptics.selection();
      showToast("Health Connect desativado.");
      accessibilityService.announce("Health Connect desativado.");
      await updateSettingsCard();
    }
  }

  async function triggerAutoSync(immediate = false) {
    if (!healthConnectService.isEnabled()) return;

    if (autoSyncDebounceTimer) {
      clearTimeout(autoSyncDebounceTimer);
      autoSyncDebounceTimer = null;
    }

    const runSync = async () => {
      const currentMeasurements = storage.getMeasurements();
      const result = await healthConnectService.syncMeasurements(currentMeasurements);

      if (result.success && result.measurements) {
        if (haveMeasurementsChanged(currentMeasurements, result.measurements)) {
          storage.setMeasurements(result.measurements);
          onSyncComplete(result.measurements);
        }
      }
    };

    if (immediate) {
      await runSync();
    } else {
      autoSyncDebounceTimer = setTimeout(runSync, 1000);
    }
  }

  async function handleManualSync() {
    if (syncBtn) syncBtn.disabled = true;
    haptics.selection();
    showToast("Sincronizando com Health Connect...");

    const currentMeasurements = storage.getMeasurements();
    const result = await healthConnectService.syncMeasurements(currentMeasurements);

    if (syncBtn) syncBtn.disabled = false;

    if (result.success) {
      if (result.measurements) {
        const hasChanged = haveMeasurementsChanged(currentMeasurements, result.measurements);
        if (hasChanged) {
          storage.setMeasurements(result.measurements);
          onSyncComplete(result.measurements);
        }
      }
      haptics.success();
      const msg = `Sincronizado: ${result.exportedCount} enviados, ${result.importedCount} importados.`;
      showToast(msg);
      accessibilityService.announce(msg);
    } else {
      haptics.warning();
      const err = result.reason || "Erro na sincronização.";
      showToast(err);
      accessibilityService.announce(err, "assertive");
    }
  }

  if (toggle) {
    toggle.addEventListener("change", handleToggleChange);
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", handleManualSync);
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", async () => {
      haptics.selection();
      await healthConnectService.openHealthConnectSettings();
    });
  }

  return {
    updateSettingsCard,
    triggerAutoSync
  };
}
