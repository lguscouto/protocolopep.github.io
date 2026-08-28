import { describe, it, expect } from "vitest";
import { migratePeptides, migrateLogs, migrateAppState, CURRENT_SCHEMA_VERSION } from "../../src/domain/migrations.js";

describe("Migrations Domain", () => {
  it("migra peptídeos legado v1 para v2", () => {
    const legacy = [
      { id: "pep_1", name: "MOTS-c", time: "08:30", days: [1, 3, 5], accent: "#2CC5C0" },
      { id: "pep_2", name: "AOD-9604", time: "19:00", days: null }
    ];

    const migrated = migratePeptides(legacy);
    expect(migrated).toHaveLength(2);
    expect(migrated[0].times).toEqual(["08:30"]);
    expect(migrated[0].days).toEqual([1, 3, 5]);
    expect(migrated[1].times).toEqual(["19:00"]);
    expect(migrated[1].days).toBeNull();
  });

  it("migra registros diários (logs) com segurança", () => {
    const legacyLogs = {
      "2026-08-28": {
        "pep_1": [{ t: "08:35", name: "MOTS-c" }],
        "pep_2": { t: "19:10", name: "AOD-9604" }
      },
      "invalid-date": { "pep_1": "error" }
    };

    const migrated = migrateLogs(legacyLogs);
    expect(migrated["2026-08-28"]).toBeDefined();
    expect(migrated["2026-08-28"].pep_1).toHaveLength(1);
    expect(migrated["invalid-date"]).toBeUndefined();
  });

  it("migra estado completo do aplicativo de forma idempotente", () => {
    const raw = {
      version: 1,
      protocol: [{ name: "Ipamorelin", time: "22:00" }],
      logs: {},
      theme: "white"
    };

    const state1 = migrateAppState(raw);
    expect(state1.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(state1.theme).toBe("white");
    expect(state1.protocol[0].times).toEqual(["22:00"]);

    const state2 = migrateAppState(state1);
    expect(state2.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(state2.protocol).toHaveLength(1);
  });
});
