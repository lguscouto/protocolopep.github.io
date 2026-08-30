/**
 * Helper de orquestração fail-closed:
 * Garante que nenhuma ação secundária ou feedback (haptics, toasts, etc.)
 * seja disparada antes da confirmação de sucesso da persistência.
 *
 * @param {Object} options
 * @param {Function} options.persist - Função que executa a persistência e retorna { success: boolean, ... }
 * @param {Function} [options.onSuccess] - Callback executado somente quando persist() retornar { success: true }
 * @returns {Object} Resultado de persist()
 */
export function commitAction({ persist, onSuccess = () => {} }) {
  if (typeof persist !== "function") {
    throw new TypeError("commitAction requires a persist function");
  }

  const result = persist();
  if (!result || result.success !== true) {
    return result || { success: false, error: "Persistência não confirmada" };
  }

  onSuccess(result);
  return result;
}
