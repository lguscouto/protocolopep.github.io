import {
  HEALTH_CONNECT_STATUS,
  getHealthConnectStatusLabel
} from "../domain/health-connect.js";

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

  async function updateSettingsCard() {
    if (!statusBadge) return;

    const isEnabled = healthConnectService.isEnabled();
    if (toggle) {
      toggle.checked = isEnabled;
    }

    if (!isEnabled) {
      statusBadge.textContent = "DESATIVADO";
      statusBadge.className = "badge-status off";
      statusBadge.style.background = "var(--surface2)";
      statusBadge.style.color = "var(--muted)";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "none";
      return;
    }

    const avail = await healthConnectService.checkAvailability();
    if (!avail.available) {
      statusBadge.textContent = getHealthConnectStatusLabel(avail.status).toUpperCase();
      statusBadge.className = "badge-status off";
      statusBadge.style.background = "rgba(245,158,11,0.15)";
      statusBadge.style.color = "#f59e0b";
      if (syncBtn) syncBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "inline-flex";
      return;
    }

    statusBadge.textContent = "CONECTADO";
    statusBadge.className = "badge-status on";
    statusBadge.style.background = "rgba(16,185,129,0.15)";
    statusBadge.style.color = "#10b981";
    if (syncBtn) syncBtn.style.display = "inline-flex";
    if (settingsBtn) settingsBtn.style.display = "inline-flex";
  }

  async function handleToggleChange() {
    if (!toggle) return;
    const shouldEnable = toggle.checked;

    if (shouldEnable) {
      const avail = await healthConnectService.checkAvailability();
      if (!avail.available) {
        showToast(avail.message || "Health Connect não disponível neste dispositivo.");
        haptics.warning();
        toggle.checked = false;
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      const perm = await healthConnectService.requestPermissions();
      if (!perm.granted) {
        showToast("Permissões de saúde não concedidas.");
        haptics.warning();
        toggle.checked = false;
        healthConnectService.setEnabled(false);
        await updateSettingsCard();
        return;
      }

      healthConnectService.setEnabled(true);
      haptics.success();
      showToast("Health Connect ativado com sucesso.");
      await updateSettingsCard();
      await triggerAutoSync();
    } else {
      healthConnectService.setEnabled(false);
      haptics.selection();
      showToast("Health Connect desativado.");
      await updateSettingsCard();
    }
  }

  async function triggerAutoSync() {
    if (!healthConnectService.isEnabled()) return;
    const currentMeasurements = storage.getMeasurements();
    const result = await healthConnectService.syncMeasurements(currentMeasurements);

    if (result.success) {
      if (result.measurements && result.measurements.length !== currentMeasurements.length) {
        storage.setMeasurements(result.measurements);
        onSyncComplete(result.measurements);
      }
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
        storage.setMeasurements(result.measurements);
        onSyncComplete(result.measurements);
      }
      haptics.success();
      showToast(`Sincronizado: ${result.exportedCount} enviados, ${result.importedCount} importados.`);
    } else {
      haptics.warning();
      showToast(result.reason || "Erro na sincronização.");
    }
  }

  if (toggle) {
    toggle.addEventListener("change", handleToggleChange);
    toggle.addEventListener("input", handleToggleChange);
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
