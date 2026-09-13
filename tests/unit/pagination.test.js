import { describe, expect, it } from "vitest";
import { paginate } from "../../src/domain/pagination.js";

describe("paginate", () => {
  it("retorna páginas estáveis sem alterar a ordem ou a lista de origem", () => {
    const source = [1, 2, 3, 4, 5];
    expect(paginate(source, { offset: 0, pageSize: 2 })).toEqual({
      items: [1, 2], total: 5, offset: 0, pageSize: 2, hasMore: true
    });
    expect(paginate(source, { offset: 2, pageSize: 2 })).toEqual({
      items: [3, 4], total: 5, offset: 2, pageSize: 2, hasMore: true
    });
    expect(paginate(source, { offset: 4, pageSize: 2 })).toEqual({
      items: [5], total: 5, offset: 4, pageSize: 2, hasMore: false
    });
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it("normaliza entradas inválidas e não perde o total", () => {
    expect(paginate(null, { offset: -4, pageSize: 0 })).toEqual({
      items: [], total: 0, offset: 0, pageSize: 30, hasMore: false
    });
    expect(paginate(["a"], { offset: 99, pageSize: 30 }).hasMore).toBe(false);
  });
});

