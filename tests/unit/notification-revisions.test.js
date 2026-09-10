import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalNotifications } from "@capacitor/local-notifications";
import { NotificationService } from "../../src/services/notifications.js";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: {
  getPending: vi.fn(async () => ({ notifications: [] })),
  schedule: vi.fn(async () => ({})),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: "granted" }))
} }));

describe("Notification schedule revisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T07:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("uses the configuration valid at each reminder instant and honors lifecycle intervals", async () => {
    const config = { name: "Original", dose: "Informada", ui: 2.5, start: "2026-09-01", times: ["08:00", "18:00"] };
    const changed = { ...config, name: "Novo nome", times: ["10:00", "20:00"], ui: 3.5 };
    const rev = (id, date, status, conf) => ({ id, effectiveFrom: new Date(date).toISOString(), status, config: conf });
    const protocol = { id: "p1", ...changed, lifecycleStatus: "ended", revisions: [
      rev("r1", "2026-09-01T09:00:00", "active", config),
      rev("r2", "2026-09-02T12:00:00", "paused", config),
      rev("r3", "2026-09-04T09:00:00", "active", changed),
      rev("r4", "2026-09-05T12:00:00", "ended", changed)
    ] };
    const service = new NotificationService();
    service.cfg = { ...service.cfg, enabled: true, discreteMode: false };
    const result = await service.schedulePeptideReminders([protocol]);
    expect(result.scheduledCount).toBe(5);
    const reminders = LocalNotifications.schedule.mock.calls[0][0].notifications;
    expect(reminders.map((item) => [item.schedule.at.getDate(), item.schedule.at.getHours(), item.title])).toEqual([
      [1, 18, "Lembrete: Original"], [2, 8, "Lembrete: Original"],
      [4, 10, "Lembrete: Novo nome"], [4, 20, "Lembrete: Novo nome"], [5, 10, "Lembrete: Novo nome"]
    ]);
    expect(reminders[0].body).toContain("2.5 UI");
    expect(reminders[2].body).toContain("3.5 UI");
  });

  it("does not schedule before a daily start or normalize an invalid clock time", async () => {
    const service = new NotificationService();
    service.cfg.enabled = true;
    const result = await service.schedulePeptideReminders([{ id: "p1", start: "2026-09-13", times: ["08:00", "25:00", "18:60"] }]);
    expect(result.scheduledCount).toBeGreaterThan(14);
    expect(LocalNotifications.schedule.mock.calls[0][0].notifications.slice(0, 2).map((item) => item.schedule.at.getDate())).toEqual([13, 14]);
  });

  it("ignores silenced routines and only creates a daily summary on an eligible day", async () => {
    const activeConfig = { name: "Com lembrete", times: ["08:00"], remindersEnabled: true };
    const revisions = [
      { id: "r1", effectiveFrom: "1900-01-01T00:00:00.000Z", status: "active", config: activeConfig },
      { id: "r2", effectiveFrom: "2026-09-02T00:00:00.000Z", status: "ended", config: activeConfig }
    ];
    const service = new NotificationService();
    service.cfg = { ...service.cfg, enabled: true, summary: "21:00" };

    const result = await service.schedulePeptideReminders([
      { id: "enabled", ...activeConfig, lifecycleStatus: "ended", revisions },
      { id: "silenced", name: "Silenciada", times: ["09:00"], remindersEnabled: false, lifecycleStatus: "active" }
    ]);

    expect(result.scheduledCount).toBe(2);
    const scheduled = LocalNotifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled.map((item) => item.schedule.at.getHours())).toEqual([8, 21]);
    expect(scheduled.some((item) => item.extra?.peptideId === "silenced")).toBe(false);
  });

  it("honors reminder preference changes at the exact revision instant", async () => {
    const enabled = { name: "Rotina", times: ["08:00", "18:00"], remindersEnabled: true };
    const disabled = { ...enabled, remindersEnabled: false };
    const protocol = { id: "revised", ...disabled, lifecycleStatus: "active", revisions: [
      { id: "r1", effectiveFrom: "1900-01-01T00:00:00.000Z", status: "active", config: enabled },
      { id: "r2", effectiveFrom: "2026-09-02T12:00:00.000Z", status: "active", config: disabled }
    ] };
    const service = new NotificationService();
    service.cfg.enabled = true;

    const result = await service.schedulePeptideReminders([protocol]);
    expect(result.scheduledCount).toBe(3);
    expect(LocalNotifications.schedule.mock.calls[0][0].notifications.map((item) => [item.schedule.at.getDate(), item.schedule.at.getHours()])).toEqual([
      [1, 8], [1, 18], [2, 8]
    ]);
  });

  it("invalidates the scheduling fingerprint when a routine is silenced", async () => {
    const service = new NotificationService();
    service.schedulePeptideReminders = vi.fn(async () => ({ scheduledCount: 0 }));
    const enabled = [{ id: "p1", times: ["08:00"], remindersEnabled: true }];
    const silenced = [{ ...enabled[0], remindersEnabled: false }];

    await service.schedulePeptideRemindersIfNeeded(enabled);
    await service.schedulePeptideRemindersIfNeeded(enabled);
    await service.schedulePeptideRemindersIfNeeded(silenced);
    expect(service.schedulePeptideReminders).toHaveBeenCalledTimes(2);
  });

  it("keeps the global notification switch authoritative", async () => {
    const service = new NotificationService();
    service.cfg.enabled = false;
    const result = await service.schedulePeptideReminders([{
      id: "enabled",
      name: "Rotina",
      times: ["08:00"],
      remindersEnabled: true,
      lifecycleStatus: "active"
    }]);

    expect(result).toMatchObject({ scheduledCount: 0, schedulingMode: "disabled" });
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });
});
