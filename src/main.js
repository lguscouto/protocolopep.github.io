import "./css/variables.css";
import "./css/base.css";
import "./css/animated-bg.css";
import "./css/components.css";

import { storage } from "./services/storage.js";
import { theme } from "./services/theme.js";
import { haptics } from "./services/haptics.js";
import { notifications } from "./services/notifications.js";
import { appBridge } from "./services/app-bridge.js";
import { DEFAULT_PROTOCOL, LIBRARY, PALETTE, DAY_FULL, DAY_W } from "./data/default-library.js";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const dateKey = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

function daysBetween(aKey, bDate) {
  const a = new Date(aKey + "T00:00:00");
  const b = new Date(bDate);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

const isSchedOn = (p, d) => {
  if (p.interval && p.interval > 0) {
    if (!p.start) return true;
    const diff = daysBetween(p.start, d);
    if (diff < 0) return false;
    return diff % p.interval === 0;
  }
  return p.days === null || (Array.isArray(p.days) && p.days.includes(d.getDay()));
};

let currentTab = "today";
let editingPeptideId = null;

async function initApp() {
  await theme.init();
  await storage.init();
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

  const w = window.innerWidth;
  const h = window.innerHeight;
  const numNodes = Math.min(22, Math.floor((w * h) / 38000));
  const nodes = [];

  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 2
    });
  }

  let svgHtml = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g id="mol-lines"></g><g id="mol-dots"></g></svg>`;
  container.innerHTML = svgHtml;

  const linesGroup = container.querySelector("#mol-lines");
  const dotsGroup = container.querySelector("#mol-dots");

  function animate() {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }

    let dotsStr = "";
    for (const n of nodes) {
      dotsStr += `<circle class="mol-dot" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r}"/>`;
    }

    let linesStr = "";
    const maxDist = 130;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          linesStr += `<line class="mol-line" x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}"/>`;
        }
      }
    }

    if (dotsGroup) dotsGroup.innerHTML = dotsStr;
    if (linesGroup) linesGroup.innerHTML = linesStr;

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav button");
  const navInd = document.querySelector(".nav-ind");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) {
        haptics.light();
        switchTab(tab);
      }
    });
  });

  const activeBtn = document.querySelector(`.nav button[data-tab="${currentTab}"]`);
  if (activeBtn && navInd) {
    navInd.style.left = `${activeBtn.offsetLeft}px`;
    navInd.style.width = `${activeBtn.offsetWidth}px`;
    navInd.style.opacity = "1";
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("on"));
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));

  const targetView = document.getElementById(`view-${tab}`);
  if (targetView) targetView.classList.add("on");

  const btn = document.querySelector(`.nav button[data-tab="${tab}"]`);
  const navInd = document.querySelector(".nav-ind");
  if (navInd && btn) {
    navInd.style.left = `${btn.offsetLeft}px`;
    navInd.style.width = `${btn.offsetWidth}px`;
    navInd.style.opacity = "1";
  }

  if (tab === "today") renderToday();
  if (tab === "week") renderWeek();
  if (tab === "history") renderHistory();
}

function drawRing(taken, total) {
  const pct = total ? taken / total : 0;
  const r = 16, c = 2 * Math.PI * r;
  const ringEl = document.getElementById("ring");
  if (!ringEl) return;
  ringEl.innerHTML = `
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--surface3)" stroke-width="3.6"/>
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--primary)" stroke-width="3.6"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"
      transform="rotate(-90 18 18)" style="transition:stroke-dashoffset .4s ease"/>
    <text x="18" y="19" text-anchor="middle" dominant-baseline="middle"
      font-family="var(--display)" font-size="9.5" font-weight="700" fill="var(--text)">${total ? Math.round(pct * 100) : 0}%</text>`;
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
  if (Array.isArray(v)) return v.map((x) => x.t);
  return [v.t || ""];
}

function renderToday() {
  const peptides = storage.getPeptides();
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = logs[todayK] || {};
  const container = document.getElementById("today-cards");
  if (!container) return;

  container.innerHTML = "";
  let takenCount = 0;

  if (peptides.length === 0) {
    container.innerHTML = `<div class="empty-note">Nenhum peptídeo no seu protocolo ainda.<br>Toque no botão abaixo para adicionar.</div>`;
  }

  peptides.forEach((p) => {
    const perDay = p.perDay || 1;
    const tomadas = dosesTaken(rec, p.id);
    const done = tomadas >= perDay;
    takenCount += Math.min(tomadas, perDay) / perDay;

    const horarios = doseTimes(rec, p.id);
    const lastTime = horarios.length ? horarios[horarios.length - 1] : "";
    const moon = p.moon ? " 🌙" : "";

    const card = document.createElement("div");
    card.className = `card ${done ? "done" : ""}`;
    card.style.setProperty("--acc", p.accent || "var(--primary)");

    let ctrlHTML;
    if (perDay <= 1) {
      ctrlHTML = `
        <button class="take ${done ? "done" : ""}" data-id="${p.id}">
          <span>${done ? "✓ Tomado" : "Tomei"}</span>
          ${done && lastTime ? `<span class="at">${lastTime}</span>` : ""}
        </button>`;
    } else {
      let boxes = "";
      for (let i = 0; i < perDay; i++) {
        const marcada = i < tomadas;
        const hora = marcada && horarios[i] ? horarios[i] : "";
        boxes += `
          <div class="dosebox ${marcada ? "on" : ""}">
            <span class="dosebox-ico">${marcada ? "✓" : i + 1}</span>
            ${hora ? `<span class="dosebox-t">${hora}</span>` : ""}
          </div>`;
      }
      ctrlHTML = `
        <div class="doses" data-id="${p.id}">
          <div class="doses-count">${tomadas} de ${perDay}</div>
          <div class="doses-boxes">${boxes}</div>
          <div class="doses-btns">
            <button class="dose-add" data-id="${p.id}" ${tomadas >= perDay ? "disabled" : ""}>+ dose</button>
            ${tomadas > 0 ? `<button class="dose-undo" data-id="${p.id}">desfazer</button>` : ""}
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
            ${p.time ? `<span class="note-start">⏰ ${p.time}</span>` : ""}
            ${p.start ? `<span class="note-start">início ${fmtBR(p.start)}</span>` : ""}
            ${p.note ? `<span class="note-txt">${esc(p.note)}</span>` : ""}
          </div>` : ""}
      </div>
      <div class="ctrls">
        <button class="gear" data-id="${p.id}" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button class="del" data-id="${p.id}" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      ${ctrlHTML}`;

    container.appendChild(card);
  });

  const total = peptides.length;
  const takenRounded = Math.round(takenCount * 10) / 10;
  const ringN = document.getElementById("ring-n");
  if (ringN) {
    ringN.textContent = `${Number.isInteger(takenRounded) ? takenRounded : takenRounded.toFixed(1)} / ${total}`;
  }
  drawRing(takenCount, total);

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

  if (rec[id]) {
    delete rec[id];
    haptics.light();
  } else {
    rec[id] = { t: nowTime, name: p.name, dose: p.dose, per: p.per };
    haptics.medium();
  }

  logs[todayK] = rec;
  storage.setLogs(logs);
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
  const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nova = { t: nowTime, name: p.name, dose: p.dose, per: p.per };

  let arr = rec[id];
  if (!Array.isArray(arr)) arr = arr ? [arr] : [];
  if (arr.length >= perDay) return;

  arr.push(nova);
  rec[id] = arr;
  logs[todayK] = rec;

  haptics.medium();
  if (arr.length === perDay) haptics.success();

  storage.setLogs(logs);
  renderToday();
  renderWeek();
  renderHistory();
}

function undoSingleDose(id) {
  const logs = storage.getLogs();
  const todayK = dateKey(new Date());
  const rec = { ...(logs[todayK] || {}) };
  const v = rec[id];
  if (!v) return;

  if (Array.isArray(v)) {
    v.pop();
    if (v.length === 0) delete rec[id];
    else rec[id] = v;
  } else {
    delete rec[id];
  }

  logs[todayK] = rec;
  haptics.light();
  storage.setLogs(logs);
  renderToday();
  renderWeek();
  renderHistory();
}

function deletePeptide(id) {
  const peptides = storage.getPeptides();
  const p = peptides.find((x) => x.id === id);
  if (!p) return;

  if (confirm(`Remover "${p.name}" do seu protocolo?`)) {
    haptics.error();
    const updated = peptides.filter((x) => x.id !== id);
    storage.setPeptides(updated);
    renderToday();
    renderWeek();
    renderHistory();
    notifications.schedulePeptideReminders(updated);
  }
}

function renderWeek() {
  const container = document.getElementById("week-table-wrap");
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
          <td class="pep" style="color:${p.accent || "var(--primary)"}">${esc(p.name)}</td>
          ${daysOfWeek.map((d) => {
            const isScheduled = isSchedOn(p, d.date);
            const rec = logs[d.key] || {};
            const taken = dosesTaken(rec, p.id) > 0;

            if (!isScheduled && !taken) {
              return `<td class="${d.isToday ? "col-today" : ""}"><span class="cell na">·</span></td>`;
            }

            return `
              <td class="${d.isToday ? "col-today" : ""}">
                <span class="cell tap ${taken ? "" : "empty"}"
                      data-pep="${p.id}"
                      data-date="${d.key}"
                      style="${taken ? `background:${p.accent || "var(--primary)"}` : ""}">
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

  storage.setLogs(logs);
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
      const p = peptides.find((x) => x.id === pId) || { name: pId, accent: "#2CC5C0" };
      const val = rec[pId];

      if (Array.isArray(val)) {
        val.forEach((doseItem, idx) => {
          totalDoses++;
          pepEntries.push({
            id: pId,
            name: p.name,
            accent: p.accent,
            time: doseItem.t || "Retroativo",
            dose: doseItem.dose || p.dose || "",
            idx: idx
          });
        });
      } else if (val) {
        totalDoses++;
        pepEntries.push({
          id: pId,
          name: p.name,
          accent: p.accent,
          time: val.t || "Retroativo",
          dose: val.dose || p.dose || "",
          idx: 0
        });
      }
    });

    if (pepEntries.length > 0) {
      const dObj = new Date(dk + "T00:00:00");
      const dFmt = dObj.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "short"
      });

      html += `
        <div class="hist-day">
          <div class="hist-date">
            <span>${dFmt}</span>
            <span class="hist-n">${pepEntries.length}</span>
          </div>
          ${pepEntries.map((item) => `
            <div class="hist-item">
              <span class="hist-dot" style="background:${item.accent || "var(--primary)"}"></span>
              <div class="hist-info">
                <div class="hist-name">${esc(item.name)}</div>
                <div class="hist-dose">${esc(item.dose)}</div>
              </div>
              <div class="hist-time">${item.time}</div>
              <button class="hist-rm" data-key="${dk}" data-id="${item.id}" data-idx="${item.idx}" title="Excluir">✕</button>
            </div>
          `).join("")}
        </div>`;
    }
  });

  if (totalDoses === 0) {
    html = `<div class="empty-note">Nenhum registro de dose ainda.</div>`;
  }

  if (countEl) countEl.textContent = `${totalDoses} dose(s) registradas`;
  container.innerHTML = html;

  container.querySelectorAll(".hist-rm").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeHistoryEntry(btn.dataset.key, btn.dataset.id, Number(btn.dataset.idx));
    });
  });
}

function removeHistoryEntry(dKey, pId, idx) {
  const logs = storage.getLogs();
  const rec = logs[dKey];
  if (!rec || !rec[pId]) return;

  if (Array.isArray(rec[pId])) {
    rec[pId].splice(idx, 1);
    if (rec[pId].length === 0) delete rec[pId];
  } else {
    delete rec[pId];
  }

  if (Object.keys(rec).length === 0) delete logs[dKey];
  haptics.light();
  storage.setLogs(logs);
  renderToday();
  renderWeek();
  renderHistory();
}

function setupCalculator() {
  let vialMg = 5;
  let diluentMl = 2;
  let desiredDoseMcg = 250;

  const mgChips = document.querySelectorAll("#calc-mg-chips .chip");
  const mlChips = document.querySelectorAll("#calc-ml-chips .chip");
  const doseInput = document.getElementById("calc-dose-input");
  const unitBtns = document.querySelectorAll("#calc-unit-toggle button");

  let doseUnit = "mcg";

  function recalculate() {
    let desiredMg = doseUnit === "mcg" ? desiredDoseMcg / 1000 : desiredDoseMcg;
    if (desiredMg <= 0 || vialMg <= 0 || diluentMl <= 0) return;

    const concentration = vialMg / diluentMl;
    const volumeMl = desiredMg / concentration;
    const ui = volumeMl * 100;
    const uiRounded = Math.round(ui * 10) / 10;

    const resBig = document.getElementById("calc-res-big");
    const resSub = document.getElementById("calc-res-sub");
    const resConc = document.getElementById("calc-res-conc");
    const resDoses = document.getElementById("calc-res-doses");

    if (resBig) resBig.textContent = uiRounded;
    if (resSub) resSub.innerHTML = `Puxar <b>${uiRounded} UI</b> na seringa de insulina U-100 (${volumeMl.toFixed(3)} ml)`;
    if (resConc) resConc.textContent = `${concentration.toFixed(1)} mg/ml`;
    if (resDoses) resDoses.textContent = `${Math.floor(vialMg / desiredMg)} doses`;

    renderSyringe(uiRounded);
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
      if (!isNaN(val) && val > 0) {
        desiredDoseMcg = val;
        recalculate();
      }
    });
  }

  unitBtns.forEach((b) => {
    b.addEventListener("click", () => {
      unitBtns.forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      doseUnit = b.dataset.u;
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
      await theme.toggleTheme();
    });
  }

  const notifBtn = document.getElementById("notif-btn");
  const notifModal = document.getElementById("notif-modal");
  const notifClose = document.getElementById("notif-close");
  const notifDone = document.getElementById("nf-done");

  if (notifBtn && notifModal) {
    notifBtn.addEventListener("click", () => {
      haptics.light();
      updateNotifModalUI();
      notifModal.classList.add("on");
    });
  }
  if (notifClose && notifModal) {
    notifClose.addEventListener("click", () => notifModal.classList.remove("on"));
  }
  if (notifDone && notifModal) {
    notifDone.addEventListener("click", () => notifModal.classList.remove("on"));
  }

  const nfEnable = document.getElementById("nf-enable");
  if (nfEnable) {
    nfEnable.addEventListener("click", async () => {
      notifications.ensureAudio();
      const granted = await notifications.requestPermission();
      const cfg = notifications.getConfig();
      cfg.enabled = granted ? !cfg.enabled : false;
      notifications.saveConfig(cfg);
      updateNotifModalUI();
      if (cfg.enabled) {
        notifications.sendInstantNotification("Protocolo PEP", "Lembretes e notificações ativados com sucesso! ✓");
        notifications.schedulePeptideReminders(storage.getPeptides());
      }
    });
  }

  const nfTest = document.getElementById("nf-test");
  if (nfTest) {
    nfTest.addEventListener("click", () => {
      notifications.sendInstantNotification("Teste de Lembrete", "Se você viu este aviso, as notificações estão funcionando! ✓");
    });
  }

  const addBtn = document.getElementById("add-pep-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      haptics.light();
      openEditModal(null);
    });
  }

  const editModal = document.getElementById("edit-modal");
  const editClose = document.getElementById("edit-close");
  const editSave = document.getElementById("edit-save");

  if (editClose && editModal) {
    editClose.addEventListener("click", () => editModal.classList.remove("on"));
  }

  if (editSave) {
    editSave.addEventListener("click", () => saveEditedPeptide());
  }

  renderLibraryChips();
  renderColorSwatches();

  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const backup = storage.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
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
        try {
          const data = JSON.parse(reader.result);
          if (confirm("Isto substituirá seu protocolo e registros atuais pelos dados do arquivo. Continuar?")) {
            storage.importBackup(data);
            renderToday();
            renderWeek();
            renderHistory();
            notifications.schedulePeptideReminders(storage.getPeptides());
            alert("Backup importado com sucesso! ✓");
            haptics.success();
          }
        } catch (err) {
          alert("Arquivo inválido. Use um arquivo de backup exportado pelo aplicativo.");
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
    st.style.color = "var(--primary)";
    st.textContent = "Notificações Ativadas ✓";
    en.textContent = "Desativar Lembretes";
  } else {
    st.className = "stat";
    st.style.borderColor = "var(--border)";
    st.style.color = "var(--muted)";
    st.textContent = "Notificações Desativadas";
    en.textContent = "Ativar Lembretes";
  }
}

function renderLibraryChips() {
  const cont = document.getElementById("modal-lib-chips");
  if (!cont) return;

  cont.innerHTML = LIBRARY.map((item) => `
    <button type="button" class="lib-chip" data-name="${esc(item.name)}" data-sub="${esc(item.sub)}">
      ${esc(item.name)}
    </button>
  `).join("");

  cont.querySelectorAll(".lib-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const nmInput = document.getElementById("edit-name");
      const subInput = document.getElementById("edit-sub");
      if (nmInput) nmInput.value = b.dataset.name;
      if (subInput) subInput.value = b.dataset.sub;
      haptics.light();
    });
  });
}

let selectedColor = PALETTE[0];
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
  document.getElementById("edit-freq").value = p ? p.freq || "Todos os dias" : "Todos os dias";
  document.getElementById("edit-perday").value = p ? p.perDay || 1 : 1;
  document.getElementById("edit-time").value = p ? p.time || "" : "";
  document.getElementById("edit-note").value = p ? p.note || "" : "";

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
  const freq = document.getElementById("edit-freq").value.trim() || "Todos os dias";
  const perDay = parseInt(document.getElementById("edit-perday").value) || 1;
  const time = document.getElementById("edit-time").value.trim();
  const note = document.getElementById("edit-note").value.trim();

  const peptides = [...storage.getPeptides()];

  if (editingPeptideId) {
    const idx = peptides.findIndex((x) => x.id === editingPeptideId);
    if (idx >= 0) {
      peptides[idx] = {
        ...peptides[idx],
        name,
        sub,
        dose,
        ui,
        freq,
        perDay,
        time,
        note,
        accent: selectedColor
      };
    }
  } else {
    const newId = "pep_" + Date.now().toString(36);
    peptides.push({
      id: newId,
      name,
      sub,
      dose,
      ui,
      freq,
      perDay,
      time,
      note,
      accent: selectedColor,
      days: null
    });
  }

  storage.setPeptides(peptides);
  renderToday();
  renderWeek();
  renderHistory();
  notifications.schedulePeptideReminders(peptides);

  const modal = document.getElementById("edit-modal");
  if (modal) modal.classList.remove("on");
  haptics.success();
}

document.addEventListener("DOMContentLoaded", initApp);
