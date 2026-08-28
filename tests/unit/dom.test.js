import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeAttribute, sanitizeId, sanitizeColor } from "../../src/ui/dom.js";

describe("DOM & Security Utilities", () => {
  it("escapa caracteres especiais de HTML para prevenir injeções", () => {
    const raw = `<script>alert("xss")</script> & 'test'`;
    const escaped = escapeHtml(raw);
    expect(escaped).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;test&#039;");
  });

  it("sanitiza atributos removendo aspas e tags", () => {
    expect(sanitizeAttribute(`" onmouseover="evil()`)).toBe(" onmouseover=evil()");
  });

  it("sanitiza IDs permitindo apenas caracteres seguros", () => {
    expect(sanitizeId("pep_123-abc")).toBe("pep_123-abc");
    expect(sanitizeId("pep_123; <script>")).toBe("pep_123script");
  });

  it("sanitiza cores HEX", () => {
    expect(sanitizeColor("#2CC5C0")).toBe("#2CC5C0");
    expect(sanitizeColor("red", "#2CC5C0")).toBe("#2CC5C0");
  });
});
