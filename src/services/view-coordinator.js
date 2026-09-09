export function createViewCoordinator({ initialView = "today", renderers = {} } = {}) {
  let activeView = initialView;
  const dirty = new Set(Object.keys(renderers));

  const render = (view = activeView, { force = false } = {}) => {
    const renderer = renderers[view];
    if (typeof renderer !== "function") return false;
    if (!force && !dirty.has(view)) return false;
    renderer();
    dirty.delete(view);
    return true;
  };

  return {
    get activeView() {
      return activeView;
    },
    activate(view) {
      activeView = view;
      return render(view);
    },
    invalidate(...views) {
      views.flat().filter(Boolean).forEach((view) => dirty.add(view));
      return dirty.has(activeView) ? render(activeView) : false;
    },
    markReady(view) {
      dirty.add(view);
    },
    isDirty(view) {
      return dirty.has(view);
    },
    render
  };
}
