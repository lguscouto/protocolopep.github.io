import { describe, it, expect } from "vitest";
import { validateAndParseBackup, createBackupPayload, MAX_BACKUP_SIZE_BYTES } from "../../src/domain/backup.js";

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
});
