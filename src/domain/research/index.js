/**
 * Funções puras de pesquisa científica e busca de compostos — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Segurança Matemática e Imutabilidade: Lógica pura, determinística e sem side-effects.
 * - Local-First & Offline: Todas as operações executam em memória no dispositivo.
 */

import { RESEARCH_DATABASE } from "./database.js";

/**
 * Normaliza uma string para busca insensível a acentos e maiúsculas
 * @param {string} str 
 * @returns {string}
 */
export function normalizeSearchTerm(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .slice(0, 100)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Realiza busca textual em compostos por nome, nome completo, sinônimos ou categoria
 * @param {Array<Object>} [database=RESEARCH_DATABASE] 
 * @param {string} query 
 * @returns {Array<Object>}
 */
export function searchCompounds(database = RESEARCH_DATABASE, query = "") {
  if (!Array.isArray(database)) return [];
  const term = normalizeSearchTerm(query);
  if (!term) return [...database];

  return database.filter((compound) => {
    if (!compound) return false;

    const normName = normalizeSearchTerm(compound.name);
    const normFullName = normalizeSearchTerm(compound.fullName);
    const normCategory = normalizeSearchTerm(compound.categoryLabel);
    const normSummary = normalizeSearchTerm(compound.literatureSummary);

    if (normName.includes(term) || normFullName.includes(term) || normCategory.includes(term) || normSummary.includes(term)) {
      return true;
    }

    if (Array.isArray(compound.synonyms)) {
      return compound.synonyms.some((syn) => normalizeSearchTerm(syn).includes(term));
    }

    return false;
  });
}

/**
 * Filtra compostos por categoria
 * @param {Array<Object>} [database=RESEARCH_DATABASE] 
 * @param {string} category 
 * @returns {Array<Object>}
 */
export function filterByCategory(database = RESEARCH_DATABASE, category = "all") {
  if (!Array.isArray(database)) return [];
  if (!category || category === "all") return [...database];

  return database.filter((compound) => compound && compound.category === category);
}

/**
 * Busca um composto pelo seu ID canônico
 * @param {Array<Object>} [database=RESEARCH_DATABASE] 
 * @param {string} id 
 * @returns {Object|null}
 */
export function getCompoundById(database = RESEARCH_DATABASE, id = "") {
  if (!Array.isArray(database) || !id) return null;
  return database.find((c) => c && c.id === id) || null;
}

/**
 * Extrai lista de categorias únicas disponíveis no catálogo
 * @param {Array<Object>} [database=RESEARCH_DATABASE] 
 * @returns {Array<{ id: string, label: string, count: number }>}
 */
export function getCategories(database = RESEARCH_DATABASE) {
  if (!Array.isArray(database)) return [];

  const map = new Map();

  database.forEach((item) => {
    if (!item || !item.category) return;
    const catId = item.category;
    const catLabel = item.categoryLabel || catId;

    if (!map.has(catId)) {
      map.set(catId, { id: catId, label: catLabel, count: 1 });
    } else {
      map.get(catId).count += 1;
    }
  });

  return Array.from(map.values());
}

/**
 * Formata citação bibliográfica
 * @param {Object} ref 
 * @returns {string}
 */
export function formatCitation(ref) {
  if (!ref || typeof ref !== "object") return "";
  const authors = ref.authors || "Autores não informados";
  const title = ref.title ? `"${ref.title}"` : "";
  const journal = ref.journal || "";
  const year = ref.year ? `(${ref.year})` : "";
  const pmid = ref.pmid ? `PMID: ${ref.pmid}` : "";

  return [authors, title, journal, year, pmid].filter(Boolean).join(". ");
}
