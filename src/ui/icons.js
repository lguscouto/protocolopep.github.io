const ICON_PATHS = Object.freeze({
  note: '<path d="M5 3.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3v-3.5a2 2 0 0 1-1-1.7v-8.8a2 2 0 0 1 1-1.9Z"/><path d="M7 8h8M7 11h6"/>',
  warning: '<path d="m12 3 9 16H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>'
});

/** Retorna apenas SVGs do conjunto fechado de ícones locais. */
export function renderIcon(name, { label = "" } = {}) {
  const path = ICON_PATHS[name];
  if (!path) return "";
  const aria = label ? ` role="img" aria-label="${String(label).replace(/[&<>\"']/g, "")}"` : ' aria-hidden="true"';
  return `<svg class="icon-svg icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${aria}>${path}</svg>`;
}

export const ICON_NAMES = Object.freeze(Object.keys(ICON_PATHS));

