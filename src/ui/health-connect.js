import {
  HEALTH_CONNECT_STATUS,
  haveMeasurementsChanged
} from "../domain/health-connect.js";
import { accessibilityService } from "../services/accessibility.js";
import { i18nService } from "../services/i18n.js";

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

  const statusLabel = (status) => {
    const keyByStatus = {
      [HEALTH_CONNECT_STATUS.AVAILABLE]: "settings.healthStatusAvailable",
      [HEALTH_CONNECT_STATUS.NOT_AUTHORIZED]: "settings.healthStatusPermission",
      [HEALTH_CONNECT_STATUS.PERMISSION_REQUIRED]: "settings.healthStatusPermission",
      [HEALTH_CONNECT_STATUS.PARTIALLY_AUTHORIZED]: "settings.healthStatusPartial",
      [HEALTH_CONNECT_STATUS.UPDATE_REQUIRED]: "settings.healthStatusUpdate",
      [HEALTH_CONNECT_STATUS.UNAVAILABLE]: "settings.healthStatusNotInstalled",
      [HEALTH_CONNECT_STATUS.NOT_INSTALLED]: "settings.healthStatusNotInstalled",
      [HEALTH_CONNECT_STATUS.NOT_SUPPORTED]: "settings.healthStatusUnsupported",
      [HEALTH_CONNECT_STATUS.ERROR]: "settings.healthStatusError",
      [HEALTH_CONNECT_STATUS.DISABLED]: "common.disabled"
    };
    return i18nService.t(keyByStatus[status] || "settings.healthStatusError");
  };

  async function updateSettingsCard() {
    if (!statusBadge) return;

    const isEnabled = healthConnectService.isEnabled();
    if (toggle) {
      toggle.checked = isEnabled;
      toggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
    }

    if (!isEnabled) {
      statusBadge.textContent = i18nService.t("common.disabled");
      statusBadge.className = "badge-status off";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "none";
      return;
    }

    const avail = await healthConnectService.checkAvailability();
    if (!avail.available) {
      statusBadge.textContent = statusLabel(avail.status).toUpperCase();
      statusBadge.className = "badge-status pending";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "inline-flex";
      return;
    }

    const perm = await healthConnectService.checkPermissions();
    if (!perm.granted) {
      statusBadge.textContent = statusLabel(perm.status).toUpperCase();
      statusBadge.className = "badge-status pending";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "inline-flex";
      return;
    }

    statusBadge.textContent = i18nService.t("common.connected");
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
        showToast(statusLabel(avail.status) || i18nService.t("settings.healthConnectUnavailable"));
        haptics.warning();
        toggle.checked = false;
        toggle.setAttribute("aria-checked", "false");
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      const perm = await healthConnectService.requestPermissions();
      if (!perm.granted) {
        showToast(i18nService.t("settings.healthPermissionsDenied"));
        haptics.warning();
        toggle.checked = false;
        toggle.setAttribute("aria-checked", "false");
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      healthConnectService.setEnabled(true);
      haptics.success();
      showToast(i18nService.t("settings.healthEnabled"));
      accessibilityService.announce(i18nService.t("settings.healthEnabled"));
      await updateSettingsCard();
      await triggerAutoSync(true);
    } else {
      healthConnectService.setEnabled(false);
      haptics.selection();
      showToast(i18nService.t("settings.healthDisabled"));
      accessibilityService.announce(i18nService.t("settings.healthDisabled"));
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
    showToast(i18nService.t("settings.healthSyncing"));

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
      const msg = i18nService.t("settings.healthSynced", { exported: result.exportedCount, imported: result.importedCount });
      showToast(msg);
      accessibilityService.announce(msg);
    } else {
      haptics.warning();
      const err = result.reason === "PERMISSION_DENIED"
        ? i18nService.t("settings.healthPermissionsDenied")
        : result.reason === "SYNC_IN_PROGRESS"
          ? i18nService.t("settings.healthSyncInProgress")
          : i18nService.t("settings.healthSyncError");
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
