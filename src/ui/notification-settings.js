/**
 * Módulo de Interface e Gerenciamento de Notificações (V05)
 */

import { notifications } from "../services/notifications.js";
import { haptics } from "../services/haptics.js";
import { accessibilityService } from "../services/accessibility.js";
import { escapeHtml } from "./dom.js";

const esc = escapeHtml;

export async function updateNotificationUI(peptides = []) {
  const status = await notifications.getSystemStatus(peptides);
  const cfg = notifications.getConfig();

  // 1. Atualizar Modal de Notificações
  const badgeEl = document.getElementById("nf-status-badge");
  const msgEl = document.getElementById("nf-status-msg");
  const enableBtn = document.getElementById("nf-enable");
  const discreteToggle = document.getElementById("nf-discrete-toggle");
  const soundToggle = document.getElementById("nf-sound-toggle");
  const summaryInput = document.getElementById("nf-summary-time");

  if (badgeEl) {
    badgeEl.className = `badge ${status.badgeClass}`;
    badgeEl.textContent = status.label;
  }

  if (msgEl) {
    msgEl.textContent = status.message;
  }

  if (enableBtn) {
    if (status.state === "active") {
      enableBtn.textContent = "Desativar Lembretes";
      enableBtn.className = "btn-subtle";
      enableBtn.style.width = "100%";
    } else {
      enableBtn.textContent = "Ativar Lembretes";
      enableBtn.className = "btn-primary";
      enableBtn.style.width = "100%";
    }
  }

  if (discreteToggle) {
    discreteToggle.checked = cfg.discreteMode !== false;
  }

  if (soundToggle) {
    soundToggle.checked = cfg.sound !== false;
  }

  if (summaryInput) {
    summaryInput.value = cfg.summary || "";
  }

  // 2. Atualizar Card na Aba Ajustes
  const settingsBadge = document.getElementById("settings-notif-badge");
  const settingsMsg = document.getElementById("settings-notif-msg");
  if (settingsBadge) {
    settingsBadge.className = `badge ${status.badgeClass}`;
    settingsBadge.textContent = status.label;
  }
  if (settingsMsg) {
    settingsMsg.textContent = status.message;
  }
}

export function setupNotificationListeners(storage) {
  const enableBtn = document.getElementById("nf-enable");
  const testBtn = document.getElementById("nf-test");
  const rescheduleBtn = document.getElementById("nf-reschedule");
  const discreteToggle = document.getElementById("nf-discrete-toggle");
  const soundToggle = document.getElementById("nf-sound-toggle");
  const summaryInput = document.getElementById("nf-summary-time");

  const openNotifModalBtns = document.querySelectorAll("#notif-btn, #open-notif-modal-btn");
  openNotifModalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptics.light();
      const modal = document.getElementById("notif-modal");
      if (modal) {
        modal.classList.add("on");
        modal.setAttribute("aria-hidden", "false");
        if (accessibilityService) {
          accessibilityService.trapFocus(modal);
        }
      }
      updateNotificationUI(storage.getPeptides());
    });
  });

  if (discreteToggle) {
    discreteToggle.addEventListener("change", async () => {
      notifications.saveConfig({ discreteMode: discreteToggle.checked });
      haptics.light();
      if (notifications.getConfig().enabled) {
        await notifications.schedulePeptideReminders(storage.getPeptides());
        await updateNotificationUI(storage.getPeptides());
      }
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener("change", async () => {
      notifications.saveConfig({ sound: soundToggle.checked });
      haptics.light();
      if (notifications.getConfig().enabled) {
        await notifications.schedulePeptideReminders(storage.getPeptides());
        await updateNotificationUI(storage.getPeptides());
      }
    });
  }

  if (summaryInput) {
    summaryInput.addEventListener("change", async () => {
      notifications.saveConfig({ summary: summaryInput.value });
      haptics.light();
      if (notifications.getConfig().enabled) {
        await notifications.schedulePeptideReminders(storage.getPeptides());
        await updateNotificationUI(storage.getPeptides());
      }
    });
  }

  if (enableBtn) {
    enableBtn.addEventListener("click", async () => {
      const cfg = notifications.getConfig();
      if (cfg.enabled) {
        // Desativar
        notifications.saveConfig({ enabled: false });
        await notifications.cancelAllPepReminders();
        haptics.light();
        await updateNotificationUI(storage.getPeptides());
      } else {
        // Ativar
        const hasPerm = await notifications.checkPermission();
        if (!hasPerm) {
          const granted = await notifications.requestPermission();
          if (!granted) {
            haptics.warning();
            notifications.saveConfig({ enabled: false });
            await updateNotificationUI(storage.getPeptides());
            alert("Permissão de notificação não autorizada pelo sistema Android. Para ativar, permita as notificações nas Configurações do aparelho.");
            return;
          }
        }

        // P1 Item 11: Verificar Exact Alarm no Android (API 31+) e solicitar autorização se negado
        const exactAlarmRes = await notifications.checkExactAlarmPermission();
        if (!exactAlarmRes.granted && exactAlarmRes.status === "denied") {
          const userWants = window.confirm(
            "Para que os lembretes toquem no minuto exato no Android, o Protocolo PEP precisa de permissão para 'Alarmes e Lembretes'. Deseja abrir as configurações do sistema para autorizar?"
          );
          if (userWants) {
            await notifications.requestExactAlarmPermission();
          } else {
            console.info("[Notif] Exact alarm não autorizado pelo usuário. Lembretes serão agendados com janelas padrão.");
          }
        }

        notifications.saveConfig({ enabled: true });
        const res = await notifications.schedulePeptideReminders(storage.getPeptides());
        haptics.success();
        await updateNotificationUI(storage.getPeptides());
      }
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      haptics.light();
      const cfg = notifications.getConfig();
      if (cfg.discreteMode) {
        await notifications.sendInstantNotification("Protocolo PEP", "Horário de aplicação programada");
      } else {
        await notifications.sendInstantNotification("Lembrete: Peptídeo Teste", "500 mcg · 10 UI");
      }
    });
  }

  if (rescheduleBtn) {
    rescheduleBtn.addEventListener("click", async () => {
      haptics.light();
      const res = await notifications.schedulePeptideReminders(storage.getPeptides());
      await updateNotificationUI(storage.getPeptides());
      haptics.success();
      alert(`Lembretes reagendados com sucesso! (${res.scheduledCount} agendados para 14 dias)`);
    });
  }
}
