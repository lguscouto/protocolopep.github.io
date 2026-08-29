/**
 * Módulo de Domínio: Rotação e Gerenciamento de Sítios de Aplicação (V11)
 *
 * Princípios de Governança:
 * - Linguagem estritamente não prescritiva: 'próximo na sua rotação', 'último registrado'.
 * - Não clínica: lista ordinal configurável pelo usuário sem orientações médicas.
 * - Funções puras, imutáveis e auditáveis.
 */

export const DEFAULT_INJECTION_SITES = Object.freeze([
  "Abdômen (Direito)",
  "Abdômen (Esquerdo)",
  "Coxa (Direita)",
  "Coxa (Esquerda)",
  "Deltoide (Direito)",
  "Deltoide (Esquerdo)"
]);

/**
 * Retorna a lista padrão imutável de sítios de aplicação.
 * @returns {string[]}
 */
export function getDefaultSites() {
  return [...DEFAULT_INJECTION_SITES];
}

/**
 * Sanitiza e valida o nome de um sítio de aplicação.
 * @param {string} name
 * @returns {string}
 */
export function formatSiteLabel(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().slice(0, 50);
}

/**
 * Valida a integridade de uma lista de sítios de aplicação.
 * @param {any} sites
 * @returns {{ valid: boolean, errors: string[], sites: string[] }}
 */
export function validateSitesList(sites) {
  const errors = [];
  if (!Array.isArray(sites)) {
    return { valid: false, errors: ["A lista de sítios deve ser um array."], sites: [] };
  }

  const cleaned = [];
  const seen = new Set();

  for (let i = 0; i < sites.length; i++) {
    const item = formatSiteLabel(sites[i]);
    if (!item) {
      errors.push(`O sítio na posição ${i + 1} não pode ser vazio.`);
      continue;
    }
    const lower = item.toLowerCase();
    if (seen.has(lower)) {
      errors.push(`Sítio duplicado encontrado: "${item}".`);
      continue;
    }
    seen.add(lower);
    cleaned.push(item);
  }

  if (cleaned.length === 0 && sites.length > 0 && errors.length > 0) {
    return { valid: false, errors, sites: [] };
  }

  return {
    valid: errors.length === 0,
    errors,
    sites: cleaned
  };
}

/**
 * Determina o próximo sítio com base na sequência circular configurada pelo usuário.
 * Retorna null se não houver sítios configurados.
 *
 * @param {string[]} configuredSites - Lista ordenada de sítios definida pelo usuário.
 * @param {string|null} lastSiteName - Nome do último sítio registrado.
 * @returns {string|null}
 */
export function getNextSite(configuredSites, lastSiteName = null) {
  if (!Array.isArray(configuredSites) || configuredSites.length === 0) {
    return null;
  }

  if (!lastSiteName || typeof lastSiteName !== "string") {
    return configuredSites[0];
  }

  const target = lastSiteName.trim().toLowerCase();
  const index = configuredSites.findIndex(
    (s) => s.trim().toLowerCase() === target
  );

  // Se o último sítio não for encontrado na lista atual, recomeça do primeiro
  if (index === -1) {
    return configuredSites[0];
  }

  // Avanço circular na ordem configurada
  const nextIndex = (index + 1) % configuredSites.length;
  return configuredSites[nextIndex];
}

/**
 * Localiza o último sítio de aplicação registrado nos logs de doses.
 * @param {Object} logs - Objeto com mapa de datas e doses.
 * @param {string|null} peptideId - ID opcional de peptídeo para filtrar histórico.
 * @returns {{ site: string, date: string, time: string } | null}
 */
export function getLastUsedSite(logs, peptideId = null) {
  if (!logs || typeof logs !== "object") return null;

  const dateKeys = Object.keys(logs).sort().reverse();

  for (const dk of dateKeys) {
    const dayEntry = logs[dk];
    if (!dayEntry || typeof dayEntry !== "object") continue;

    const peptideKeys = peptideId ? [peptideId] : Object.keys(dayEntry);

    for (const pId of peptideKeys) {
      const pLogs = dayEntry[pId];
      if (!pLogs) continue;

      const entries = Array.isArray(pLogs) ? pLogs : [pLogs];
      // Percorrer as doses mais recentes do dia
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e && typeof e === "object" && e.site && typeof e.site === "string" && e.site.trim()) {
          return {
            site: e.site.trim(),
            date: dk,
            time: e.time || ""
          };
        }
      }
    }
  }

  return null;
}
