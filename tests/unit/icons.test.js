import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ICON_NAMES, renderIcon } from "../../src/ui/icons.js";

describe("ícones locais", () => {
  it("expõe somente nomes conhecidos e markup SVG confiável", () => {
    expect(ICON_NAMES).toEqual(["note", "warning"]);
    expect(renderIcon("note")).toContain("<svg");
    expect(renderIcon("unknown")).toBe("");
    expect(renderIcon("note", { label: "Nota" })).toContain('aria-label="Nota"');
  });

  it("mantém ícones semânticos e distintos na navegação principal", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const navStart = html.indexOf('<nav class="nav"');
    const nav = html.slice(navStart, html.indexOf("</nav>", navStart) + 6);
    const markup = ["today", "journey", "progress", "settings"].map((tab) => {
      const marker = `data-tab="${tab}"`;
      const start = nav.lastIndexOf("<button", nav.indexOf(marker));
      const end = nav.indexOf("</button>", start) + "</button>".length;
      return { tab, svg: nav.slice(start, end).match(/<svg[\s\S]*?<\/svg>/)?.[0] || "" };
    });
    expect(markup).toHaveLength(4);
    expect(new Set(markup.map(({ svg }) => svg)).size).toBe(4);
    expect(markup.map(({ svg }) => svg).join(" ")).not.toMatch(/⚙|clock|M19\.4 15/);
    markup.forEach(({ svg }) => {
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-width="1.8"');
      expect(svg).toContain('aria-hidden="true"');
    });
  });
});

