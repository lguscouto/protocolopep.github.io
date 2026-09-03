import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("UI Contract & CSS Integrity", () => {
  const componentsPath = path.resolve(__dirname, "../../src/css/components.css");
  const primitivesPath = path.resolve(__dirname, "../../src/css/primitives.css");

  it("garante a existência do arquivo primitives.css", () => {
    expect(fs.existsSync(primitivesPath)).toBe(true);
  });

  it("garante que primitives.css define as classes essenciais do sistema visual", () => {
    if (!fs.existsSync(primitivesPath)) return;
    const primitivesCss = fs.readFileSync(primitivesPath, "utf-8");

    expect(primitivesCss).toContain(".btn-primary");
    expect(primitivesCss).toContain(".page-title");
    expect(primitivesCss).toContain(".section-title");
    expect(primitivesCss).toContain(".icon-button");
    expect(primitivesCss).toContain(".action-row");
    expect(primitivesCss).toContain(".settings-section");
  });

  it("não possui múltiplas definições duplicadas de .btn-primary em components.css", () => {
    const componentsCss = fs.readFileSync(componentsPath, "utf-8");
    // Extrai matches exatos de seletores `.btn-primary {`
    const matches = componentsCss.match(/^\.btn-primary\s*\{/gm) || [];
    expect(matches.length).toBeLessThanOrEqual(0); // Deve ter sido movido para primitives.css
  });
});
