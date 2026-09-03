const OPEN_MODAL_SELECTOR = ".modal.on";

function nextFrame(windowRef, callback) {
  if (typeof windowRef?.requestAnimationFrame === "function") {
    return windowRef.requestAnimationFrame(callback);
  }
  return windowRef?.setTimeout ? windowRef.setTimeout(callback, 0) : 0;
}

function cancelFrame(windowRef, frameId) {
  if (!frameId) return;
  if (typeof windowRef?.cancelAnimationFrame === "function") {
    windowRef.cancelAnimationFrame(frameId);
  } else if (typeof windowRef?.clearTimeout === "function") {
    windowRef.clearTimeout(frameId);
  }
}

/**
 * Centraliza o comportamento estrutural dos bottom sheets:
 * - bloqueia a rolagem da página enquanto um modal está aberto;
 * - acompanha o visualViewport durante o teclado virtual;
 * - mantém o campo focado visível dentro do corpo rolável do sheet.
 */
export function setupModalController({
  documentRef = typeof document !== "undefined" ? document : null,
  windowRef = typeof window !== "undefined" ? window : null
} = {}) {
  if (!documentRef?.body || !documentRef.documentElement || !windowRef) {
    return () => {};
  }

  const root = documentRef.documentElement;
  const body = documentRef.body;
  const viewport = windowRef.visualViewport || null;
  let modalOpen = false;
  let savedScrollY = 0;
  let focusFrame = 0;

  const ensureFocusedFieldVisible = () => {
    focusFrame = 0;
    if (!modalOpen) return;

    const activeElement = documentRef.activeElement;
    if (!activeElement || typeof activeElement.closest !== "function") return;

    const modal = activeElement.closest(OPEN_MODAL_SELECTOR);
    const scroller = activeElement.closest(".sheet-body");
    if (!modal || !scroller || typeof activeElement.getBoundingClientRect !== "function") return;

    const fieldRect = activeElement.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const viewportHeight = viewport?.height || windowRef.innerHeight;
    const visibleTop = scrollerRect.top + 12;
    const visibleBottom = Math.min(scrollerRect.bottom, viewportHeight) - 12;
    let delta = 0;

    if (fieldRect.bottom > visibleBottom) {
      delta = fieldRect.bottom - visibleBottom;
    } else if (fieldRect.top < visibleTop) {
      delta = fieldRect.top - visibleTop;
    }

    if (delta !== 0 && typeof scroller.scrollBy === "function") {
      scroller.scrollBy({ top: delta, behavior: "smooth" });
    }
  };

  const queueFocusedFieldCheck = () => {
    cancelFrame(windowRef, focusFrame);
    focusFrame = nextFrame(windowRef, ensureFocusedFieldVisible);
  };

  const updateViewportVars = () => {
    const viewportHeight = viewport?.height || windowRef.innerHeight;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
    }

    const offsetTop = viewport?.offsetTop || 0;
    root.style.setProperty("--app-viewport-offset-top", `${offsetTop}px`);
    queueFocusedFieldCheck();
  };

  const syncModalLock = () => {
    const hasOpenModal = Boolean(documentRef.querySelector(OPEN_MODAL_SELECTOR));

    if (hasOpenModal && !modalOpen) {
      savedScrollY = Number.isFinite(windowRef.scrollY) ? windowRef.scrollY : 0;
    }

    if (!hasOpenModal && modalOpen && typeof windowRef.scrollTo === "function") {
      windowRef.scrollTo(0, savedScrollY);
    }

    modalOpen = hasOpenModal;
    root.classList.toggle("modal-open", modalOpen);
    body.classList.toggle("modal-open", modalOpen);

    if (modalOpen) {
      updateViewportVars();
    }
  };

  const observer = typeof windowRef.MutationObserver === "function"
    ? new windowRef.MutationObserver(syncModalLock)
    : null;
  observer?.observe(body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  const onFocusIn = (event) => {
    if (event.target?.closest?.(OPEN_MODAL_SELECTOR)) {
      queueFocusedFieldCheck();
    }
  };

  documentRef.addEventListener("focusin", onFocusIn);
  windowRef.addEventListener("resize", updateViewportVars, { passive: true });
  viewport?.addEventListener("resize", updateViewportVars, { passive: true });
  viewport?.addEventListener("scroll", updateViewportVars, { passive: true });

  updateViewportVars();
  syncModalLock();

  return () => {
    cancelFrame(windowRef, focusFrame);
    observer?.disconnect();
    documentRef.removeEventListener("focusin", onFocusIn);
    windowRef.removeEventListener("resize", updateViewportVars);
    viewport?.removeEventListener("resize", updateViewportVars);
    viewport?.removeEventListener("scroll", updateViewportVars);
    root.classList.remove("modal-open");
    body.classList.remove("modal-open");
  };
}

