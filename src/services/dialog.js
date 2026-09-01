/**
 * Serviço Unificado de Diálogos e Modais In-App (V13)
 *
 * Substitui chamadas síncronas bloqueantes de window.alert() e window.confirm()
 * por modais acessíveis com armadilha de foco (Tab), fechamento via Escape,
 * suporte a leitores de tela (ARIA) e feedback tátil (Haptics).
 */

import { haptics } from "./haptics.js";

export class DialogService {
  /**
   * Exibe um modal de confirmação acessível (retorna Promise<boolean>)
   *
   * @param {Object} options
   * @param {string} [options.title="Confirmar"]
   * @param {string} options.message
   * @param {string} [options.confirmText="Confirmar"]
   * @param {string} [options.cancelText="Cancelar"]
   * @param {boolean} [options.isDanger=true]
   * @returns {Promise<boolean>}
   */
  confirm({
    title = "Confirmar",
    message = "",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    isDanger = true
  } = {}) {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        return resolve(false);
      }

      const modal = document.getElementById("confirm-modal");
      const titleEl = document.getElementById("confirm-title");
      const msgEl = document.getElementById("confirm-message");
      const okBtn = document.getElementById("confirm-ok");
      const cancelBtn = document.getElementById("confirm-cancel");
      const closeBtn = document.getElementById("confirm-close");

      if (!modal) {
        console.warn("[DialogService] Modal de confirmação indisponível; ação cancelada por segurança.");
        return resolve(false);
      }

      const previousActive = document.activeElement;

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (okBtn) {
        okBtn.textContent = confirmText;
        okBtn.className = isDanger ? "btn-danger" : "btn-primary";
        okBtn.style.display = "";
      }
      if (cancelBtn) {
        cancelBtn.textContent = cancelText;
        cancelBtn.style.display = "";
      }

      const cleanup = () => {
        modal.classList.remove("on");
        modal.setAttribute("aria-hidden", "true");
        okBtn?.removeEventListener("click", onOk);
        cancelBtn?.removeEventListener("click", onCancel);
        closeBtn?.removeEventListener("click", onCancel);
        window.removeEventListener("keydown", onKeyDown);
        if (previousActive && typeof previousActive.focus === "function") {
          try {
            previousActive.focus();
          } catch (e) {
            // ignore
          }
        }
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Tab") {
          const focusable = [cancelBtn, okBtn, closeBtn].filter(
            (el) => el && el.style.display !== "none"
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      okBtn?.addEventListener("click", onOk);
      cancelBtn?.addEventListener("click", onCancel);
      closeBtn?.addEventListener("click", onCancel);
      window.addEventListener("keydown", onKeyDown);

      modal.classList.add("on");
      modal.setAttribute("aria-hidden", "false");

      if (isDanger) {
        haptics.warning();
      } else {
        haptics.light();
      }

      // Foco inicial seguro no botão de cancelar para evitar ações destrutivas acidentais
      if (cancelBtn && cancelBtn.style.display !== "none") {
        cancelBtn.focus();
      } else if (okBtn) {
        okBtn.focus();
      }
    });
  }

  /**
   * Exibe um modal de alerta informativo acessível (retorna Promise<boolean>)
   *
   * @param {Object} options
   * @param {string} [options.title="Aviso"]
   * @param {string} options.message
   * @param {string} [options.buttonText="OK"]
   * @param {boolean} [options.isDanger=false]
   * @returns {Promise<boolean>}
   */
  alert({
    title = "Aviso",
    message = "",
    buttonText = "OK",
    isDanger = false
  } = {}) {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        return resolve(true);
      }

      const modal = document.getElementById("confirm-modal");
      const titleEl = document.getElementById("confirm-title");
      const msgEl = document.getElementById("confirm-message");
      const okBtn = document.getElementById("confirm-ok");
      const cancelBtn = document.getElementById("confirm-cancel");
      const closeBtn = document.getElementById("confirm-close");

      if (!modal) {
        console.warn(`[DialogService] ${title}: ${message}`);
        return resolve(true);
      }

      const previousActive = document.activeElement;

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (okBtn) {
        okBtn.textContent = buttonText;
        okBtn.className = isDanger ? "btn-danger" : "btn-primary";
        okBtn.style.display = "";
      }
      if (cancelBtn) {
        cancelBtn.style.display = "none";
      }

      const cleanup = () => {
        modal.classList.remove("on");
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.style.display = "";
        okBtn?.removeEventListener("click", onOk);
        closeBtn?.removeEventListener("click", onOk);
        window.removeEventListener("keydown", onKeyDown);
        if (previousActive && typeof previousActive.focus === "function") {
          try {
            previousActive.focus();
          } catch (e) {
            // ignore
          }
        }
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          onOk();
        } else if (e.key === "Tab") {
          const focusable = [okBtn, closeBtn].filter(
            (el) => el && el.style.display !== "none"
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      okBtn?.addEventListener("click", onOk);
      closeBtn?.addEventListener("click", onOk);
      window.addEventListener("keydown", onKeyDown);

      modal.classList.add("on");
      modal.setAttribute("aria-hidden", "false");

      if (isDanger) {
        haptics.error();
      } else {
        haptics.light();
      }

      if (okBtn) {
        okBtn.focus();
      }
    });
  }
}

export const dialogService = new DialogService();
