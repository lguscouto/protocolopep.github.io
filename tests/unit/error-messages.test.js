import { describe, expect, it } from "vitest";
import { resolveUiError } from "../../src/ui/error-messages.js";

describe("resolveUiError", () => {
  it("converte códigos estáveis em mensagens traduzidas sem expor diagnóstico", () => {
    const message = resolveUiError({ error: "STORAGE_WRITE_FAILED", message: "QuotaExceededError" });
    expect(message).toBeTruthy();
    expect(message).not.toContain("QuotaExceededError");
  });

  it("usa mensagem neutra para códigos desconhecidos", () => {
    expect(resolveUiError({ error: "UNKNOWN_INTERNAL_CODE" })).toBeTruthy();
    expect(resolveUiError({ error: "UNKNOWN_INTERNAL_CODE" })).not.toContain("UNKNOWN_INTERNAL_CODE");
  });
});

