import { describe, expect, it } from "vitest";
import { buildQuickRegisterContext } from "../../src/domain/quick-register.js";

const routine = (id, time = "08:00") => ({ id, name: id, dose: "1 mg", perDay: 1, time, days: null, startDate: "2020-01-01" });

describe("contexto do registro rápido", () => {
  const now = new Date(2026, 8, 12, 10, 0);

  it("pré-seleciona somente quando existe uma pendência", () => {
    expect(buildQuickRegisterContext([routine("a")], {}, now).selectedId).toBe("a");
    expect(buildQuickRegisterContext([routine("a"), routine("b")], {}, now).selectedId).toBeNull();
  });

  it("oferece tratamentos cadastrados quando não há pendência", () => {
    const logs = { "2026-09-12": { a: [{ status: "applied" }] } };
    const result = buildQuickRegisterContext([routine("a")], logs, now);
    expect(result.pending).toEqual([]);
    expect(result.choices).toHaveLength(1);
  });

  it("identifica protocolo vazio sem criar valores clínicos", () => {
    expect(buildQuickRegisterContext([], {}, now)).toMatchObject({ empty: true, selectedId: null, choices: [] });
  });
});
