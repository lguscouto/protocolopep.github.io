import { describe, expect, it } from "vitest";
import {
  assessTemporalConsistency,
  getZoneOffsetForLocalDateTime,
  localDateTimeToIso
} from "../../src/domain/time.js";

describe("Time Domain — timezone histórico e DST", () => {
  it.each([
    ["2026-01-15", "08:00", "America/New_York", "-05:00", "2026-01-15T13:00:00.000Z"],
    ["2026-07-15", "08:00", "America/New_York", "-04:00", "2026-07-15T12:00:00.000Z"],
    ["2026-01-15", "08:00", "America/Sao_Paulo", "-03:00", "2026-01-15T11:00:00.000Z"],
    ["2026-01-15", "08:00", "Asia/Tokyo", "+09:00", "2026-01-14T23:00:00.000Z"]
  ])("resolve %s %s em %s", (date, time, zone, expectedOffset, expectedIso) => {
    const offset = getZoneOffsetForLocalDateTime(date, time, zone);
    expect(offset).toBe(expectedOffset);
    expect(localDateTimeToIso(date, time, null, zone)).toBe(expectedIso);
    expect(localDateTimeToIso(date, time, offset, zone)).toBe(expectedIso);
  });

  it("rejeita horário inexistente durante avanço do DST", () => {
    expect(getZoneOffsetForLocalDateTime("2026-03-08", "02:30", "America/New_York")).toBeNull();
    expect(localDateTimeToIso("2026-03-08", "02:30", null, "America/New_York")).toBeNull();
  });

  it("recalcula edição Rio em aparelho no Japão com o offset histórico preservado", () => {
    expect(localDateTimeToIso("2026-08-30", "10:00", "-03:00", "Asia/Tokyo"))
      .toBe("2026-08-30T13:00:00.000Z");
  });

  it("detecta divergência entre timestamp, offset e horário civil", () => {
    expect(assessTemporalConsistency({
      date: "2026-08-29", time: "08:00",
      timestamp: "2026-08-29T11:00:00.000Z",
      zoneOffset: "-03:00", timeZoneId: "America/Sao_Paulo"
    })).toMatchObject({ valid: true, status: "valid" });

    expect(assessTemporalConsistency({
      date: "2026-08-29", time: "09:00",
      timestamp: "2026-08-29T11:00:00.000Z", zoneOffset: "-03:00"
    })).toMatchObject({ valid: false, status: "needs_review" });
  });

  it("aceita o offset explícito válido em horário ambíguo de DST", () => {
    expect(assessTemporalConsistency({
      date: "2026-11-01", time: "01:30",
      timestamp: "2026-11-01T06:30:00.000Z",
      zoneOffset: "-05:00", timeZoneId: "America/New_York"
    }).valid).toBe(true);
  });
});
