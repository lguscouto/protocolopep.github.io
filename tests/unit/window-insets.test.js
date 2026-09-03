import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const css = fs.readFileSync(path.join(projectRoot, "src/css/variables.css"), "utf-8");
const baseCss = fs.readFileSync(path.join(projectRoot, "src/css/base.css"), "utf-8");
const componentsCss = fs.readFileSync(path.join(projectRoot, "src/css/components.css"), "utf-8");
const primitivesCss = fs.readFileSync(path.join(projectRoot, "src/css/primitives.css"), "utf-8");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf-8");
const mainActivity = fs.readFileSync(
  path.join(projectRoot, "android/app/src/main/java/com/protocolopep/app/MainActivity.java"),
  "utf-8"
);
const modalController = fs.readFileSync(
  path.join(projectRoot, "src/ui/modal-controller.js"),
  "utf-8"
);

describe("Contrato de insets Android edge-to-edge", () => {
  it("define fallback CSS e tokens semânticos para as quatro bordas", () => {
    [
      "--safe-area-inset-top",
      "--safe-area-inset-right",
      "--safe-area-inset-bottom",
      "--safe-area-inset-left",
      "--app-safe-top",
      "--app-safe-right",
      "--app-safe-bottom",
      "--app-safe-left"
    ].forEach((token) => expect(css).toContain(`${token}:`));
  });

  it("usa o inset inferior no shell e nos componentes fixos", () => {
    expect(baseCss).toContain("padding-bottom: calc(85px + var(--app-safe-bottom))");
    expect(componentsCss).toContain("var(--app-safe-bottom)");
    expect(componentsCss).toContain("100dvh");
    expect(componentsCss).toContain(".sheet-foot");
  });

  it("publica WindowInsetsCompat no WebView nativo", () => {
    expect(mainActivity).toContain("WindowInsetsCompat.Type.systemBars()");
    expect(mainActivity).toContain("WindowInsetsCompat.Type.displayCutout()");
    expect(mainActivity).toContain("setOnApplyWindowInsetsListener");
    expect(mainActivity).toContain("addWebViewListener");
    expect(mainActivity).toContain("--safe-area-inset-bottom");
  });

  it("mantém modal e teclado sincronizados com o visualViewport", () => {
    expect(css).toContain("--app-viewport-height: 100dvh");
    expect(componentsCss).toContain("height: var(--app-viewport-height, 100dvh)");
    expect(componentsCss).toContain("var(--app-viewport-height, 100dvh)");
    expect(componentsCss).toContain(".sheet > form");
    expect(componentsCss).toContain("html.modal-open");
    expect(modalController).toContain("visualViewport");
    expect(modalController).toContain("MutationObserver");
    expect(modalController).toContain("modal-open");
    expect(modalController).toContain("scrollBy");
  });

  it("centraliza variantes repetidas de sheets em classes reutilizáveis", () => {
    expect(componentsCss).toContain(".sheet--standard");
    expect(componentsCss).toContain(".sheet-foot--actions");
    expect(componentsCss).toContain(".sheet-body--research-results");
    expect(primitivesCss).toContain(".action-row--equal");
    expect(indexHtml).not.toMatch(/class="sheet"[^>]*style=/);
    expect(indexHtml).not.toMatch(/class="sheet-foot" style=/);
    expect(indexHtml).not.toMatch(/class="sheet-body"[^>]*style=/);
  });
});
