import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

const THEME_KEY = "pep_theme_mode";

class ThemeService {
  constructor() {
    this.currentTheme = "preto"; // padrão preto/dark
  }

  async init() {
    let saved = localStorage.getItem(THEME_KEY);
    if (!saved) {
      // Checar preferência do sistema
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        saved = "branco";
      } else {
        saved = "preto";
      }
    }
    this.applyTheme(saved);

    // Escutar mudanças do sistema se não houver preferência fixa
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        const userChoice = localStorage.getItem(THEME_KEY);
        if (!userChoice) {
          this.applyTheme(e.matches ? "preto" : "branco");
        }
      });
    }
  }

  getTheme() {
    return this.currentTheme;
  }

  async toggleTheme() {
    const next = this.currentTheme === "branco" ? "preto" : "branco";
    this.applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    return next;
  }

  async applyTheme(themeName) {
    this.currentTheme = themeName === "branco" ? "branco" : "preto";
    const isLight = this.currentTheme === "branco";

    if (isLight) {
      document.body.classList.remove("theme-dark");
      document.body.classList.add("theme-light", "light");
    } else {
      document.body.classList.remove("theme-light", "light");
      document.body.classList.add("theme-dark");
    }

    // Atualizar meta theme-color do HTML
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const colorBg = isLight ? "#F4F7F9" : "#080C11";
    if (metaTheme) {
      metaTheme.setAttribute("content", colorBg);
    }

    // Sincronizar com StatusBar nativa do Android via Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({
          style: isLight ? Style.Light : Style.Dark
        });
        await StatusBar.setBackgroundColor({
          color: colorBg
        });
      } catch (err) {
        console.warn("[Theme] StatusBar sync error:", err);
      }
    }

    // Atualizar ícone do botão de tema se existir
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
      themeBtn.innerHTML = isLight
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      themeBtn.setAttribute("title", isLight ? "Mudar para Tema Preto" : "Mudar para Tema Branco");
    }
  }
}

export const theme = new ThemeService();
