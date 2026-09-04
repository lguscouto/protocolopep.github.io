import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { ThemeService } from "../../src/services/theme.js";

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

describe("ThemeService", () => {
  let store;
  let classList;

  beforeEach(() => {
    store = {};
    classList = createClassList();
    global.localStorage = {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; }
    };
    global.document = {
      body: { classList },
      querySelector: () => null,
      getElementById: () => null
    };
  });

  afterEach(() => {
    delete global.localStorage;
    delete global.document;
  });

  it.each([
    ["white", "branco", "theme-light"],
    ["light", "branco", "theme-light"],
    ["branco", "branco", "theme-light"],
    ["black", "preto", "theme-dark"],
    ["dark", "preto", "theme-dark"],
    ["preto", "preto", "theme-dark"]
  ])("normaliza %s, aplica a classe %s e persiste", async (input, expected, cssClass) => {
    const service = new ThemeService();

    await service.setTheme(input);

    expect(service.getTheme()).toBe(expected);
    expect(service.getBackupTheme()).toBe(expected === "branco" ? "white" : "black");
    expect(localStorage.getItem("pep_theme_mode")).toBe(expected);
    expect(classList.contains(cssClass)).toBe(true);
  });

  it("alterna o tema aguardando a aplicação e mantém a persistência", async () => {
    const service = new ThemeService();

    await service.setTheme("preto");
    await service.toggleTheme();

    expect(service.isLight()).toBe(true);
    expect(service.getBackupTheme()).toBe("white");
    expect(localStorage.getItem("pep_theme_mode")).toBe("branco");
  });
});
