import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PEP_SCREENSHOT_URL || "http://127.0.0.1:3000/";
const outputDir = path.resolve("docs/store-screenshots");
const today = new Date();

function dateKey(offset = 0) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const todayKey = dateKey(0);
const yesterdayKey = dateKey(-1);
const beforeYesterdayKey = dateKey(-2);

const peptides = [
  {
    id: "pep_alpha",
    name: "Composto Alfa",
    sub: "rotina pessoal",
    dose: "250 mcg",
    ui: 10,
    perDay: 1,
    time: "08:00",
    color: "#30D5C8",
    days: null
  },
  {
    id: "pep_beta",
    name: "Composto Beta",
    sub: "acompanhamento local",
    dose: "500 mcg",
    ui: 20,
    perDay: 1,
    time: "20:00",
    color: "#F5B75B",
    days: null
  }
];

function doseLog(id, peptideId, scheduledDate, time, site, retroactive = false) {
  return {
    id,
    peptideId,
    scheduledDate,
    takenAt: `${scheduledDate}T${time}:00.000Z`,
    time,
    status: "applied",
    dose: peptideId === "pep_alpha" ? "250 mcg" : "500 mcg",
    ui: peptideId === "pep_alpha" ? 10 : 20,
    note: retroactive ? "Registro da semana" : "",
    site,
    retroactive
  };
}

const logs = {
  [beforeYesterdayKey]: {
    "pep_alpha": [doseLog("shot-before", "pep_alpha", beforeYesterdayKey, "08:00", "Abdômen (Esquerdo)", true)]
  },
  [yesterdayKey]: {
    "pep_beta": [doseLog("shot-yesterday", "pep_beta", yesterdayKey, "20:00", "Coxa (Direita)", true)]
  }
};

const measurements = [
  {
    id: "measurement-sample",
    date: yesterdayKey,
    time: "07:30",
    weightKg: 82.4,
    energyLevel: 4,
    moodLevel: 4,
    symptoms: ["Sono reparador", "Disposição elevada"],
    notes: "Treino leve e hidratação normal.",
    source: "local",
    ownership: "pep"
  }
];

async function seedApp(page) {
  await page.addInitScript(({ peptides: seedPeptides, logs: seedLogs, measurements: seedMeasurements }) => {
    localStorage.clear();
    localStorage.setItem("pep_user_language", "pt-BR");
    localStorage.setItem("pep_onboarding_version", "1");
    localStorage.setItem("pep_protocol_v2", JSON.stringify(seedPeptides));
    localStorage.setItem("pep_logs_v2", JSON.stringify(seedLogs));
    localStorage.setItem("pep_measurements_v2", JSON.stringify(seedMeasurements));
  }, { peptides, logs, measurements });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
}

async function captureApp(page, setup) {
  await seedApp(page);
  await setup(page);
  await page.waitForTimeout(250);
  return page.screenshot({ type: "png" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function marketingMarkup({ title, subtitle, imageBase64, index }) {
  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
        body {
          position: relative;
          color: #f1f5f9;
          background:
            radial-gradient(720px 520px at 0% 0%, rgba(48,213,200,.18), transparent 70%),
            radial-gradient(760px 600px at 100% 100%, rgba(245,183,91,.12), transparent 72%),
            #070b10;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .glow { position: absolute; width: 600px; height: 600px; border-radius: 50%; background: rgba(48,213,200,.06); filter: blur(12px); right: -260px; top: 520px; }
        .content { position: relative; z-index: 1; padding: 102px 82px 0; text-align: center; }
        .eyebrow { color: #30d5c8; font-size: 22px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        h1 { max-width: 880px; margin: 24px auto 0; font-size: 64px; line-height: 1.06; letter-spacing: -.04em; font-weight: 800; }
        .subtitle { max-width: 760px; margin: 24px auto 0; color: #a7b3c2; font-size: 28px; line-height: 1.35; }
        .phone { width: 680px; height: 1410px; margin: 48px auto 0; padding: 20px; border: 3px solid rgba(241,245,249,.24); border-radius: 52px; background: #111821; box-shadow: 0 34px 70px rgba(0,0,0,.45), 0 0 0 1px rgba(48,213,200,.12); }
        .screen { width: 640px; height: 1350px; overflow: hidden; border-radius: 34px; background: #070b10; }
        .screen img { display: block; width: 640px; height: 1350px; object-fit: fill; }
        .footer { position: absolute; z-index: 1; left: 82px; right: 82px; bottom: 40px; display: flex; align-items: center; justify-content: space-between; color: #8a98a8; font-size: 21px; }
        .footer strong { color: #f1f5f9; font-weight: 700; }
        .number { color: #30d5c8; font-weight: 800; }
      </style>
    </head>
    <body>
      <div class="glow" aria-hidden="true"></div>
      <main class="content">
        <div class="eyebrow">Protocolo PEP</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
        <div class="phone"><div class="screen"><img src="data:image/png;base64,${imageBase64}" alt="Prévia do aplicativo Protocolo PEP"></div></div>
      </main>
      <footer class="footer"><span><strong>Precisão que acolhe.</strong> Registro pessoal no seu aparelho.</span><span class="number">0${index}</span></footer>
    </body>
  </html>`;
}

const shots = [
  {
    filename: "01-proxima-acao.png",
    title: "A próxima ação fica clara.",
    subtitle: "Registre a rotina de hoje em poucos toques.",
    setup: async () => {}
  },
  {
    filename: "02-mapa-de-aplicacao.png",
    title: "Registre o local com clareza.",
    subtitle: "Um mapa visual para guardar a sua escolha.",
    setup: async (page) => {
      await page.locator("#tab-history").click();
      await page.locator("#hist-retro-btn").click();
      await page.locator("#retro-log-modal").waitFor({ state: "visible" });
    }
  },
  {
    filename: "03-linha-do-tempo.png",
    title: "Sua semana, em uma linha do tempo.",
    subtitle: "Histórico e próximos passos no mesmo lugar.",
    setup: async (page) => {
      await page.locator("#tab-week").click();
      await page.locator(".week-timeline").waitFor({ state: "visible" });
    }
  },
  {
    filename: "04-acompanhamento-pessoal.png",
    title: "Acompanhe no seu ritmo.",
    subtitle: "Medidas e observações ficam organizadas no aparelho.",
    setup: async (page) => {
      await page.locator("#tab-history").click();
      await page.locator("#open-measurement-modal-btn").click();
      await page.locator("#measurement-modal").waitFor({ state: "visible" });
      await page.locator("#meas-weight-input").fill("82.4");
      await page.locator("#meas-energy-4").click();
      await page.locator("#meas-mood-4").click();
      await page.locator(".symptom-chip-btn").filter({ hasText: "Sono reparador" }).click();
    }
  }
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, locale: "pt-BR" });
const appPage = await context.newPage();
await appPage.setViewportSize({ width: 360, height: 760 });
const marketingPage = await context.newPage();

try {
  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    const appPng = await captureApp(appPage, shot.setup);
    const imageBase64 = appPng.toString("base64");
    await marketingPage.setViewportSize({ width: 1080, height: 1920 });
    await marketingPage.setContent(marketingMarkup({ ...shot, imageBase64, index: i + 1 }), { waitUntil: "load" });
    await marketingPage.evaluate(() => window.scrollTo(0, 0));
    await marketingPage.screenshot({ path: path.join(outputDir, shot.filename), type: "png" });
  }
} finally {
  await browser.close();
}

console.log(`Generated ${shots.length} store screenshots in ${outputDir}`);
