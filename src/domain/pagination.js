/**
 * Paginação pura para listas já filtradas e ordenadas no domínio.
 * O chamador continua responsável por aplicar filtros e preservar a ordem.
 */
export function paginate(items, { offset = 0, pageSize = 30 } = {}) {
  const source = Array.isArray(items) ? items : [];
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 30;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
  const total = source.length;
  const pageItems = source.slice(safeOffset, safeOffset + safePageSize);
  return {
    items: pageItems,
    total,
    offset: safeOffset,
    pageSize: safePageSize,
    hasMore: safeOffset + pageItems.length < total
  };
}

