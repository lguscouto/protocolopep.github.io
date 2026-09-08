import { describe, it, expect } from "vitest";
import { createPeptide } from "../../src/domain/protocol.js";
import { resolveProtocolAt, reviseProtocol } from "../../src/domain/protocol-history.js";

describe("Histórico de configuração do protocolo", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");

  it("resolve a configuração pela vigência sem reescrever o passado", () => {
    const original = createPeptide({ id: "pep_history", name: "Original", dose: "10 mcg", ui: 1, start: "2026-09-01", interval: 2 });
    const revised = reviseProtocol(original, createPeptide({ ...original, name: "Atualizado", dose: "20 mcg", ui: 2 }), { effectiveFrom: "2026-09-08T12:00:00.000Z", now });
    expect(resolveProtocolAt(revised, new Date("2026-09-08T11:59:59.000Z")).name).toBe("Original");
    expect(resolveProtocolAt(revised, now)).toMatchObject({ name: "Atualizado", dose: "20 mcg", ui: 2 });
    expect(resolveProtocolAt(revised, now).revisions).toEqual([]);
  });

  it("registra pausa e retomada sem mover a âncora do intervalo", () => {
    const original = createPeptide({ id: "pep_lifecycle", name: "Rotina", start: "2026-09-01", interval: 3 });
    const paused = reviseProtocol(original, original, { status: "paused", effectiveFrom: "2026-09-08T12:00:00.000Z", now });
    const resumed = reviseProtocol(paused, paused, { status: "active", effectiveFrom: "2026-09-08T13:00:00.000Z", now: new Date("2026-09-08T13:00:00.000Z") });
    expect(resolveProtocolAt(paused, new Date("2026-09-08T12:30:00.000Z")).lifecycleStatus).toBe("paused");
    expect(resolveProtocolAt(resumed, new Date("2026-09-08T13:30:00.000Z"))).toMatchObject({ lifecycleStatus: "active", start: "2026-09-01", interval: 3 });
  });
});
