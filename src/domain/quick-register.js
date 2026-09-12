import { dateToKey, getScheduledPeptides } from "./schedule.js";
import { summarizeDoseEntries } from "./dose-state.js";

/** Selects context only; never invents a dose or an application site. */
export function buildQuickRegisterContext(peptides = [], logs = {}, now = new Date()) {
  const date = dateToKey(now);
  const pending = getScheduledPeptides(peptides, now).filter((item) => {
    const state = summarizeDoseEntries(logs[date]?.[item.id]);
    return state.resolved < Math.max(1, Number(item.perDay) || 1);
  });
  return {
    date,
    pending,
    selectedId: pending.length === 1 ? pending[0].id : null,
    choices: pending.length ? pending : peptides,
    empty: peptides.length === 0
  };
}
