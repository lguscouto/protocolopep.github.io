import "./css/variables.css";
import "./css/base.css";
import "./css/primitives.css";
import "./css/animated-bg.css";
import "./css/components.css";

import { storage } from "./services/storage.js";
import { createFeatureLoader, scheduleIdleWork } from "./services/feature-loader.js";
import { createViewCoordinator } from "./services/view-coordinator.js";
import { startAnimatedBackground } from "./services/animated-background.js";
import { commitAction } from "./services/committed-action.js";
import { theme } from "./services/theme.js";
import { haptics } from "./services/haptics.js";
import { notifications } from "./services/notifications.js";
import { appBridge } from "./services/app-bridge.js";
import { LIBRARY, EXTENDED_COMPOUND_CATALOG, PALETTE } from "./data/default-library.js";
import {
  dateToKey,
  daysBetween,
  isScheduledOnDate,
  getScheduledPeptides,
  calculateDayProgress,
  getUpcomingOccurrences,
  calculateBackfillDates
} from "./domain/schedule.js";
import {
  createDoseCardViewModel,
  createDashboardFocusViewModel,
  renderDashboardFocusHTML,
  renderEmptyDashboardHTML
} from "./ui/dashboard.js";
import { createPeptide, validatePeptide } from "./domain/protocol.js";
import { buildDailyApplicationProgress, parseUnits, doseEntries, doseStatus, summarizeDoseEntries } from "./domain/dose-state.js";
import { resolveProtocolAt, resolveProtocolForDay, reviseProtocol } from "./domain/protocol-history.js";
import { renderProtocolList, renderProtocolControls, changeProtocolStatus } from "./ui/protocol-lifecycle.js";
import { isValidDateKey, isValidTime } from "./domain/schedule.js";
import { escapeHtml, sanitizeColor, sanitizeId } from "./ui/dom.js";
import { shouldShowOnboarding, showOnboarding } from "./ui/onboarding.js";
import { createDoseLog, validateDoseLog, normalizeDoseEntry } from "./domain/dose-log.js";
import { generateDailySummary } from "./domain/daily-summary.js";
import { updateNotificationUI, setupNotificationListeners } from "./ui/notification-settings.js";
import { calculateRemainingDoses, getExpirationStatus } from "./domain/inventory.js";
import { getNextSite, getLastUsedSite } from "./domain/injection-sites.js";
import { createRevisionedPerformanceIndexes } from "./domain/performance-indexes.js";
import { getDoseDisplayData as getDoseDisplayDataCore } from "./domain/dose-display.js";
import { appLock } from "./services/app-lock.js";
import { setupAppLockUI } from "./ui/app-lock.js";
import { dialogService } from "./services/dialog.js";
import { i18nService } from "./services/i18n.js";
import { setupI18nUI, applyTranslations } from "./ui/i18n.js";
import { accessibilityService } from "./services/accessibility.js";
import { setupAccessibilityUI } from "./ui/accessibility.js";
import { setupModalController } from "./ui/modal-controller.js";
import { DoseService } from "./services/dose-service.js";
import { openRetroLogModal as openRetroModal, saveRetroLog as saveRetro } from "./ui/retro-log.js";
import { buildQuickRegisterContext } from "./domain/quick-register.js";
import { setupQuickRegister } from "./ui/quick-register.js";
import { showActionFeedback } from "./ui/action-feedback.js";
import { createJourney, normalizeTabTarget } from "./ui/journey.js";
import { App } from "@capacitor/app";

export { accessibilityService };
export const doseService = new DoseService(storage);
let accessibilityUI = null;

const esc = escapeHtml;

function fmtBR(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function administrationLabel(item = {}) {
  const quantity = item.administrationQuantity;
  const unit = item.administrationUnit;
  if (quantity !== null && quantity !== undefined && unit) return `${quantity} ${unit === "tablet" ? "comprimido(s)" : unit === "capsule" ? "cápsula(s)" : unit === "ml" ? "mL" : "UI"}`;
  return item.ui !== null && item.ui !== undefined ? `${item.ui} UI` : "";
}

function showToast(msg, options = {}) {
  showActionFeedback(msg, options);
}

const dateKey = dateToKey;

function syncAppWidget() {
  if (!widgetService) return;
  widgetService.syncWidget({
    peptides: storage.getPeptides(),
    logs: storage.getLogs(),
    dateStr: dateKey(new Date())
  });
}

let currentTab = "today";
let editingPeptideId = null;
let pendingCalculationSnapshot = null;
let inventoryUI = null;
let sitesUI = null;
let measurementsUI = null;
let appLockUI = null;
let healthConnectUI = null;
let i18nUI = null;
let researchUI = null;
let quickRegisterUI = null;
let journeyUI = null;
let adherencePeriodDays = 7;
const historyFilters = { period: "30", compoundId: "all", eventType: "all", query: "", startDate: null, endDate: null };
const progressFilters = { period: "30", startDate: null, endDate: null };
let historyBodyMetric = "weight";
let historyRevisionCompoundId = "";

let getDoseDisplayData = null;
let buildReviewModel = null;
let buildBodyMetricChartModel = null;
let calculateWeightGoalIndicators = null;
let buildProtocolRevisionMarkerModel = null;
let buildProgressSummary = null;
let renderProgressOverviewHTML = null;
let renderBodyMetricChart = null;
let calculateAdherenceSummary = null;
let renderAdherenceSummaryHTML = null;
let exportFile = null;
let shareExportedFile = null;
let recordBackupExport = null;
let renderBackupStatusUI = () => {};
let widgetService = null;
let settingsMenuUI = null;
const performanceIndexes = createRevisionedPerformanceIndexes(() => storage.getRevision());

const deferredDom = new Map();

function parkFeatureDom(feature, { childHosts = [], elements = [] } = {}) {
  const records = deferredDom.get(feature) || [];
  childHosts.forEach((selector) => {
    const host = document.querySelector(selector);
    if (!host || host.dataset.pepDeferred === "true") return;
    const anchor = document.createComment(`pep:${feature}`);
    const fragment = document.createDocumentFragment();
    while (host.firstChild) fragment.appendChild(host.firstChild);
    host.appendChild(anchor);
    host.dataset.pepDeferred = "true";
    records.push({ type: "children", host, anchor, fragment });
  });
  elements.forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element || element.dataset.pepDeferred === "true") return;
    const anchor = document.createComment(`pep:${feature}`);
    element.before(anchor);
    element.remove();
    element.dataset.pepDeferred = "true";
    records.push({ type: "element", element, anchor });
  });
  deferredDom.set(feature, records);
}

function restoreFeatureDom(feature) {
  const records = deferredDom.get(feature) || [];
  records.forEach((record) => {
    if (record.type === "children") {
      record.anchor.before(record.fragment);
      record.anchor.remove();
      delete record.host.dataset.pepDeferred;
    } else {
      record.anchor.replaceWith(record.element);
      delete record.element.dataset.pepDeferred;
    }
  });
  deferredDom.delete(feature);
}

function prepareDeferredDom() {
  parkFeatureDom("agenda", { childHosts: ["#view-week"] });
  parkFeatureDom("history", { childHosts: ["#view-history"] });
  parkFeatureDom("measurements", { elements: ["#measurement-modal"] });
  parkFeatureDom("tools", { childHosts: ["#view-calc"], elements: ["#research-modal", "#compound-detail-modal"] });
  parkFeatureDom("settings", { elements: ["#backup-preview-modal", "#diag-modal", "#vial-modal", "#vial-history-modal", "#sites-modal", "#settings-panel-treatment", "#settings-panel-tools", "#settings-panel-app", "#settings-panel-data", "#settings-panel-help"] });
  parkFeatureDom("reporting", { elements: ["#report-modal"] });
}

async function loadFeature(loader, label) {
  try {
    return await loader.load();
  } catch (error) {
    void dialogService.alert({
      title: "Não foi possível abrir",
      message: `Falha ao carregar ${label}. Tente novamente.`,
      isDanger: true
    });
    throw error;
  }
}

const reportingFeature = createFeatureLoader(async () => {
  restoreFeatureDom("reporting");
  const { setupReportModal } = await import("./ui/report-preview.js");
  setupReportModal(storage);
});

const agendaFeature = createFeatureLoader(async () => {
  restoreFeatureDom("agenda");
  applyTranslations(document, i18nService);
  getDoseDisplayData = getDoseDisplayDataCore;
  document.getElementById("view-week")?.setAttribute("data-feature-ready", "true");
});

const measurementsFeature = createFeatureLoader(async () => {
  const { setupMeasurementsUI } = await import("./ui/measurements.js");
  restoreFeatureDom("measurements");
  applyTranslations(document, i18nService);
  measurementsUI = setupMeasurementsUI({
    storage,
    onMeasurementsChange: ({ type } = {}) => {
      invalidateViews("today", "history", "progress");
      healthConnectUI?.triggerAutoSync?.();
      showActionFeedback(i18nService.t(type === "weight" ? "experience.weightSaved" : type === "symptom" ? "experience.symptomSaved" : "experience.measurementsSaved"));
    }
  });
  return measurementsUI;
});

const historyFeature = createFeatureLoader(async () => {
  restoreFeatureDom("history");
  applyTranslations(document, i18nService);
  const [report, adherence, adherenceUi, measurementsModule, measurementsDomain, revisionMarkers, bodyMetricChartUi] = await Promise.all([
    import("./domain/report.js"),
    import("./domain/adherence.js"),
    import("./ui/adherence.js"),
    import("./ui/measurements.js"),
    import("./domain/measurements.js"),
    import("./domain/protocol-revision-markers.js"),
    import("./ui/body-metric-chart.js")
  ]);
  getDoseDisplayData = report.getDoseDisplayData;
  buildReviewModel = report.buildReviewModel;
  buildBodyMetricChartModel = measurementsModule.buildBodyMetricChartModel;
  calculateWeightGoalIndicators = measurementsDomain.calculateWeightGoalIndicators;
  buildProtocolRevisionMarkerModel = revisionMarkers.buildProtocolRevisionMarkerModel;
  renderBodyMetricChart = bodyMetricChartUi.renderBodyMetricChart;
  calculateAdherenceSummary = adherence.calculateAdherenceSummary;
  renderAdherenceSummaryHTML = adherenceUi.renderAdherenceSummaryHTML;
  await measurementsFeature.load();
  measurementsUI.bindHistoryControls();
  setupHistoryFilters();
  bindRestoredCoreControls();
  void reportingFeature.load();
  document.getElementById("view-history")?.setAttribute("data-feature-ready", "true");
});

const progressFeature = createFeatureLoader(async () => {
  const [report, adherence, adherenceUi, measurementsDomain, revisionMarkers, bodyMetricChartUi, progressDomain, progressUi] = await Promise.all([
    import("./domain/report.js"), import("./domain/adherence.js"), import("./ui/adherence.js"),
    import("./domain/measurements.js"), import("./domain/protocol-revision-markers.js"), import("./ui/body-metric-chart.js"),
    import("./domain/progress.js"), import("./ui/progress.js")
  ]);
  buildReviewModel = report.buildReviewModel;
  buildBodyMetricChartModel = measurementsDomain.buildBodyMetricChartModel;
  calculateWeightGoalIndicators = measurementsDomain.calculateWeightGoalIndicators;
  buildProtocolRevisionMarkerModel = revisionMarkers.buildProtocolRevisionMarkerModel;
  renderBodyMetricChart = bodyMetricChartUi.renderBodyMetricChart;
  calculateAdherenceSummary = adherence.calculateAdherenceSummary;
  renderAdherenceSummaryHTML = adherenceUi.renderAdherenceSummaryHTML;
  buildProgressSummary = progressDomain.buildProgressSummary;
  renderProgressOverviewHTML = progressUi.renderProgressOverviewHTML;
  await measurementsFeature.load();
  measurementsUI.bindHistoryControls();
  setupProgressFilters();
  document.getElementById("view-progress")?.setAttribute("data-feature-ready", "true");
});

const settingsFeature = createFeatureLoader(async () => {
  restoreFeatureDom("settings");
  applyTranslations(document, i18nService);
  settingsMenuUI ||= setupSettingsMenu();
  const [backupPreview, backupStatus, exportService, diagnostics, inventory, sites, healthService, healthUi, widget] = await Promise.all([
    import("./ui/backup-preview.js"),
    import("./ui/backup-status.js"),
    import("./services/export.js"),
    import("./ui/diagnostics.js"),
    import("./ui/inventory.js"),
    import("./ui/injection-sites.js"),
    import("./services/health-connect.js"),
    import("./ui/health-connect.js"),
    import("./services/widget.js")
  ]);
  exportFile = exportService.exportFile;
  shareExportedFile = exportService.shareExportedFile;
  recordBackupExport = backupStatus.recordBackupExport;
  renderBackupStatusUI = backupStatus.renderBackupStatusUI;
  widgetService = widget.widgetService;

  inventoryUI = inventory.setupInventoryUI({ storage, onInventoryChange: () => invalidateViews("today", "week", "history", "progress") });
  sitesUI = sites.setupInjectionSitesUI({ storage, onSitesChange: () => invalidateViews("today", "week", "history", "progress") });
  healthConnectUI = healthUi.setupHealthConnectUI({
    healthConnectService: healthService.healthConnect,
    storage,
    onSyncComplete: () => {
      measurementsUI?.renderList?.();
      invalidateViews("today", "history", "progress");
    },
    showToast,
    haptics
  });
  backupPreview.setupBackupPreview({
    storage,
    theme,
    notifications,
    onStateRestored: () => {
      invalidateViews("today", "week", "history", "progress");
      updateNotificationUI(storage.getPeptides());
    }
  });
  diagnostics.setupDiagnosticsModal({
    storage,
    getNotificationsActive: () => (window.pepNotifications ? window.pepNotifications.hasActiveReminders() : false),
    appVersion: "3.9.10"
  });
  const widgetToggle = document.getElementById("widget-discrete-toggle");
  if (widgetToggle && widgetToggle.dataset.widgetBound !== "true") {
    widgetToggle.dataset.widgetBound = "true";
    widgetToggle.checked = widgetService.isDiscreteModeEnabled();
    widgetToggle.addEventListener("change", () => {
      widgetService.setDiscreteModeEnabled(widgetToggle.checked);
      haptics.selection();
      syncAppWidget();
    });
  }
  bindCalculatorInventoryButton();
  bindRestoredCoreControls();
  renderBackupStatusUI();
  void reportingFeature.load();
  document.getElementById("view-settings")?.setAttribute("data-feature-ready", "true");
});

const toolsFeature = createFeatureLoader(async () => {
  restoreFeatureDom("tools");
  applyTranslations(document, i18nService);
  const [calculator, researchServiceModule, researchUi] = await Promise.all([
    import("./ui/calculator.js"),
    import("./services/research.js"),
    import("./ui/research.js")
  ]);
  calculator.setupCalculatorUI({
    haptics,
    onUseCalculation: ({ dose, ui, calculationSnapshot }) => openEditModal(null, { dose, ui, calculationSnapshot })
  });
  researchUI = researchUi.setupResearchUI({
    researchService: researchServiceModule.researchService,
    onOpenCalculator: (compound) => {
      void switchTab("calc");
      showToast(`Calculadora aberta: ${compound.name}`);
      setTimeout(() => document.getElementById("calc-dose-input")?.focus(), 150);
    },
    onAddToProtocol: (compound) => {
      void switchTab("today");
      openEditModal(null, { name: compound.name, sub: compound.categoryLabel, accent: compound.accentColor });
      showToast(`Iniciando cadastro de ${compound.name}`);
    }
  });
  const vialButton = document.getElementById("calc-save-vial-btn");
  if (vialButton && settingsFeature.state !== "ready") {
    vialButton.addEventListener("click", async (event) => {
      if (settingsFeature.state === "ready") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      await loadFeature(settingsFeature, "os frascos");
      vialButton.click();
    });
  }
  if (settingsFeature.state === "ready") bindCalculatorInventoryButton();
  bindRestoredCoreControls();
  document.getElementById("view-calc")?.setAttribute("data-feature-ready", "true");
});

const viewCoordinator = createViewCoordinator({
  initialView: "today",
  renderers: { today: renderToday, week: renderWeek, history: renderHistory, progress: renderProgress }
});

function invalidateViews(...views) {
  viewCoordinator.invalidate(...views);
}

function bindCalculatorInventoryButton() {
  const button = document.getElementById("calc-save-vial-btn");
  if (!button || button.dataset.inventoryBound === "true" || !inventoryUI) return;
  button.dataset.inventoryBound = "true";
  button.addEventListener("click", () => {
    haptics.light();
    const mg = parseFloat(document.querySelector("#calc-mg-chips .chip.sel")?.dataset.v || "5");
    const waterMl = parseFloat(document.querySelector("#calc-ml-chips .chip.sel")?.dataset.v || "2");
    const select = document.getElementById("calc-peptide-select");
    const name = select?.value && select.value !== "custom" ? select.options[select.selectedIndex]?.textContent.split(" (")[0].trim() || "" : "";
    inventoryUI.openVialModal(null, { mg, waterMl, name });
  });
}

function bindRestoredCoreControls() {
  const bind = (id, event, handler) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.coreBound === "true") return;
    element.dataset.coreBound = "true";
    element.addEventListener(event, handler);
  };
  bind("hist-retro-btn", "click", () => { openRetroLogModal(); haptics.light(); });
  bind("calc-back-btn", "click", () => { haptics.light(); void switchTab("settings"); });
  ["hist-report-btn", "settings-report-btn"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button || button.dataset.reportGuardBound === "true") return;
    button.dataset.reportGuardBound = "true";
    button.addEventListener("click", async (event) => {
      if (reportingFeature.state === "ready") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      await loadFeature(reportingFeature, "os relatórios");
      button.click();
    });
  });
}

async function initApp() {
  prepareDeferredDom();
  await theme.init({ deferNative: true });
  const storageState = storage.init();
  if (storageState.error) void dialogService.alert({ title: "Falha no armazenamento", message: storageState.error, isDanger: true });
  if (i18nService.getLocale() !== "pt-BR") {
    await i18nService.ensureLocaleLoaded();
  }
  await notifications.init({ deferNative: true });
  notifications.setupActionListener({
    onRegister: ({ peptideId, scheduledDate }) => {
      switchTab("today");
      openRetroLogModal(scheduledDate || dateKey(new Date()), peptideId, { requireSiteSelection: true });
    },
    onSnooze: (payload) => notifications.snoozeNotification(payload),
    onSkip: ({ peptideId, scheduledDate }) => {
      switchTab("today");
      openRetroLogModal(scheduledDate || dateKey(new Date()), peptideId, { initialStatus: "missed" });
    }
  });
  if (typeof App.addListener === "function") {
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && notifications.isEnabled()) {
        void notifications.schedulePeptideRemindersIfNeeded(storage.getPeptides(), { reason: "app-resume" });
      }
    });
  }
  initAnimatedBg();
  setupModalController();

  appBridge.init(
    () => {
      const onboardingOverlay = document.getElementById("onboarding-overlay");
      if (onboardingOverlay) {
        if (!shouldShowOnboarding()) {
          onboardingOverlay.remove();
          return true;
        }
        return true; // Bloqueia saída acidental enquanto no onboarding inicial obrigatório
      }
      const openModal = document.querySelector(".modal.on, .sheet.on, #retro-overlay[style*='flex'], #notif-modal.on");
      if (openModal) {
        closeAllModals();
        return true;
      }
      return false;
    },
    () => {
      if (currentTab !== "today") {
        switchTab("today");
        return true;
      }
      return false;
    }
  );

  if (shouldShowOnboarding()) {
    showOnboarding();
  }

  const dateEl = document.getElementById("header-date");
  if (dateEl) {
    const today = new Date();
    dateEl.textContent = today.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  setupNavigation();
  journeyUI = createJourney({ onNavigate: (target) => void switchTab(target) });
  quickRegisterUI = setupQuickRegister({
    getContext: () => buildQuickRegisterContext(storage.getPeptides(), storage.getLogs(), new Date()),
    onApplication: (peptideId, scheduledDate) => openRetroLogModal(scheduledDate, peptideId, { requireSiteSelection: true, mode: "compact" }),
    onMeasurement: async (mode) => {
      await loadFeature(measurementsFeature, "o registro de medidas");
      measurementsUI.openMeasurementModal(null, null, { mode });
    },
    onEmpty: () => openEditModal()
  });
  setupRenderedEventDelegation();
  setupModalsAndButtons();
  setupNotificationListeners(storage);
  appLockUI = setupAppLockUI({
    appLockService: appLock,
    onUnlock: () => invalidateViews("today", "week", "history", "progress")
  });

  i18nUI = setupI18nUI({
    i18nService,
    onLocaleChange: () => {
      applyTranslations(document, i18nService);
      invalidateViews("today", "week", "history", "progress");
      if (inventoryUI && typeof inventoryUI.renderInventoryList === "function") {
        inventoryUI.renderInventoryList();
      }
      if (sitesUI && typeof sitesUI.updateSummary === "function") {
        sitesUI.updateSummary();
      }
      if (appLockUI && typeof appLockUI.updateSettingsLockCard === "function") {
        appLockUI.updateSettingsLockCard();
      }
      if (healthConnectUI && typeof healthConnectUI.updateSettingsCard === "function") {
        healthConnectUI.updateSettingsCard();
      }
    }
  });

  applyTranslations(document, i18nService);

  accessibilityUI = setupAccessibilityUI({
    accessibilityService,
    haptics,
    onCloseTopModal: () => {
      closeAllModals();
    }
  });

  viewCoordinator.render("today", { force: true });
  updateNotificationUI(storage.getPeptides());
  if (appLockUI && typeof appLockUI.updateSettingsLockCard === "function") {
    appLockUI.updateSettingsLockCard();
  }

  scheduleIdleWork(async () => {
    await theme.syncNativeStatusBar();
    await notifications.ensureNativeSetup();
    await notifications.schedulePeptideRemindersIfNeeded(storage.getPeptides(), { reason: "startup" });
    try {
      const { widgetService: service } = await import("./services/widget.js");
      widgetService = service;
      syncAppWidget();
    } catch (error) {
      console.warn("[Startup] Widget indisponível:", error);
    }
  });

  scheduleIdleWork(async () => {
    await Promise.allSettled([
      import("./domain/report.js"),
      import("./domain/adherence.js"),
      import("./ui/adherence.js"),
      import("./ui/measurements.js"),
      import("./ui/inventory.js"),
      import("./ui/injection-sites.js"),
      import("./ui/calculator.js"),
      import("./ui/research.js"),
      import("./services/research.js"),
      import("./ui/backup-preview.js"),
      import("./ui/backup-status.js"),
      import("./services/export.js"),
      import("./ui/diagnostics.js"),
      import("./services/health-connect.js"),
      import("./ui/health-connect.js"),
      import("./services/widget.js"),
      import("./ui/report-preview.js")
    ]);
    document.documentElement.setAttribute("data-pep-prefetch-ready", "true");
  }, { delay: 600, timeout: 1500 });
}

function initAnimatedBg() {
  startAnimatedBackground({ container: document.getElementById("bg-molecules"), theme });
}

function setupNavigation() {
  const navBtns = Array.from(document.querySelectorAll(".nav button"));
  navBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) {
        haptics.selection();
        switchTab(tab);
      }
    });

    btn.addEventListener("keydown", (e) => {
      let targetIndex = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        targetIndex = (index + 1) % navBtns.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        targetIndex = (index - 1 + navBtns.length) % navBtns.length;
      } else if (e.key === "Home") {
        targetIndex = 0;
      } else if (e.key === "End") {
        targetIndex = navBtns.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        const nextBtn = navBtns[targetIndex];
        nextBtn.focus();
        const tab = nextBtn.dataset.tab;
        if (tab) switchTab(tab);
      }
    });
  });

  // Listener global de acessibilidade para tecla Escape fechar modais
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModal = document.querySelector(".modal.on, .sheet.on, #retro-overlay[style*='flex']");
      if (openModal) {
        closeAllModals();
        haptics.light();
      }
    }
  });
}

async function switchTab(tabId) {
  const normalized = normalizeTabTarget(tabId, journeyUI?.segment || "upcoming");
  const primaryTab = normalized.tab;
  const journeySegment = normalized.segment;
  const previousTab = currentTab;
  if (previousTab === "settings" && primaryTab !== "settings") settingsMenuUI?.reset?.();
  if (journeySegment === "upcoming") restoreFeatureDom("agenda");
  if (journeySegment === "history") restoreFeatureDom("history");
  if (primaryTab === "calc") restoreFeatureDom("tools");
  activateTabShell(primaryTab);
  try {
    if (journeySegment === "upcoming") await loadFeature(agendaFeature, "os próximos registros");
    if (journeySegment === "history") await loadFeature(historyFeature, "o histórico");
    if (primaryTab === "progress") await loadFeature(progressFeature, "o progresso");
    if (primaryTab === "settings") await loadFeature(settingsFeature, "Mais");
    if (primaryTab === "calc") await loadFeature(toolsFeature, "as Ferramentas");
  } catch {
    activateTabShell(previousTab);
    return false;
  }

  if (primaryTab === "journey") {
    journeyUI?.activate(journeySegment);
    viewCoordinator.activate(journeySegment === "history" ? "history" : "week");
  } else {
    viewCoordinator.activate(primaryTab);
  }
  if (primaryTab === "settings") {
    updateNotificationUI(storage.getPeptides());
    renderBackupStatusUI();
    inventoryUI?.renderInventoryList?.();
    sitesUI?.updateSummary?.();
    appLockUI?.updateSettingsLockCard?.();
    const widgetToggle = document.getElementById("widget-discrete-toggle");
    if (widgetToggle && widgetService) widgetToggle.checked = widgetService.isDiscreteModeEnabled();
    healthConnectUI?.updateSettingsCard?.();
    i18nUI?.updateActiveLangUI?.(i18nService.getLocale());
    renderSettingsTreatments();
  }
  return true;
}

function activateTabShell(tabId) {
  currentTab = tabId;

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("on");
  });
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add("on");

  document.querySelectorAll(".nav button").forEach((btn) => {
    const isSelected = btn.dataset.tab === tabId;
    btn.classList.toggle("on", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    btn.setAttribute("tabindex", isSelected ? "0" : "-1");
  });

  const tabLabels = {
    today: "Hoje",
    journey: "Jornada",
    progress: "Progresso",
    calc: "Ferramentas",
    settings: "Mais e Preferências"
  };
  const headerTitle = document.getElementById("header-title");
  if (headerTitle) headerTitle.textContent = tabLabels[tabId] || tabId;
  accessibilityService.announce(`Aba ${tabLabels[tabId] || tabId} ativa.`);
}

function setupRenderedEventDelegation() {
  document.getElementById("view-today")?.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const today = dateKey(new Date());
    if (target.matches('[data-action="create-protocol"]')) return openEditModal();
    if (target.matches('[data-action="open-calc"]')) return void switchTab("calc");
    if (target.matches('[data-action="open-progress"]')) return void switchTab("progress");
    if (target.matches(".multi-dose-register")) return openRetroLogModal(today, target.dataset.id, { requireSiteSelection: true, initialStatus: "applied" });
    if (target.matches(".take")) {
      return target.classList.contains("done") ? void toggleDose(target.dataset.id) : openRetroLogModal(today, target.dataset.id, { requireSiteSelection: true });
    }
    if (target.matches(".dose-undo")) return void undoSingleDose(target.dataset.id);
    if (target.matches(".gear")) return openEditModal(target.dataset.id);
    if (target.matches(".del")) return void deletePeptide(target.dataset.id);
    if (target.id === "dash-focus-action") {
      const action = target.dataset.action;
      const peptideId = target.dataset.peptideId;
      if (["toggle-dose", "add-dose"].includes(action) && peptideId) return openRetroLogModal(today, peptideId, { requireSiteSelection: true });
      if (action === "open-week") return void switchTab("week");
      if (action === "add-peptide") return openEditModal();
    }
  });

  document.getElementById("view-week")?.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.matches(".week-event-edit")) {
      openEditModal(target.dataset.pep);
      haptics.light();
    }
    if (target.matches(".week-event-toggle")) {
      const index = target.dataset.logIndex === "" ? null : Number(target.dataset.logIndex);
      void toggleDateLog(target.dataset.pep, target.dataset.date, index);
    }
  });

  document.getElementById("view-history")?.addEventListener("click", async (event) => {
    const target = event.target.closest("button, [role='button']");
    if (!target) return;
    if (target.matches(".weight-chart-point")) {
      measurementsUI?.openMeasurementById(target.dataset.measurementId);
      return;
    }
    if (target.matches(".protocol-revision-marker")) {
      const detail = document.getElementById("history-protocol-revision-detail");
      if (detail) detail.textContent = target.dataset.detail || "";
      return;
    }
    if (target.id === "history-goal-clear-btn") {
      const result = storage.setMeasurementGoals({ goalWeightKg: null });
      if (!result.success) {
        void dialogService.alert({ title: "Meta não salva", message: result.error, isDanger: true });
        return;
      }
      haptics.success();
      invalidateViews("history");
      return;
    }
    if (target.matches("[data-adherence-days]")) {
      const days = Number.parseInt(target.dataset.adherenceDays, 10);
      if ([7, 30].includes(days) && days !== adherencePeriodDays) {
        adherencePeriodDays = days;
        renderAdherenceSummary();
      }
      return;
    }
    if (target.id === "empty-add-measurement-btn") return measurementsUI?.openMeasurementModal();
    if (target.matches(".hist-edit")) {
      const log = doseEntries(storage.getLogs()[target.dataset.date]?.[target.dataset.pep])[Number(target.dataset.idx)];
      if (log) openRetroModal(target.dataset.date, target.dataset.pep, { storage, dateKey, editingLog: log });
      return;
    }
    if (target.matches(".history-measurement-edit")) {
      measurementsUI?.openMeasurementById(target.dataset.id);
      return;
    }
    if (target.matches(".hist-rm") && await showConfirmDialog({ title: i18nService.t("dialogs.deleteRecordTitle"), message: i18nService.t("dialogs.deleteRecordMsg"), confirmText: i18nService.t("common.delete"), isDanger: true })) {
      deleteHistoryEntry(target.dataset.date, target.dataset.pep, Number(target.dataset.idx));
    }
  });

  const updateWeightChartDetail = (event) => {
    const revisionMarker = event.target.closest(".protocol-revision-marker");
    if (revisionMarker) {
      const detail = document.getElementById("history-protocol-revision-detail");
      if (detail) detail.textContent = revisionMarker.dataset.detail || "";
      return;
    }
    const point = event.target.closest(".weight-chart-point");
    if (!point) return;
    const detail = document.getElementById("history-weight-chart-detail");
    if (detail) detail.textContent = point.dataset.detail || "";
  };
  document.getElementById("view-progress")?.addEventListener("focusin", updateWeightChartDetail);
  document.getElementById("view-progress")?.addEventListener("pointerover", updateWeightChartDetail);
  document.getElementById("view-progress")?.addEventListener("click", (event) => {
    const target = event.target.closest("button, [role='button']");
    if (!target) return;
    if (target.dataset.progressRegister === "weight" || target.id === "empty-add-measurement-btn") {
      measurementsUI?.openMeasurementModal(null, null, { mode: "weight" });
    } else if (target.matches(".weight-chart-point")) {
      measurementsUI?.openMeasurementById(target.dataset.measurementId);
    } else if (target.id === "history-goal-clear-btn") {
      const result = storage.setMeasurementGoals({ goalWeightKg: null });
      if (result.success) { haptics.success(); invalidateViews("progress"); }
      else void dialogService.alert({ title: "Meta não salva", message: result.error, isDanger: true });
    } else if (target.matches("[data-adherence-days]")) {
      adherencePeriodDays = Number.parseInt(target.dataset.adherenceDays, 10);
      invalidateViews("progress");
    }
  });
  document.getElementById("view-progress")?.addEventListener("change", (event) => {
    if (event.target.id === "history-body-metric") historyBodyMetric = event.target.value;
    else if (event.target.id === "history-revision-compound") historyRevisionCompoundId = event.target.value;
    else return;
    invalidateViews("progress");
  });
  document.getElementById("view-progress")?.addEventListener("submit", (event) => {
    if (event.target.id !== "history-weight-goal-form") return;
    event.preventDefault();
    const input = document.getElementById("history-goal-weight-input");
    const result = storage.setMeasurementGoals({ goalWeightKg: input?.value ?? null });
    if (!result.success) {
      void dialogService.alert({ title: "Meta não salva", message: result.error, isDanger: true });
      return;
    }
    haptics.success();
    invalidateViews("progress");
  });
}

function drawRing(taken, total) {
  const circle = document.getElementById("ring-circle");
  const pctEl = document.getElementById("ring-pct");
  if (!circle || !pctEl) return;

  const pct = total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;
  const circumference = 2 * Math.PI * 18; // r=18
  const offset = circumference - (pct / 100) * circumference;

  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${offset}`;
  pctEl.textContent = `${pct}%`;
}

function dosesTaken(rec, id) {
  return summarizeDoseEntries(rec[id]).applied;
}

function dosesResolved(rec, id) { return summarizeDoseEntries(rec[id]).resolved; }

function renderMultiDoseDetails(progress) {
  const statusLabel = (status) => status === "pending"
    ? i18nService.t("common.pending")
    : i18nService.t(`phase1.${status}`);
  const occurrences = progress.occurrences.map((occurrence) => `
    <li class="multi-dose-detail-row" data-status="${sanitizeId(occurrence.status)}">
      <div class="multi-dose-detail-main">
        <strong>${esc(i18nService.t("phase4.occurrence", { position: occurrence.position }))}</strong>
        <span class="multi-dose-detail-status">${esc(statusLabel(occurrence.status))}</span>
      </div>
      <div class="multi-dose-detail-meta">
        <span>${esc(occurrence.scheduledTime
          ? i18nService.t("phase4.scheduledAt", { time: occurrence.scheduledTime })
          : i18nService.t("phase4.timeNotInformed"))}</span>
        ${occurrence.effectiveTime ? `<span>${esc(i18nService.t("phase4.recordedAt", { time: occurrence.effectiveTime }))}</span>` : ""}
        ${occurrence.reason ? `<span>${esc(i18nService.t("phase4.reason", { reason: occurrence.reason }))}</span>` : ""}
      </div>
    </li>`).join("");
  const extras = progress.extras.length ? `
    <div class="multi-dose-extra-heading">${esc(i18nService.t("phase4.extraRecords"))}</div>
    <ul class="multi-dose-extra-list">
      ${progress.extras.map((record, index) => `
        <li>
          <strong>${esc(i18nService.t("phase4.extraRecord", { position: index + 1 }))}</strong>
          <span>${esc(record.kind === "unknown" ? i18nService.t("phase4.unknownState") : statusLabel(record.status))}</span>
          ${record.time ? `<span>${esc(i18nService.t("phase4.recordedAt", { time: record.time }))}</span>` : ""}
          ${record.reason ? `<span>${esc(i18nService.t("phase4.reason", { reason: record.reason }))}</span>` : ""}
        </li>`).join("")}
    </ul>` : "";

  return `
    <details class="multi-dose-details">
      <summary>${esc(i18nService.t("phase4.details"))}</summary>
      <ol class="multi-dose-detail-list">${occurrences}</ol>
      ${extras}
    </details>`;
}

function renderToday() {
  const { peptides, logs, inventory, sites: configuredSites, measurements } = storage.readSnapshot(["peptides", "logs", "inventory", "sites", "measurements"]);
  const indexes = performanceIndexes.get({ logs, inventory });
  const lastSiteIndex = indexes.lastSites;
  const vialIndex = indexes.activeVials;
  const now = new Date();
  const todayK = dateKey(now);
  const rec = indexes.getRecordsForDate(todayK) || {};
  const container = document.getElementById("today-cards");
  const heroEl = document.getElementById("dash-hero");
  const focusContent = document.getElementById("dash-focus-content");
  const listHeading = document.getElementById("today-list-heading");
  const listSummary = document.getElementById("today-list-summary");
  const addPepBtn = document.getElementById("add-pep-btn");
  const actionsWrap = document.querySelector(".dash-actions-wrap");

  if (!container) return;
  container.innerHTML = "";

  if (peptides.length === 0) {
    if (heroEl) heroEl.style.display = "none";
    if (listHeading) listHeading.style.display = "none";
    if (addPepBtn) addPepBtn.style.display = "none";
    if (actionsWrap) actionsWrap.style.display = "none";

    container.innerHTML = renderEmptyDashboardHTML();

    drawRing(0, 0);
    syncAppWidget();
    return;
  }

  // Com protocolos cadastrados
  if (heroEl) heroEl.style.display = "";
  if (addPepBtn) addPepBtn.style.display = "";
  if (actionsWrap) actionsWrap.style.display = "";

  const scheduledToday = getScheduledPeptides(peptides, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const upcoming = getUpcomingOccurrences(peptides, tomorrow, 3);
  const dayProgress = calculateDayProgress(peptides, logs, now);
  const todayItems = scheduledToday.map((peptide) => {
    const lastUsed = lastSiteIndex.byPeptide.get(peptide.id) || null;
    return {
      ...peptide,
      takenCount: dosesTaken(rec, peptide.id),
      resolvedCount: dosesResolved(rec, peptide.id),
      skippedCount: summarizeDoseEntries(rec[peptide.id]).skipped,
      missedCount: summarizeDoseEntries(rec[peptide.id]).missed,
      nextSite: getNextSite(configuredSites, lastUsed ? lastUsed.site : null),
      lastSite: lastUsed ? lastUsed.site : null
    };
  });
  const focusModel = createDashboardFocusViewModel({
    todayItems,
    upcoming,
    locale: i18nService.getLocale()
  });
  focusModel.locale = i18nService.getLocale();

  if (heroEl) {
    heroEl.dataset.state = focusModel.state;
    heroEl.setAttribute("aria-label", `${focusModel.eyebrow}: ${focusModel.title}`);
  }
  if (focusContent) focusContent.innerHTML = renderDashboardFocusHTML(focusModel);
  const remainingToday = focusModel.state === "pending" ? scheduledToday.filter((item) => item.id !== focusModel.peptideId) : [];
  if (listHeading) listHeading.style.display = remainingToday.length > 0 ? "" : "none";
  if (listSummary) {
    listSummary.textContent = i18nService.t("phase1.dayProgress", {
      taken: dayProgress.scheduledTaken,
      due: dayProgress.totalDue,
      skipped: dayProgress.skippedCount,
      missed: dayProgress.missedCount,
      pending: dayProgress.pendingCount
    });
  }

  if (remainingToday.length > 0) {
    remainingToday.forEach((p) => {
      const perDay = p.perDay || 1;
      const tomadas = dosesTaken(rec, p.id);
      const records = doseEntries(rec[p.id]);
      const progress = buildDailyApplicationProgress({ peptide: p, records });
      const states = progress;
      const resolved = progress.resolved;

      const lastUsed = lastSiteIndex.byPeptide.get(p.id) || null;
      const nextSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null);

      const activeVial = vialIndex.find(p.id, p.name);
      let vialStatus = null;
      if (activeVial) {
        const remDoses = calculateRemainingDoses(activeVial, p.dose);
        const exp = getExpirationStatus(activeVial);
        vialStatus = { remainingDoses: remDoses, expStatus: exp.status };
      }

      const vm = createDoseCardViewModel({
        peptide: p,
        takenCount: tomadas,
        resolvedCount: resolved,
        skippedCount: states.skipped,
        missedCount: states.missed,
        nextSite,
        lastSite: lastUsed ? lastUsed.site : null,
        vialStatus
      });

      const lastTime = records.length ? records.at(-1)?.time || records.at(-1)?.t || "" : "";
      const moon = p.moon ? " 🌙" : "";

      const card = document.createElement("article");
      card.className = `card ${vm.isCompleted ? "done" : ""}`;
      card.style.setProperty("--acc", sanitizeColor(p.accent, "var(--primary)"));

      let ctrlHTML;
      let detailsHTML = "";
      if (perDay <= 1) {
        ctrlHTML = `
          <button type="button" class="take ${vm.isCompleted ? "done" : ""}" data-id="${sanitizeId(p.id)}" aria-label="${vm.isCompleted ? 'Desmarcar dose de ' + esc(p.name) : 'Confirmar dose de ' + esc(p.name)}">
            <span>${vm.isCompleted ? i18nService.t(`phase1.${doseStatus(records[0])}`) : i18nService.t("common.apply")}</span>
            ${vm.isCompleted && lastTime ? `<span class="at">${esc(lastTime)}</span>` : ""}
          </button>`;
      } else {
        const completed = progress.pending === 0;
        const actionLabel = completed ? i18nService.t("phase4.routineComplete") : i18nService.t("dashboard.registerApplication");
        ctrlHTML = `
          <div class="multi-dose-controls" data-id="${sanitizeId(p.id)}">
            <button type="button" class="multi-dose-register" data-id="${sanitizeId(p.id)}" ${completed ? "disabled" : ""}
              aria-label="${esc(`${actionLabel} · ${progress.resolved}/${progress.total}`)}">
              <span>${esc(actionLabel)}</span>
              <strong>${esc(`${progress.resolved}/${progress.total}`)}</strong>
            </button>
            ${resolved > 0 ? `<button type="button" class="dose-undo" data-id="${sanitizeId(p.id)}">${esc(i18nService.t("phase4.undoLast"))}</button>` : ""}
          </div>`;
        detailsHTML = renderMultiDoseDetails(progress);
      }

      let vialBadgeHTML = "";
      if (vm.vialStatus) {
        const expAlert = vm.vialStatus.expStatus === "expired" ? " ⚠️ Vencido" : vm.vialStatus.expStatus === "expiring_soon" ? " ⏳ Vence em breve" : "";
        vialBadgeHTML = `<span class="chip-acc" style="background:rgba(14,133,128,0.12);color:var(--success);font-size:11px;font-weight:700;" title="${esc(i18nService.t("settings.inventoryCardTitle"))}">🧪 ~${vm.vialStatus.remainingDoses} ${esc(i18nService.t("common.doses"))}${expAlert}</span>`;
      }

      let siteBadgeHTML = "";
      if (vm.nextSite) {
        siteBadgeHTML = `<span class="chip-acc" style="background:rgba(99,102,241,0.12);color:var(--primary);font-size:11px;font-weight:700;" title="Próximo sítio na sua rotação">📍 ${esc(vm.nextSite)}</span>`;
      }
      if (vm.lastSite) {
        siteBadgeHTML += `<span class="chip-acc chip-last-site" title="Último local registrado">Último: ${esc(vm.lastSite)}</span>`;
      }

      const statusBadgeHTML = vm.isCompleted
        ? `<span class="chip-acc">${esc(i18nService.t(tomadas >= perDay ? "phase1.applied" : "phase1.resolved"))}</span>`
        : `<span class="chip-acc" style="background:rgba(245,183,91,0.15);color:var(--warning);font-weight:700;">⏳ ${i18nService.t("common.pending") || "Pendente"}</span>`;

      card.innerHTML = `
        <div class="info">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <div class="nm"><span class="dot"></span>${esc(p.name)}${moon}</div>
            ${statusBadgeHTML}
          </div>
          <div class="sub">${esc(p.sub || "")}</div>
          <div class="meta">
            ${administrationLabel(p) ? `<span class="ui">${esc(administrationLabel(p))}</span>` : ""}
            <span class="freq">· ${esc(p.freq || "")}</span>
            <span class="chip-acc">${esc(p.dose || "")}/${esc(p.per || i18nService.t("modals.peptide.perDay"))}</span>
            ${vialBadgeHTML}
            ${siteBadgeHTML}
          </div>
          ${(p.start || p.note || p.time || p.calculationSnapshot) ? `
            <div class="note-line">
              ${p.time ? `<span class="note-start">⏰ ${esc(p.time)}</span>` : ""}
              ${p.start ? `<span class="note-start">início ${fmtBR(p.start)}</span>` : ""}
              ${p.calculationSnapshot ? `<span class="note-calc" title="${esc(p.calculationSnapshot.formula || '')}">🔬 ${esc(String(p.calculationSnapshot.vialMg))}mg/${esc(String(p.calculationSnapshot.waterMl))}mL</span>` : ""}
              ${p.note ? `<span class="note-txt">${esc(p.note)}</span>` : ""}
            </div>` : ""}
        </div>
        <div class="ctrls">
          <button type="button" class="gear" data-id="${sanitizeId(p.id)}" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" class="del" data-id="${sanitizeId(p.id)}" title="${esc(i18nService.t("phase1.end"))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
        ${ctrlHTML}
        ${detailsHTML}`;

      container.appendChild(card);
    });
  }

  const compactProgress = document.getElementById("today-progress-compact");
  if (compactProgress) {
    const latestWeight = [...measurements].filter((item) => Number.isFinite(item?.weightKg)).sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`))[0];
    compactProgress.innerHTML = `<strong>Progresso de hoje</strong><span>${dayProgress.resolvedCount} de ${dayProgress.totalDue} registros resolvidos${latestWeight ? ` · peso mais recente ${esc(String(latestWeight.weightKg))} kg` : ""}</span><button type="button" data-action="open-progress">Ver progresso</button>`;
  }
  // Cálculo canônico do anel diário
  const ringN = document.getElementById("ring-n");
  if (ringN) {
    ringN.textContent = `${dayProgress.scheduledTaken} / ${dayProgress.totalDue}`;
  }
  drawRing(dayProgress.scheduledTaken, dayProgress.totalDue);

  syncAppWidget();
}

async function toggleDose(id) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = logs[todayK] || {};
  const p = resolveProtocolAt(peptides.find((x) => x.id === id));
  if (!p) return;

  const recordedEntries = doseEntries(rec[id]);
  const latestEntry = recordedEntries.at(-1);
  if (latestEntry && doseStatus(latestEntry) !== "applied") {
    openRetroModal(todayK, id, { storage, dateKey, editingLog: latestEntry });
    return;
  }
  const isUndoing = dosesResolved(rec, id) > 0;
  if (isUndoing) {
    const res = doseService.undoDose({ peptideId: p.id, scheduledDate: todayK });
    if (!res.success) {
      void dialogService.alert({ title: i18nService.t("dialogs.unmarkErrorTitle"), message: i18nService.t("dialogs.unmarkErrorMsg") + (res.message || res.error), isDanger: true });
      return;
    }
    haptics.light();
    accessibilityService.announce(`Aplicação de ${p.name} desmarcada.`);
  } else {
    if (p.administrationLegacy === false && p.administrationRoute !== "oral") {
      openRetroModal(todayK, id, { storage, dateKey, requireSiteSelection: true });
      return;
    }
    const configuredSites = p.administrationRoute === "intramuscular" ? storage.getIntramuscularSites() : storage.getSites();
    const lastUsed = getLastUsedSite(logs, p.id);
    const currentSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null) || "";
    let res = doseService.registerDose({
      peptideId: p.id,
      scheduledDate: todayK,
      dose: p.dose,
      ui: p.ui,
      site: currentSite
    });

    if (!res.success && res.error === "VIAL_MISSING_CONCENTRATION") {
      const confirmHistOnly = await showConfirmDialog({
        title: "Concentração Não Definida",
        message: `${res.message || "O frasco não possui concentração definida."}\n\nDeseja registrar a aplicação apenas no histórico sem debitar do estoque?`,
        confirmText: "Registrar no Histórico",
        cancelText: "Cancelar",
        isDanger: false
      });
      if (confirmHistOnly) {
        res = doseService.registerDose({
          peptideId: p.id,
          scheduledDate: todayK,
          dose: p.dose,
          ui: p.ui,
          site: currentSite,
          allowHistoryOnlyWithoutStock: true
        });
      }
    }

    if (!res.success) {
      void dialogService.alert({ title: i18nService.t("dialogs.saveErrorTitle"), message: i18nService.t("dialogs.saveErrorMsg") + (res.message || res.error), isDanger: true });
      return;
    }
    haptics.success();
    accessibilityService.announce(`Aplicação de ${p.name} confirmada.`);
  }

  invalidateViews("today", "week", "history", "progress");
}

async function addSingleDose(id) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = logs[todayK] || {};
  const p = resolveProtocolAt(peptides.find((x) => x.id === id));
  if (!p) return;

  const perDay = p.perDay || 1;
  const takenCount = dosesResolved(rec, id);
  if (takenCount >= perDay) return;

  if (p.administrationLegacy === false && p.administrationRoute !== "oral") {
    openRetroModal(todayK, id, { storage, dateKey, requireSiteSelection: true });
    return;
  }
  const configuredSites = p.administrationRoute === "intramuscular" ? storage.getIntramuscularSites() : storage.getSites();
  const lastUsed = getLastUsedSite(logs, p.id);
  const currentSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null) || "";

  let res = doseService.registerDose({
    peptideId: p.id,
    scheduledDate: todayK,
    dose: p.dose,
    ui: p.ui,
    site: currentSite
  });

  if (!res.success && res.error === "VIAL_MISSING_CONCENTRATION") {
    const confirmHistOnly = await showConfirmDialog({
      title: "Concentração Não Definida",
      message: `${res.message || "O frasco não possui concentração definida."}\n\nDeseja registrar a dose apenas no histórico sem debitar do estoque?`,
      confirmText: "Registrar no Histórico",
      cancelText: "Cancelar",
      isDanger: false
    });
    if (confirmHistOnly) {
      res = doseService.registerDose({
        peptideId: p.id,
        scheduledDate: todayK,
        dose: p.dose,
        ui: p.ui,
        site: currentSite,
        allowHistoryOnlyWithoutStock: true
      });
    }
  }

  if (!res.success) {
    void dialogService.alert({ title: i18nService.t("dialogs.saveErrorTitle"), message: i18nService.t("dialogs.saveDoseErrorMsg") + (res.message || res.error), isDanger: true });
    return;
  }

  haptics.medium();
  invalidateViews("today", "week", "history", "progress");
}

function undoSingleDose(id) {
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (!p) return;
  const todayK = dateKey(new Date());

  const res = doseService.undoDose({
    peptideId: p.id,
    scheduledDate: todayK
  });

  if (!res.success) {
    void dialogService.alert({ title: i18nService.t("dialogs.removeErrorTitle"), message: i18nService.t("dialogs.removeErrorMsg") + (res.message || res.error), isDanger: true });
    return;
  }

  haptics.light();
  invalidateViews("today", "week", "history", "progress");
}

function getTimelineDateParts(date) {
  const locale = i18nService.getLocale();
  const format = (options) => new Intl.DateTimeFormat(locale, options).format(date);
  return {
    dayNumber: format({ day: "2-digit" }),
    monthShort: format({ month: "short" }).replace(/\.$/, ""),
    weekdayShort: format({ weekday: "short" }).replace(/\.$/, ""),
    weekdayLong: format({ weekday: "long" }),
    fullDate: format({ day: "2-digit", month: "2-digit", year: "numeric" })
  };
}

function renderAdherenceSummary(snapshot = null) {
  const host = document.getElementById("adherence-summary");
  if (!host) return;
  const state = snapshot || storage.readSnapshot(["peptides", "logs"]);

  const summary = calculateAdherenceSummary(
    state.peptides,
    state.logs,
    { days: adherencePeriodDays, endDate: dateKey(new Date()) }
  );
  host.innerHTML = renderAdherenceSummaryHTML(summary, {
    periodDays: adherencePeriodDays,
    locale: i18nService.getLocale()
  });

}

function renderWeek() {
  const container = document.getElementById("week-table-wrap") || document.getElementById("week-grid");
  if (!container) return;

  const { peptides, logs } = storage.readSnapshot(["peptides", "logs"]);
  const now = new Date();
  const todayKey = dateKey(now);

  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - now.getDay());

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const dateKeyValue = dateKey(date);
    const rec = logs[dateKeyValue] || {};
    const entries = [];

    const scheduled = getScheduledPeptides(peptides, date);
    const ids = new Set([...scheduled.map((peptide) => peptide.id), ...Object.keys(rec)]);
    ids.forEach((id) => {
      const effective = scheduled.find((peptide) => peptide.id === id);
      const current = peptides.find((peptide) => peptide.id === id);
      const records = doseEntries(rec[id]);
      const due = effective ? Math.max(1, parseInt(effective.perDay, 10) || 1) : 0;
      const counts = summarizeDoseEntries(records, due);

      records.forEach((log, index) => {
        const display = getDoseDisplayData(log, current);
        entries.push({
          id,
          name: display.name,
          accent: current?.accent || current?.color || "var(--primary)",
          dose: display.dose,
          ui: display.ui,
          time: log.time || log.t || "",
          recordIndex: index,
          pendingCount: 0,
          scheduled: Boolean(effective),
          editableProtocol: Boolean(current),
          legacy: display.historyIntegrity === "legacy",
          status: doseStatus(log)
        });
      });

      if (effective && counts.pending > 0) {
        entries.push({
          id,
          name: effective.name || i18nService.t("dashboard.genericCompound"),
          accent: effective.accent || effective.color || "var(--primary)",
          dose: effective.dose || "",
          ui: effective.ui || 0,
          time: effective.time || effective.times?.[0] || "08:00",
          recordIndex: null,
          pendingCount: counts.pending,
          scheduled: true,
          editableProtocol: true,
          legacy: false,
          status: "unrecorded"
        });
      }
    });

    entries.sort((a, b) => (a.time || "").localeCompare(b.time || "") || a.name.localeCompare(b.name));

    return {
      key: dateKeyValue,
      date,
      parts: getTimelineDateParts(date),
      isToday: dateKeyValue === todayKey,
      isPast: dateKeyValue < todayKey,
      entries,
      progress: calculateDayProgress(peptides, logs, date)
    };
  });

  let html = `<div class="week-timeline"><div class="week-days" role="list" aria-label="${esc(i18nService.t("week.timelineLabel"))}">`;

  if (peptides.length === 0 && weekDays.every((day) => day.entries.length === 0)) {
    html += `
      <div class="timeline-empty week-empty" role="listitem">
        <div class="timeline-empty-icon" aria-hidden="true">✦</div>
        <strong>${esc(i18nService.t("week.emptyTitle"))}</strong>
        <p>${esc(i18nService.t("week.emptyDesc"))}</p>
      </div>`;
  } else {
    weekDays.forEach((day) => {
      const dayCount = day.entries.reduce((count, entry) => count + Math.max(1, entry.pendingCount), 0);
      const progress = day.progress.totalDue > 0
        ? i18nService.t("week.dayProgress", { taken: day.progress.scheduledTaken, due: day.progress.totalDue })
        : day.entries.length ? i18nService.t("week.appliedCount", { count: day.progress.totalTaken }) : i18nService.t("week.restDay");
      const dayLabel = day.isToday ? i18nService.t("week.today") : day.parts.weekdayLong;

      html += `
        <article class="timeline-item week-day ${day.isToday ? "is-today" : ""} ${day.isPast ? "is-past" : ""}" role="listitem" data-date="${sanitizeId(day.key)}">
          <div class="timeline-rail" aria-hidden="true">
            <span class="timeline-marker">
              <span class="timeline-marker-dow">${esc(day.parts.weekdayShort)}</span>
              <strong>${esc(day.parts.dayNumber)}</strong>
              <span class="timeline-marker-month">${esc(day.parts.monthShort)}</span>
            </span>
          </div>
          <div class="timeline-content week-day-content">
            <div class="week-day-head">
              <div>
                <div class="week-day-title">${esc(dayLabel)}</div>
                <div class="week-day-date">${esc(day.parts.fullDate)}</div>
              </div>
              <div class="week-day-summary">
                <span class="week-day-count">${esc(i18nService.t("week.dayCount", { count: dayCount }))}</span>
                <span class="week-day-progress">${esc(progress)}</span>
              </div>
            </div>
            <div class="week-day-events" role="list" aria-label="${esc(`${dayLabel} · ${day.parts.fullDate}`)}">
              ${day.entries.length > 0 ? day.entries.map((entry) => {
                const statusKey = { applied: "applied", skipped: "skipped", missed: "missed", unrecorded: "unrecorded" }[entry.status] || "unknown";
                const statusLabel = i18nService.t(`week.${statusKey}`);
                const statusClass = entry.status === "applied" ? "done" : entry.status === "unrecorded" ? "pending" : "partial";
                const doseMeta = [entry.time, entry.dose, administrationLabel(entry)].filter(Boolean).join(" · ");
                const progressMeta = entry.pendingCount > 1 ? ` · ${i18nService.t("week.pendingCount", { count: entry.pendingCount })}` : "";
                const legacyMeta = entry.legacy ? ` · ${i18nService.t("week.legacy")}` : "";
                const ariaLabel = `${entry.name} · ${doseMeta || statusLabel} · ${statusLabel}`;
                return `
                  <div class="week-event ${statusClass} ${entry.scheduled ? "is-scheduled" : "is-extra"}" role="listitem" data-status="${esc(statusKey)}">
                    <button type="button" class="week-event-toggle" data-pep="${sanitizeId(entry.id)}" data-date="${sanitizeId(day.key)}" data-log-index="${entry.recordIndex ?? ""}" aria-label="${esc(ariaLabel)}" ${day.key > todayKey ? "disabled" : ""}>
                      <span class="week-event-status" aria-hidden="true">${entry.status === "applied" ? "✓" : entry.status === "unrecorded" ? "•" : "—"}</span>
                      <span class="week-event-main">
                        <strong>${esc(entry.name)}</strong>
                        <span>${esc(doseMeta || statusLabel)}${esc(progressMeta)}${esc(legacyMeta)}</span>
                      </span>
                      <span class="week-event-action">${esc(statusLabel)}</span>
                    </button>
                    ${entry.editableProtocol ? `<button type="button" class="week-event-edit" data-pep="${sanitizeId(entry.id)}" aria-label="Editar ${esc(entry.name)}">✎</button>` : ""}
                  </div>`;
              }).join("") : `
                <div class="week-day-empty" role="listitem">
                  <span aria-hidden="true">—</span>
                  <span>${esc(i18nService.t("week.restDay"))}</span>
                </div>`}
            </div>
          </div>
        </article>`;
    });
  }

  html += `</div>`;

  if (peptides.length > 0 || weekDays.some((day) => day.entries.length > 0)) {
    html += `
      <div class="timeline-legend" aria-label="${esc(i18nService.t("week.legendLabel"))}">
        <span class="timeline-legend-item done"><i aria-hidden="true">✓</i>${esc(i18nService.t("week.applied"))}</span>
        <span class="timeline-legend-item partial"><i aria-hidden="true">—</i>${esc(i18nService.t("week.skipped"))} / ${esc(i18nService.t("week.missed"))}</span>
        <span class="timeline-legend-item pending"><i aria-hidden="true">•</i>${esc(i18nService.t("week.unrecorded"))}</span>
        <span class="timeline-legend-item rest"><i aria-hidden="true">—</i>${esc(i18nService.t("week.restDay"))}</span>
      </div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

}

async function toggleDateLog(id, dKey, recordIndex = null) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const rec = { ...(logs[dKey] || {}) };
  const p = peptides.find((x) => x.id === id);

  const todayK = dateKey(new Date());

  if (dKey > todayK) {
    void dialogService.alert({ title: "Data inválida", message: "Não é possível registrar aplicações em datas futuras.", isDanger: true });
    return;
  }

  if (Number.isInteger(recordIndex)) {
    const log = doseEntries(rec[id])[recordIndex];
    if (!log) return;
    openRetroModal(dKey, id, { storage, dateKey, editingLog: log });
    return;
  }

  if (!p) return;
  openRetroLogModal(dKey, id);
}

function openRetroLogModal(prefillDate = null, prefillPepId = null, options = {}) {
  openRetroModal(prefillDate, prefillPepId, { storage, dateKey, ...options });
}

async function saveRetroLog() {
  await saveRetro({
    doseService,
    storage,
    dateKey,
    haptics,
    renderAll: () => {
      invalidateViews("today", "week", "history", "progress");
      showActionFeedback(i18nService.t("experience.applicationSaved"));
    }
  });
}

function historyDateRange() {
  if (historyFilters.period === "all") return { startDate: null, endDate: null };
  if (historyFilters.period === "custom") return { startDate: historyFilters.startDate, endDate: historyFilters.endDate };
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Number(historyFilters.period || 30) + 1);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

function setupHistoryFilters() {
  const bindings = [
    ["history-period", "period"],
    ["history-compound", "compoundId"], ["history-type", "eventType"],
    ["history-search", "query"], ["history-start-date", "startDate"], ["history-end-date", "endDate"]
  ];
  bindings.forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;
    const eventName = id === "history-search" ? "input" : "change";
    element.addEventListener(eventName, () => {
      historyFilters[key] = element.value || (key === "compoundId" || key === "eventType" ? "all" : null);
      const custom = document.getElementById("history-custom-dates");
      if (custom) custom.hidden = historyFilters.period !== "custom";
      const summary = document.getElementById("history-filter-summary");
      if (summary) {
        const period = historyFilters.period === "all" ? "Todo o histórico" : historyFilters.period === "custom" ? "Período personalizado" : `${historyFilters.period} dias`;
        const selectedOption = document.querySelector("#history-compound option:checked");
        const treatment = historyFilters.compoundId === "all" ? "Todos os tratamentos" : selectedOption?.textContent || "Tratamento selecionado";
        summary.textContent = `${period} · ${treatment}`;
      }
      invalidateViews("today", "history", "progress");
    });
  });
}

function renderHistoryEvolution(model, range = historyDateRange()) {
  const target = document.getElementById("measurements-trend-summary");
  if (!target) return;
  const stats = model.measurementStats;
  const weightRecords = model.measurements.filter((entry) => entry.weightKg !== null);
  const weightIndicators = calculateWeightGoalIndicators(model.measurements, storage.getMeasurementGoals());
  const formatSigned = (value, suffix = "kg") => value === null ? "—" : `${value > 0 ? "+" : ""}${value} ${suffix}`;
  const goalDifference = weightIndicators.goalDifferenceKg === null
    ? "Defina uma meta para comparar"
    : weightIndicators.goalStatus === "at_goal"
      ? "Na meta"
      : `${Math.abs(weightIndicators.goalDifferenceKg)} kg ${weightIndicators.goalStatus === "above" ? "acima" : "abaixo"} da meta`;
  const metricDefinitions = [
    { key: "weight", label: "Peso", unit: "kg", getValue: (entry) => entry.weightKg },
    { key: "abdomen", label: "Abdômen", unit: "cm", getValue: (entry) => entry.circumferencesCm?.abdomen },
    { key: "waist", label: "Cintura", unit: "cm", getValue: (entry) => entry.circumferencesCm?.waist },
    { key: "hips", label: "Quadril", unit: "cm", getValue: (entry) => entry.circumferencesCm?.hips }
  ];
  const availableMetrics = metricDefinitions.filter((metric) => model.measurements.some((entry) => Number.isFinite(metric.getValue(entry)) && metric.getValue(entry) > 0));
  if (!availableMetrics.some((metric) => metric.key === historyBodyMetric)) {
    historyBodyMetric = availableMetrics.find((metric) => metric.key === "weight")?.key || availableMetrics[0]?.key || "weight";
  }
  const selectedMetric = metricDefinitions.find((metric) => metric.key === historyBodyMetric) || metricDefinitions[0];
  const historyRange = range;
  const protocols = storage.getPeptides();
  const bodyMetricChart = buildBodyMetricChartModel(model.measurements, selectedMetric.key, historyRevisionCompoundId ? historyRange : {});
  const revisionCompounds = protocols.filter((protocol) => {
    const probe = buildProtocolRevisionMarkerModel([protocol], protocol.id, bodyMetricChart, historyRange);
    return probe.length > 0;
  });
  if (historyRevisionCompoundId && !revisionCompounds.some((protocol) => protocol.id === historyRevisionCompoundId)) {
    historyRevisionCompoundId = "";
  }
  const revisionMarkers = historyRevisionCompoundId
    ? buildProtocolRevisionMarkerModel(protocols, historyRevisionCompoundId, bodyMetricChart, historyRange)
    : [];
  const symptomRows = Object.entries(stats.symptomsFrequency).sort((a, b) => b[1] - a[1]);
  if (model.measurements.length === 0) {
    target.innerHTML = `<section class="history-evolution"><form class="history-weight-goal" id="history-weight-goal-form"><div><strong>Meta pessoal de peso</strong><span>Opcional e salva apenas neste dispositivo.</span></div><label for="history-goal-weight-input" class="sr-only">Meta de peso em quilogramas</label><div class="history-weight-goal-controls"><input id="history-goal-weight-input" class="txt" type="text" inputmode="decimal" pattern="[0-9]+([,.][0-9]+)?" placeholder="Meta em kg" value="${weightIndicators.goalWeightKg ?? ""}"><button type="submit" class="btn-primary" id="history-goal-save-btn">Salvar meta</button><button type="button" class="btn-secondary" id="history-goal-clear-btn" ${weightIndicators.goalWeightKg === null ? "disabled" : ""}>Apagar</button></div></form><div class="empty-state-illustrated empty-state-illustrated--measurements"><img class="empty-state-illustration" src="/assets/illustrations/empty-measurements.png" alt="" aria-hidden="true"><div class="empty-state-title">Registre seu primeiro acompanhamento</div><div class="empty-state-description">Peso, medidas e sintomas ficam organizados no histórico local.</div><button type="button" class="btn-primary empty-state-action" id="empty-add-measurement-btn">+ Medidas / Sintomas</button></div></section>`;
    return;
  }
  target.innerHTML = `<section class="history-evolution" aria-labelledby="history-evolution-title">
    <div class="history-section-heading"><h3 id="history-evolution-title">Evolução descritiva</h3><span>${model.observations.count} data${model.observations.count === 1 ? "" : "s"} com observações</span></div>
    <form class="history-weight-goal" id="history-weight-goal-form">
      <div><strong>Meta pessoal de peso</strong><span>Opcional e salva apenas neste dispositivo.</span></div>
      <label for="history-goal-weight-input" class="sr-only">Meta de peso em quilogramas</label>
      <div class="history-weight-goal-controls"><input id="history-goal-weight-input" class="txt" type="text" inputmode="decimal" pattern="[0-9]+([,.][0-9]+)?" placeholder="Meta em kg" value="${weightIndicators.goalWeightKg ?? ""}"><button type="submit" class="btn-primary" id="history-goal-save-btn">Salvar meta</button><button type="button" class="btn-secondary" id="history-goal-clear-btn" ${weightIndicators.goalWeightKg === null ? "disabled" : ""}>Apagar</button></div>
    </form>
    <div class="report-preview-summary-grid">
      <span class="measurement-chip--weight"><b>${weightIndicators.latestWeight ?? "—"}${weightIndicators.latestWeight !== null ? " kg" : ""}</b> peso mais recente</span>
      <span><b>${formatSigned(weightIndicators.absoluteChangeKg)}</b> variação absoluta</span>
      <span><b>${weightIndicators.percentChange === null ? "—" : `${weightIndicators.percentChange > 0 ? "+" : ""}${weightIndicators.percentChange}%`}</b> variação percentual</span>
      <span><b>${formatSigned(weightIndicators.weeklyObservedChangeKg)}</b> variação semanal observada</span>
      <span><b>${esc(goalDifference)}</b> diferença até a meta</span>
    </div>
    ${revisionCompounds.length ? `<label class="history-metric-selector" for="history-revision-compound"><span>Revisões do composto</span><select id="history-revision-compound" class="txt"><option value="">Sem composto</option>${revisionCompounds.map((protocol) => `<option value="${esc(protocol.id)}" ${protocol.id === historyRevisionCompoundId ? "selected" : ""}>${esc(protocol.name)}</option>`).join("")}</select></label>` : ""}
    ${availableMetrics.length ? `<label class="history-metric-selector" for="history-body-metric"><span>Métrica do gráfico</span><select id="history-body-metric" class="txt">${availableMetrics.map((metric) => `<option value="${metric.key}" ${metric.key === selectedMetric.key ? "selected" : ""}>${metric.label}</option>`).join("")}</select></label>` : ""}
    ${renderBodyMetricChart(bodyMetricChart, revisionMarkers)}
    ${weightRecords.length > 0 && weightRecords.length < 3 ? `<p class="history-context-note">Há poucos registros de peso. Os valores disponíveis são exibidos sem projeção de tendência.</p>` : ""}
    ${symptomRows.length ? `<div class="history-symptom-frequency">${symptomRows.map(([name, count]) => `<span>${esc(name)} <b>${count}×</b></span>`).join("")}</div>` : ""}
    <details class="history-data-table"><summary>Tabela textual dos dados utilizados</summary>
      <div class="history-table-scroll"><table><thead><tr><th>Data</th><th>Hora</th><th>Peso</th><th>Abdômen</th><th>Cintura</th><th>Quadril</th><th>Energia</th><th>Humor</th><th>Sintomas</th><th>Origem</th></tr></thead><tbody>
      ${model.measurements.map((entry) => `<tr><td>${esc(fmtBR(entry.date))}</td><td>${esc(entry.time || "—")}</td><td>${entry.weightKg !== null ? `${entry.weightKg} kg` : "—"}</td><td>${entry.circumferencesCm?.abdomen !== null && entry.circumferencesCm?.abdomen !== undefined ? `${entry.circumferencesCm.abdomen} cm` : "—"}</td><td>${entry.circumferencesCm?.waist !== null && entry.circumferencesCm?.waist !== undefined ? `${entry.circumferencesCm.waist} cm` : "—"}</td><td>${entry.circumferencesCm?.hips !== null && entry.circumferencesCm?.hips !== undefined ? `${entry.circumferencesCm.hips} cm` : "—"}</td><td>${entry.energyLevel ?? "—"}</td><td>${entry.moodLevel ?? "—"}</td><td>${esc(entry.symptomDetails.map((item) => `${item.name}${item.intensity ? ` (${item.intensity})` : ""}`).join(" · ") || "—")}</td><td>${esc(entry.source)}</td></tr>`).join("") || `<tr><td colspan="10">Nenhum registro no período.</td></tr>`}
      </tbody></table></div></details>
    <p class="history-context-note">Dados descritivos autorrelatados. A falta de registro não significa ausência de sintomas e não há interpretação causal ou clínica.</p>
  </section>`;
}

function renderHistoryLegacy() {
  const container = document.getElementById("history-list");
  const countEl = document.getElementById("history-count");
  if (!container) return;

  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const daysKeys = Object.keys(logs).sort().reverse();

  let totalDoses = 0;
  let html = `<div class="history-timeline" role="list" aria-label="${esc(i18nService.t("history.timelineLabel"))}">`;

  daysKeys.forEach((dk) => {
    const rec = logs[dk];
    if (!rec) return;

    const pepEntries = [];
    Object.keys(rec).forEach((pId) => {
      const p = peptides.find((x) => x.id === pId) || {
        name: pId,
        accent: "#2CC5C0"
      };
      doseEntries(rec[pId]).forEach((doseItem, idx) => {
        const norm = normalizeDoseEntry(doseItem, dk, pId);
        if (!norm) return;
        totalDoses++;
        pepEntries.push({ ...norm, ...getDoseDisplayData(norm, p), id: pId, accent: p.accent, idx });
      });
    });

    if (pepEntries.length > 0) {
      const [y, m, d] = dk.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dateParts = getTimelineDateParts(dateObj);
      const isToday = dk === dateKey(new Date());

      html += `
        <article class="timeline-item hist-day ${isToday ? "is-today" : ""}" role="listitem" data-date="${sanitizeId(dk)}">
          <div class="timeline-rail" aria-hidden="true">
            <span class="timeline-marker hist-marker">
              <span class="timeline-marker-dow">${esc(dateParts.weekdayShort)}</span>
              <strong>${esc(dateParts.dayNumber)}</strong>
              <span class="timeline-marker-month">${esc(dateParts.monthShort)}</span>
            </span>
          </div>
          <div class="timeline-content hist-day-content">
            <div class="hist-date">
              <div>
                <strong>${esc(dateParts.weekdayLong)}</strong>
                <span>${esc(dateParts.fullDate)}</span>
              </div>
              <span class="hist-n">${esc(i18nService.t("history.dosesCount", { count: pepEntries.length }))}</span>
            </div>
            <div class="hist-list">
            ${pepEntries.map((e) => `
              <div class="hist-item" data-pep="${sanitizeId(e.id)}">
                <span class="hist-dot" style="background:${sanitizeColor(e.accent, "var(--primary)")};"></span>
                <div class="hist-info">
                  <div class="hist-name">${esc(e.name)}</div>
                  <div class="hist-status">${esc(i18nService.t(`phase1.${doseStatus(e)}`))}${e.historyIntegrity === "legacy" ? ` · ${esc(i18nService.t("phase1.legacy"))}` : ""}</div>
                  <div class="hist-dose">
                    ${esc(e.dose || "—")}${administrationLabel(e) ? ` · ${esc(administrationLabel(e))}` : ""}${e.site ? ` · 📍 ${esc(e.site)}` : ""}
                  </div>
                  ${e.note ? `<div class="hist-note">💬 ${esc(e.note)}</div>` : ""}
                  ${e.statusReason ? `<div class="hist-note">${esc(e.statusReason)}</div>` : ""}
                  ${e.vialId ? `<div class="hist-note">${esc(i18nService.t("phase1.vial"))}: ${esc(e.vial?.lotNumber || e.vialId)}</div>` : ""}
                </div>
                <div class="hist-time">
                  <span>${esc(e.time)}</span>
                  ${e.retroactive ? `<span class="badge-retro">${esc(i18nService.t("history.retroactive"))}</span>` : ""}
                </div>
                <div class="hist-actions"><button type="button" class="hist-edit" data-date="${sanitizeId(dk)}" data-pep="${sanitizeId(e.id)}" data-idx="${e.idx}" aria-label="${esc(i18nService.t("phase1.editRecord"))}">✎</button>
                <button type="button" class="hist-rm" data-date="${sanitizeId(dk)}" data-pep="${sanitizeId(e.id)}" data-idx="${e.idx}" title="${esc(i18nService.t("history.deleteDose"))}" aria-label="${esc(i18nService.t("history.deleteDose"))}">✕</button></div>
              </div>
            `).join("")}
            </div>
          </div>
        </article>`;
    }
  });

  if (countEl) countEl.textContent = i18nService.t("phase1.recordsCount", { count: totalDoses });

  if (totalDoses === 0) {
    container.innerHTML = `
      <div class="timeline-empty history-empty">
        <div class="timeline-empty-icon" aria-hidden="true">◌</div>
        <strong>${esc(i18nService.t("history.emptyTitle"))}</strong>
        <p>${esc(i18nService.t("history.emptyDesc"))}</p>
      </div>`;
  } else {
    container.innerHTML = `${html}</div>`;
  }

  renderAdherenceSummary();

  if (measurementsUI && typeof measurementsUI.renderTrendSummary === "function") {
    measurementsUI.renderTrendSummary();
    measurementsUI.renderMeasurementsHistory();
  }

}

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;
  const state = storage.readSnapshot(["peptides", "logs", "measurements"]);
  const peptides = state.peptides;
  const compoundSelect = document.getElementById("history-compound");
  if (compoundSelect) {
    const selected = historyFilters.compoundId;
    compoundSelect.innerHTML = `<option value="all">${esc(i18nService.t("history.allCompounds"))}</option>${peptides.map((item) => `<option value="${sanitizeId(item.id)}">${esc(item.name)}${item.lifecycleStatus === "ended" ? ` (${esc(i18nService.t("phase1.ended").toLocaleLowerCase(i18nService.getLocale()))})` : ""}</option>`).join("")}`;
    compoundSelect.value = peptides.some((item) => item.id === selected) ? selected : "all";
    historyFilters.compoundId = compoundSelect.value;
  }
  const model = buildReviewModel({
    protocol: peptides,
    logs: state.logs,
    measurements: state.measurements,
    ...historyDateRange(),
    compoundId: historyFilters.compoundId,
    eventType: historyFilters.eventType,
    query: historyFilters.query,
    includeNotes: true
  });
  const countEl = document.getElementById("history-count");
  if (countEl) countEl.textContent = `${model.events.length} registro${model.events.length === 1 ? "" : "s"}`;
  const contextNote = document.getElementById("history-context-note");
  if (contextNote) contextNote.hidden = historyFilters.compoundId === "all";
  const typeLabel = { application: i18nService.t("history.typeApplication"), measurement: i18nService.t("history.typeMeasurement"), symptom: i18nService.t("history.typeSymptom"), protocol: i18nService.t("history.typeProtocol") || "Protocolo" };
  container.innerHTML = model.events.length ? `<div class="history-timeline history-timeline--integrated" role="list">${model.events.map((event) => {
    const details = event.type === "application"
      ? `<span>Previsto: <b>${esc(event.scheduledTime || "não informado")}</b></span><span>Efetivo: <b>${esc(event.effectiveTime || "não informado")}</b></span>${event.data.site ? `<span>Local: <b>${esc(event.data.site)}</b></span>` : ""}`
      : event.type === "measurement" || event.type === "symptom"
        ? `<span>Origem: <b>${esc(event.data.source)}</b></span>${event.data.ownership === "external" ? `<span>Propriedade: <b>Health Connect</b></span>` : ""}`
        : `<span>Vigência: <b>${esc(fmtBR(event.date))} ${esc(event.time)}</b></span><span>Estado: <b>${esc(event.data.statusLabel)}</b></span>`;
    return `<article class="history-event history-event--${event.type} ${event.type === "application" ? `hist-day hist-item ${event.date === dateKey(new Date()) ? "is-today" : ""}` : ""}" role="listitem">
      <div class="history-event-head"><span class="history-event-type">${typeLabel[event.type]}</span><time datetime="${esc(event.date)}T${esc(event.time)}">${esc(fmtBR(event.date))} · ${esc(event.time || "—")}</time></div>
      <div class="history-event-body"><strong class="${event.type === "application" ? "hist-name" : ""}">${esc(event.title)}</strong><p class="${event.type === "application" ? "hist-status" : ""}">${esc(event.type === "application" ? i18nService.t(`phase1.${event.data.status}`) : event.subtitle)}</p>${event.type === "application" ? `<p class="hist-dose">${esc(event.data.dose)}${administrationLabel(event.data) ? ` · ${esc(administrationLabel(event.data))}` : ""}${event.data.site ? ` · 📍 ${esc(event.data.site)}` : ""}</p>` : ""}${event.notes ? `<p class="hist-note">${esc(event.notes)}</p>` : ""}${event.retroactive ? `<span class="badge-retro">${esc(i18nService.t("history.retroactiveBadge"))}</span>` : ""}${event.contextGeneral ? `<span class="history-context-badge">${esc(i18nService.t("history.contextBadge"))}</span>` : ""}</div>
      <details class="history-event-details"><summary>Ver detalhes</summary><div>${details}</div></details>
      <div class="hist-actions">${event.type === "application" ? `<button type="button" class="hist-edit" data-date="${sanitizeId(event.date)}" data-pep="${sanitizeId(event.data.peptideId)}" data-idx="${event.data.recordIndex}">Corrigir</button><button type="button" class="hist-rm" data-date="${sanitizeId(event.date)}" data-pep="${sanitizeId(event.data.peptideId)}" data-idx="${event.data.recordIndex}">Excluir</button>` : event.type === "measurement" || event.type === "symptom" ? `<button type="button" class="history-measurement-edit btn-meas-edit" data-id="${sanitizeId(event.editableId)}">Corrigir</button>` : ""}</div>
    </article>`;
  }).join("")}</div>` : `<div class="timeline-empty history-empty"><div class="timeline-empty-icon" aria-hidden="true">◌</div><strong>${esc(i18nService.t("history.noRecordsFound"))}</strong><p>${esc(i18nService.t("history.adjustFiltersHint"))}</p></div>`;
}

function progressDateRange() {
  if (progressFilters.period === "all") return { startDate: null, endDate: null };
  if (progressFilters.period === "custom") return { startDate: progressFilters.startDate, endDate: progressFilters.endDate };
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Number(progressFilters.period || 30) + 1);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

function setupProgressFilters() {
  [["progress-period", "period"], ["progress-start-date", "startDate"], ["progress-end-date", "endDate"]].forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.progressBound === "true") return;
    element.dataset.progressBound = "true";
    element.addEventListener("change", () => {
      progressFilters[key] = element.value || null;
      const custom = document.getElementById("progress-custom-dates");
      if (custom) custom.hidden = progressFilters.period !== "custom";
      invalidateViews("progress");
      if (currentTab === "progress") viewCoordinator.render("progress", { force: true });
    });
  });
  const select = document.getElementById("progress-period");
  const chips = Array.from(document.querySelectorAll("[data-progress-period]"));
  const syncPeriodChips = () => chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.progressPeriod === (select?.value || "30")));
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (!select) return;
      select.value = chip.dataset.progressPeriod || "30";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncPeriodChips();
    });
  });
  select?.addEventListener("change", syncPeriodChips);
  syncPeriodChips();
}

function renderProgress() {
  const state = storage.readSnapshot(["peptides", "logs", "measurements"]);
  const { startDate, endDate } = progressDateRange();
  const model = buildReviewModel({ protocol: state.peptides, logs: state.logs, measurements: state.measurements, startDate, endDate, includeNotes: true });
  const summary = buildProgressSummary({ ...state, startDate, endDate });
  const overview = document.getElementById("progress-overview");
  if (overview) overview.innerHTML = renderProgressOverviewHTML(summary);
  renderAdherenceSummary(state);
  renderHistoryEvolution(model, { startDate, endDate });
  measurementsUI?.renderMeasurementsHistory?.();
}

function renderSettingsTreatments() {
  const host = document.getElementById("settings-protocol-list");
  if (!host) return;
  host.innerHTML = "";
  renderProtocolList(host, storage.getPeptides(), openEditModal);
}

function setupSettingsMenu() {
  const menu = document.getElementById("settings-menu");
  const back = document.getElementById("settings-detail-back");
  const sections = Array.from(document.querySelectorAll("[data-settings-panel]"));
  if (!menu || !back || !sections.length) return { reset() {} };
  const rows = Array.from(menu.querySelectorAll("[data-settings-target]"));
  const showMenu = (focusRow = null) => {
    menu.hidden = false;
    back.hidden = true;
    sections.forEach((section) => { section.hidden = true; section.classList.remove("is-active"); });
    focusRow?.focus({ preventScroll: true });
  };
  const openPanel = (target, row) => {
    menu.hidden = true;
    back.hidden = false;
    sections.forEach((section) => {
      const active = section.dataset.settingsPanel === target;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
    });
    sections.find((section) => section.dataset.settingsPanel === target)?.querySelector("h3")?.focus?.({ preventScroll: true });
    if (!sections.find((section) => section.dataset.settingsPanel === target)) row?.focus({ preventScroll: true });
  };
  rows.forEach((row) => row.addEventListener("click", () => openPanel(row.dataset.settingsTarget, row)));
  back.addEventListener("click", () => showMenu(rows[0]));
  showMenu();
  return { reset: () => showMenu() };
}

function deleteHistoryEntry(dKey, pId, idx) {
  const logs = storage.getLogs();
  if (!logs[dKey] || !logs[dKey][pId]) return;

  const val = logs[dKey][pId];
  let targetLogId = null;
  if (Array.isArray(val) && val[idx]) {
    targetLogId = val[idx].id;
  }

  const res = doseService.deleteDose({
    peptideId: pId,
    scheduledDate: dKey,
    doseLogId: targetLogId
  });

  if (!res.success) {
    void dialogService.alert({ title: i18nService.t("dialogs.removeErrorTitle"), message: i18nService.t("dialogs.removeRecordErrorMsg") + (res.message || res.error || ""), isDanger: true });
    return;
  }

  haptics.light();
  invalidateViews("today", "week", "history", "progress");
}

function showConfirmDialog({ title = i18nService.t("common.confirm"), message = "", confirmText = i18nService.t("common.confirm"), cancelText = i18nService.t("common.cancel"), isDanger = true } = {}) {
  return dialogService.confirm({ title, message, confirmText, cancelText, isDanger });
}

async function deletePeptide(id) {
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  await changeProtocolStatus(p, "ended", { storage, onSaved: protocolSaved });
}

function reportReminderRefreshFailure(result) {
  if (!result?.error) return;
  void dialogService.alert({
    title: i18nService.t("dialogs.saveErrorTitle"),
    message: i18nService.t("dialogs.reminderRescheduleNotice"),
    isDanger: true
  });
}

function protocolSaved() {
  haptics.success();
  closeAllModals();
  invalidateViews("today", "week", "history", "progress");
  if (currentTab === "settings") renderSettingsTreatments();
  void notifications.schedulePeptideRemindersIfNeeded(storage.getPeptides(), { force: true, reason: "protocol-change" })
    .then((result) => {
      reportReminderRefreshFailure(result);
      return updateNotificationUI(storage.getPeptides());
    });
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => {
    m.classList.remove("on");
    m.setAttribute("aria-hidden", "true");
  });
  const retroOverlay = document.getElementById("retro-overlay");
  if (retroOverlay) retroOverlay.style.display = "none";
  if (accessibilityService) {
    accessibilityService.restoreFocus();
  }
}

function setupModalsAndButtons() {
  const replayAfterLoad = (selector, loader, label) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.addEventListener("click", async (event) => {
      if (loader.state === "ready") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await loadFeature(loader, label);
        element.click();
      } catch {
        // loadFeature já apresentou feedback e mantém uma nova tentativa disponível.
      }
    });
  };
  replayAfterLoad("#dash-import-btn", settingsFeature, "a restauração de backup");
  replayAfterLoad("#dash-report-btn", reportingFeature, "os relatórios");
  replayAfterLoad("#dash-research-btn", toolsFeature, "a pesquisa");

  const themeBtn = document.getElementById("settings-theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", async () => {
      haptics.medium();
      await theme.toggle();
    });
  }

  const addPepBtn = document.getElementById("add-pep-btn");
  if (addPepBtn) {
    addPepBtn.addEventListener("click", () => {
      openEditModal(null);
      haptics.light();
    });
  }

  document.querySelectorAll(".sheet-x, #nf-done, .modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeAllModals();
      haptics.light();
    });
  });

  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        closeAllModals();
        haptics.light();
      }
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModal = document.querySelector(".modal.on");
      if (openModal) {
        closeAllModals();
        haptics.light();
      }
    }
  });

  const savePepBtn = document.getElementById("edit-save") || document.getElementById("save-pep-btn");
  if (savePepBtn) {
    savePepBtn.addEventListener("click", saveEditedPeptide);
  }

  const editDelBtn = document.getElementById("edit-del-btn");
  if (editDelBtn) {
    editDelBtn.addEventListener("click", () => {
      if (editingPeptideId) {
        deletePeptide(editingPeptideId);
      }
    });
  }

  const histRetroBtn = document.getElementById("hist-retro-btn");
  if (histRetroBtn) {
    histRetroBtn.addEventListener("click", () => {
      openRetroLogModal();
      haptics.light();
    });
  }

  const retroSaveBtn = document.getElementById("retro-save");
  if (retroSaveBtn) {
    retroSaveBtn.addEventListener("click", saveRetroLog);
  }

  const retroCancelBtn = document.getElementById("retro-cancel");
  if (retroCancelBtn) {
    retroCancelBtn.addEventListener("click", () => {
      closeAllModals();
      haptics.light();
    });
  }

  const libSearchInput = document.getElementById("lib-search-input");
  if (libSearchInput) {
    libSearchInput.addEventListener("input", (e) => {
      renderLibraryList(e.target.value);
    });
  }
  renderLibraryList();

  // Segmented controls do editor
  document.querySelectorAll("#edit-period-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#edit-period-toggle button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      selectedPer = b.dataset.per;
      haptics.light();
    });
  });

  document.querySelectorAll("#edit-freq-type-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#edit-freq-type-toggle button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      selectedFreqType = b.dataset.type;
      haptics.light();
      updateFreqPreviewAndUI();
    });
  });

  document.querySelectorAll("#edit-days-grid .day-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const d = parseInt(b.dataset.day);
      if (selectedDays.includes(d)) {
        selectedDays = selectedDays.filter((x) => x !== d);
      } else {
        selectedDays.push(d);
      }
      haptics.light();
      renderDayChipsUI();
      updateFreqPreviewAndUI();
    });
  });

  const intervalValInput = document.getElementById("edit-interval-val");
  if (intervalValInput) {
    intervalValInput.addEventListener("input", () => {
      updateFreqPreviewAndUI();
    });
  }

  const protocolStartDateInput = document.getElementById("edit-protocol-start-date");
  if (protocolStartDateInput) {
    protocolStartDateInput.addEventListener("input", () => {
      const syncIntervalDate = document.getElementById("edit-start-date");
      if (syncIntervalDate && selectedFreqType === "intervalo") {
        syncIntervalDate.value = protocolStartDateInput.value;
      }
      updateBackfillPreviewUI();
    });
  }

  const intervalStartDateInput = document.getElementById("edit-start-date");
  if (intervalStartDateInput) {
    intervalStartDateInput.addEventListener("input", () => {
      if (protocolStartDateInput) {
        protocolStartDateInput.value = intervalStartDateInput.value;
      }
      updateBackfillPreviewUI();
    });
  }

  const exportBtn = document.getElementById("export-btn");
  const handleExport = async () => {
    try {
      await loadFeature(settingsFeature, "a exportação de backup");
      const backupPayload = storage.exportBackup(theme.getBackupTheme());
      const now = new Date();
      const stamp = `${dateKey(now)}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const fileName = `protocolo-pep-backup-${stamp}.json`;

      const result = await exportFile({
        fileName,
        content: backupPayload,
        mimeType: "application/json",
        subDir: "ProtocoloPEP"
      });

      if (result.aborted) {
        return;
      }

      if (!result.success) {
        throw new Error(result.error || "Falha ao salvar backup no dispositivo.");
      }

      recordBackupExport(result.path);
      renderBackupStatusUI();
      haptics.success();

      const userWantsShare = await dialogService.confirm({
        title: "Backup Exportado ✓",
        message: `O backup foi exportado com sucesso!\n\n📁 Salvo em: ${result.path}\n\nDeseja também abrir opções de compartilhamento para enviar ou salvar no Google Drive / WhatsApp?`,
        confirmText: "Compartilhar",
        cancelText: "OK",
        isDanger: false
      });

      if (userWantsShare) {
        await shareExportedFile({
          fileName,
          content: backupPayload,
          mimeType: "application/json",
          title: "Backup Protocolo PEP"
        });
      }
    } catch (err) {
      console.error("[BackupExport] Falha ao exportar backup:", err);
      haptics.warning();
      void dialogService.alert({
        title: "Erro ao Exportar Backup",
        message: "Não foi possível gravar o arquivo de backup: " + (err.message || err),
        isDanger: true
      });
    }
  };

  if (exportBtn) exportBtn.addEventListener("click", handleExport);

  const reopenOnboardingBtn = document.getElementById("reopen-onboarding-btn");
  if (reopenOnboardingBtn) {
    reopenOnboardingBtn.addEventListener("click", () => {
      haptics.light();
      showOnboarding({ isReview: true });
    });
  }

  // Dashboard Actions & Banner
  const dashBanner = document.getElementById("dash-banner");
  const dashBannerClose = document.getElementById("dash-banner-close");
  const dashBannerLink = document.getElementById("dash-banner-link");

  if (localStorage.getItem("pep_banner_dismissed") === "true" && dashBanner) {
    dashBanner.style.display = "none";
  }

  if (dashBannerClose && dashBanner) {
    dashBannerClose.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      dashBanner.style.display = "none";
      localStorage.setItem("pep_banner_dismissed", "true");
      haptics.light();
    });
  }

  if (dashBannerLink) {
    dashBannerLink.addEventListener("click", () => {
      haptics.light();
    });
  }

  const dashShareBtn = document.getElementById("settings-share-btn");
  if (dashShareBtn) {
    dashShareBtn.addEventListener("click", () => {
      haptics.light();
      openSharePreviewModal();
    });
  }

  const shareCopyBtn = document.getElementById("share-copy-btn");
  if (shareCopyBtn) {
    shareCopyBtn.addEventListener("click", async () => {
      const previewText = document.getElementById("share-preview-text");
      const text = previewText ? previewText.value : "";
      if (!text) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        haptics.success();
        void dialogService.alert({ title: i18nService.t("dialogs.copiedTitle"), message: i18nService.t("dialogs.copiedMsg") });
      } catch (err) {
        console.error("Falha ao copiar:", err);
        void dialogService.alert({ title: i18nService.t("dialogs.copyFailTitle"), message: i18nService.t("dialogs.copyFailMsg"), isDanger: true });
      }
    });
  }

  const shareNativeBtn = document.getElementById("share-native-btn");
  if (shareNativeBtn) {
    shareNativeBtn.addEventListener("click", async () => {
      const previewText = document.getElementById("share-preview-text");
      const text = previewText ? previewText.value : "";
      if (!text) return;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "Protocolo PEP — Resumo Diário",
            text: text
          });
        } catch (e) {
          // Cancelamento pelo usuário no sheet nativo
        }
      } else {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          }
          haptics.success();
          void dialogService.alert({ title: "Resumo copiado", message: "Compartilhamento nativo indisponível. Resumo copiado para a área de transferência! ✓" });
        } catch (err) {
          void dialogService.alert({ title: "Compartilhamento indisponível", message: "Compartilhamento não suportado neste aparelho.", isDanger: true });
        }
      }
    });
  }

  const dashExportBtn = document.getElementById("dash-export-btn");
  if (dashExportBtn) {
    dashExportBtn.addEventListener("click", handleExport);
  }

  const dashCalcBtn = document.getElementById("dash-calc-btn");
  if (dashCalcBtn) {
    dashCalcBtn.addEventListener("click", () => {
      haptics.light();
      switchTab("calc");
    });
  }
  const openToolsBtn = document.getElementById("open-tools-btn");
  if (openToolsBtn) {
    openToolsBtn.addEventListener("click", () => {
      haptics.light();
      switchTab("calc");
    });
  }
  document.getElementById("settings-add-treatment")?.addEventListener("click", () => openEditModal(null));
  const calcBackBtn = document.getElementById("calc-back-btn");
  if (calcBackBtn) {
    calcBackBtn.addEventListener("click", () => {
      haptics.light();
      switchTab("settings");
    });
  }
  const dashInventoryBtn = document.getElementById("dash-inventory-btn");
  if (dashInventoryBtn) dashInventoryBtn.addEventListener("click", () => { haptics.light(); switchTab("settings"); setTimeout(() => document.getElementById("inventory-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); });
}

function normalizeStr(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderLibraryList(filterText = "") {
  const cont = document.getElementById("modal-lib-list");
  if (!cont) return;

  const query = normalizeStr(filterText.trim());
  const catalog = [...LIBRARY.map((item) => ({ ...item, compoundClass: "peptide", aliases: [] })), ...EXTENDED_COMPOUND_CATALOG];
  const filtered = catalog.filter((item) => {
    if (!query) return true;
    return normalizeStr(item.name).includes(query) || normalizeStr(item.sub).includes(query) || item.aliases.some((alias) => normalizeStr(alias).includes(query));
  });

  if (filtered.length === 0) {
    cont.innerHTML = `<div class="lib-empty">${esc(i18nService.t("modals.peptide.libEmpty"))}</div>`;
    return;
  }

  const currentName = (document.getElementById("edit-name")?.value || "").trim().toLowerCase();

  cont.innerHTML = filtered.map((item) => {
    const isSelected = item.name.trim().toLowerCase() === currentName;
    return `
      <div class="lib-item ${isSelected ? "selected" : ""}" data-name="${esc(item.name)}" data-sub="${esc(item.sub || "")}" data-compound-class="${esc(item.compoundClass || "peptide")}">
        <span class="lib-item-name">${esc(item.name)}</span>
        <span class="lib-item-sub">${esc(item.sub || "")}</span>
      </div>
    `;
  }).join("");

  cont.querySelectorAll(".lib-item").forEach((el) => {
    el.addEventListener("click", () => {
      const nameInput = document.getElementById("edit-name");
      const subInput = document.getElementById("edit-sub");
      if (nameInput) nameInput.value = el.dataset.name;
      if (subInput) subInput.value = el.dataset.sub;
      const classInput = document.getElementById("edit-compound-class");
      if (classInput) classInput.value = el.dataset.compoundClass || "peptide";

      cont.querySelectorAll(".lib-item").forEach((i) => i.classList.remove("selected"));
      el.classList.add("selected");
      haptics.light();
    });
  });
}

let selectedColor = PALETTE[0];
let selectedPer = "dia";
let selectedFreqType = "todos";
let selectedDays = [0, 1, 2, 3, 4, 5, 6];
let selectedInterval = 2;
let selectedStartDate = "";

function formatDaysLabel(days) {
  if (!days || days.length === 0 || days.length === 7) return "Todos os dias";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Fins de semana";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Seg a Sex";
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return [...days].sort((a, b) => a - b).map((d) => dayNames[d]).join(" · ");
}

function updateBackfillPreviewUI() {
  const startVal = document.getElementById("edit-protocol-start-date")?.value;
  const backfillWrap = document.getElementById("edit-backfill-wrap");
  const backfillPreview = document.getElementById("edit-backfill-preview");
  if (!backfillWrap || !backfillPreview || !startVal || editingPeptideId) {
    if (backfillWrap) backfillWrap.style.display = "none";
    return;
  }

  let days = null;
  let interval = null;
  if (selectedFreqType === "especificos") {
    days = [...selectedDays].sort((a, b) => a - b);
  } else if (selectedFreqType === "intervalo") {
    interval = parseInt(document.getElementById("edit-interval-val")?.value, 10) || 2;
  }

  const perDay = parseInt(document.getElementById("edit-perday")?.value, 10) || 1;
  const mainTime = document.getElementById("edit-time")?.value?.trim() || "08:00";
  const times = [];
  if (mainTime) times.push(mainTime);
  document.querySelectorAll(".edit-extra-time").forEach((input) => {
    const val = input.value.trim();
    if (val) times.push(val);
  });

  const tempPeptide = {
    id: editingPeptideId || "temp",
    days,
    interval,
    start: startVal,
    perDay,
    times,
    time: mainTime
  };

  const dates = calculateBackfillDates(tempPeptide, startVal, new Date());
  if (dates.length > 0) {
    backfillWrap.style.display = "block";
    const totalDoses = dates.reduce((acc, d) => acc + (d.times?.length || 1), 0);
    const firstParts = dates[0].dateKey.split("-");
    const lastParts = dates[dates.length - 1].dateKey.split("-");
    const firstStr = `${firstParts[2]}/${firstParts[1]}`;
    const lastStr = `${lastParts[2]}/${lastParts[1]}`;
    backfillPreview.textContent = i18nService.t("modals.peptide.backfillPreview", { count: totalDoses, start: firstStr, end: lastStr });
  } else {
    backfillWrap.style.display = "none";
  }
}

function updateFreqPreviewAndUI() {
  const preview = document.getElementById("edit-freq-preview");
  const daysWrap = document.getElementById("edit-days-wrap");
  const intervalWrap = document.getElementById("edit-interval-wrap");

  if (selectedFreqType === "todos") {
    if (preview) preview.textContent = "Todos os dias";
    if (daysWrap) daysWrap.style.display = "none";
    if (intervalWrap) intervalWrap.style.display = "none";
  } else if (selectedFreqType === "especificos") {
    if (daysWrap) daysWrap.style.display = "block";
    if (intervalWrap) intervalWrap.style.display = "none";
    const label = formatDaysLabel(selectedDays);
    if (preview) preview.textContent = label;
  } else if (selectedFreqType === "intervalo") {
    if (daysWrap) daysWrap.style.display = "none";
    if (intervalWrap) intervalWrap.style.display = "block";
    const intVal = parseInt(document.getElementById("edit-interval-val")?.value) || 2;
    if (preview) preview.textContent = `A cada ${intVal} dias`;
  }

  updateBackfillPreviewUI();
}

function renderDayChipsUI() {
  document.querySelectorAll("#edit-days-grid .day-chip").forEach((b) => {
    const d = parseInt(b.dataset.day);
    if (selectedDays.includes(d)) {
      b.classList.add("on");
    } else {
      b.classList.remove("on");
    }
  });
}

function renderColorSwatches() {
  const cont = document.getElementById("modal-swatches");
  if (!cont) return;

  cont.innerHTML = PALETTE.map((color) => `
    <button type="button" data-color="${color}" style="--swatch-color:${color};" class="${color === selectedColor ? "on" : ""}" aria-label="Selecionar cor ${color}"></button>
  `).join("");

  cont.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      cont.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      selectedColor = b.dataset.color;
      haptics.light();
    });
  });
}

function openEditModal(pepId, prefillData = null) {
  editingPeptideId = pepId;
  const modal = document.getElementById("edit-modal");
  const title = document.getElementById("modal-title");
  if (!modal) return;

  const peptides = storage.getPeptides();
  const originalProtocol = pepId ? peptides.find((x) => x.id === pepId) : null;
  const p = resolveProtocolAt(originalProtocol);
  renderProtocolControls(originalProtocol, { storage, onSaved: protocolSaved });

  if (title) title.textContent = p ? i18nService.t("modals.peptide.editTitleWithName", { name: p.name }) : i18nService.t("modals.peptide.newTitle");

  document.getElementById("edit-name").value = p ? p.name : (prefillData?.name || "");
  document.getElementById("edit-sub").value = p ? p.sub || "" : (prefillData?.sub || "");
  document.getElementById("edit-dose").value = p ? p.dose || "" : (prefillData?.dose || "");
  const classInput = document.getElementById("edit-compound-class");
  const routeInput = document.getElementById("edit-administration-route");
  const quantityInput = document.getElementById("edit-administration-quantity");
  const unitInput = document.getElementById("edit-administration-unit");
  const uiInput = document.getElementById("edit-ui");
  const activeRoute = p?.administrationRoute || prefillData?.administrationRoute || "subcutaneous";
  const activeUnit = p?.administrationUnit || prefillData?.administrationUnit || "ui";
  if (classInput) classInput.value = p?.compoundClass || prefillData?.compoundClass || "peptide";
  if (routeInput) routeInput.value = activeRoute;
  const syncAdministrationEditor = () => {
    const oral = routeInput?.value === "oral";
    const allowed = oral ? [["tablet", "Comprimido"], ["capsule", "Cápsula"]] : [["ui", "UI"], ["ml", "mL"]];
    const current = unitInput?.value || activeUnit;
    if (unitInput) { unitInput.innerHTML = allowed.map(([value, label]) => `<option value="${value}">${label}</option>`).join(""); unitInput.value = allowed.some(([value]) => value === current) ? current : allowed[0][0]; }
    if (uiInput) { uiInput.closest(".form-field").hidden = oral || unitInput?.value === "ml"; if (oral || unitInput?.value === "ml") uiInput.value = ""; }
  };
  if (quantityInput) quantityInput.value = p?.administrationQuantity ?? prefillData?.administrationQuantity ?? (activeUnit === "ui" ? (p?.ui ?? prefillData?.ui ?? "") : "");
  syncAdministrationEditor();
  routeInput?.addEventListener("change", syncAdministrationEditor);
  unitInput?.addEventListener("change", syncAdministrationEditor);
  document.getElementById("edit-ui").value = p && p.ui !== undefined && p.ui !== null ? p.ui : (prefillData?.ui !== undefined ? prefillData.ui : "");
  syncAdministrationEditor();
  document.getElementById("edit-perday").value = p ? p.perDay || 1 : 1;
  document.getElementById("edit-time").value = p ? p.time || "" : "";
  document.getElementById("edit-note").value = p ? p.note || "" : "";

  const perDayInput = document.getElementById("edit-perday");
  const extraTimesWrap = document.getElementById("edit-extra-times-wrap");
  const extraTimesList = document.getElementById("edit-extra-times-list");
  const mainTimeInput = document.getElementById("edit-time");
  const reminderToggle = document.getElementById("edit-reminders-enabled");
  const reminderHelp = document.getElementById("edit-reminders-help");
  let reminderToggleTouched = false;
  const existingHadSchedule = Boolean(p && Array.isArray(p.times) && p.times.length > 0);
  const mayAutoEnableReminder = !p || !existingHadSchedule;

  const hasValidReminderTime = () => {
    const values = [mainTimeInput?.value, ...[...document.querySelectorAll(".edit-extra-time")].map((input) => input.value)];
    return values.some((value) => isValidTime(value?.trim() || ""));
  };

  const syncReminderControl = () => {
    if (!reminderToggle) return;
    const hasSchedule = hasValidReminderTime();
    reminderToggle.disabled = !hasSchedule;
    reminderToggle.closest(".routine-reminder-label")?.classList.toggle("is-disabled", !hasSchedule);
    if (!hasSchedule) {
      reminderToggle.checked = false;
    } else if (mayAutoEnableReminder && !reminderToggleTouched) {
      reminderToggle.checked = true;
    }
    if (reminderHelp) {
      if (!hasSchedule) {
        reminderHelp.textContent = i18nService.t("modals.routineReminderNoTime");
      } else if (!notifications.isEnabled()) {
        reminderHelp.textContent = i18nService.t("modals.routineReminderGlobalOff");
      } else {
        reminderHelp.textContent = i18nService.t("modals.routineReminderEnabledHelp");
      }
    }
  };

  if (reminderToggle) {
    reminderToggle.checked = p ? p.remindersEnabled !== false : false;
    reminderToggle.onchange = () => {
      reminderToggleTouched = true;
      syncReminderControl();
    };
  }
  if (mainTimeInput) mainTimeInput.oninput = syncReminderControl;

  const renderExtraTimes = () => {
    const pd = Math.min(6, Math.max(1, parseInt(perDayInput?.value, 10) || 1));
    if (!extraTimesWrap || !extraTimesList) return;
    if (pd <= 1) {
      extraTimesWrap.style.display = "none";
      extraTimesList.innerHTML = "";
      syncReminderControl();
      return;
    }

    extraTimesWrap.style.display = "block";
    const existingTimes = p?.times || [];
    let html = "";
    for (let i = 2; i <= pd; i++) {
      const val = existingTimes[i - 1] || "";
      html += `
        <div class="form-field-interval">
          <label class="form-field-label form-field-label--subtle">Horário Dose ${i}</label>
          <input type="time" class="form-field-control form-field-control--compact edit-extra-time" data-index="${i}" value="${esc(val)}" />
        </div>
      `;
    }
    extraTimesList.innerHTML = html;
    extraTimesList.querySelectorAll(".edit-extra-time").forEach((input) => {
      input.addEventListener("input", syncReminderControl);
    });
    syncReminderControl();
  };

  if (perDayInput) {
    perDayInput.oninput = renderExtraTimes;
  }
  renderExtraTimes();
  syncReminderControl();

  pendingCalculationSnapshot = p ? (p.calculationSnapshot || null) : (prefillData?.calculationSnapshot || null);

  const calcInfoEl = document.getElementById("modal-calc-info");
  const calcInfoTxt = document.getElementById("modal-calc-info-txt");
  if (calcInfoEl && calcInfoTxt) {
    if (pendingCalculationSnapshot) {
      calcInfoEl.style.display = "block";
      calcInfoTxt.textContent = `${pendingCalculationSnapshot.vialMg} mg frasco / ${pendingCalculationSnapshot.waterMl} mL diluente ➔ ${pendingCalculationSnapshot.doseVal} ${pendingCalculationSnapshot.doseUnit} (${pendingCalculationSnapshot.unitsUI} UI)`;
    } else {
      calcInfoEl.style.display = "none";
    }
  }

  selectedPer = p?.per || "dia";
  document.querySelectorAll("#edit-period-toggle button").forEach((b) => {
    b.classList.toggle("on", b.dataset.per === selectedPer);
  });

  if (p?.interval && p.interval > 0) {
    selectedFreqType = "intervalo";
    selectedInterval = p.interval;
    selectedStartDate = p.start || dateKey(new Date());
    document.getElementById("edit-interval-val").value = selectedInterval;
    document.getElementById("edit-start-date").value = selectedStartDate;
  } else if (Array.isArray(p?.days) && p.days.length > 0 && p.days.length < 7) {
    selectedFreqType = "especificos";
    selectedDays = [...p.days];
  } else {
    selectedFreqType = "todos";
    selectedDays = [0, 1, 2, 3, 4, 5, 6];
  }

  document.querySelectorAll("#edit-freq-type-toggle button").forEach((b) => {
    b.classList.toggle("on", b.dataset.type === selectedFreqType);
  });

  renderDayChipsUI();
  updateFreqPreviewAndUI();

  selectedColor = p ? p.accent || PALETTE[0] : PALETTE[peptides.length % PALETTE.length];
  renderColorSwatches();

  const protocolStartInput = document.getElementById("edit-protocol-start-date");
  if (protocolStartInput) {
    protocolStartInput.value = p?.start || prefillData?.start || dateKey(new Date());
  }
  const backfillCheck = document.getElementById("edit-backfill-check");
  if (backfillCheck) {
    backfillCheck.checked = false;
  }
  updateBackfillPreviewUI();

  const delBtn = document.getElementById("edit-del-btn");
  if (delBtn) {
    delBtn.style.display = pepId && p?.lifecycleStatus !== "ended" ? "inline-flex" : "none";
    delBtn.textContent = i18nService.t("phase1.end");
  }

  const libSection = document.getElementById("modal-lib-section");
  const libSearchInput = document.getElementById("lib-search-input");
  if (libSection) {
    if (pepId) {
      libSection.style.display = "none";
    } else {
      libSection.style.display = "flex";
      if (libSearchInput) libSearchInput.value = "";
      renderLibraryList("");
    }
  }

  modal.classList.add("on");
  modal.setAttribute("aria-hidden", "false");
  if (accessibilityService) {
    accessibilityService.trapFocus(modal);
  }
}

async function saveEditedPeptide() {
  const name = document.getElementById("edit-name").value.trim();
  if (!name) {
    void dialogService.alert({ title: "Nome obrigatório", message: "Informe o nome do peptídeo.", isDanger: true });
    return;
  }

  const sub = document.getElementById("edit-sub").value.trim();
  const dose = document.getElementById("edit-dose").value.trim();
  const compoundClass = document.getElementById("edit-compound-class")?.value || "peptide";
  const administrationRoute = document.getElementById("edit-administration-route")?.value || "subcutaneous";
  const administrationUnit = document.getElementById("edit-administration-unit")?.value || "ui";
  const administrationQuantity = document.getElementById("edit-administration-quantity")?.value || "";
  const ui = administrationRoute === "oral" || administrationUnit === "ml" ? null : parseUnits(document.getElementById("edit-ui").value);
  const perDay = Number(document.getElementById("edit-perday").value);
  const mainTime = document.getElementById("edit-time").value.trim();
  const note = document.getElementById("edit-note").value.trim();
  const remindersEnabled = Boolean(document.getElementById("edit-reminders-enabled")?.checked);

  const times = [];
  if (mainTime) times.push(mainTime);
  document.querySelectorAll(".edit-extra-time").forEach((input) => {
    const val = input.value.trim();
    if (val) times.push(val);
  });

  const protocolStartDate = document.getElementById("edit-protocol-start-date")?.value || null;
  const normalizedAdministrationQuantity = Number(String(administrationQuantity || (administrationUnit === "ui" ? ui ?? "" : "")).replace(",", "."));
  const validUnit = administrationRoute === "oral" ? ["tablet", "capsule"].includes(administrationUnit) : ["ui", "ml"].includes(administrationUnit);
  if (!Number.isFinite(normalizedAdministrationQuantity) || normalizedAdministrationQuantity <= 0 || !validUnit || (administrationRoute !== "oral" && administrationUnit === "ui" && ui === null) || !Number.isInteger(perDay) || perDay < 1 || perDay > 6 || (mainTime && !isValidTime(mainTime)) || times.some(time => !isValidTime(time)) || (protocolStartDate && !isValidDateKey(protocolStartDate))) {
    void dialogService.alert({ title: "Dados inválidos", message: "Confira a via, quantidade, unidade, horários e data de início.", isDanger: true });
    return;
  }
  let days = null;
  let interval = null;
  let start = protocolStartDate;
  let freq = "Todos os dias";

  if (selectedFreqType === "especificos") {
    if (selectedDays.length === 0) {
      void dialogService.alert({ title: i18nService.t("dialogs.incompleteScheduleTitle"), message: i18nService.t("dialogs.incompleteScheduleMsg"), isDanger: true });
      return;
    }
    days = [...selectedDays].sort((a, b) => a - b);
    freq = formatDaysLabel(days);
  } else if (selectedFreqType === "intervalo") {
    const intVal = Number(document.getElementById("edit-interval-val")?.value);
    if (!Number.isInteger(intVal) || intVal < 2) {
      void dialogService.alert({ title: "Intervalo inválido", message: "Informe um número inteiro de dias, a partir de 2.", isDanger: true });
      return;
    }
    const sDate = protocolStartDate || document.getElementById("edit-start-date")?.value || dateKey(new Date());
    interval = intVal;
    start = sDate;
    freq = `A cada ${intVal} dias`;
  } else {
    freq = "Todos os dias";
    days = null;
  }

  const peptideData = createPeptide({
    id: editingPeptideId,
    name,
    sub,
    dose,
    ui,
    compoundClass,
    administrationRoute,
    administrationQuantity: normalizedAdministrationQuantity,
    administrationUnit,
    administrationLegacy: false,
    per: selectedPer,
    freq,
    days,
    interval,
    start,
    perDay,
    times,
    time: mainTime,
    remindersEnabled,
    note,
    accent: selectedColor,
    calculationSnapshot: pendingCalculationSnapshot
  });

  const peptides = [...storage.getPeptides()];
  const valid = validatePeptide(peptideData);
  if (!valid.valid) {
    void dialogService.alert({ title: "Dados inválidos", message: valid.error, isDanger: true });
    return;
  }

  if (editingPeptideId) {
    const idx = peptides.findIndex((x) => x.id === editingPeptideId);
    if (idx >= 0) {
      const original = peptides[idx];
      const current = resolveProtocolAt(original);
      if (current.lifecycleStatus === "ended") return;
      if (current.dose !== dose || current.ui !== ui) peptideData.calculationSnapshot = null;
      const effectiveDate = document.getElementById("edit-effective-date")?.value;
      const now = new Date();
      if (effectiveDate && (!isValidDateKey(effectiveDate) || effectiveDate <= dateKey(now))) {
        void dialogService.alert({ title: "Vigência inválida", message: "Deixe vazio para aplicar agora ou escolha uma data futura.", isDanger: true });
        return;
      }
      try {
        peptides[idx] = reviseProtocol(original, peptideData, { effectiveFrom: effectiveDate ? new Date(`${effectiveDate}T00:00:00`).toISOString() : now.toISOString(), now });
      } catch (error) {
        void dialogService.alert({ title: i18nService.t("dialogs.protocolChangeError"), message: error.message, isDanger: true });
        return;
      }
    }
  } else {
    peptides.push(peptideData);
  }

  const res = storage.setPeptides(peptides);
  if (!res.success) {
    void dialogService.alert({ title: i18nService.t("dialogs.saveErrorTitle"), message: i18nService.t("dialogs.savePeptideError") + (res.error || ""), isDanger: true });
    return;
  }

  // Preenchimento de histórico retroativo se selecionado
  const backfillWrap = document.getElementById("edit-backfill-wrap");
  const backfillCheck = document.getElementById("edit-backfill-check");
  let backfillAdded = 0;
  if (!editingPeptideId && backfillWrap && backfillWrap.style.display !== "none" && backfillCheck && backfillCheck.checked && start) {
    const backfillRes = doseService.backfillPeptideDoses({
      peptide: peptideData,
      startDate: start,
      todayDate: new Date()
    });
    if (backfillRes.success && backfillRes.addedCount > 0) {
      backfillAdded = backfillRes.addedCount;
    }
    if (!backfillRes.success) {
      void dialogService.alert({ title: i18nService.t("dialogs.backfillFailTitle"), message: i18nService.t("dialogs.backfillFailMsg") + (backfillRes.message || backfillRes.error), isDanger: true });
      invalidateViews("today", "week", "history", "progress");
      return;
    }
  }

  if (accessibilityService) {
    const msg = backfillAdded > 0
      ? `Peptídeo ${name} salvo e ${backfillAdded} dose(s) anterior(es) registradas no histórico.`
      : `Peptídeo ${name} salvo com sucesso.`;
    accessibilityService.announce(msg);
  }

  invalidateViews("today", "week", "history", "progress");
  const reminderResult = await notifications.schedulePeptideRemindersIfNeeded(peptides, { force: true, reason: "protocol-save" });
  await updateNotificationUI(peptides);

  const modal = document.getElementById("edit-modal");
  if (modal) {
    modal.classList.remove("on");
    modal.setAttribute("aria-hidden", "true");
  }
  if (accessibilityService) {
    accessibilityService.restoreFocus();
  }
  switchTab("today");
  haptics.success();
  reportReminderRefreshFailure(reminderResult);
}

function openSharePreviewModal() {
  const modal = document.getElementById("share-preview-modal");
  const previewText = document.getElementById("share-preview-text");
  const optDoses = document.getElementById("share-opt-doses");
  const optNames = document.getElementById("share-opt-names");
  if (!modal || !previewText) return;

  const updatePreview = () => {
    const peptides = storage.getPeptides();
    const logs = storage.getLogs();
    const now = new Date();
    const text = generateDailySummary(peptides, logs, now, {
      includeDoses: optDoses ? optDoses.checked : true,
      includeNames: optNames ? optNames.checked : true,
      includeDisclaimer: true
    });
    previewText.value = text;
  };

  if (optDoses) optDoses.onchange = updatePreview;
  if (optNames) optNames.onchange = updatePreview;

  updatePreview();
  modal.classList.add("on");
  modal.setAttribute("aria-hidden", "false");
  if (accessibilityService) {
    accessibilityService.trapFocus(modal);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
