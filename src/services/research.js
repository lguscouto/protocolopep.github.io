/**
 * Serviço de Pesquisa Científica Local — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & Offline First: Persistência local no storage do dispositivo.
 * - Resiliência e Fail-Closed: Operações com fallback e tratamento de erros.
 */

import { RESEARCH_DATABASE } from "../domain/research/database.js";
import {
  searchCompounds,
  filterByCategory,
  getCompoundById,
  getCategories,
  formatCitation
} from "../domain/research/index.js";

const FAVORITES_STORAGE_KEY = "pep_research_favorites";
const RECENT_QUERIES_STORAGE_KEY = "pep_research_recent_queries";
const MAX_RECENT_QUERIES = 8;

export class ResearchService {
  /**
   * @param {Object} [storage=localStorage] - Interface compatível com Storage API
   * @param {Array<Object>} [database=RESEARCH_DATABASE] - Catálogo estático de compostos
   */
  constructor(storage = typeof localStorage !== "undefined" ? localStorage : null, database = RESEARCH_DATABASE) {
    this.storage = storage;
    this.database = database;
  }

  /**
   * Retorna todos os compostos da base
   * @returns {Array<Object>}
   */
  getAll() {
    return [...this.database];
  }

  /**
   * Busca compostos com filtro textual e de categoria
   * @param {string} query 
   * @param {string} [category="all"] 
   * @returns {Array<Object>}
   */
  search(query = "", category = "all") {
    let results = this.database;

    if (category && category !== "all") {
      results = filterByCategory(results, category);
    }

    if (query && query.trim()) {
      results = searchCompounds(results, query);
    }

    return results;
  }

  /**
   * Retorna um composto pelo ID
   * @param {string} id 
   * @returns {Object|null}
   */
  getById(id) {
    return getCompoundById(this.database, id);
  }

  /**
   * Retorna as categorias disponíveis com contagem
   * @returns {Array<{ id: string, label: string, count: number }>}
   */
  getCategories() {
    return getCategories(this.database);
  }

  /**
   * Obtém os IDs dos compostos favoritados
   * @returns {string[]}
   */
  getFavorites() {
    try {
      if (this.storage) {
        const raw = this.storage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("[ResearchService] Falha ao ler favoritos:", e);
    }
    return [];
  }

  /**
   * Alterna o estado de favorito de um composto
   * @param {string} id 
   * @returns {boolean} true se agora está favoritado, false se foi removido
   */
  toggleFavorite(id) {
    if (!id || typeof id !== "string") return false;

    const favorites = new Set(this.getFavorites());
    let isFav = false;

    if (favorites.has(id)) {
      favorites.delete(id);
      isFav = false;
    } else {
      favorites.add(id);
      isFav = true;
    }

    try {
      if (this.storage) {
        this.storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
      }
    } catch (e) {
      console.warn("[ResearchService] Falha ao persistir favoritos:", e);
    }

    return isFav;
  }

  /**
   * Verifica se um composto é favorito
   * @param {string} id 
   * @returns {boolean}
   */
  isFavorite(id) {
    if (!id) return false;
    return this.getFavorites().includes(id);
  }

  /**
   * Obtém histórico de buscas recentes
   * @returns {string[]}
   */
  getRecentQueries() {
    try {
      if (this.storage) {
        const raw = this.storage.getItem(RECENT_QUERIES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("[ResearchService] Falha ao ler buscas recentes:", e);
    }
    return [];
  }

  /**
   * Adiciona um termo ao histórico de buscas recentes
   * @param {string} query 
   */
  addRecentQuery(query) {
    if (!query || typeof query !== "string" || !query.trim()) return;

    const trimmed = query.trim();
    let recents = this.getRecentQueries().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    recents.unshift(trimmed);

    if (recents.length > MAX_RECENT_QUERIES) {
      recents = recents.slice(0, MAX_RECENT_QUERIES);
    }

    try {
      if (this.storage) {
        this.storage.setItem(RECENT_QUERIES_STORAGE_KEY, JSON.stringify(recents));
      }
    } catch (e) {
      console.warn("[ResearchService] Falha ao persistir busca recente:", e);
    }
  }

  /**
   * Limpa o histórico de buscas recentes
   */
  clearRecentQueries() {
    try {
      if (this.storage) {
        this.storage.removeItem(RECENT_QUERIES_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("[ResearchService] Falha ao limpar buscas recentes:", e);
    }
  }

  /**
   * Formata citação bibliográfica
   * @param {Object} ref 
   * @returns {string}
   */
  formatCitation(ref) {
    return formatCitation(ref);
  }
}

export const researchService = new ResearchService();
