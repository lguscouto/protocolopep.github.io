import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppLockService } from "../../src/services/app-lock.js";

describe("App Lock Service (V13)", () => {
  let service;
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: vi.fn((k) => mockStore[k] || null),
      setItem: vi.fn((k, v) => { mockStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete mockStore[k]; }),
      clear: vi.fn(() => { mockStore = {}; })
    };
    service = new AppLockService();
  });

  it("inicia com bloqueio desativado por padrão", () => {
    expect(service.isLockEnabled()).toBe(false);
    expect(service.isLocked).toBe(false);
  });

  it("permite ativar e desativar o bloqueio persistido", () => {
    const success = service.setLockEnabled(true);
    expect(success).toBe(true);
    expect(service.isLockEnabled()).toBe(true);
    expect(global.localStorage.getItem("pep_app_lock_enabled")).toBe("true");

    service.setLockEnabled(false);
    expect(service.isLockEnabled()).toBe(false);
    expect(global.localStorage.getItem("pep_app_lock_enabled")).toBe("false");
  });

  it("tranca o aplicativo somente se o bloqueio estiver ativado", () => {
    service.setLockEnabled(false);
    service.lock();
    expect(service.isLocked).toBe(false);

    service.setLockEnabled(true);
    service.lock();
    expect(service.isLocked).toBe(true);

    service.unlock();
    expect(service.isLocked).toBe(false);
  });

  it("notifica inscritos nas mudanças de estado de bloqueio", () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    service.setLockEnabled(true);
    expect(listener).toHaveBeenCalledWith({
      isLocked: false,
      isLockEnabled: true
    });

    service.lock();
    expect(listener).toHaveBeenCalledWith({
      isLocked: true,
      isLockEnabled: true
    });

    unsubscribe();
    service.unlock();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("autentica graciosamente em ambiente de teste/fallback", async () => {
    service.setLockEnabled(true);
    service.lock();
    expect(service.isLocked).toBe(true);

    const res = await service.authenticate();
    expect(res.success).toBe(true);
    expect(service.isLocked).toBe(false);
  });
});
