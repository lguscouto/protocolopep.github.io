import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { haptics } from "./haptics.js";
import { dateToKey, isScheduledOnDate, isValidTime } from "../domain/schedule.js";
import { normalizeProtocolRevisions, resolveProtocolAt } from "../domain/protocol-history.js";
import { normalizeRemindersEnabled } from "../domain/protocol.js";
import { formatNotificationContent, getNotificationVisualState } from "../domain/notification-formatter.js";

const NOTIF_CFG_KEY = "pep_notif_config";
export const NOTIF_CHANNEL_ID = "pep_lembretes";
export const NOTIF_CHANNEL_SILENT_ID = "pep_lembretes_silenciosos";
export const NOTIFICATION_HORIZON_DAYS = 90;
export const NOTIFICATION_ACTION_TYPE = "pep_application_actions";

export class NotificationService {
  constructor() {
    this.cfg = {
      enabled: false,
      sound: true,
      summary: "",
      discreteMode: true
    };
    this.audioCtx = null;
    this.nativeSetupPromise = null;
    this.scheduleInFlight = null;
    this.lastSchedule = null;
  }

  async init({ deferNative = false } = {}) {
    try {
      const saved = localStorage.getItem(NOTIF_CFG_KEY);
      if (saved) {
        this.cfg = { ...this.cfg, ...JSON.parse(saved) };
      }
    } catch (e) {}

    if (!deferNative) await this.ensureNativeSetup();
  }

  async ensureNativeSetup() {
    if (!Capacitor.isNativePlatform()) return { success: true, native: false };
    if (this.nativeSetupPromise) return this.nativeSetupPromise;
    this.nativeSetupPromise = (async () => {
      try {
        if (typeof LocalNotifications.createChannel !== "function") {
          return { success: true, native: true, unsupported: true };
        }
        await LocalNotifications.createChannel({
          id: NOTIF_CHANNEL_ID,
          name: "Lembretes de Peptídeos",
          description: "Notificações com som e vibração para horários de doses do seu protocolo",
          importance: 4,
          visibility: 1,
          vibration: true
        });
        if (typeof LocalNotifications.registerActionTypes === "function") {
          await LocalNotifications.registerActionTypes({
            types: [{
              id: NOTIFICATION_ACTION_TYPE,
              actions: [
                { id: "register", title: "Registrar" },
                { id: "snooze", title: "Lembrar em 30 min" },
                { id: "skip", title: "Marcar como não realizada", destructive: true }
              ]
            }]
          });
        }
        await LocalNotifications.createChannel({
          id: NOTIF_CHANNEL_SILENT_ID,
          name: "Lembretes Silenciosos",
          description: "Notificações discretas sem som ou vibração para horários de doses",
          importance: 2,
          visibility: 1,
          vibration: false
        });
        return { success: true, native: true };
      } catch (e) {
        console.warn("[Notif] Channel creation error:", e);
        this.nativeSetupPromise = null;
        return { success: false, native: true, error: e.message };
      }
    })();
    return this.nativeSetupPromise;
  }

  getConfig() {
    return this.cfg;
  }

  setupActionListener({ onRegister = () => {}, onSnooze = () => {}, onSkip = () => {} } = {}) {
    if (!Capacitor.isNativePlatform() || typeof LocalNotifications.addListener !== "function") return null;
    return LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
      const actionId = event?.actionId || event?.notification?.actionId;
      const extra = event?.notification?.extra || {};
      const payload = {
        peptideId: extra.peptideId || "",
        scheduledDate: extra.scheduledDate || "",
        time: extra.time || ""
      };
      if (actionId === "register") return onRegister(payload);
      if (actionId === "snooze") return onSnooze(payload);
      if (actionId === "skip") return onSkip(payload);
      return onRegister(payload);
    });
  }

  isEnabled() {
    return Boolean(this.cfg && this.cfg.enabled);
  }

  saveConfig(newCfg) {
    this.cfg = { ...this.cfg, ...newCfg };
    this.lastSchedule = null;
    try {
      localStorage.setItem(NOTIF_CFG_KEY, JSON.stringify(this.cfg));
    } catch (e) {}
  }

  async checkExactAlarmPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        if (typeof LocalNotifications.checkExactNotificationSetting === "function") {
          const res = await LocalNotifications.checkExactNotificationSetting();
          return {
            granted: res && res.exact_alarm === "granted",
            status: (res && res.exact_alarm) || "prompt"
          };
        }
        return { granted: false, status: "unknown" };
      } catch (e) {
        console.warn("[Notif] Erro ao verificar permissão de exact alarm:", e);
        return { granted: false, status: "unknown", error: e.message };
      }
    }
    return { granted: true, status: "not_applicable" };
  }

  async requestExactAlarmPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        if (typeof LocalNotifications.changeExactNotificationSetting === "function") {
          const res = await LocalNotifications.changeExactNotificationSetting();
          return {
            granted: res && res.exact_alarm === "granted",
            status: (res && res.exact_alarm) || "prompt"
          };
        }
      } catch (e) {
        console.warn("[Notif] Erro ao abrir configurações de exact alarm:", e);
        return { granted: false, status: "error", error: e.message };
      }
    }
    return { granted: true, status: "not_applicable" };
  }

  async checkPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await LocalNotifications.checkPermissions();
        return res.display === "granted";
      } catch (e) {
        return false;
      }
    } else {
      return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
    }
  }

  async requestPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        return res.display === "granted";
      } catch (e) {
        return false;
      }
    } else if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async getSystemStatus(peptides = []) {
    let permission = "prompt";
    let pendingCount = 0;
    let exactAlarm = "not_applicable";

    if (Capacitor.isNativePlatform()) {
      try {
        const permRes = await LocalNotifications.checkPermissions();
        if (permRes.display === "granted") {
          permission = "granted";
        } else if (permRes.display === "denied") {
          permission = "denied";
        } else {
          permission = "prompt";
        }

        const pending = await LocalNotifications.getPending();
        pendingCount = pending && pending.notifications ? pending.notifications.length : 0;

        const eaRes = await this.checkExactAlarmPermission();
        exactAlarm = eaRes.status;
      } catch (e) {
        permission = "denied";
      }
    } else {
      if (typeof window !== "undefined" && "Notification" in window) {
        permission = Notification.permission;
      }
    }

    const eligibleRoutineCount = Array.isArray(peptides)
      ? peptides.filter((protocol) => {
          const current = resolveProtocolAt(protocol);
          return current?.lifecycleStatus === "active" && normalizeRemindersEnabled(current);
        }).length
      : 0;

    return getNotificationVisualState({
      enabled: this.cfg.enabled,
      permission,
      exactAlarm,
      pendingCount,
      horizonDays: NOTIFICATION_HORIZON_DAYS,
      eligibleRoutineCount
    });
  }

  ensureAudio() {
    try {
      if (!this.audioCtx && typeof window !== "undefined") {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.audioCtx = new AC();
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
    } catch (e) {}
  }

  beep() {
    try {
      this.ensureAudio();
      if (!this.audioCtx) return;
      const t = this.audioCtx.currentTime;
      [0, 0.28].forEach((off) => {
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        o.connect(g);
        g.connect(this.audioCtx.destination);
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.35, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.22);
        o.start(t + off);
        o.stop(t + off + 0.24);
      });
    } catch (e) {}
  }

  async sendInstantNotification(title, body) {
    const activeChannelId = this.cfg.sound ? NOTIF_CHANNEL_ID : NOTIF_CHANNEL_SILENT_ID;
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: title,
              body: body,
              channelId: activeChannelId,
              smallIcon: "ic_stat_pep",
              iconColor: "#2CC5C0"
            }
          ]
        });
        if (this.cfg.sound) haptics.light();
        return { success: true, native: true };
      } catch (err) {
        console.warn("[Notif] Send instant error:", err);
        return { success: false, error: err.message };
      }
    } else {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "icon-192.png" });
        if (this.cfg.sound) {
          this.beep();
          haptics.light();
        }
        return { success: true, web: true };
      }
      return { success: true, fallback: true };
    }
  }

  async snoozeNotification({ peptideId = "", scheduledDate = "", time = "" } = {}) {
    if (!Capacitor.isNativePlatform()) return { success: false, reason: "not_native" };
    try {
      const at = new Date(Date.now() + 30 * 60 * 1000);
      await LocalNotifications.schedule({ notifications: [{
        id: Math.floor(Math.random() * 100000) + 200000,
        title: "Lembrete adiado",
        body: "Você pediu para ser lembrado novamente em 30 minutos.",
        channelId: this.cfg.sound ? NOTIF_CHANNEL_ID : NOTIF_CHANNEL_SILENT_ID,
        actionTypeId: NOTIFICATION_ACTION_TYPE,
        schedule: { at },
        smallIcon: "ic_stat_pep",
        iconColor: "#2CC5C0",
        extra: { peptideId, scheduledDate, time }
      }] });
      return { success: true };
    } catch (error) {
      console.warn("[Notif] Não foi possível adiar o lembrete:", error);
      return { success: false, error: error.message };
    }
  }

  async cancelAllPepReminders() {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending && pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel(pending);
          console.log(`[Notif] ${pending.notifications.length} lembretes pendentes cancelados.`);
        }
      } catch (e) {
        console.warn("[Notif] Erro ao cancelar lembretes pendentes:", e);
      }
    }
  }

  async cancelScheduleForPeptide(peptideId) {
    if (!peptideId) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending && pending.notifications && pending.notifications.length > 0) {
          const toCancel = pending.notifications.filter(
            (n) => n.extra && n.extra.peptideId === peptideId
          );
          if (toCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: toCancel });
          }
        }
      } catch (e) {
        console.warn("[Notif] Erro ao cancelar lembretes do peptídeo:", e);
      }
    }
  }

  async resolveSchedulingPolicy() {
    const exactAlarm = await this.checkExactAlarmPermission();
    if (exactAlarm.status === "not_applicable") {
      return { mode: "not_applicable", allowWhileIdle: false, exactAlarm };
    }
    if (exactAlarm.granted) {
      return { mode: "exact", allowWhileIdle: true, exactAlarm };
    }
    return { mode: "approximate", allowWhileIdle: false, exactAlarm };
  }

  async schedulePeptideReminders(peptides = []) {
    await this.ensureNativeSetup();
    // 1. Sempre cancelar lembretes anteriores
    await this.cancelAllPepReminders();

    // Se notificações estiverem desativadas, parar por aqui garantindo que nada fique agendado
    if (!this.cfg.enabled) {
      return { scheduledCount: 0, schedulingMode: "disabled" };
    }

    // A política de Exact Alarm pertence ao serviço: todo chamador recebe o mesmo fallback seguro.
    const schedulingPolicy = await this.resolveSchedulingPolicy();

    if (Capacitor.isNativePlatform()) {
      try {
        const activeChannelId = this.cfg.sound ? NOTIF_CHANNEL_ID : NOTIF_CHANNEL_SILENT_ID;
        const notifications = [];
        const summaryEligibleDays = new Set();
        let notifId = 1000;
        const now = new Date();

        // Agendar um horizonte local amplo para que o usuário não precise abrir o app toda semana.
        for (let dayOffset = 0; dayOffset < NOTIFICATION_HORIZON_DAYS; dayOffset++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + dayOffset);

          for (const protocol of peptides) {
            // A revision may change the schedule partway through a day. Resolve
            // each candidate at its actual instant, not at the end of that day.
            const configs = [protocol, ...normalizeProtocolRevisions(protocol.revisions).map((revision) => revision.config)];
            const timesOf = (config) => Array.isArray(config.times) && config.times.length > 0
              ? config.times : (config.time ? [config.time] : []);
            const timeList = [...new Set(configs.flatMap(timesOf).filter(isValidTime).map((time) => time.trim()))];

            for (const tStr of timeList) {
              const [h, m] = tStr.split(":").map(Number);

              const schedDate = new Date(targetDate);
              schedDate.setHours(h, m, 0, 0);
              const p = resolveProtocolAt(protocol, schedDate);
              if (!isScheduledOnDate(p, schedDate) || !timesOf(p).includes(tStr)) continue;
              if (!normalizeRemindersEnabled(p)) continue;
              summaryEligibleDays.add(dateToKey(schedDate));

              // Apenas agendar se a data/hora for futura
              if (schedDate.getTime() > now.getTime()) {
                const formatted = formatNotificationContent(p, {
                  discreteMode: this.cfg.discreteMode
                });

                notifications.push({
                  id: notifId++,
                  title: formatted.title,
                  body: formatted.body,
                  channelId: activeChannelId,
                  schedule: schedulingPolicy.allowWhileIdle
                    ? { at: schedDate, allowWhileIdle: true }
                    : { at: schedDate },
                  smallIcon: "ic_stat_pep",
                  iconColor: "#2CC5C0",
                  actionTypeId: NOTIFICATION_ACTION_TYPE,
                  extra: { peptideId: p.id, scheduledDate: dateToKey(schedDate), time: tStr }
                });
              }
            }
          }
        }

        // Resumo diário no mesmo horizonte das aplicações
        if (this.cfg.summary) {
          const [sh, sm] = this.cfg.summary.split(":").map(Number);
          if (isValidTime(this.cfg.summary)) {
            for (let dayOffset = 0; dayOffset < NOTIFICATION_HORIZON_DAYS; dayOffset++) {
              const sumDate = new Date(now);
              sumDate.setDate(now.getDate() + dayOffset);
              sumDate.setHours(sh, sm, 0, 0);

              if (sumDate.getTime() > now.getTime() && summaryEligibleDays.has(dateToKey(sumDate))) {
                notifications.push({
                  id: notifId++,
                  title: "Protocolo PEP · Resumo Diário",
                  body: "Verifique suas doses de peptídeos programadas para hoje.",
                  channelId: activeChannelId,
                  schedule: schedulingPolicy.allowWhileIdle
                    ? { at: sumDate, allowWhileIdle: true }
                    : { at: sumDate },
                  smallIcon: "ic_stat_pep",
                  iconColor: "#2CC5C0"
                });
              }
            }
          }
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
          console.log(`[Notif] ${notifications.length} lembretes nativos agendados no canal ${activeChannelId}.`);
        }

        return {
          scheduledCount: notifications.length,
          schedulingMode: schedulingPolicy.mode,
          exactAlarmStatus: schedulingPolicy.exactAlarm.status
        };
      } catch (e) {
        console.warn("[Notif] Native scheduling error:", e);
        return {
          scheduledCount: 0,
          schedulingMode: schedulingPolicy.mode,
          exactAlarmStatus: schedulingPolicy.exactAlarm.status,
          error: e.message
        };
      }
    }

    return {
      scheduledCount: 0,
      schedulingMode: schedulingPolicy.mode,
      exactAlarmStatus: schedulingPolicy.exactAlarm.status
    };
  }

  schedulePeptideRemindersIfNeeded(peptides = [], { force = false, reason = "state-check" } = {}) {
    const day = dateToKey(new Date());
    const fingerprint = JSON.stringify({
      day,
      cfg: this.cfg,
      peptides
    });

    if (this.scheduleInFlight?.fingerprint === fingerprint && !force) {
      return this.scheduleInFlight.promise;
    }

    const run = async () => {
      if (!force && this.lastSchedule?.fingerprint === fingerprint) {
        if (!Capacitor.isNativePlatform()) {
          return { ...this.lastSchedule.result, skipped: true, reason };
        }
        try {
          const pending = await LocalNotifications.getPending();
          const pendingCount = pending?.notifications?.length || 0;
          if (pendingCount >= (this.lastSchedule.result.scheduledCount || 0)) {
            return { ...this.lastSchedule.result, skipped: true, reason };
          }
        } catch {
          // Falha de reconciliação: reagendar mantém o comportamento fail-safe.
        }
      }

      const result = await this.schedulePeptideReminders(peptides);
      if (!result?.error) this.lastSchedule = { fingerprint, result };
      return { ...result, skipped: false, reason };
    };

    const promise = (this.scheduleInFlight?.promise || Promise.resolve())
      .catch(() => {})
      .then(run)
      .finally(() => {
        if (this.scheduleInFlight?.promise === promise) this.scheduleInFlight = null;
      });
    this.scheduleInFlight = { fingerprint, promise };
    return promise;
  }
}

export const notifications = new NotificationService();
