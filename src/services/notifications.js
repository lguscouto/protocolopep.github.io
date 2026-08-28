import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { haptics } from "./haptics.js";
import { isScheduledOnDate } from "../domain/schedule.js";

const NOTIF_CFG_KEY = "pep_notif_config";
export const NOTIF_CHANNEL_ID = "pep_lembretes";

export class NotificationService {
  constructor() {
    this.cfg = { enabled: false, sound: true, summary: "" };
    this.audioCtx = null;
  }

  async init() {
    try {
      const saved = localStorage.getItem(NOTIF_CFG_KEY);
      if (saved) {
        this.cfg = { ...this.cfg, ...JSON.parse(saved) };
      }
    } catch (e) {}

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.createChannel({
          id: NOTIF_CHANNEL_ID,
          name: "Lembretes de Peptídeos",
          description: "Notificações para horários de doses do seu protocolo",
          importance: 5,
          visibility: 1,
          vibration: true
        });
      } catch (e) {
        console.warn("[Notif] Channel creation error:", e);
      }
    }
  }

  getConfig() {
    return this.cfg;
  }

  saveConfig(newCfg) {
    this.cfg = { ...this.cfg, ...newCfg };
    try {
      localStorage.setItem(NOTIF_CFG_KEY, JSON.stringify(this.cfg));
    } catch (e) {}
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
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: title,
              body: body,
              channelId: NOTIF_CHANNEL_ID,
              smallIcon: "ic_stat_pep",
              iconColor: "#2CC5C0"
            }
          ]
        });
        if (this.cfg.sound) haptics.light();
      } catch (err) {
        console.warn("[Notif] Send instant error:", err);
      }
    } else {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "icon-192.png" });
        if (this.cfg.sound) {
          this.beep();
          haptics.light();
        }
      }
    }
  }

  async cancelAllPepReminders() {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel(pending);
          console.log(`[Notif] ${pending.notifications.length} lembretes pendentes cancelados.`);
        }
      } catch (e) {
        console.warn("[Notif] Erro ao cancelar lembretes pendentes:", e);
      }
    }
  }

  async schedulePeptideReminders(peptides = []) {
    // 1. Sempre cancelar lembretes anteriores
    await this.cancelAllPepReminders();

    // Se notificações estiverem desativadas, parar por aqui garantindo que nada fique agendado
    if (!this.cfg.enabled) {
      return { scheduledCount: 0 };
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const notifications = [];
        let notifId = 1000;
        const now = new Date();

        // Agendar horizonte de 14 dias concretos baseados no motor puro de agenda
        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + dayOffset);

          for (const p of peptides) {
            if (!isScheduledOnDate(p, targetDate)) continue;

            const timeList = Array.isArray(p.times) && p.times.length > 0
              ? p.times
              : (p.time ? [p.time] : []);

            for (const tStr of timeList) {
              const [h, m] = tStr.split(":").map(Number);
              if (isNaN(h) || isNaN(m)) continue;

              const schedDate = new Date(targetDate);
              schedDate.setHours(h, m, 0, 0);

              // Apenas agendar se a data/hora for futura
              if (schedDate.getTime() > now.getTime()) {
                notifications.push({
                  id: notifId++,
                  title: `Lembrete: ${p.name}`,
                  body: `${p.ui ? p.ui + " UI · " : ""}${p.dose ? p.dose : "Dose programada"}${p.sub ? " (" + p.sub + ")" : ""}`,
                  channelId: NOTIF_CHANNEL_ID,
                  schedule: { at: schedDate, allowWhileIdle: true },
                  smallIcon: "ic_stat_pep",
                  iconColor: "#2CC5C0"
                });
              }
            }
          }
        }

        // Resumo diário nos próximos 14 dias
        if (this.cfg.summary) {
          const [sh, sm] = this.cfg.summary.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm)) {
            for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
              const sumDate = new Date(now);
              sumDate.setDate(now.getDate() + dayOffset);
              sumDate.setHours(sh, sm, 0, 0);

              if (sumDate.getTime() > now.getTime()) {
                notifications.push({
                  id: notifId++,
                  title: "Protocolo PEP · Resumo Diário",
                  body: "Verifique suas doses de peptídeos programadas para hoje.",
                  channelId: NOTIF_CHANNEL_ID,
                  schedule: { at: sumDate, allowWhileIdle: true },
                  smallIcon: "ic_stat_pep",
                  iconColor: "#2CC5C0"
                });
              }
            }
          }
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
          console.log(`[Notif] ${notifications.length} lembretes nativos agendados.`);
        }

        return { scheduledCount: notifications.length };
      } catch (e) {
        console.warn("[Notif] Native scheduling error:", e);
        return { scheduledCount: 0, error: e.message };
      }
    }

    return { scheduledCount: 0 };
  }
}

export const notifications = new NotificationService();
