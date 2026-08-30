import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(value.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("Design Tokens & Contrast", () => {
  const cssPath = path.resolve(__dirname, "../../src/css/variables.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  it("define --tap-min de pelo menos 44px", () => {
    expect(css).toContain("--tap-min: 44px");
  });

  it("define tokens de espaçamento e raios padronizados", () => {
    expect(css).toContain("--radius-sm: 10px");
    expect(css).toContain("--radius-md: 14px");
    expect(css).toContain("--radius-lg: 18px");
    expect(css).toContain("--space-1: 4px");
    expect(css).toContain("--space-4: 16px");
  });

  it("garante contraste WCAG AA (>= 4.5:1) nos pares essenciais escuros", () => {
    // Texto primário sobre fundo escuro
    expect(contrast("#F1F5F9", "#070B10")).toBeGreaterThanOrEqual(4.5);
    // Texto muted sobre fundo escuro
    expect(contrast("#A7B3C2", "#070B10")).toBeGreaterThanOrEqual(4.5);
    // Texto muted-2 sobre fundo escuro
    expect(contrast("#8A98A8", "#070B10")).toBeGreaterThanOrEqual(4.5);
  });

  it("garante contraste WCAG AA (>= 4.5:1) nos pares essenciais claros", () => {
    // Texto primário sobre fundo claro
    expect(contrast("#14202A", "#F5F7F8")).toBeGreaterThanOrEqual(4.5);
    // Texto muted sobre fundo claro
    expect(contrast("#526474", "#F5F7F8")).toBeGreaterThanOrEqual(4.5);
    // Texto muted-2 sobre fundo claro
    expect(contrast("#5F7080", "#F5F7F8")).toBeGreaterThanOrEqual(4.5);
    // Primary sobre branco
    expect(contrast("#0F766E", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});
