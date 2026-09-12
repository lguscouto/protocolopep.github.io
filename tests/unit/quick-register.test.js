import { describe, expect, it } from "vitest";
import { buildQuickRegisterContext } from "../../src/domain/quick-register.js";
import { resolveApplicationChoice } from "../../src/ui/quick-register.js";

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

  it("exige escolha explícita para registro manual sem pendências", () => {
    const context = buildQuickRegisterContext([routine("a")], { "2026-09-12": { a: [{ status: "applied" }] } }, now);
    expect(resolveApplicationChoice(context)).toMatchObject({ kind: "manual", choices: context.choices });
  });

  it("mantém a escolha entre tratamentos quando não há pendências", () => {
    const routines = [routine("a"), routine("b")];
    const logs = { "2026-09-12": { a: [{ status: "applied" }], b: [{ status: "applied" }] } };
    const context = buildQuickRegisterContext(routines, logs, now);
    expect(resolveApplicationChoice(context)).toMatchObject({ kind: "manual", choices: routines });
  });
});
