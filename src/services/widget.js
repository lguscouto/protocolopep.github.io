/**
 * Serviço de Integração com o Widget Nativo Android (V14)
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & 100% Offline: Sincronização direta com o AppWidgetManager do Android via Plugin Capacitor.
 * - Modo Discreto: Proteção de privacidade configurável localmente.
 * - Fail-Safe: Não bloqueia a execução caso o plugin ou plataforma não estejam disponíveis.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { calculateWidgetSummary } from "../domain/widget.js";

const PepWidget = registerPlugin("PepWidget");

const STORAGE_KEY_DISCRETE = "pep_widget_discrete_mode";

export class WidgetService {
  constructor() {
    this.plugin = PepWidget;
  }

  isDiscreteModeEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY_DISCRETE) === "true";
    } catch (e) {
      return false;
    }
  }

  setDiscreteModeEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY_DISCRETE, enabled ? "true" : "false");
      return true;
    } catch (e) {
      console.error("[WidgetService] Erro ao salvar preferência de modo discreto:", e);
      return false;
    }
  }

  async syncWidget({ peptides = [], logs = {}, dateStr = null } = {}) {
    try {
      const discreteMode = this.isDiscreteModeEnabled();
      const summary = calculateWidgetSummary({
        peptides,
        logs,
        targetDate: dateStr || new Date(),
        discreteMode
      });

      if (Capacitor.isNativePlatform() && this.plugin && typeof this.plugin.updateWidgetData === "function") {
        await this.plugin.updateWidgetData(summary);
      }

      return { success: true, summary };
    } catch (err) {
      console.warn("[WidgetService] Falha ao sincronizar widget nativo:", err);
      return { success: false, error: err.message };
    }
  }
}

export const widgetService = new WidgetService();
