import { describe, it, expect, beforeEach, vi } from "vitest";
import { DialogService } from "../../src/services/dialog.js";

describe("DialogService (V13)", () => {
  let dialog;
  let mockElements;
  let keydownListeners;

  function createMockElement(id = "") {
    const listeners = {};
    const classes = new Set();
    const style = { display: "" };
    return {
      id,
      textContent: "",
      className: "",
      style,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c)
      },
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      focus: vi.fn(),
      addEventListener: (evt, cb) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(cb);
      },
      removeEventListener: (evt, cb) => {
        if (!listeners[evt]) return;
        listeners[evt] = listeners[evt].filter((fn) => fn !== cb);
      },
      click: function () {
        if (listeners.click) {
          listeners.click.forEach((fn) => fn({ preventDefault: () => {} }));
        }
      }
    };
  }

  beforeEach(() => {
    dialog = new DialogService();
    keydownListeners = [];

    mockElements = {
      "confirm-modal": createMockElement("confirm-modal"),
      "confirm-title": createMockElement("confirm-title"),
      "confirm-message": createMockElement("confirm-message"),
      "confirm-ok": createMockElement("confirm-ok"),
      "confirm-cancel": createMockElement("confirm-cancel"),
      "confirm-close": createMockElement("confirm-close")
    };

    global.document = {
      getElementById: (id) => mockElements[id] || null,
      activeElement: null
    };

    global.window = {
      addEventListener: (evt, cb) => {
        if (evt === "keydown") keydownListeners.push(cb);
      },
      removeEventListener: (evt, cb) => {
        if (evt === "keydown") {
          keydownListeners = keydownListeners.filter((fn) => fn !== cb);
        }
      },
      confirm: vi.fn((msg) => true),
      alert: vi.fn((msg) => {})
    };
  });

  it("confirm(): abre modal, define textos e resolve true no clique de OK", async () => {
    const promise = dialog.confirm({
      title: "Excluir Peptídeo",
      message: "Tem certeza?",
      confirmText: "Sim, Excluir",
      cancelText: "Voltar",
      isDanger: true
    });

    const modal = mockElements["confirm-modal"];
    expect(modal.classList.contains("on")).toBe(true);
    expect(mockElements["confirm-title"].textContent).toBe("Excluir Peptídeo");
    expect(mockElements["confirm-message"].textContent).toBe("Tem certeza?");
    expect(mockElements["confirm-ok"].textContent).toBe("Sim, Excluir");
    expect(mockElements["confirm-cancel"].textContent).toBe("Voltar");

    // Clica em OK
    mockElements["confirm-ok"].click();

    const result = await promise;
    expect(result).toBe(true);
    expect(modal.classList.contains("on")).toBe(false);
  });

  it("confirm(): resolve false no clique de Cancelar", async () => {
    const promise = dialog.confirm({
      title: "Cancelar Ação",
      message: "Deseja cancelar?",
      isDanger: false
    });

    mockElements["confirm-cancel"].click();

    const result = await promise;
    expect(result).toBe(false);
    expect(mockElements["confirm-modal"].classList.contains("on")).toBe(false);
  });

  it("confirm(): resolve false ao pressionar tecla Escape", async () => {
    const promise = dialog.confirm({
      title: "Fechar com Escape",
      message: "Pressione Escape"
    });

    keydownListeners.forEach((fn) => fn({ key: "Escape", preventDefault: () => {} }));

    const result = await promise;
    expect(result).toBe(false);
  });

  it("alert(): oculta botão de cancelar e resolve true no clique de OK", async () => {
    const promise = dialog.alert({
      title: "Aviso de Erro",
      message: "Ocorreu um erro.",
      buttonText: "Entendi",
      isDanger: true
    });

    const modal = mockElements["confirm-modal"];
    const cancelBtn = mockElements["confirm-cancel"];
    const okBtn = mockElements["confirm-ok"];

    expect(modal.classList.contains("on")).toBe(true);
    expect(cancelBtn.style.display).toBe("none");
    expect(okBtn.textContent).toBe("Entendi");

    okBtn.click();

    const result = await promise;
    expect(result).toBe(true);
    expect(modal.classList.contains("on")).toBe(false);
    expect(cancelBtn.style.display).toBe("");
  });

  it("alert(): resolve true ao pressionar Escape ou Enter", async () => {
    const promise = dialog.alert({
      title: "Aviso",
      message: "Informação importante"
    });

    keydownListeners.forEach((fn) => fn({ key: "Enter", preventDefault: () => {} }));

    const result = await promise;
    expect(result).toBe(true);
  });

  it("fallback gracioso se document não existir", async () => {
    delete global.document;
    const res = await dialog.confirm({ message: "Sem document" });
    expect(res).toBe(false);
  });
});
