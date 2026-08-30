import { describe, expect, it, vi } from "vitest";
import { commitAction } from "../../src/services/committed-action.js";

describe("commitAction", () => {
  it("emite feedback somente depois da persistência confirmada", () => {
    const order = [];
    const result = commitAction({
      persist: () => {
        order.push("persist");
        return { success: true, data: 123 };
      },
      onSuccess: (res) => {
        order.push("feedback");
        expect(res.data).toBe(123);
      }
    });

    expect(result.success).toBe(true);
    expect(order).toEqual(["persist", "feedback"]);
  });

  it("não emite feedback quando a persistência falha", () => {
    const onSuccess = vi.fn();
    const result = commitAction({
      persist: () => ({ success: false, error: "storage failed" }),
      onSuccess
    });

    expect(result.success).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("retorna fallback de erro se persist retornar falsy", () => {
    const onSuccess = vi.fn();
    const result = commitAction({
      persist: () => null,
      onSuccess
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Persistência não confirmada");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("lança erro se persist não for função", () => {
    expect(() => commitAction({})).toThrow(TypeError);
  });
});
