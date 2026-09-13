/**
 * Módulo de Interface e Gerenciamento de Notificações (V05)
 */

import { notifications } from "../services/notifications.js";
import { haptics } from "../services/haptics.js";
import { accessibilityService } from "../services/accessibility.js";
import { dialogService } from "../services/dialog.js";
import { i18nService } from "../services/i18n.js";
import { escapeHtml } from "./dom.js";

const tr = (key, fallback, params) => {
  const value = i18nService.t(key, params);
  return value === key ? fallback : value;
};

const esc = escapeHtml;

export async function updateNotificationUI(peptides = []) {
  const status = await notifications.getSystemStatus(peptides);
  const cfg = notifications.getConfig();
  const statusParams = {
    ...(status.messageParams || {}),
    exactRestricted: status.messageParams?.exactRestricted
      ? ` (${tr("modals.notifications.exactAlarmRestricted", "Alarmes exatos restritos; o Android usará uma janela aproximada")})`
      : ""
  };

  // 1. Atualizar Modal de Notificações
  const badgeEl = document.getElementById("nf-status-badge");
  const msgEl = document.getElementById("nf-status-msg");
  const enableBtn = document.getElementById("nf-enable");
  const discreteToggle = document.getElementById("nf-discrete-toggle");
  const soundToggle = document.getElementById("nf-sound-toggle");
  const summaryInput = document.getElementById("nf-summary-time");

  if (badgeEl) {
    badgeEl.className = `badge ${status.badgeClass}`;
    badgeEl.textContent = tr(status.labelKey, status.label);
  }

  if (msgEl) {
    msgEl.textContent = tr(status.messageKey, status.message, statusParams);
  }

  if (enableBtn) {
    if (cfg.enabled) {
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
    settingsBadge.textContent = tr(status.labelKey, status.label);
  }
  if (settingsMsg) {
    settingsMsg.textContent = tr(status.messageKey, status.message, statusParams);
  }
}

export function setupNotificationListeners(storage) {
  const enableBtn = document.getElementById("nf-enable");
  const testBtn = document.getElementById("nf-test");
  const rescheduleBtn = document.getElementById("nf-reschedule");
  const discreteToggle = document.getElementById("nf-discrete-toggle");
  const soundToggle = document.getElementById("nf-sound-toggle");
  const summaryInput = document.getElementById("nf-summary-time");

  const notifModal = document.getElementById("notif-modal");
  const closeNotifModal = () => {
    if (notifModal) {
      notifModal.classList.remove("on");
      notifModal.setAttribute("aria-hidden", "true");
    }
    if (accessibilityService) {
      accessibilityService.restoreFocus();
    }
    haptics.light();
  };

  const openNotifModalBtns = document.querySelectorAll("#notif-btn, #open-notif-modal-btn");
  openNotifModalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptics.light();
      if (notifModal) {
        notifModal.classList.add("on");
        notifModal.setAttribute("aria-hidden", "false");
        if (accessibilityService) {
          accessibilityService.trapFocus(notifModal);
        }
      }
      updateNotificationUI(storage.getPeptides());
    });
  });

  const closeNotifModalBtns = document.querySelectorAll("#notif-close");
  closeNotifModalBtns.forEach((btn) => {
    btn.addEventListener("click", closeNotifModal);
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
            dialogService.alert({
              title: tr("modals.notifications.notifPermissionTitle", "Permissão Necessária"),
              message: tr("modals.notifications.notifPermissionMessage", "Permissão de notificação não autorizada pelo sistema Android. Para ativar, permita as notificações nas Configurações do aparelho."),
              isDanger: true
            });
            return;
          }
        }

        // P1 Item 11: Verificar Exact Alarm no Android (API 31+) e solicitar autorização se negado
        const exactAlarmRes = await notifications.checkExactAlarmPermission();
        if (!exactAlarmRes.granted && exactAlarmRes.status === "denied") {
          const userWants = await dialogService.confirm({
            title: tr("modals.notifications.exactAlarmPromptTitle", "Permissão para Alarmes Exatos"),
            message: tr("modals.notifications.exactAlarmPromptMessage", "Para que os lembretes toquem no minuto exato no Android, o Protocolo PEP precisa de permissão para 'Alarmes e Lembretes'. Deseja abrir as configurações do sistema para autorizar?"),
            confirmText: tr("modals.notifications.openSettings", "Abrir Configurações"),
            cancelText: tr("modals.notifications.notNow", "Agora Não"),
            isDanger: false
          });
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
        await notifications.sendInstantNotification(tr("modals.notifications.testTitle", "Protocolo PEP"), tr("modals.notifications.testBody", "Horário de aplicação programada"));
      } else {
        await notifications.sendInstantNotification(tr("modals.notifications.testCustomTitle", "Lembrete: {name}", { name: tr("common.test", "teste") }), tr("modals.notifications.testCustomBody", "500 mcg · 10 UI"));
      }
    });
  }

  if (rescheduleBtn) {
    rescheduleBtn.addEventListener("click", async () => {
      haptics.light();
      const res = await notifications.schedulePeptideReminders(storage.getPeptides());
      await updateNotificationUI(storage.getPeptides());
      haptics.success();
      dialogService.alert({
        title: tr("modals.notifications.rescheduledTitle", "Lembretes Reagendados"),
        message: tr("modals.notifications.rescheduledSuccess", "Lembretes atualizados com sucesso! ({count} próximos horários no aparelho)", { count: res.scheduledCount })
      });
    });
  }
}
