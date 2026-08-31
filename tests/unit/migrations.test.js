import { describe, it, expect } from "vitest";
import {
  migratePeptides,
  migrateLogs,
  migrateAppState,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  CURRENT_SCHEMA_VERSION
} from "../../src/domain/migrations.js";

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

  it("executa migrações sequenciais de esquema v1 -> v2 -> v3 -> v4", () => {
    const v1State = {
      version: 1,
      protocol: [{ id: "p1", name: "Semaglutide", time: "08:00" }],
      logs: {
        "2026-08-29": {
          "p1": { t: "08:00", name: "Semaglutide" }
        }
      }
    };

    const v2 = migrateV1ToV2(v1State);
    expect(v2.version).toBe(2);
    expect(v2.protocol[0].times).toEqual(["08:00"]);

    const v3 = migrateV2ToV3(v2);
    expect(v3.version).toBe(3);
    expect(Array.isArray(v3.logs["2026-08-29"].p1)).toBe(true);

    const v4 = migrateV3ToV4(v3);
    expect(v4.version).toBe(4);
    expect(Array.isArray(v4.inventory)).toBe(true);
    expect(Array.isArray(v4.sites)).toBe(true);
    expect(Array.isArray(v4.measurements)).toBe(true);
  });
});
