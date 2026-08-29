import { describe, it, expect } from "vitest";
import { buildReportData, escapeCSV, generateReportCSV, generateReportHTML } from "../../src/domain/report.js";

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
    expect(csv).toContain('"28/08/2026";"08:00";"BPC-157";"reparo";"250 mcg";"10";"Regular";"jejum"');
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
});
