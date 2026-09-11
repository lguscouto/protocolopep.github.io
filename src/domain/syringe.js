/** Capacidades físicas suportadas para a escala U-100. */
export const SYRINGE_CAPACITIES_UI = Object.freeze([30, 50, 100]);

/** Valores ausentes, legados ou inválidos representam a seringa padrão de 100 UI. */
export function normalizeSyringeMaxUI(value) {
  const capacity = Number(value);
  return SYRINGE_CAPACITIES_UI.includes(capacity) ? capacity : 100;
}
