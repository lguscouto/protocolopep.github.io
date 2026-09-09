import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const RUNS = 5;
const BASELINE = Object.freeze({
  initialGzipBytes: 107.46 * 1024,
  domReadyMs: 366,
  firstContentMs: 228,
  longTasksMs: 250,
  domNodes: 1116
});
const LIMITS = Object.freeze({
  initialGzipBytes: Math.min(80 * 1024, BASELINE.initialGzipBytes * 0.75),
  domReadyMs: BASELINE.domReadyMs * 0.85,
  firstContentMs: BASELINE.firstContentMs * 1.05,
  longTasksMs: BASELINE.longTasksMs * 0.7,
  domNodes: Math.floor(BASELINE.domNodes * 0.75),
  featureMs: 200
});

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value) => Math.round(value * 10) / 10;

function syntheticFixture() {
  const peptides = Array.from({ length: 10 }, (_, index) => ({
    id: `perf-peptide-${index}`,
    name: `Composto ${index + 1}`,
    sub: "Massa de desempenho",
    dose: `${250 + index * 25} mcg`,
    ui: 10 + index,
    perDay: 1,
    time: `${String(7 + (index % 8)).padStart(2, "0")}:00`,
    color: `hsl(${index * 36} 70% 55%)`,
    days: null,
    startDate: "2025-01-01"
  }));
  const logs = {};
  const measurements = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let offset = 0; offset < 365; offset += 1) {
    const date = cursor.toISOString().slice(0, 10);
    const peptide = peptides[offset % peptides.length];
    logs[date] = [{
      id: `perf-log-${offset}`,
      peptideId: peptide.id,
      date,
      time: peptide.time,
      dose: peptide.dose,
      units: peptide.ui,
      site: offset % 2 ? "Abdômen esquerdo" : "Abdômen direito"
    }];
    measurements.push({
      id: `perf-measure-${offset}`,
      date,
      time: "07:00",
      weightKg: 80 + (offset % 10) / 10,
      symptoms: [],
      notes: "",
      source: "local",
      ownership: "pep"
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return { peptides, logs, measurements };
}

async function initialEntryGzipBytes() {
  const html = await readFile("dist/index.html", "utf8");
  const match = html.match(/<script[^>]+src="\.\/assets\/(index-[^"]+\.js)"/);
  if (!match) {
    const assets = await readdir("dist/assets");
    throw new Error(`Chunk inicial não encontrado em dist/index.html (${assets.length} assets).`);
  }
  return gzipSync(await readFile(`dist/assets/${match[1]}`)).byteLength;
}

async function preparePage(browser, baseUrl, fixture) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.addInitScript((data) => {
    localStorage.clear();
    localStorage.setItem("pep_user_language", "pt-BR");
    localStorage.setItem("pep_onboarding_version", "1");
    if (data.peptides.length) localStorage.setItem("pep_protocol_v2", JSON.stringify(data.peptides));
    if (Object.keys(data.logs).length) localStorage.setItem("pep_logs_v2", JSON.stringify(data.logs));
    if (data.measurements.length) localStorage.setItem("pep_measurements_v2", JSON.stringify(data.measurements));
    window.__pepLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        window.__pepLongTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Navegadores sem Long Tasks API continuam medindo as demais métricas.
    }
  }, fixture);
  return { context, page, runtimeErrors, baseUrl };
}

async function measureStartup(browser, baseUrl, fixture) {
  const { context, page, runtimeErrors } = await preparePage(browser, baseUrl, fixture);
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#view-today.on").waitFor();
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const paint = performance.getEntriesByName("first-contentful-paint")[0];
      return {
        domReadyMs: nav?.domContentLoadedEventEnd || 0,
        firstContentMs: paint?.startTime || 0,
        longTasksMs: (window.__pepLongTasks || []).reduce((total, duration) => total + duration, 0),
        domNodes: document.querySelectorAll("*").length
      };
    });
    if (runtimeErrors.length) throw new Error(`Erros no runtime: ${runtimeErrors.join(" | ")}`);
    return metrics;
  } finally {
    await context.close();
  }
}

async function measureFeature(browser, baseUrl, tabId, readySelector, beforeClick) {
  const { context, page, runtimeErrors } = await preparePage(browser, baseUrl, { peptides: [], logs: {}, measurements: [] });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#view-today.on").waitFor();
    await page.locator("html").waitFor({ state: "attached" });
    await page.waitForFunction(() => document.documentElement.dataset.pepPrefetchReady === "true", null, { timeout: 5000 });
    if (beforeClick) await beforeClick(page);
    const elapsed = await page.evaluate(({ tabId, readySelector }) => new Promise((resolve, reject) => {
      const tab = document.getElementById(tabId);
      if (!tab) return reject(new Error(`Aba ausente: ${tabId}`));
      const start = performance.now();
      const finish = () => {
        if (document.querySelector(readySelector)?.getAttribute("data-feature-ready") === "true") {
          resolve(performance.now() - start);
          return true;
        }
        return false;
      };
      const observer = new MutationObserver(() => {
        if (finish()) observer.disconnect();
      });
      observer.observe(document.documentElement, { attributes: true, subtree: true });
      tab.click();
      if (finish()) observer.disconnect();
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Tempo excedido ao abrir ${tabId}`));
      }, 5000);
    }), { tabId, readySelector });
    if (runtimeErrors.length) throw new Error(`Erros no runtime: ${runtimeErrors.join(" | ")}`);
    return elapsed;
  } finally {
    await context.close();
  }
}

function assertAtMost(label, value, limit) {
  if (value > limit) throw new Error(`${label}: ${round(value)} excede o limite ${round(limit)}.`);
}

const server = await preview({
  preview: { host: "127.0.0.1", port: 4183, strictPort: true },
  logLevel: "error"
});
const address = server.httpServer.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const initialGzipBytes = await initialEntryGzipBytes();
  const scenarios = {
    vazio: { peptides: [], logs: {}, measurements: [] },
    carga: syntheticFixture()
  };
  const results = {};
  for (const [name, fixture] of Object.entries(scenarios)) {
    results[name] = [];
    for (let run = 0; run < RUNS; run += 1) results[name].push(await measureStartup(browser, baseUrl, fixture));
  }
  const medians = Object.fromEntries(Object.entries(results).map(([name, runs]) => [name, {
    domReadyMs: median(runs.map((item) => item.domReadyMs)),
    firstContentMs: median(runs.map((item) => item.firstContentMs)),
    longTasksMs: median(runs.map((item) => item.longTasksMs)),
    domNodes: median(runs.map((item) => item.domNodes))
  }]));

  const features = {};
  for (const feature of [
    ["agenda", "tab-week", "#view-week"],
    ["historico", "tab-history", "#view-history"],
    ["mais", "tab-settings", "#view-settings"]
  ]) {
    const values = [];
    for (let run = 0; run < RUNS; run += 1) values.push(await measureFeature(browser, baseUrl, feature[1], feature[2]));
    features[feature[0]] = median(values);
  }

  assertAtMost("JavaScript inicial gzip (bytes)", initialGzipBytes, LIMITS.initialGzipBytes);
  const metrics = medians.vazio;
  assertAtMost("vazio: DOM pronto", metrics.domReadyMs, LIMITS.domReadyMs);
  assertAtMost("vazio: primeiro conteúdo", metrics.firstContentMs, LIMITS.firstContentMs);
  assertAtMost("vazio: tarefas longas", metrics.longTasksMs, LIMITS.longTasksMs);
  assertAtMost("vazio: elementos no DOM", metrics.domNodes, LIMITS.domNodes);
  for (const [name, elapsed] of Object.entries(features)) assertAtMost(`Primeiro acesso a ${name}`, elapsed, LIMITS.featureMs);

  console.log(JSON.stringify({
    profile: { runs: RUNS, viewport: "412x915", cpuThrottle: 4 },
    initialJavaScript: { bytes: initialGzipBytes, gzipKb: round(initialGzipBytes / 1024) },
    medians: Object.fromEntries(Object.entries(medians).map(([name, data]) => [name, Object.fromEntries(Object.entries(data).map(([key, value]) => [key, round(value)]))])),
    firstAccessMs: Object.fromEntries(Object.entries(features).map(([name, value]) => [name, round(value)])),
    limits: Object.fromEntries(Object.entries(LIMITS).map(([key, value]) => [key, round(value)]))
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
