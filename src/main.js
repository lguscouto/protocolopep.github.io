import "./css/variables.css";
import "./css/base.css";
import "./css/animated-bg.css";
import "./css/components.css";

import { storage } from "./services/storage.js";
import { theme } from "./services/theme.js";
import { haptics } from "./services/haptics.js";
import { notifications } from "./services/notifications.js";
import { appBridge } from "./services/app-bridge.js";
import { LIBRARY, PALETTE, DAY_FULL, DAY_W } from "./data/default-library.js";
import { calculateReconstitution, convertDoseValue } from "./domain/calculator.js";
import {
  dateToKey,
  daysBetween,
  isScheduledOnDate,
  getScheduledPeptides,
  calculateDayProgress
} from "./domain/schedule.js";
import { createPeptide, validatePeptide } from "./domain/protocol.js";
import { escapeHtml, sanitizeColor, sanitizeId } from "./ui/dom.js";
import { shouldShowOnboarding, showOnboarding } from "./ui/onboarding.js";
import { createCalculationSnapshot, formatAuditTrail } from "./domain/calculation-record.js";
import { createDoseLog, validateDoseLog, normalizeDoseEntry } from "./domain/dose-log.js";
import { generateDailySummary } from "./domain/daily-summary.js";
import { updateNotificationUI, setupNotificationListeners } from "./ui/notification-settings.js";
import { setupBackupPreview } from "./ui/backup-preview.js";
import { recordBackupExport, renderBackupStatusUI } from "./ui/backup-status.js";
import { setupReportModal } from "./ui/report-preview.js";
import { setupDiagnosticsModal } from "./ui/diagnostics.js";
import { setupInventoryUI } from "./ui/inventory.js";
import { calculateRemainingDoses, getExpirationStatus } from "./domain/inventory.js";
import { setupInjectionSitesUI } from "./ui/injection-sites.js";
import { getNextSite, getLastUsedSite } from "./domain/injection-sites.js";
import { setupMeasurementsUI } from "./ui/measurements.js";
import { appLock } from "./services/app-lock.js";
import { setupAppLockUI } from "./ui/app-lock.js";
import { widgetService } from "./services/widget.js";

const esc = escapeHtml;

function fmtBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const dateKey = dateToKey;

function syncAppWidget() {
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

async function initApp() {
  await theme.init();
  storage.init();
  await notifications.init();
  initAnimatedBg();

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
  setupModalsAndButtons();
  setupNotificationListeners(storage);
  setupCalculator();
  inventoryUI = setupInventoryUI({
    storage,
    onInventoryChange: () => {
      renderToday();
      renderWeek();
    }
  });
  sitesUI = setupInjectionSitesUI({
    storage,
    onSitesChange: () => {
      renderToday();
      renderWeek();
    }
  });
  measurementsUI = setupMeasurementsUI({
    storage,
    onMeasurementsChange: () => {
      renderHistory();
    }
  });
  appLockUI = setupAppLockUI({
    appLockService: appLock,
    onUnlock: () => {
      renderToday();
      renderWeek();
      renderHistory();
    }
  });

  renderToday();
  renderWeek();
  renderHistory();
  updateNotificationUI(storage.getPeptides());
  renderBackupStatusUI();
  if (appLockUI && typeof appLockUI.updateSettingsLockCard === "function") {
    appLockUI.updateSettingsLockCard();
  }

  const widgetToggle = document.getElementById("widget-discrete-toggle");
  if (widgetToggle) {
    widgetToggle.checked = widgetService.isDiscreteModeEnabled();
    widgetToggle.addEventListener("change", () => {
      widgetService.setDiscreteModeEnabled(widgetToggle.checked);
      haptics.selection();
      syncAppWidget();
    });
  }

  syncAppWidget();
  notifications.schedulePeptideReminders(storage.getPeptides());
}

function initAnimatedBg() {
  const container = document.getElementById("bg-molecules");
  if (!container) return;

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 18 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1.2
  }));

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const isWhite = theme.getTheme() === "white";
    ctx.fillStyle = isWhite ? "rgba(14, 133, 128, 0.2)" : "rgba(44, 197, 192, 0.15)";
    ctx.strokeStyle = isWhite ? "rgba(14, 133, 128, 0.08)" : "rgba(44, 197, 192, 0.06)";

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
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

function switchTab(tabId) {
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

  if (tabId === "today") renderToday();
  if (tabId === "week") renderWeek();
  if (tabId === "history") renderHistory();
  if (tabId === "settings") {
    updateNotificationUI(storage.getPeptides());
    renderBackupStatusUI();
    if (inventoryUI && typeof inventoryUI.renderInventoryList === "function") {
      inventoryUI.renderInventoryList();
    }
    if (sitesUI && typeof sitesUI.updateSummary === "function") {
      sitesUI.updateSummary();
    }
    if (appLockUI && typeof appLockUI.updateSettingsLockCard === "function") {
      appLockUI.updateSettingsLockCard();
    }
    const widgetToggle = document.getElementById("widget-discrete-toggle");
    if (widgetToggle) {
      widgetToggle.checked = widgetService.isDiscreteModeEnabled();
    }
  }
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
  const v = rec[id];
  if (!v) return 0;
  if (Array.isArray(v)) return v.length;
  return 1;
}

function doseTimes(rec, id) {
  const v = rec[id];
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => x.t || "");
  return [v.t || ""];
}

function renderToday() {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const now = new Date();
  const todayK = dateKey(now);
  const rec = logs[todayK] || {};
  const container = document.getElementById("today-cards");
  if (!container) return;

  container.innerHTML = "";

  // Filtrar apenas compostos agendados para o dia de hoje
  const scheduledToday = getScheduledPeptides(peptides, now);

  if (peptides.length === 0) {
    container.innerHTML = `<div class="empty-note">Nenhum peptídeo no seu protocolo ainda.<br>Toque no botão abaixo para adicionar.</div>`;
  } else if (scheduledToday.length === 0) {
    container.innerHTML = `<div class="empty-note">Nenhuma dose programada para hoje.<br>Acompanhe sua grade na aba <b>Semana</b>.</div>`;
  }

  scheduledToday.forEach((p) => {
    const perDay = p.perDay || 1;
    const tomadas = dosesTaken(rec, p.id);
    const done = tomadas >= perDay;

    const horarios = doseTimes(rec, p.id);
    const lastTime = horarios.length ? horarios[horarios.length - 1] : "";
    const moon = p.moon ? " 🌙" : "";

    const card = document.createElement("div");
    card.className = `card ${done ? "done" : ""}`;
    card.style.setProperty("--acc", sanitizeColor(p.accent, "var(--primary)"));

    let ctrlHTML;
    if (perDay <= 1) {
      ctrlHTML = `
        <button class="take ${done ? "done" : ""}" data-id="${sanitizeId(p.id)}">
          <span>${done ? "✓ Tomado" : "Tomei"}</span>
          ${done && lastTime ? `<span class="at">${esc(lastTime)}</span>` : ""}
        </button>`;
    } else {
      let boxes = "";
      for (let i = 0; i < perDay; i++) {
        const marcada = i < tomadas;
        const hora = marcada && horarios[i] ? horarios[i] : "";
        boxes += `
          <div class="dosebox ${marcada ? "on" : ""}">
            <span class="dosebox-ico">${marcada ? "✓" : i + 1}</span>
            ${hora ? `<span class="dosebox-t">${esc(hora)}</span>` : ""}
          </div>`;
      }
      ctrlHTML = `
        <div class="doses" data-id="${sanitizeId(p.id)}">
          <div class="doses-count">${tomadas} de ${perDay}</div>
          <div class="doses-boxes">${boxes}</div>
          <div class="doses-btns">
            <button class="dose-add" data-id="${sanitizeId(p.id)}" ${tomadas >= perDay ? "disabled" : ""}>+ dose</button>
            ${tomadas > 0 ? `<button class="dose-undo" data-id="${sanitizeId(p.id)}">desfazer</button>` : ""}
          </div>
        </div>`;
    }

    const activeVial = storage.findVialForPeptide(p.id, p.name);
    let vialBadgeHTML = "";
    if (activeVial) {
      const remDoses = calculateRemainingDoses(activeVial, p.dose);
      const exp = getExpirationStatus(activeVial);
      const expAlert = exp.status === "expired" ? " ⚠️ Vencido" : exp.status === "expiring_soon" ? " ⏳ Vence em breve" : "";
      vialBadgeHTML = `<span class="chip-acc" style="background:rgba(14,133,128,0.12);color:var(--accent);font-size:11px;font-weight:700;" title="Saldo: ${activeVial.remainingMcg} mcg">🧪 ~${remDoses} doses${expAlert}</span>`;
    }

    const configuredSites = storage.getSites();
    let siteBadgeHTML = "";
    if (configuredSites && configuredSites.length > 0) {
      const lastUsed = getLastUsedSite(storage.getLogs(), p.id);
      const nextSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null);
      if (nextSite) {
        siteBadgeHTML = `<span class="chip-acc" style="background:rgba(99,102,241,0.12);color:var(--primary);font-size:11px;font-weight:700;" title="Próximo sítio na sua rotação">📍 ${esc(nextSite)}</span>`;
      }
    }

    card.innerHTML = `
      <div class="info">
        <div class="nm"><span class="dot"></span>${esc(p.name)}${moon}</div>
        <div class="sub">${esc(p.sub || "")}</div>
        <div class="meta">
          <span class="ui">${esc(String(p.ui))} UI</span>
          <span class="freq">· ${esc(p.freq || "")}</span>
          <span class="chip-acc">${esc(p.dose || "")}/${esc(p.per || "dia")}</span>
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
        <button class="gear" data-id="${sanitizeId(p.id)}" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button class="del" data-id="${sanitizeId(p.id)}" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      ${ctrlHTML}`;

    container.appendChild(card);
  });

  // Cálculo canônico do anel diário
  const dayProgress = calculateDayProgress(peptides, logs, now);
  const ringN = document.getElementById("ring-n");
  if (ringN) {
    ringN.textContent = `${dayProgress.totalTaken} / ${dayProgress.totalDue}`;
  }
  drawRing(dayProgress.totalTaken, dayProgress.totalDue);

  container.querySelectorAll(".take").forEach((b) => {
    b.addEventListener("click", () => toggleDose(b.dataset.id));
  });
  container.querySelectorAll(".dose-add").forEach((b) => {
    b.addEventListener("click", () => addSingleDose(b.dataset.id));
  });
  container.querySelectorAll(".dose-undo").forEach((b) => {
    b.addEventListener("click", () => undoSingleDose(b.dataset.id));
  });
  container.querySelectorAll(".gear").forEach((b) => {
    b.addEventListener("click", () => openEditModal(b.dataset.id));
  });
  container.querySelectorAll(".del").forEach((b) => {
    b.addEventListener("click", () => deletePeptide(b.dataset.id));
  });

  syncAppWidget();
}

function toggleDose(id) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = { ...(logs[todayK] || {}) };
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isUndoing = dosesTaken(rec, id) > 0;

  let createdLog = null;
  if (isUndoing) {
    delete rec[id];
    haptics.light();
  } else {
    const configuredSites = storage.getSites();
    const lastUsed = getLastUsedSite(logs, p.id);
    const currentSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null) || "";

    createdLog = createDoseLog({
      peptideId: p.id,
      scheduledDate: todayK,
      time: nowTime,
      dose: p.dose,
      ui: p.ui,
      site: currentSite,
      retroactive: false
    });
    rec[id] = [createdLog];
    haptics.success();
  }

  if (Object.keys(rec).length === 0) {
    delete logs[todayK];
  } else {
    logs[todayK] = rec;
  }

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao gravar aplicação: " + (res.error || "Armazenamento local indisponível"));
    return;
  }

  // Movimentação no inventário após persistência confirmada
  const activeVial = storage.findVialForPeptide(p.id, p.name);
  if (activeVial) {
    if (isUndoing) {
      storage.creditDoseToVial(activeVial.id, { doseStr: p.dose, note: `Estorno de aplicação (${p.name})` });
    } else {
      storage.debitDoseFromVial(activeVial.id, { doseStr: p.dose, doseLogId: createdLog?.id, note: p.name });
    }
  }

  renderToday();
  renderWeek();
  renderHistory();
}

function addSingleDose(id) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = { ...(logs[todayK] || {}) };
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  const perDay = p.perDay || 1;
  const curr = rec[id];
  let arr = [];

  if (Array.isArray(curr)) {
    arr = [...curr];
  } else if (curr && typeof curr === "object") {
    const norm = normalizeDoseEntry(curr, todayK, id);
    if (norm) arr = [norm];
  }

  if (arr.length >= perDay) return;

  const configuredSites = storage.getSites();
  const lastUsed = getLastUsedSite(logs, p.id);
  const currentSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null) || "";

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const doseLog = createDoseLog({
    peptideId: p.id,
    scheduledDate: todayK,
    time: nowTime,
    dose: p.dose,
    ui: p.ui,
    site: currentSite,
    retroactive: false
  });
  arr.push(doseLog);
  rec[id] = arr;
  logs[todayK] = rec;

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao gravar dose: " + (res.error || "Armazenamento indisponível"));
    return;
  }

  // Débito no inventário após persistência confirmada
  const activeVial = storage.findVialForPeptide(p.id, p.name);
  if (activeVial) {
    storage.debitDoseFromVial(activeVial.id, { doseStr: p.dose, doseLogId: doseLog.id, note: p.name });
  }

  haptics.medium();
  renderToday();
  renderWeek();
  renderHistory();
}

function undoSingleDose(id) {
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = { ...(logs[todayK] || {}) };
  const curr = rec[id];

  if (Array.isArray(curr) && curr.length > 0) {
    curr.pop();
    if (curr.length === 0) delete rec[id];
    else rec[id] = curr;
  } else if (curr) {
    delete rec[id];
  }

  if (Object.keys(rec).length === 0) delete logs[todayK];
  else logs[todayK] = rec;

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao remover dose: " + (res.error || "Armazenamento indisponível"));
    return;
  }

  // Estorno no inventário
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (p) {
    const activeVial = storage.findVialForPeptide(p.id, p.name);
    if (activeVial) {
      storage.creditDoseToVial(activeVial.id, { doseStr: p.dose, note: `Estorno de dose (${p.name})` });
    }
  }

  haptics.light();
  renderToday();
  renderWeek();
  renderHistory();
}

function renderWeek() {
  const container = document.getElementById("week-table-wrap") || document.getElementById("week-grid");
  if (!container) return;

  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const now = new Date();
  const currentDow = now.getDay();

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDow);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    weekDays.push(d);
  }

  let tableHtml = `
    <table class="week-table">
      <thead>
        <tr>
          <th style="text-align:left;padding-left:8px;">Peptídeo</th>
          ${weekDays.map((d, i) => `
            <th class="${i === currentDow ? "today" : ""}">
              <span class="dw">${DAY_W[i]}</span>
              <span class="dn">${d.getDate()}</span>
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>`;

  if (peptides.length === 0) {
    tableHtml += `<tr><td colspan="8" class="empty-note">Nenhum peptídeo cadastrado.</td></tr>`;
  } else {
    peptides.forEach((p) => {
      tableHtml += `
        <tr>
          <td class="pep" data-id="${sanitizeId(p.id)}" style="color:${sanitizeColor(p.accent, "var(--primary)")};cursor:pointer;" title="Toque para editar ou excluir">${esc(p.name)}</td>
          ${weekDays.map((d) => {
            const dK = dateKey(d);
            const isScheduled = isScheduledOnDate(p, d);
            const rec = logs[dK] || {};
            const taken = dosesTaken(rec, p.id) > 0;

            if (!isScheduled && !taken) {
              return `<td class="${dK === dateKey(now) ? "col-today" : ""}"><span class="cell na">·</span></td>`;
            }

            return `
              <td class="${dK === dateKey(now) ? "col-today" : ""}">
                <span class="cell tap ${taken ? "" : "empty"}"
                      data-pep="${sanitizeId(p.id)}"
                      data-date="${sanitizeId(dK)}"
                      style="${taken ? `background:${sanitizeColor(p.accent, "var(--primary)")}` : ""}">
                  ${taken ? "✓" : ""}
                </span>
              </td>`;
          }).join("")}
        </tr>`;
    });
  }

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;

  container.querySelectorAll(".pep[data-id]").forEach((cell) => {
    cell.addEventListener("click", () => {
      openEditModal(cell.dataset.id);
      haptics.light();
    });
  });

  container.querySelectorAll(".cell.tap").forEach((cell) => {
    cell.addEventListener("click", () => {
      toggleDateLog(cell.dataset.pep, cell.dataset.date);
    });
  });
}

async function toggleDateLog(id, dKey) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const rec = { ...(logs[dKey] || {}) };
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  const todayK = dateKey(new Date());

  if (dKey > todayK) {
    alert("Não é permitido registrar aplicações em datas futuras.");
    return;
  }

  if (dKey < todayK) {
    if (dosesTaken(rec, id) > 0) {
      const confirmed = await showConfirmDialog({
        title: "Remover Dose Passada",
        message: `Deseja remover a aplicação de ${p.name} registrada em ${fmtBR(dKey)}?`,
        confirmText: "Remover",
        isDanger: true
      });
      if (!confirmed) return;

      delete rec[id];
      if (Object.keys(rec).length === 0) delete logs[dKey];
      else logs[dKey] = rec;

      const res = storage.setLogs(logs);
      if (!res.success) {
        alert("Erro ao remover registro: " + (res.error || "Armazenamento indisponível"));
        return;
      }
      haptics.light();
      renderToday();
      renderWeek();
      renderHistory();
    } else {
      openRetroLogModal(dKey, id);
    }
    return;
  }

  toggleDose(id);
}

function openRetroLogModal(prefillDate = null, prefillPepId = null) {
  const modal = document.getElementById("retro-log-modal");
  if (!modal) return;

  const peptides = storage.getPeptides();
  if (peptides.length === 0) {
    alert("Adicione pelo menos um peptídeo ao seu protocolo antes de registrar aplicações.");
    return;
  }

  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");

  const todayKey = dateKey(new Date());

  if (dateInput) {
    dateInput.max = todayKey;
    dateInput.value = prefillDate || todayKey;
  }

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (timeInput) {
    timeInput.value = nowTime;
  }

  if (pepSelect) {
    pepSelect.innerHTML = peptides.map((p) => `
      <option value="${esc(p.id)}" ${p.id === prefillPepId ? "selected" : ""}>
        ${esc(p.name)} (${esc(p.dose || "")}${p.ui ? ` · ${esc(String(p.ui))} UI` : ""})
      </option>
    `).join("");

    const updateDoseAndUi = () => {
      const selectedId = pepSelect.value;
      const p = peptides.find((x) => x.id === selectedId);
      if (p) {
        if (doseInput) doseInput.value = p.dose || "";
        if (uiInput) uiInput.value = p.ui !== undefined && p.ui !== null ? p.ui : "";
      }
      if (siteSelect) {
        const configuredSites = storage.getSites();
        const lastUsed = getLastUsedSite(storage.getLogs(), selectedId);
        const nextSite = getNextSite(configuredSites, lastUsed ? lastUsed.site : null);
        siteSelect.innerHTML = `
          <option value="">-- Não especificado --</option>
          ${configuredSites.map((s) => `<option value="${esc(s)}" ${s === nextSite ? "selected" : ""}>${esc(s)}</option>`).join("")}
        `;
      }
    };

    pepSelect.onchange = updateDoseAndUi;
    updateDoseAndUi();
  }

  if (noteInput) noteInput.value = "";

  modal.classList.add("on");
}

function saveRetroLog() {
  const pepSelect = document.getElementById("retro-pep-select");
  const siteSelect = document.getElementById("retro-site-select");
  const dateInput = document.getElementById("retro-date-input");
  const timeInput = document.getElementById("retro-time-input");
  const doseInput = document.getElementById("retro-dose-input");
  const uiInput = document.getElementById("retro-ui-input");
  const noteInput = document.getElementById("retro-note-input");

  const pepId = pepSelect ? pepSelect.value : "";
  const siteVal = siteSelect ? siteSelect.value.trim() : "";
  const dKey = dateInput ? dateInput.value : "";
  const timeVal = timeInput ? timeInput.value : "12:00";
  const doseVal = doseInput ? doseInput.value.trim() : "";
  const uiVal = uiInput ? parseInt(uiInput.value, 10) || 0 : 0;
  const noteVal = noteInput ? noteInput.value.trim() : "";

  if (!pepId) {
    alert("Selecione um peptídeo.");
    return;
  }

  if (!dKey) {
    alert("Selecione a data da aplicação.");
    return;
  }

  const todayKey = dateKey(new Date());
  if (dKey > todayKey) {
    alert("Não é permitido registrar aplicações em datas futuras.");
    return;
  }

  const logEntry = createDoseLog({
    peptideId: pepId,
    scheduledDate: dKey,
    time: timeVal,
    dose: doseVal,
    ui: uiVal,
    note: noteVal,
    site: siteVal,
    retroactive: dKey < todayKey
  });

  const validRes = validateDoseLog(logEntry);
  if (!validRes.valid) {
    alert(validRes.error || "Dados inválidos para registro de dose.");
    return;
  }

  const logs = storage.getLogs();
  const rec = { ...(logs[dKey] || {}) };
  const curr = rec[pepId];
  let arr = [];
  if (Array.isArray(curr)) {
    arr = [...curr];
  } else if (curr && typeof curr === "object") {
    const norm = normalizeDoseEntry(curr, dKey, pepId);
    if (norm) arr = [norm];
  }

  arr.push(logEntry);
  rec[pepId] = arr;
  logs[dKey] = rec;

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao gravar aplicação: " + (res.error || "Armazenamento indisponível"));
    return;
  }

  const modal = document.getElementById("retro-log-modal");
  if (modal) modal.classList.remove("on");

  haptics.success();
  renderToday();
  renderWeek();
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("history-list");
  const countEl = document.getElementById("history-count");
  if (!container) return;

  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const daysKeys = Object.keys(logs).sort().reverse();

  let totalDoses = 0;
  let html = "";

  daysKeys.forEach((dk) => {
    const rec = logs[dk];
    if (!rec) return;

    const pepEntries = [];
    Object.keys(rec).forEach((pId) => {
      const p = peptides.find((x) => x.id === pId) || {
        name: pId,
        accent: "#2CC5C0"
      };
      const val = rec[pId];

      if (Array.isArray(val)) {
        val.forEach((doseItem, idx) => {
          const norm = normalizeDoseEntry(doseItem, dk, pId);
          if (norm) {
            totalDoses++;
            pepEntries.push({
              id: pId,
              name: p.name || norm.name || pId,
              accent: p.accent,
              time: norm.time || "12:00",
              dose: norm.dose || p.dose || "",
              ui: norm.ui || p.ui || 0,
              note: norm.note || "",
              site: norm.site || "",
              retroactive: norm.retroactive,
              idx: idx
            });
          }
        });
      } else if (val && typeof val === "object") {
        const norm = normalizeDoseEntry(val, dk, pId);
        if (norm) {
          totalDoses++;
          pepEntries.push({
            id: pId,
            name: p.name || norm.name || pId,
            accent: p.accent,
            time: norm.time || "12:00",
            dose: norm.dose || p.dose || "",
            ui: norm.ui || p.ui || 0,
            note: norm.note || "",
            site: norm.site || "",
            retroactive: norm.retroactive,
            idx: 0
          });
        }
      }
    });

    if (pepEntries.length > 0) {
      const [y, m, d] = dk.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = DAY_FULL[dateObj.getDay()] || "";
      const formattedDate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;

      html += `
        <div class="hist-day">
          <div class="hist-date">
            <span>${formattedDate} · ${dayName}</span>
            <span class="hist-n">${pepEntries.length} dose${pepEntries.length > 1 ? "s" : ""}</span>
          </div>
          <div class="hist-list">
            ${pepEntries.map((e) => `
              <div class="hist-item">
                <span class="hist-dot" style="background:${sanitizeColor(e.accent, "var(--primary)")};"></span>
                <div class="hist-info">
                  <div class="hist-name">${esc(e.name)}</div>
                  <div class="hist-dose">
                    ${esc(e.dose)}${e.ui ? ` · ${esc(String(e.ui))} UI` : ""}${e.site ? ` · 📍 ${esc(e.site)}` : ""}
                  </div>
                  ${e.note ? `<div class="hist-note">💬 ${esc(e.note)}</div>` : ""}
                </div>
                <div class="hist-time">
                  <span>${esc(e.time)}</span>
                  ${e.retroactive ? `<span class="badge-retro">Retroativo</span>` : ""}
                </div>
                <button class="hist-rm" data-date="${sanitizeId(dk)}" data-pep="${sanitizeId(e.id)}" data-idx="${e.idx}" title="Excluir dose">✕</button>
              </div>
            `).join("")}
          </div>
        </div>`;
    }
  });

  if (countEl) countEl.textContent = `${totalDoses} doses registradas`;

  if (totalDoses === 0) {
    container.innerHTML = `<div class="empty-note">Nenhum registro de dose ainda.<br>Marque suas aplicações no <b>Dashboard</b>, <b>Semana</b> ou toque em <b>+ Dose Retroativa</b>.</div>`;
  } else {
    container.innerHTML = html;
  }

  if (measurementsUI && typeof measurementsUI.renderTrendSummary === "function") {
    measurementsUI.renderTrendSummary();
    measurementsUI.renderMeasurementsHistory();
  }

  container.querySelectorAll(".hist-rm").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dKey = btn.dataset.date;
      const pId = btn.dataset.pep;
      const idx = parseInt(btn.dataset.idx, 10);
      const confirmed = await showConfirmDialog({
        title: "Excluir Registro",
        message: "Deseja realmente remover este registro de dose do histórico?",
        confirmText: "Excluir",
        isDanger: true
      });
      if (confirmed) {
        deleteHistoryEntry(dKey, pId, idx);
      }
    });
  });
}

function deleteHistoryEntry(dKey, pId, idx) {
  const logs = storage.getLogs();
  if (!logs[dKey] || !logs[dKey][pId]) return;

  const val = logs[dKey][pId];
  if (Array.isArray(val)) {
    val.splice(idx, 1);
    if (val.length === 0) delete logs[dKey][pId];
  } else {
    delete logs[dKey][pId];
  }

  if (Object.keys(logs[dKey]).length === 0) {
    delete logs[dKey];
  }

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao remover registro: " + (res.error || "Armazenamento indisponível"));
    return;
  }

  // Estorno no inventário após exclusão confirmada
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === pId);
  if (p) {
    const activeVial = storage.findVialForPeptide(p.id, p.name);
    if (activeVial) {
      storage.creditDoseToVial(activeVial.id, { doseStr: p.dose, note: `Estorno por exclusão (${p.name})` });
    }
  }

  haptics.light();
  renderToday();
  renderWeek();
  renderHistory();
}

function showConfirmDialog({ title = "Confirmar", message = "", confirmText = "Confirmar", cancelText = "Cancelar", isDanger = true }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-title");
    const msgEl = document.getElementById("confirm-message");
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");
    const closeBtn = document.getElementById("confirm-close");

    if (!modal) {
      const res = window.confirm(message);
      return resolve(res);
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.className = isDanger ? "btn-danger" : "btn-primary";
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const cleanup = () => {
      modal.classList.remove("on");
      okBtn?.removeEventListener("click", onOk);
      cancelBtn?.removeEventListener("click", onCancel);
      closeBtn?.removeEventListener("click", onCancel);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    okBtn?.addEventListener("click", onOk);
    cancelBtn?.addEventListener("click", onCancel);
    closeBtn?.addEventListener("click", onCancel);

    modal.classList.add("on");
    haptics.warning();
  });
}

async function deletePeptide(id) {
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  const confirmed = await showConfirmDialog({
    title: "Excluir Peptídeo",
    message: `Deseja realmente remover "${p.name}" do seu protocolo? Os registros de histórico anteriores serão preservados.`,
    confirmText: "Excluir",
    cancelText: "Cancelar",
    isDanger: true
  });

  if (!confirmed) return;

  const updated = peptides.filter((x) => x.id !== id);
  const res = storage.setPeptides(updated);
  if (!res.success) {
    alert("Erro ao remover peptídeo: " + (res.error || "Armazenamento indisponível"));
    return;
  }

  haptics.medium();
  closeAllModals();
  renderToday();
  renderWeek();
  renderHistory();
  notifications.schedulePeptideReminders(updated);
}

function setupCalculator() {
  let vialMg = 5;
  let diluentMl = 2;
  let desiredDoseVal = NaN;
  let doseUnit = "mcg";
  let currentCalculationSnapshot = null;

  const mgChips = document.querySelectorAll("#calc-mg-chips .chip");
  const mlChips = document.querySelectorAll("#calc-ml-chips .chip");
  const doseInput = document.getElementById("calc-dose-input");
  const unitBtns = document.querySelectorAll("#calc-unit-toggle button");
  const auditCard = document.getElementById("calc-audit-card");
  const auditFormula = document.getElementById("calc-audit-formula");
  const auditTrail = document.getElementById("calc-audit-trail");
  const useBtn = document.getElementById("calc-use-btn");

  function recalculate() {
    const resBig = document.getElementById("calc-res-big");
    const resSub = document.getElementById("calc-res-sub");
    const resConc = document.getElementById("calc-res-conc");
    const resDoses = document.getElementById("calc-res-doses");

    const concentrationMgMl = (vialMg / diluentMl).toFixed(2);
    if (resConc) resConc.textContent = `${concentrationMgMl} mg/mL`;

    const saveVialBtn = document.getElementById("calc-save-vial-btn");

    if (isNaN(desiredDoseVal) || desiredDoseVal <= 0) {
      if (resBig) resBig.textContent = "--";
      if (resSub) resSub.innerHTML = `Informe a dose pretendida acima para calcular as unidades (UI).`;
      if (resDoses) resDoses.textContent = "--";
      if (auditCard) auditCard.style.display = "none";
      if (useBtn) useBtn.disabled = true;
      if (saveVialBtn) saveVialBtn.disabled = true;
      currentCalculationSnapshot = null;
      renderSyringe(0);
      return;
    }

    const result = calculateReconstitution({
      vialMg,
      waterMl: diluentMl,
      doseVal: desiredDoseVal,
      doseUnit,
      syringeMaxUI: 100
    });

    if (!result.valid) {
      if (resBig) resBig.textContent = "--";
      if (resSub) resSub.innerHTML = `<span style="color:var(--danger)">${esc(result.error)}</span>`;
      if (resDoses) resDoses.textContent = "--";
      if (auditCard) auditCard.style.display = "none";
      if (useBtn) useBtn.disabled = true;
      if (saveVialBtn) saveVialBtn.disabled = true;
      currentCalculationSnapshot = null;
      renderSyringe(0);
      return;
    }

    if (resBig) resBig.textContent = result.unitsUI;
    if (resSub) resSub.innerHTML = `Puxar <b>${result.unitsUI} UI</b> na seringa de insulina U-100 (${result.volumeMl} mL)`;
    if (resDoses) resDoses.textContent = `${result.dosesPerVial} doses`;

    currentCalculationSnapshot = createCalculationSnapshot(result);

    if (auditCard) {
      auditCard.style.display = "flex";
      if (auditFormula) auditFormula.textContent = result.formula;
      if (auditTrail) auditTrail.textContent = formatAuditTrail(currentCalculationSnapshot);
    }

    if (useBtn) useBtn.disabled = false;
    if (saveVialBtn) saveVialBtn.disabled = false;

    renderSyringe(result.unitsUI);
  }

  function renderSyringe(ui) {
    const cont = document.getElementById("calc-syringe");
    if (!cont) return;

    const clampedUi = Math.min(100, Math.max(0, ui));
    const fillWidth = (clampedUi / 100) * 240;

    cont.innerHTML = `
      <svg viewBox="0 0 320 60" style="width:100%;max-width:340px;height:auto;">
        <rect x="30" y="15" width="250" height="30" rx="4" fill="var(--surface3)" stroke="var(--border2)" stroke-width="1.5"/>
        <rect x="30" y="16" width="${fillWidth}" height="28" fill="var(--primary)" opacity="0.6"/>
        <line x1="8" y1="30" x2="30" y2="30" stroke="var(--muted2)" stroke-width="2"/>
        ${[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
          const x = 30 + (tick / 100) * 240;
          return `
            <line x1="${x}" y1="15" x2="${x}" y2="${tick % 20 === 0 ? "27" : "22"}" stroke="var(--text)" stroke-width="1" opacity="0.7"/>
            ${tick % 20 === 0 ? `<text x="${x}" y="38" font-size="8" font-family="var(--display)" fill="var(--muted)" text-anchor="middle">${tick}</text>` : ""}
          `;
        }).join("")}
        <line x1="${30 + fillWidth}" y1="10" x2="${30 + fillWidth}" y2="50" stroke="var(--danger)" stroke-width="3"/>
      </svg>`;
  }

  mgChips.forEach((c) => {
    c.addEventListener("click", () => {
      mgChips.forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      vialMg = Number(c.dataset.v);
      haptics.light();
      recalculate();
    });
  });

  mlChips.forEach((c) => {
    c.addEventListener("click", () => {
      mlChips.forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      diluentMl = Number(c.dataset.v);
      haptics.light();
      recalculate();
    });
  });

  if (doseInput) {
    doseInput.addEventListener("input", (e) => {
      const raw = e.target.value.trim();
      const val = parseFloat(raw);
      desiredDoseVal = raw !== "" && !isNaN(val) ? val : NaN;
      recalculate();
    });
  }

  unitBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const oldUnit = doseUnit;
      const newUnit = b.dataset.u;
      if (oldUnit === newUnit) return;

      unitBtns.forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      doseUnit = newUnit;

      if (doseInput && doseInput.value) {
        const converted = convertDoseValue(doseInput.value, oldUnit, newUnit);
        doseInput.value = converted;
        desiredDoseVal = parseFloat(converted) || 0;
      }

      if (doseInput) {
        doseInput.placeholder = doseUnit === "mcg" ? "ex: 250" : "ex: 2.5";
      }

      haptics.light();
      recalculate();
    });
  });

  if (useBtn) {
    useBtn.addEventListener("click", () => {
      if (!currentCalculationSnapshot) return;
      haptics.medium();
      openEditModal(null, {
        dose: `${desiredDoseVal} ${doseUnit}`,
        ui: currentCalculationSnapshot.unitsUI,
        calculationSnapshot: currentCalculationSnapshot
      });
    });
  }

  recalculate();
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.remove("on"));
  const retroOverlay = document.getElementById("retro-overlay");
  if (retroOverlay) retroOverlay.style.display = "none";
}

function setupModalsAndButtons() {
  const themeBtn = document.getElementById("theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", async () => {
      haptics.medium();
      await theme.toggle();
    });
  }

  const notifBtn = document.getElementById("notif-btn");
  const notifModal = document.getElementById("notif-modal");
  if (notifBtn && notifModal) {
    notifBtn.addEventListener("click", () => {
      updateNotifModalUI();
      notifModal.classList.add("on");
      haptics.light();
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

  const nfEnable = document.getElementById("nf-enable");
  if (nfEnable) {
    nfEnable.addEventListener("click", async () => {
      const cfg = notifications.getConfig();
      if (!cfg.enabled) {
        const granted = await notifications.requestPermission();
        if (granted) {
          notifications.saveConfig({ enabled: true });
          notifications.schedulePeptideReminders(storage.getPeptides());
          haptics.success();
        } else {
          alert("Permissão de notificação não concedida nas configurações do dispositivo.");
        }
      } else {
        notifications.saveConfig({ enabled: false });
        await notifications.cancelAllPepReminders();
        haptics.light();
      }
      updateNotifModalUI();
    });
  }

  const nfTest = document.getElementById("nf-test");
  if (nfTest) {
    nfTest.addEventListener("click", async () => {
      await notifications.sendInstantNotification(
        "Protocolo PEP · Notificação de Teste",
        "Seus lembretes de peptídeos estão funcionando perfeitamente! 💉"
      );
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

  const exportBtn = document.getElementById("export-btn");
  const handleExport = () => {
    const backupPayload = storage.exportBackup(theme.getTheme());
    const blob = new Blob([backupPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `protocolo-pep-backup-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordBackupExport();
    renderBackupStatusUI();
    haptics.success();
  };

  if (exportBtn) exportBtn.addEventListener("click", handleExport);

  setupBackupPreview({
    storage,
    theme,
    notifications,
    onStateRestored: () => {
      renderToday();
      renderWeek();
      renderHistory();
      updateNotificationUI(storage.getPeptides());
    }
  });

  setupReportModal(storage);
  setupDiagnosticsModal({
    storage,
    getNotificationsActive: () => notifications.isEnabled(),
    appVersion: "1.7.0"
  });

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

  const dashShareBtn = document.getElementById("dash-share-btn");
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
        alert("Resumo copiado para a área de transferência! ✓");
      } catch (err) {
        console.error("Falha ao copiar:", err);
        alert("Não foi possível copiar automaticamente.");
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
          alert("Compartilhamento nativo indisponível. Resumo copiado para a área de transferência! ✓");
        } catch (err) {
          alert("Compartilhamento não suportado.");
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
  const filtered = LIBRARY.filter((item) => {
    if (!query) return true;
    const nameNorm = normalizeStr(item.name);
    const subNorm = normalizeStr(item.sub);
    return nameNorm.includes(query) || subNorm.includes(query);
  });

  if (filtered.length === 0) {
    cont.innerHTML = `<div class="lib-empty">Nenhum peptídeo encontrado na biblioteca. Digite um nome personalizado abaixo.</div>`;
    return;
  }

  const currentName = (document.getElementById("edit-name")?.value || "").trim().toLowerCase();

  cont.innerHTML = filtered.map((item) => {
    const isSelected = item.name.trim().toLowerCase() === currentName;
    return `
      <div class="lib-item ${isSelected ? "selected" : ""}" data-name="${esc(item.name)}" data-sub="${esc(item.sub || "")}">
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
    <button type="button" data-color="${color}" style="background:${color};" class="${color === selectedColor ? "on" : ""}"></button>
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
  const p = pepId ? peptides.find((x) => x.id === pepId) : null;

  if (title) title.textContent = p ? `Editar ${p.name}` : "Adicionar Peptídeo";

  document.getElementById("edit-name").value = p ? p.name : (prefillData?.name || "");
  document.getElementById("edit-sub").value = p ? p.sub || "" : (prefillData?.sub || "");
  document.getElementById("edit-dose").value = p ? p.dose || "" : (prefillData?.dose || "");
  document.getElementById("edit-ui").value = p && p.ui !== undefined ? p.ui : (prefillData?.ui !== undefined ? prefillData.ui : "");
  document.getElementById("edit-perday").value = p ? p.perDay || 1 : 1;
  document.getElementById("edit-time").value = p ? p.time || "" : "";
  document.getElementById("edit-note").value = p ? p.note || "" : "";

  const perDayInput = document.getElementById("edit-perday");
  const extraTimesWrap = document.getElementById("edit-extra-times-wrap");
  const extraTimesList = document.getElementById("edit-extra-times-list");

  const renderExtraTimes = () => {
    const pd = Math.min(6, Math.max(1, parseInt(perDayInput?.value, 10) || 1));
    if (!extraTimesWrap || !extraTimesList) return;
    if (pd <= 1) {
      extraTimesWrap.style.display = "none";
      extraTimesList.innerHTML = "";
      return;
    }

    extraTimesWrap.style.display = "block";
    const existingTimes = p?.times || [];
    let html = "";
    for (let i = 2; i <= pd; i++) {
      const val = existingTimes[i - 1] || "";
      html += `
        <div style="flex:1;min-width:120px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:3px;">Horário Dose ${i}</label>
          <input type="time" class="txt edit-extra-time" data-index="${i}" value="${esc(val)}" style="width:100%;padding:6px 8px;font-size:12.5px;" />
        </div>
      `;
    }
    extraTimesList.innerHTML = html;
  };

  if (perDayInput) {
    perDayInput.oninput = renderExtraTimes;
  }
  renderExtraTimes();

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

  const delBtn = document.getElementById("edit-del-btn");
  if (delBtn) {
    delBtn.style.display = pepId ? "inline-flex" : "none";
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
}

function saveEditedPeptide() {
  const name = document.getElementById("edit-name").value.trim();
  if (!name) {
    alert("Digite o nome do peptídeo.");
    return;
  }

  const sub = document.getElementById("edit-sub").value.trim();
  const dose = document.getElementById("edit-dose").value.trim();
  const ui = parseInt(document.getElementById("edit-ui").value, 10) || 0;
  const perDay = parseInt(document.getElementById("edit-perday").value, 10) || 1;
  const mainTime = document.getElementById("edit-time").value.trim();
  const note = document.getElementById("edit-note").value.trim();

  const times = [];
  if (mainTime) times.push(mainTime);
  document.querySelectorAll(".edit-extra-time").forEach((input) => {
    const val = input.value.trim();
    if (val) times.push(val);
  });

  let days = null;
  let interval = null;
  let start = null;
  let freq = "Todos os dias";

  if (selectedFreqType === "especificos") {
    if (selectedDays.length === 0) {
      alert("Selecione pelo menos um dia da semana.");
      return;
    }
    days = [...selectedDays].sort((a, b) => a - b);
    freq = formatDaysLabel(days);
  } else if (selectedFreqType === "intervalo") {
    const intVal = parseInt(document.getElementById("edit-interval-val")?.value) || 2;
    const sDate = document.getElementById("edit-start-date")?.value || dateKey(new Date());
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
    per: selectedPer,
    freq,
    days,
    interval,
    start,
    perDay,
    times,
    time: mainTime,
    note,
    accent: selectedColor,
    calculationSnapshot: pendingCalculationSnapshot
  });

  const peptides = [...storage.getPeptides()];

  if (editingPeptideId) {
    const idx = peptides.findIndex((x) => x.id === editingPeptideId);
    if (idx >= 0) {
      peptides[idx] = peptideData;
    }
  } else {
    peptides.push(peptideData);
  }

  const res = storage.setPeptides(peptides);
  if (!res.success) {
    alert("Erro ao salvar peptídeo: " + (res.error || "Armazenamento local indisponível"));
    return;
  }

  renderToday();
  renderWeek();
  renderHistory();
  updateNotificationUI(peptides);
  notifications.schedulePeptideReminders(peptides);

  const modal = document.getElementById("edit-modal");
  if (modal) modal.classList.remove("on");
  switchTab("today");
  haptics.success();
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
