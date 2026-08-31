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
    notifService.saveConfig({ enabled: true, sound: false, summary: "08:00", discreteMode: true });
    expect(notifService.getConfig().enabled).toBe(true);
    expect(notifService.getConfig().sound).toBe(false);
    expect(notifService.getConfig().discreteMode).toBe(true);
  });

  it("permite cancelamento direcionado por ID de peptídeo", async () => {
    expect(typeof notifService.cancelScheduleForPeptide).toBe("function");
    await expect(notifService.cancelScheduleForPeptide("pep-123")).resolves.not.toThrow();
  });

  it("dispara notificação instantânea de teste com payload correto", async () => {
    const res = await notifService.sendInstantNotification("Título Teste", "Corpo Teste");
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
  });

  it("verifica permissão e chamada de exact alarm em runtime", async () => {
    const checkRes = await notifService.checkExactAlarmPermission();
    expect(checkRes).toBeDefined();
    expect(checkRes.granted).toBe(true);

    const reqRes = await notifService.requestExactAlarmPermission();
    expect(reqRes).toBeDefined();
    expect(reqRes.granted).toBe(true);
  });
});
