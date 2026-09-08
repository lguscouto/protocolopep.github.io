import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRetroLogModal, saveRetroLog } from "../../src/ui/retro-log.js";
import { dialogService } from "../../src/services/dialog.js";

vi.mock("../../src/services/dialog.js", () => ({ dialogService: { alert: vi.fn(), confirm: vi.fn() } }));
vi.mock("../../src/ui/injection-site-picker.js", () => ({ renderInjectionSitePicker: vi.fn() }));
vi.mock("../../src/services/i18n.js", () => ({ i18nService: { t: (key) => key, getLocale: () => "pt-BR" } }));

const ids = ["retro-log-modal", "retro-pep-select", "retro-site-select", "retro-site-picker", "retro-date-input", "retro-time-input",
  "retro-dose-input", "retro-ui-input", "retro-note-input", "retro-status-select", "retro-reason-input", "retro-edit-history",
  "retro-modal-title", "retro-site-field", "retro-reason-field", "retro-save"];

function element() {
  const classes = new Set();
  return { value: "", innerHTML: "", textContent: "", hidden: false, disabled: false, setAttribute: vi.fn(),
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) } };
}

describe("Registro e correção auditável pela interface", () => {
  let dom, storage, doseService, haptics, renderAll;
  const dateKey = () => "2026-09-08";
  const save = () => saveRetroLog({ doseService, dateKey, haptics, renderAll });
  const open = (editingLog = null, options = {}) => openRetroLogModal("2026-09-07", "p1", { storage, dateKey, editingLog, ...options });

  beforeEach(() => {
    vi.clearAllMocks();
    dom = Object.fromEntries(ids.map((id) => [id, element()]));
    vi.stubGlobal("document", { getElementById: (id) => dom[id] || null });
    storage = { getPeptides: () => [{ id: "p1", name: "Atual", dose: "100 mcg", ui: 2.5 }], getSites: () => ["Coxa (Direita)"], getLogs: () => ({}) };
    doseService = { registerDose: vi.fn(() => ({ success: true })), editDose: vi.fn(() => ({ success: true })) };
    haptics = { success: vi.fn() };
    renderAll = vi.fn();
    open();
    dom["retro-time-input"].value = "08:30";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("preserva frações com vírgula sem truncamento", async () => {
    dom["retro-ui-input"].value = "2,5";
    await save();
    expect(doseService.registerDose).toHaveBeenCalledWith(expect.objectContaining({ ui: 2.5, status: "applied", site: "Coxa (Direita)", scheduledDate: "2026-09-07" }));
    expect(haptics.success).toHaveBeenCalledOnce();
    expect(dom["retro-log-modal"].classList.contains("on")).toBe(false);
  });

  it("exige confirmação explícita do local no registro rápido", async () => {
    open(null, { requireSiteSelection: true });
    dom["retro-ui-input"].value = "2,5";
    await save();
    expect(doseService.registerDose).not.toHaveBeenCalled();
    expect(dialogService.alert).toHaveBeenCalledWith(expect.objectContaining({ title: "Escolha o local" }));
    dom["retro-site-select"].value = "Coxa (Direita)";
    await save();
    expect(doseService.registerDose).toHaveBeenCalledWith(expect.objectContaining({ site: "Coxa (Direita)" }));
  });

  it.each(["NaN", "-1", "Infinity", "2.5x"])("rejeita UI inválida %s antes de gravar", async (ui) => {
    dom["retro-ui-input"].value = ui;
    await save();
    expect(doseService.registerDose).not.toHaveBeenCalled();
    expect(haptics.success).not.toHaveBeenCalled();
    expect(dom["retro-log-modal"].classList.contains("on")).toBe(true);
  });

  it.each(["skipped", "missed"])("registra %s com motivo, sem local de aplicação", async (status) => {
    dom["retro-status-select"].value = status;
    dom["retro-status-select"].onchange();
    dom["retro-reason-input"].value = "Motivo pessoal";
    expect(dom["retro-site-field"].hidden).toBe(true);
    expect(dom["retro-reason-field"].hidden).toBe(false);
    await save();
    expect(doseService.registerDose).toHaveBeenCalledWith(expect.objectContaining({ status, statusReason: "Motivo pessoal", site: "" }));
  });

  it("não muda estado desconhecido para aplicada silenciosamente", async () => {
    dom["retro-status-select"].value = "";
    await save();
    expect(doseService.registerDose).not.toHaveBeenCalled();
  });

  it("aguarda persistência e ignora toque repetido durante a gravação", async () => {
    let finish;
    doseService.registerDose.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = save();
    await save();
    expect(doseService.registerDose).toHaveBeenCalledOnce();
    expect(dom["retro-save"].disabled).toBe(true);
    expect(haptics.success).not.toHaveBeenCalled();
    finish({ success: true });
    await pending;
    expect(haptics.success).toHaveBeenCalledOnce();
    expect(dom["retro-save"].disabled).toBe(false);
  });

  it.each([false, true])("mantém o formulário e não sinaliza sucesso após falha (exceção=%s)", async (throws) => {
    doseService.registerDose.mockImplementation(() => { if (throws) throw new Error("Falha"); return { success: false, error: "STORAGE_ERROR" }; });
    await save();
    expect(haptics.success).not.toHaveBeenCalled();
    expect(renderAll).not.toHaveBeenCalled();
    expect(dom["retro-log-modal"].classList.contains("on")).toBe(true);
    expect(dom["retro-save"].disabled).toBe(false);
  });

  it("corrige pelo ID original, com contexto histórico e trilha sanitizada", async () => {
    const original = { id: "l1", peptideId: "p1", scheduledDate: "2026-09-07", time: "07:30", dose: "50 mcg", ui: 1.25,
      status: "applied", site: "Local antigo", vialId: "v-old", protocolSnapshot: { name: "Nome histórico", dose: "50 mcg", ui: 1.25 },
      editHistory: [{ editedAt: "2026-09-07T11:00:00Z", previous: { time: "06:00", dose: "<script>bad</script>", ui: 0, status: "skipped" } }] };
    const before = JSON.stringify(original);
    open(original);
    expect(dom["retro-dose-input"].value).toBe("50 mcg");
    expect(dom["retro-ui-input"].value).toBe(1.25);
    expect(dom["retro-site-select"].value).toBe("Local antigo");
    expect(dom["retro-pep-select"].innerHTML).toContain("Nome histórico");
    expect(dom["retro-pep-select"].disabled).toBe(true);
    expect(dom["retro-date-input"].disabled).toBe(true);
    expect(dom["retro-edit-history"].innerHTML).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(dom["retro-edit-history"].innerHTML).not.toContain("<script>");
    dom["retro-status-select"].value = "skipped";
    dom["retro-reason-input"].value = "Registro corrigido";
    await save();
    expect(doseService.editDose).toHaveBeenCalledWith({ peptideId: "p1", scheduledDate: "2026-09-07", doseLogId: "l1", updates: expect.objectContaining({ status: "skipped", statusReason: "Registro corrigido", ui: 1.25 }) });
    expect(doseService.registerDose).not.toHaveBeenCalled();
    expect(JSON.stringify(original)).toBe(before);
  });

  it("permite corrigir protocolo removido e não inventa unidades de registro legado", async () => {
    storage.getPeptides = () => [];
    open({ id: "legacy", peptideId: "p1", scheduledDate: "2026-09-07", time: "08:00", note: "Original" });
    expect(dom["retro-ui-input"].value).toBe("");
    expect(dom["retro-edit-history"].innerHTML).toContain("phase1.legacy");
    dom["retro-note-input"].value = "Corrigida";
    await save();
    const payload = doseService.editDose.mock.calls[0][0];
    expect(payload.updates.note).toBe("Corrigida");
    expect(payload.updates).not.toHaveProperty("ui");
    expect(payload.updates).not.toHaveProperty("dose");
  });

  it("o formulário novo não reutiliza o contexto da última edição cancelada", async () => {
    open({ id: "l1", peptideId: "p1", scheduledDate: "2026-09-07", time: "08:00", status: "missed" });
    open();
    expect(dom["retro-date-input"].disabled).toBe(false);
    expect(dom["retro-status-select"].value).toBe("applied");
    await save();
    expect(doseService.editDose).not.toHaveBeenCalled();
    expect(doseService.registerDose).toHaveBeenCalledOnce();
  });
});
