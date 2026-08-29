/**
 * Serviço de Segurança: Bloqueio do App por Biometria / Credenciais do Dispositivo (V13)
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & Offline: Autenticação direta e local via Keystore/BiometricPrompt do Android.
 * - Não bloqueio permanente: Suporte a fallback de credenciais do dispositivo (PIN/Padrão/Senha).
 * - Resiliência: Tratamento gracioso quando executando em navegadores ou dispositivos sem biometria.
 */

import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { App } from "@capacitor/app";

const STORAGE_KEY = "pep_app_lock_enabled";

export class AppLockService {
  constructor() {
    this.isLocked = false;
    this.listeners = new Set();
    this.isLifecycleInitialized = false;
  }

  isSupported() {
    return Capacitor.isNativePlatform();
  }

  async checkBiometricAvailability() {
    if (!this.isSupported()) {
      return { isAvailable: true, biometryType: "web-simulation", isNative: false };
    }

    try {
      const result = await NativeBiometric.isAvailable({ useFallback: true });
      return {
        isAvailable: Boolean(result && result.isAvailable),
        biometryType: result ? result.biometryType : null,
        isNative: true
      };
    } catch (err) {
      console.warn("[AppLock] Verificação de biometria indisponível:", err);
      return { isAvailable: false, biometryType: null, error: err.message, isNative: true };
    }
  }

  isLockEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  setLockEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
      this.notify();
      return true;
    } catch (e) {
      console.error("[AppLock] Erro ao salvar configuração de bloqueio:", e);
      return false;
    }
  }

  async authenticate({
    reason = "Para acessar o Protocolo PEP, confirme sua identidade.",
    title = "Protocolo PEP",
    subtitle = "Confirme sua biometria ou PIN",
    negativeButtonText = "Cancelar"
  } = {}) {
    if (!this.isSupported()) {
      // Em ambiente de teste ou navegador, simula sucesso para não travar desenvolvimento
      this.unlock();
      return { success: true };
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title,
        subtitle,
        negativeButtonText,
        useFallback: true,
        maxAttempts: 3
      });

      this.unlock();
      return { success: true };
    } catch (err) {
      console.warn("[AppLock] Autenticação não concluída ou cancelada:", err);
      return {
        success: false,
        error: err && err.message ? err.message : "Falha na autenticação biométrica"
      };
    }
  }

  lock() {
    if (this.isLockEnabled() && !this.isLocked) {
      this.isLocked = true;
      this.notify();
    }
  }

  unlock() {
    if (this.isLocked) {
      this.isLocked = false;
      this.notify();
    }
  }

  initLifecycleListeners() {
    if (this.isLifecycleInitialized) return;
    this.isLifecycleInitialized = true;

    try {
      if (typeof App !== "undefined" && typeof App.addListener === "function") {
        App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) {
            // App foi para o background -> arma o bloqueio imediatamente se estiver ativado
            if (this.isLockEnabled()) {
              this.lock();
            }
          }
        });
      }
    } catch (e) {
      console.warn("[AppLock] Não foi possível registrar listener de appStateChange:", e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          isLocked: this.isLocked,
          isLockEnabled: this.isLockEnabled()
        });
      } catch (e) {
        console.error("[AppLock] Listener error:", e);
      }
    }
  }
}

export const appLock = new AppLockService();
