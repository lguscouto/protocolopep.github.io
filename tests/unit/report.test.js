import { describe, it, expect } from "vitest";
import { buildReportData, escapeCSV, generateReportCSV, generateReportHTML, getDoseDisplayData, summarizeReportEntries } from "../../src/domain/report.js";

describe("Relatórios de Aplicações e Exportação (V08)", () => {
  const mockProtocol = [
    { id: "pep-1", name: "BPC-157", sub: "reparo", dose: "250 mcg", ui: 10 },
    { id: "pep-2", name: "TB-500", sub: "recuperação", dose: "500 mcg", ui: 20 }
  ];

  const mockLogs = {
    "2026-08-28": {
      "pep-1": [{ time: "08:00", retroactive: false, note: "jejum" }]
    },
    "2026-08-27": {
      "pep-1": [{ time: "08:15", retroactive: false }],
      "pep-2": [{ time: "20:00", retroactive: true, note: "esqueci cedo", dose: "500 mcg", ui: 20 }]
    },
    "2026-08-20": {
      "pep-1": ["09:00"]
    }
  };

  it("deve filtrar e ordenar registros decrescentes por data e hora", () => {
    const entries = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs
    });

    expect(entries.length).toBe(4);
    expect(entries[0].date).toBe("2026-08-28");
    expect(entries[0].peptideName).toBe("BPC-157");
    expect(entries[0].time).toBe("08:00");

    expect(entries[1].date).toBe("2026-08-27");
    expect(entries[1].peptideName).toBe("TB-500");
    expect(entries[1].retroactive).toBe(true);
    expect(entries[1].type).toBe("Retroativo");
  });

  it("deve filtrar por intervalo de datas", () => {
    const entries = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs,
      startDate: "2026-08-25",
      endDate: "2026-08-28"
    });

    expect(entries.length).toBe(3);
    expect(entries.some((e) => e.date === "2026-08-20")).toBe(false);
  });

  it("deve omitir notas sensíveis por padrão e incluir quando solicitado", () => {
    const entriesWithoutNotes = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs,
      includeNotes: false
    });
    expect(entriesWithoutNotes[0].note).toBe("");

    const entriesWithNotes = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs,
      includeNotes: true
    });
    expect(entriesWithNotes[0].note).toBe("jejum");
  });

  it("deve gerar CSV UTF-8 com BOM e escape correto de células", () => {
    const entries = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs,
      includeNotes: true
    });

    const csv = generateReportCSV(entries);
    expect(csv.startsWith("\uFEFF")).toBe(true); // UTF-8 BOM
    expect(csv).toContain('"Data";"Hora";"Peptídeo";"Subtítulo";"Dose";"UI";"Tipo";"Observações"');
    // Dados antigos sem dose registrada não herdam a dose atual do protocolo.
    expect(csv).toContain('"28/08/2026";"08:00";"BPC-157";"reparo";"\'--";"";"Regular";"jejum"');
    expect(csv).toContain('"27/08/2026";"20:00";"TB-500";"recuperação";"500 mcg";"20";"Retroativo";"esqueci cedo"');
  });

  it("deve gerar HTML imprimível contendo aviso legal e estrutura válida", () => {
    const entries = buildReportData({
      protocol: mockProtocol,
      logs: mockLogs,
      includeNotes: true
    });

    const html = generateReportHTML(entries, { startDate: "2026-08-20", endDate: "2026-08-28" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Protocolo PEP — Relatório de Aplicações");
    expect(html).toContain("Total de Aplicações: <b>4</b>");
    expect(html).toContain("Registro Pessoal Autorrelatado");
    expect(html).toContain("BPC-157");
    expect(html).toContain("TB-500");
  });

  it("deve tratar escapeCSV com caracteres especiais e aspas", () => {
    expect(escapeCSV('Teste "com aspas"')).toBe('"Teste ""com aspas"""');
    expect(escapeCSV(null)).toBe('""');
  });

  it("deve prevenir CSV Formula Injection para campos iniciando com =, +, -, @ ou tab", () => {
    expect(escapeCSV("=1+1")).toBe('"\'=1+1"');
    expect(escapeCSV("+SUM(A1:A10)")).toBe('"\'+SUM(A1:A10)"');
    expect(escapeCSV("-2+5")).toBe('"\' -2+5"'.replace(" ", ""));
    expect(escapeCSV("@SUM(B1:B2)")).toBe('"\'@SUM(B1:B2)"');
    expect(escapeCSV("\tDose")).toBe('"\'\tDose"');
    expect(escapeCSV("Texto Normal")).toBe('"Texto Normal"');
  });

  it("deve sanitizar estritamente tags HTML e scripts contra XSS em generateReportHTML", () => {
    const maliciousEntries = [
      {
        date: "2026-08-30",
        time: "<script>alert(1)</script>",
        peptideName: '<img src=x onerror="alert(1)">',
        peptideSub: '"><svg onload=alert(1)>',
        dose: "<iframe src=evil.com>",
        ui: 10,
        type: "Regular",
        note: "<script>document.cookie</script>"
      }
    ];

    const html = generateReportHTML(maliciousEntries);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;document.cookie&lt;/script&gt;");
  });

  it("preserva nomes e valores capturados após alteração ou remoção do protocolo", () => {
    const snapshot = { name: "Nome original", sub: "Sub original", dose: "250 mcg", ui: 2.5, revisionId: "rev-1" };
    const logs = { "2026-08-28": { "pep-1": [{ time: "08:00", protocolSnapshot: snapshot }] } };
    const renamed = buildReportData({ logs, protocol: [{ id: "pep-1", name: "Novo nome", dose: "900 mcg", ui: 90 }] });
    const removed = buildReportData({ logs, protocol: [] });

    expect(renamed).toEqual(removed);
    expect(renamed[0]).toMatchObject({ peptideName: "Nome original", peptideSub: "Sub original", dose: "250 mcg", ui: 2.5, historyIntegrity: "captured", revisionId: "rev-1" });
    expect(snapshot).toEqual({ name: "Nome original", sub: "Sub original", dose: "250 mcg", ui: 2.5, revisionId: "rev-1" });
  });

  it("prefere os valores efetivamente registrados, inclusive zero e unidades fracionárias", () => {
    const snapshot = { name: "Original", dose: "250 mcg", ui: 2.5 };
    expect(getDoseDisplayData({ dose: 0, ui: 0, protocolSnapshot: snapshot })).toMatchObject({ dose: 0, ui: 0 });
    expect(getDoseDisplayData({ dose: "100 mcg", ui: "1,5", protocolSnapshot: snapshot })).toMatchObject({ dose: "100 mcg", ui: 1.5 });
    const [entry] = buildReportData({ logs: { "2026-08-28": { p: [{ dose: 0, ui: 0, protocolSnapshot: snapshot }] } } });
    expect(entry).toMatchObject({ dose: 0, ui: 0 });
    expect(generateReportHTML([entry])).toContain("0 (0 UI)");
  });

  it("identifica registros legados sem inventar valores históricos ausentes", () => {
    const current = { name: "Nome atual", dose: "900 mcg", ui: 90 };
    expect(getDoseDisplayData("08:00", current)).toMatchObject({ name: "Nome atual", dose: "", ui: null, historyIntegrity: "legacy" });
    expect(getDoseDisplayData({ dose: "10 mcg" }, current)).toMatchObject({ dose: "10 mcg", ui: null, historyIntegrity: "legacy" });
    expect(getDoseDisplayData({ peptideName: "Nome antigo", sub: "Sub antiga" }, current)).toMatchObject({ name: "Nome antigo", sub: "Sub antiga", ui: null, historyIntegrity: "legacy" });
    const [removed] = buildReportData({ logs: { "2026-08-28": { removedId: ["08:00"] } } });
    expect(removed).toMatchObject({ peptideId: "removedId", peptideName: "Protocolo sem identificação", dose: "--", ui: null, historyIntegrity: "legacy" });
    expect(generateReportHTML([removed])).toContain("-- (-- UI)");
    expect(generateReportCSV([removed])).toContain("Legado: dados históricos incompletos");
  });

  it.each([NaN, Infinity, -1, "inválido", true])("não transforma unidades inválidas %s em zero", (ui) => {
    expect(getDoseDisplayData({ ui })).toMatchObject({ ui: null });
  });

  it("separa aplicações, puladas e esquecidas sem inferir estado de dias sem registro", () => {
    const logs = { "2026-08-28": { p: [
      { time: "08:00", status: "applied" },
      { time: "12:00", status: "skipped", statusReason: "Motivo privado" },
      { time: "20:00", status: "missed" }
    ] } };
    const entries = buildReportData({ logs, startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.statusLabel)).toEqual(["Esquecida", "Pulada", "Aplicada"]);
    expect(summarizeReportEntries(entries)).toEqual({ total: 3, applied: 1, skipped: 1, missed: 1, unknown: 0 });
    const html = generateReportHTML(entries);
    expect(html).toContain("Total de Aplicações: <b>1</b>");
    expect(html).toContain("Puladas: <b>1</b>");
    expect(html).toContain("Esquecidas: <b>1</b>");
    expect(html).toContain("Total de Registros: <b>3</b>");
  });

  it("não conta estados desconhecidos como aplicações", () => {
    const entries = buildReportData({ logs: { "2026-08-28": { p: [{ status: "bad-import" }] } } });
    expect(summarizeReportEntries(entries)).toMatchObject({ applied: 0, unknown: 1 });
    expect(generateReportHTML(entries)).toContain("Estado não identificado: <b>1</b>");
  });

  it("inclui local e frasco capturado, mas omite notas e motivos sem consentimento", () => {
    const logs = { "2026-08-28": { p: [{
      time: "08:00", status: "skipped", note: "Nota privada", statusReason: "Motivo privado", site: "Coxa (Direita)", vialId: "v-original",
      protocolSnapshot: { name: "Original", vial: { id: "v-original", lotNumber: "L2026", concentrationMcgPerMl: 1250, notes: "Nota privada do frasco" } }
    }] } };
    const redacted = buildReportData({ logs });
    const included = buildReportData({ logs, includeNotes: true });
    expect(redacted[0]).toMatchObject({ site: "Coxa (Direita)", vialId: "v-original", vialLot: "L2026", vialConcentrationMcgPerMl: 1250, note: "", statusReason: "" });
    for (const output of [JSON.stringify(redacted), generateReportCSV(redacted), generateReportHTML(redacted)]) {
      expect(output).not.toContain("privad");
      expect(output).toContain("Coxa (Direita)");
      expect(output).toContain("L2026");
      expect(output).toContain("1250");
    }
    for (const output of [generateReportCSV(included), generateReportHTML(included)]) {
      expect(output).toContain("Nota privada");
      expect(output).toContain("Motivo privado");
      expect(output).not.toContain("Nota privada do frasco");
    }
  });

  it("sanitiza local, frasco e motivo em HTML e CSV", () => {
    const entries = buildReportData({ includeNotes: true, logs: { "2026-08-28": { p: [{
      site: "<img src=x>", statusReason: "<script>motivo</script>", vialId: "=1+1",
      protocolSnapshot: { name: "Original", vial: { lotNumber: "@SUM(A1:A2)" } }
    }] } } });
    const html = generateReportHTML(entries);
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain("<script>motivo");
    expect(html).toContain("&lt;img src=x&gt;");
    const csv = generateReportCSV(entries);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\'@SUM(A1:A2)"');
  });
});
