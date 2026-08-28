import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationService } from "../../src/services/notifications.js";

describe("Notifications Service", () => {
  let notifService;

  beforeEach(() => {
    notifService = new NotificationService();
  });

  it("inicializa com configurações padrão", () => {
    expect(notifService.getConfig().enabled).toBe(false);
    expect(notifService.getConfig().sound).toBe(true);
  });

  it("salva configurações no storage", () => {
    notifService.saveConfig({ enabled: true, sound: false, summary: "08:00" });
    expect(notifService.getConfig().enabled).toBe(true);
    expect(notifService.getConfig().sound).toBe(false);
  });
});
