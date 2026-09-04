import { describe, it, expect } from "vitest";
import {
  validateAndParseBackup,
  createBackupPayload,
  normalizeBackupTheme,
  MAX_BACKUP_SIZE_BYTES
} from "../../src/domain/backup.js";

describe("Backup Domain", () => {
  it("cria payload de backup completo e serializado", () => {
    const protocol = [{ id: "pep_1", name: "BPC-157", dose: "250 mcg" }];
    const logs = { "2026-08-28": { "pep_1": { t: "08:00" } } };
    const payload = createBackupPayload(protocol, logs, "black");

    expect(typeof payload).toBe("string");
    const parsed = JSON.parse(payload);
    expect(parsed.app).toBe("protocolo-pep");
    expect(parsed.protocol).toHaveLength(1);
    expect(parsed.logs["2026-08-28"]).toBeDefined();
  });

  it.each([
    ["white", "white"],
    ["branco", "white"],
    ["light", "white"],
    ["black", "black"],
    ["preto", "black"],
    ["dark", "black"]
  ])("normaliza o tema %s para o schema %s", (input, expected) => {
    expect(normalizeBackupTheme(input)).toBe(expected);
    expect(JSON.parse(createBackupPayload([], {}, input)).theme).toBe(expected);
  });

  it("preserva hidden IDs e tombstones PEP no schema V6", () => {
    const payload = createBackupPayload([], {}, "black", [], [], [], {
      hiddenMeasurementIds: ["hc_external_1"],
      tombstones: [{
        id: "m_deleted_1",
        clientRecordId: "m_deleted_1",
        healthConnectRecordId: "hc_pep_1",
        ownership: "pep",
        dataOrigin: "com.protocolopep.app",
        deletedAt: "2026-09-01T10:00:00.000Z"
      }]
    });
    const result = validateAndParseBackup(payload);

    expect(result.valid).toBe(true);
    expect(result.data.version).toBe(6);
    expect(result.data.healthConnectState.hiddenMeasurementIds).toEqual(["hc_external_1"]);
    expect(result.data.healthConnectState.tombstones).toHaveLength(1);
    expect(result.stats.hiddenMeasurementsCount).toBe(1);
    expect(result.stats.tombstonesCount).toBe(1);
  });

  it("descarta tombstone externo ou sem ownership para nunca excluir recurso de terceiros", () => {
    const result = validateAndParseBackup(JSON.stringify({
      version: 6,
      protocol: [],
      logs: {},
      healthConnectState: {
        hiddenMeasurementIds: ["hc-safe"],
        tombstones: [
          { id: "external", clientRecordId: "external", ownership: "external" },
          { id: "missing-owner", clientRecordId: "missing-owner" },
          { id: "wrong-origin", clientRecordId: "wrong-origin", ownership: "pep", dataOrigin: "com.third.party" }
        ]
      }
    }));

    expect(result.valid).toBe(true);
    expect(result.data.healthConnectState.tombstones).toEqual([]);
    expect(result.data.healthConnectState.hiddenMeasurementIds).toEqual(["hc-safe"]);
  });

  it("valida backup válido e retorna estatísticas de prévia", () => {
    const validJson = JSON.stringify({
      version: 1,
      protocol: [
        { name: "MOTS-c", dose: "5,4 mg", time: "08:00" },
        { name: "AOD-9604", dose: "500 mcg", time: "07:00" }
      ],
      logs: {
        "2026-08-28": {
          "pep_1": [{ t: "08:30" }, { t: "20:00" }],
          "pep_2": { t: "07:15" }
        }
      }
    });

    const result = validateAndParseBackup(validJson);
    expect(result.valid).toBe(true);
    expect(result.stats.peptideCount).toBe(2);
    expect(result.stats.logDaysCount).toBe(1);
    expect(result.stats.totalDosesCount).toBe(3);
  });

  it("rejeita backup corrompido ou payload não JSON", () => {
    expect(validateAndParseBackup("").valid).toBe(false);
    expect(validateAndParseBackup("{ invalid json ").valid).toBe(false);
    expect(validateAndParseBackup("[]").valid).toBe(false);
  });

  it("rejeita arquivo que exceda o limite de 5MB", () => {
    const huge = "a".repeat(MAX_BACKUP_SIZE_BYTES + 10);
    const result = validateAndParseBackup(huge);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("tamanho máximo permitido");
  });

  it("rejeita backup com versão de schema futura (P1 - Sec 6)", () => {
    const futureBackup = JSON.stringify({
      version: 99,
      protocol: [{ name: "Futuristic Peptídeo", dose: "1 mg" }],
      logs: {}
    });
    const result = validateAndParseBackup(futureBackup);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("mais recente que a versão suportada");
  });

  it("migra adequadamente backups de versões legadas sem inventário ou locais", () => {
    const legacyJson = JSON.stringify({
      version: 1,
      peptides: [{ name: "BPC-157", dose: "250 mcg" }],
      logs: {}
    });
    const result = validateAndParseBackup(legacyJson);
    expect(result.valid).toBe(true);
    expect(result.data.protocol).toHaveLength(1);
    expect(result.data.inventory).toEqual([]);
    expect(result.data.sites.length).toBeGreaterThan(0); // Locais padrão
    expect(result.data.measurements).toEqual([]);
  });

  it("trata dados semanticamente inválidos (ex: datas inválidas como 2026-02-29) de forma fail-closed sem lançar exceções não tratadas (P1 - Sec 16)", () => {
    const invalidDatesJson = JSON.stringify({
      version: 4,
      protocol: [{ name: "BPC-157", start: "2026-02-29", times: ["99:99", "24:00"] }],
      logs: {
        "2026-02-29": {
          "pep-1": [{ time: "99:99" }]
        },
        "invalid-date": {
          "pep-1": [{ time: "12:00" }]
        }
      }
    });

    // Não pode disparar RangeError ou quebrar
    const result = validateAndParseBackup(invalidDatesJson);
    expect(result.valid).toBe(true);
    // Datas inválidas são descartadas na migração limpa
    expect(result.data.logs["2026-02-29"]).toBeUndefined();
    expect(result.data.logs["invalid-date"]).toBeUndefined();
    expect(result.data.protocol[0].start).toBeNull();
  });

  it("rejeita backup com medição de data ou hora explicitamente inválida", () => {
    const result = validateAndParseBackup(JSON.stringify({
      version: 6,
      protocol: [],
      logs: {},
      measurements: [{ id: "invalid", date: "2026-99-99", time: "99:99", weightKg: 80 }]
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Data da medição inválida");
  });
});
