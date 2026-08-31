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
});
