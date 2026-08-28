import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { haptics } from "./haptics.js";

const NOTIF_CFG_KEY = "pep_notif_config";

class NotificationService {
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
          id: "pep_lembretes",
          name: "Lembretes de Peptídeos",
          description: "Notificações para horários de doses do seu protocolo",
          importance: 5,
          visibility: 1,
          sound: "beep.wav",
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
      return "Notification" in window && Notification.permission === "granted";
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
    } else if ("Notification" in window) {
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
      if (!this.audioCtx) {
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
              channelId: "pep_lembretes",
              smallIcon: "ic_stat_icon_config_sample",
              iconColor: "#2CC5C0"
            }
          ]
        });
        if (this.cfg.sound) haptics.light();
      } catch (err) {
        console.warn("[Notif] Send instant error:", err);
      }
    } else {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "icon-192.png" });
        if (this.cfg.sound) {
          this.beep();
          haptics.light();
        }
      }
    }
  }

  async schedulePeptideReminders(peptides) {
    if (!this.cfg.enabled) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // Cancelar agendamentos anteriores
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel(pending);
        }

        const notifications = [];
        let idCount = 100;

        for (const p of peptides) {
          if (!p.time) continue;
          const [h, m] = p.time.split(":").map(Number);
          if (isNaN(h) || isNaN(m)) continue;

          // Agendamento diário recorrente nativo no Android
          notifications.push({
            id: idCount++,
            title: `Hora do ${p.name}`,
            body: `${p.ui} UI ${p.dose ? "· " + p.dose : ""}${p.sub ? " (" + p.sub + ")" : ""}`,
            channelId: "pep_lembretes",
            schedule: {
              on: {
                hour: h,
                minute: m
              },
              allowWhileIdle: true
            },
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#2CC5C0"
          });
        }

        // Resumo diário
        if (this.cfg.summary) {
          const [sh, sm] = this.cfg.summary.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm)) {
            notifications.push({
              id: 999,
              title: "Protocolo PEP · Resumo do Dia",
              body: "Verifique suas doses de peptídeos programadas para hoje.",
              channelId: "pep_lembretes",
              schedule: {
                on: {
                  hour: sh,
                  minute: sm
                },
                allowWhileIdle: true
              },
              smallIcon: "ic_stat_icon_config_sample",
              iconColor: "#2CC5C0"
            });
          }
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
          console.log(`[Notif] ${notifications.length} lembretes nativos agendados.`);
        }
      } catch (e) {
        console.warn("[Notif] Native scheduling error:", e);
      }
    }
  }
}

export const notifications = new NotificationService();
