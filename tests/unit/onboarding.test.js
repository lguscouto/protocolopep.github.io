import { describe, it, expect, beforeEach } from "vitest";
import {
  ONBOARDING_VERSION,
  ONBOARDING_KEY,
  ONBOARDING_SLIDES,
  shouldShowOnboarding,
  markOnboardingAccepted
} from "../../src/ui/onboarding.js";

describe("Onboarding & Termos de Uso (V01)", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.localStorage = {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };
  });

  it("deve indicar que deve exibir onboarding quando não há registro no storage", () => {
    expect(shouldShowOnboarding()).toBe(true);
  });

  it("deve indicar que deve exibir onboarding quando a versão salva for legada/diferente", () => {
    localStorage.setItem(ONBOARDING_KEY, "0");
    expect(shouldShowOnboarding()).toBe(true);
  });

  it("deve registrar o aceite com a versão corrente", () => {
    markOnboardingAccepted();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe(ONBOARDING_VERSION);
    expect(shouldShowOnboarding()).toBe(false);
  });

  it("deve manter versionamento canônico como string '1'", () => {
    expect(ONBOARDING_VERSION).toBe("1");
    expect(ONBOARDING_KEY).toBe("pep_onboarding_version");
  });

  it("deve usar ilustrações locais, acessíveis e sem dependência de rede", () => {
    expect(ONBOARDING_SLIDES).toHaveLength(3);
    for (const slide of ONBOARDING_SLIDES) {
      expect(slide.image).toMatch(/^\/assets\/illustrations\/.+\.png$/);
      expect(slide.imageAlt.length).toBeGreaterThan(12);
      expect(slide.image).not.toMatch(/^https?:/);
    }
  });
});
