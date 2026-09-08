import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateBackfillDates, calculateDayProgress, getScheduledPeptides, getUpcomingDoseTimes, getUpcomingOccurrences, isScheduledOnDate } from "../../src/domain/schedule.js";
import { calculateWidgetSummary } from "../../src/domain/widget.js";
import { generateDailySummary } from "../../src/domain/daily-summary.js";
import { getLastUsedSite } from "../../src/domain/injection-sites.js";
import { createDashboardFocusViewModel, createDoseCardViewModel } from "../../src/ui/dashboard.js";

const revision = (id, day, status, config) => ({ id, effectiveFrom: new Date(`${day}T00:00:00`).toISOString(), status, config });
const oldConfig = { name: "Original", start: "2026-09-01", interval: 2, perDay: 1, times: ["08:00"], time: "08:00", ui: 2.5 };
const nextConfig = { ...oldConfig, name: "Atualizado", perDay: 2, times: ["10:00", "18:00"], time: "10:00", ui: 3.5 };
const protocol = { id: "p1", ...nextConfig, revisions: [
  revision("r1", "2026-09-01", "active", oldConfig),
  revision("r2", "2026-09-04", "paused", oldConfig),
  revision("r3", "2026-09-06", "active", nextConfig),
  revision("r4", "2026-09-10", "ended", nextConfig)
] };

describe("Phase 1 schedule integrity", () => {
  afterEach(() => vi.useRealTimers());

  it.each([{ days: null }, { days: [1, 3, 5] }, { days: [0, 1, 2, 3, 4, 5, 6] }, { interval: 2 }])("respects the start date for every cadence: %j", (cadence) => {
    expect(isScheduledOnDate({ id: "p1", ...cadence, start: "2026-09-07" }, "2026-09-04")).toBe(false);
    expect(isScheduledOnDate({ id: "p1", ...cadence, start: "2026-09-07" }, "2026-09-07")).toBe(true);
  });

  it("does not generate occurrences for invalid date inputs or inactive legacy protocols", () => {
    expect(isScheduledOnDate({ start: "invalid" }, "2026-09-07")).toBe(false);
    expect(isScheduledOnDate({}, "invalid")).toBe(false);
    expect(getScheduledPeptides([{ lifecycleStatus: "paused" }, { lifecycleStatus: "ended" }], "2026-09-07")).toEqual([]);
  });

  it("resolves historical configuration and preserves the interval anchor after resuming", () => {
    expect(getScheduledPeptides([protocol], "2026-09-03")[0]).toMatchObject({ name: "Original", ui: 2.5, revisionId: "r1" });
    expect(getScheduledPeptides([protocol], "2026-09-05")).toEqual([]);
    expect(getScheduledPeptides([protocol], "2026-09-06")).toEqual([]);
    expect(getScheduledPeptides([protocol], "2026-09-07")[0]).toMatchObject({ name: "Atualizado", ui: 3.5, revisionId: "r3", perDay: 2 });
    expect(getScheduledPeptides([protocol], "2026-09-11")).toEqual([]);
    expect(getScheduledPeptides([protocol], "2026-08-31")).toEqual([]);
  });

  it("uses the current instant today without prematurely applying a future revision", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T09:00:00"));
    const future = { id: "p1", ...nextConfig, revisions: [revision("r1", "2026-09-01", "active", oldConfig),
      { id: "r2", effectiveFrom: new Date("2026-09-03T18:00:00").toISOString(), status: "paused", config: oldConfig }] };
    expect(getScheduledPeptides([future], "2026-09-03")[0]?.revisionId).toBe("r1");
    vi.setSystemTime(new Date("2026-09-03T18:00:00"));
    expect(getScheduledPeptides([future], "2026-09-03")).toEqual([]);
  });

  it("uses each date's revision in upcoming and retroactive schedule previews", () => {
    const upcoming = getUpcomingOccurrences([protocol], "2026-09-03", 3);
    expect(upcoming.map((item) => [item.dateKey, item.name, item.time])).toEqual([
      ["2026-09-03", "Original", "08:00"], ["2026-09-07", "Atualizado", "10:00"], ["2026-09-09", "Atualizado", "10:00"]
    ]);
    const past = calculateBackfillDates(protocol, "2026-09-01", "2026-09-10");
    expect(past.map((item) => [item.dateKey, item.times])).toEqual([
      ["2026-09-01", ["08:00"]], ["2026-09-03", ["08:00"]], ["2026-09-07", ["10:00", "18:00"]], ["2026-09-09", ["10:00", "18:00"]]
    ]);
  });

  it("previews only actual future times after a midday resumption, preserving the interval anchor", () => {
    const resumed = { ...protocol, revisions: [
      revision("r1", "2026-09-01", "paused", nextConfig),
      { id: "r2", effectiveFrom: new Date("2026-09-07T12:00:00").toISOString(), status: "active", config: nextConfig }
    ] };
    expect(getUpcomingDoseTimes([resumed], new Date("2026-09-07T12:00:00"), 3)
      .map((item) => [item.dateKey, item.time, item.revisionId])).toEqual([
      ["2026-09-07", "18:00", "r2"], ["2026-09-09", "10:00", "r2"], ["2026-09-09", "18:00", "r2"]
    ]);
  });

  it("resolves explicit skipped and missed records without counting them as applications", () => {
    const peptides = [{ id: "p1", perDay: 3 }];
    const logs = { "2026-09-03": { p1: [{ status: "applied" }, { status: "skipped" }, { status: "missed" }] } };
    expect(calculateDayProgress(peptides, logs, "2026-09-03")).toMatchObject({
      totalDue: 3, totalTaken: 1, scheduledTaken: 1, skippedCount: 1, missedCount: 1,
      resolvedCount: 3, pendingCount: 0, percentage: 33, isComplete: true, extraTaken: 0
    });
    const widget = calculateWidgetSummary({ peptides, logs, targetDate: "2026-09-03" });
    expect(widget).toMatchObject({ takenCount: 1, resolvedCount: 3, pendingCount: 0, progressPct: 33 });
    expect(widget.statusText).toContain("Sem ocorrências pendentes");
    expect(widget.nextDoseTime).not.toBe("100%");
    const summary = generateDailySummary(peptides, logs, "2026-09-03");
    expect(summary).toContain("1 de 3 doses previstas aplicadas (33%)");
    expect(summary).toContain("Puladas: 1");
    expect(summary).toContain("Esquecidas registradas: 1");
    expect(summary).toContain("Pendentes: 0");
  });

  it("does not infer a missed event from missing data and keeps extra-only days at zero percent", () => {
    expect(calculateDayProgress([{ id: "p1", perDay: 2 }], {}, "2026-09-03")).toMatchObject({ missedCount: 0, pendingCount: 2, isComplete: false });
    expect(calculateDayProgress([], { "2026-09-03": { p1: [{ status: "applied" }] } }, "2026-09-03"))
      .toMatchObject({ totalTaken: 1, extraTaken: 1, percentage: 0, isComplete: false });
  });

  it("advances the pending slot past an explicit omission while preserving applied count", () => {
    const peptides = [{ id: "p1", perDay: 2, times: ["08:00", "18:00"] }];
    const logs = { "2026-09-03": { p1: [{ status: "skipped" }] } };
    expect(calculateWidgetSummary({ peptides, logs, targetDate: "2026-09-03" }))
      .toMatchObject({ nextDoseTime: "18:00", takenCount: 0, skippedCount: 1, resolvedCount: 1, pendingCount: 1, progressPct: 0 });
  });

  it("counts legacy records as applied and ignores unknown statuses", () => {
    const logs = { "2026-09-03": { p1: [{ time: "08:00" }, { status: "invalid" }] } };
    expect(calculateDayProgress([{ id: "p1", perDay: 2 }], logs, "2026-09-03"))
      .toMatchObject({ totalTaken: 1, resolvedCount: 1, pendingCount: 1 });
  });

  it("never rotates the injection site from skipped or missed entries", () => {
    const logs = {
      "2026-09-02": { p1: [{ site: "Coxa" }] },
      "2026-09-03": { p1: [{ status: "skipped", site: "Abdômen" }, { status: "missed", site: "Braço" }] }
    };
    expect(getLastUsedSite(logs, "p1")).toMatchObject({ site: "Coxa", date: "2026-09-02" });
  });

  it("dashboard completion uses resolved occurrences instead of applied count", () => {
    expect(createDoseCardViewModel({ peptide: { id: "p1", perDay: 1 }, takenCount: 0, resolvedCount: 1, skippedCount: 1 }))
      .toMatchObject({ isCompleted: true, takenCount: 0, skippedCount: 1, pendingCount: 0 });
    const model = createDashboardFocusViewModel({ todayItems: [
      { id: "p1", name: "Pulado", time: "08:00", takenCount: 0, resolvedCount: 1 },
      { id: "p2", name: "Pendente", time: "18:00", takenCount: 0, resolvedCount: 0 }
    ] });
    expect(model).toMatchObject({ state: "pending", title: "Pendente" });
    expect(createDashboardFocusViewModel({ todayItems: [{ id: "p1", takenCount: 0, resolvedCount: 1 }] }).state).toBe("complete");
  });
});
