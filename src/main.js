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

const esc = escapeHtml;

function fmtBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const dateKey = dateToKey;

let currentTab = "today";
let editingPeptideId = null;

async function initApp() {
  await theme.init();
  storage.init();
  await notifications.init();
  initAnimatedBg();

  appBridge.init(
    () => {
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

  const now = new Date();
  const datestrip = document.getElementById("datestrip");
  if (datestrip) {
    datestrip.textContent = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  setupNavigation();
  setupModalsAndButtons();
  setupCalculator();

  renderToday();
  renderWeek();
  renderHistory();

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
  const navBtns = document.querySelectorAll(".nav button");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) {
        haptics.selection();
        switchTab(tab);
      }
    });
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
    btn.classList.toggle("on", btn.dataset.tab === tabId);
  });

  if (tabId === "today") renderToday();
  if (tabId === "week") renderWeek();
  if (tabId === "history") renderHistory();
}

function drawRing(taken, total) {
  const circle = document.getElementById("ring-circle");
  const pctEl = document.getElementById("ring-pct");
  if (!circle || !pctEl) return;

  const pct = total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;
  const circumference = 2 * Math.PI * 20; // r=20
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

    card.innerHTML = `
      <div class="info">
        <div class="nm"><span class="dot"></span>${esc(p.name)}${moon}</div>
        <div class="sub">${esc(p.sub || "")}</div>
        <div class="meta">
          <span class="ui">${esc(String(p.ui))} UI</span>
          <span class="freq">· ${esc(p.freq || "")}</span>
          <span class="chip-acc">${esc(p.dose || "")}/${esc(p.per || "dia")}</span>
        </div>
        ${(p.start || p.note || p.time) ? `
          <div class="note-line">
            ${p.time ? `<span class="note-start">⏰ ${esc(p.time)}</span>` : ""}
            ${p.start ? `<span class="note-start">início ${fmtBR(p.start)}</span>` : ""}
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
}

function toggleDose(id) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = { ...(logs[todayK] || {}) };
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (dosesTaken(rec, id) > 0) {
    delete rec[id];
    haptics.light();
  } else {
    rec[id] = { t: nowTime, name: p.name, dose: p.dose, per: p.per };
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
    arr = [{ t: curr.t || "", name: p.name, dose: p.dose, per: p.per }];
  }

  if (arr.length >= perDay) return;

  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  arr.push({ t: nowTime, name: p.name, dose: p.dose, per: p.per });
  rec[id] = arr;
  logs[todayK] = rec;

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao gravar dose: " + (res.error || "Armazenamento indisponível"));
    return;
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

  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    daysOfWeek.push({
      date: d,
      key: dateKey(d),
      dow: i,
      dayNum: d.getDate(),
      isToday: i === currentDow
    });
  }

  let tableHtml = `
    <table class="week-table">
      <thead>
        <tr>
          <th style="text-align:left;padding-left:8px;">Peptídeo</th>
          ${daysOfWeek.map((d) => `
            <th class="${d.isToday ? "today" : ""}">
              <span class="dw">${DAY_W[d.dow]}</span>
              <span class="dn">${d.dayNum}</span>
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
          <td class="pep" style="color:${sanitizeColor(p.accent, "var(--primary)")}">${esc(p.name)}</td>
          ${daysOfWeek.map((d) => {
            const isScheduled = isScheduledOnDate(p, d.date);
            const rec = logs[d.key] || {};
            const taken = dosesTaken(rec, p.id) > 0;

            if (!isScheduled && !taken) {
              return `<td class="${d.isToday ? "col-today" : ""}"><span class="cell na">·</span></td>`;
            }

            return `
              <td class="${d.isToday ? "col-today" : ""}">
                <span class="cell tap ${taken ? "" : "empty"}"
                      data-pep="${sanitizeId(p.id)}"
                      data-date="${sanitizeId(d.key)}"
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

  container.querySelectorAll(".cell.tap").forEach((cell) => {
    cell.addEventListener("click", () => {
      toggleDateLog(cell.dataset.pep, cell.dataset.date);
    });
  });
}

function toggleDateLog(id, dKey) {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const rec = { ...(logs[dKey] || {}) };
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  if (dosesTaken(rec, id) > 0) {
    delete rec[id];
    haptics.light();
  } else {
    rec[id] = { t: "", name: p.name, dose: p.dose, per: p.per, retro: true };
    haptics.medium();
  }

  if (Object.keys(rec).length === 0) delete logs[dKey];
  else logs[dKey] = rec;

  const res = storage.setLogs(logs);
  if (!res.success) {
    alert("Erro ao gravar registro: " + (res.error || "Armazenamento indisponível"));
    return;
  }
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
        name: (rec[pId] && !Array.isArray(rec[pId]) && rec[pId].name) || pId,
        accent: "#2CC5C0"
      };
      const val = rec[pId];

      if (Array.isArray(val)) {
        val.forEach((doseItem, idx) => {
          totalDoses++;
          pepEntries.push({
            id: pId,
            name: doseItem.name || p.name,
            accent: p.accent,
            time: doseItem.t || "Retroativo",
            dose: doseItem.dose || p.dose || "",
            idx: idx
          });
        });
      } else if (val && typeof val === "object") {
        totalDoses++;
        pepEntries.push({
          id: pId,
          name: val.name || p.name,
          accent: p.accent,
          time: val.t || (val.retro ? "Retroativo" : ""),
          dose: val.dose || p.dose || "",
          idx: 0
        });
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
                  ${e.dose ? `<div class="hist-dose">${esc(e.dose)}</div>` : ""}
                </div>
                <span class="hist-time">${esc(e.time || "Feito")}</span>
                <button class="hist-rm" data-date="${sanitizeId(dk)}" data-pep="${sanitizeId(e.id)}" data-idx="${e.idx}" title="Excluir dose">✕</button>
              </div>
            `).join("")}
          </div>
        </div>`;
    }
  });

  if (countEl) countEl.textContent = `${totalDoses} doses registradas`;

  if (totalDoses === 0) {
    container.innerHTML = `<div class="empty-note">Nenhum registro de dose ainda.<br>Marque suas aplicações na tela <b>Hoje</b> ou na <b>Semana</b>.</div>`;
  } else {
    container.innerHTML = html;
  }

  container.querySelectorAll(".hist-rm").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dKey = btn.dataset.date;
      const pId = btn.dataset.pep;
      const idx = parseInt(btn.dataset.idx, 10);
      deleteHistoryEntry(dKey, pId, idx);
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
  haptics.light();
  renderToday();
  renderWeek();
  renderHistory();
}

function deletePeptide(id) {
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  if (confirm(`Remover "${p.name}" do seu protocolo? (Os registros de histórico anteriores serão mantidos)`)) {
    const updated = peptides.filter((x) => x.id !== id);
    const res = storage.setPeptides(updated);
    if (!res.success) {
      alert("Erro ao remover peptídeo: " + (res.error || "Armazenamento indisponível"));
      return;
    }
    haptics.medium();
    renderToday();
    renderWeek();
    renderHistory();
    notifications.schedulePeptideReminders(updated);
  }
}

function setupCalculator() {
  let vialMg = 5;
  let diluentMl = 2;
  let desiredDoseVal = 250;
  let doseUnit = "mcg";

  const mgChips = document.querySelectorAll("#calc-mg-chips .chip");
  const mlChips = document.querySelectorAll("#calc-ml-chips .chip");
  const doseInput = document.getElementById("calc-dose-input");
  const unitBtns = document.querySelectorAll("#calc-unit-toggle button");

  function recalculate() {
    const resBig = document.getElementById("calc-res-big");
    const resSub = document.getElementById("calc-res-sub");
    const resConc = document.getElementById("calc-res-conc");
    const resDoses = document.getElementById("calc-res-doses");

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
      if (resConc) resConc.textContent = "--";
      if (resDoses) resDoses.textContent = "--";
      renderSyringe(0);
      return;
    }

    if (resBig) resBig.textContent = result.unitsUI;
    if (resSub) resSub.innerHTML = `Puxar <b>${result.unitsUI} UI</b> na seringa de insulina U-100 (${result.volumeMl} mL)`;
    if (resConc) resConc.textContent = `${result.concentrationMgMl} mg/mL`;
    if (resDoses) resDoses.textContent = `${result.dosesPerVial} doses`;

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
      const val = parseFloat(e.target.value);
      desiredDoseVal = !isNaN(val) ? val : 0;
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

  renderLibraryChips();

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
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const backupPayload = storage.exportBackup(theme.getTheme());
      const blob = new Blob([backupPayload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `protocolo-pep-backup-${dateKey(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      haptics.success();
    });
  }

  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (confirm("Isto substituirá seu protocolo e registros atuais pelos dados do arquivo. Continuar?")) {
          const res = storage.importBackup(reader.result);
          if (res.success) {
            if (res.theme) theme.setTheme(res.theme);
            renderToday();
            renderWeek();
            renderHistory();
            notifications.schedulePeptideReminders(storage.getPeptides());
            alert(`Backup importado com sucesso! ✓\n• Peptídeos: ${res.stats.peptideCount}\n• Dias com registros: ${res.stats.logDaysCount}\n• Total de doses: ${res.stats.totalDosesCount}`);
            haptics.success();
          } else {
            alert("Erro ao importar backup: " + res.error);
            haptics.warning();
          }
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }
}

function updateNotifModalUI() {
  const cfg = notifications.getConfig();
  const st = document.getElementById("nf-status");
  const en = document.getElementById("nf-enable");
  if (!st || !en) return;

  if (cfg.enabled) {
    st.className = "stat";
    st.style.borderColor = "var(--primary)";
    st.textContent = "Notificações Ativadas ✓";
    en.textContent = "Desativar Lembretes";
    en.className = "btn-subtle";
  } else {
    st.className = "stat off";
    st.style.borderColor = "var(--border)";
    st.textContent = "Notificações Desativadas";
    en.textContent = "Ativar Lembretes";
    en.className = "btn-cta";
  }
}

function renderLibraryChips() {
  const cont = document.getElementById("modal-lib-chips");
  if (!cont) return;

  cont.innerHTML = LIBRARY.map((item) => `
    <button type="button" class="lib-chip" data-name="${esc(item.name)}" data-sub="${esc(item.sub || "")}">
      + ${esc(item.name)}
    </button>
  `).join("");

  cont.querySelectorAll(".lib-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nameInput = document.getElementById("edit-name");
      const subInput = document.getElementById("edit-sub");
      if (nameInput) nameInput.value = btn.dataset.name;
      if (subInput) subInput.value = btn.dataset.sub;
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

function openEditModal(pepId) {
  editingPeptideId = pepId;
  const modal = document.getElementById("edit-modal");
  const title = document.getElementById("modal-title");
  if (!modal) return;

  const peptides = storage.getPeptides();
  const p = pepId ? peptides.find((x) => x.id === pepId) : null;

  if (title) title.textContent = p ? `Editar ${p.name}` : "Adicionar Peptídeo";

  document.getElementById("edit-name").value = p ? p.name : "";
  document.getElementById("edit-sub").value = p ? p.sub || "" : "";
  document.getElementById("edit-dose").value = p ? p.dose || "" : "";
  document.getElementById("edit-ui").value = p ? p.ui || 10 : 10;
  document.getElementById("edit-perday").value = p ? p.perDay || 1 : 1;
  document.getElementById("edit-time").value = p ? p.time || "" : "";
  document.getElementById("edit-note").value = p ? p.note || "" : "";

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
  const ui = parseInt(document.getElementById("edit-ui").value) || 10;
  const perDay = parseInt(document.getElementById("edit-perday").value) || 1;
  const time = document.getElementById("edit-time").value.trim();
  const note = document.getElementById("edit-note").value.trim();

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
    time,
    note,
    accent: selectedColor
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
  notifications.schedulePeptideReminders(peptides);

  const modal = document.getElementById("edit-modal");
  if (modal) modal.classList.remove("on");
  haptics.success();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
