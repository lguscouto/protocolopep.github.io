export function createFeatureLoader(load) {
  let state = "not-loaded";
  let pending = null;
  let value = null;

  return {
    get state() {
      return state;
    },
    get value() {
      return value;
    },
    async load() {
      if (state === "ready") return value;
      if (pending) return pending;

      state = "loading";
      pending = Promise.resolve()
        .then(load)
        .then((result) => {
          value = result;
          state = "ready";
          return result;
        })
        .catch((error) => {
          state = "not-loaded";
          pending = null;
          throw error;
        });

      return pending;
    }
  };
}

export function scheduleIdleWork(callback, { delay = 1200, timeout = 2000, windowRef = globalThis.window } = {}) {
  const run = () => {
    if (typeof windowRef?.requestIdleCallback === "function") {
      windowRef.requestIdleCallback(() => callback(), { timeout });
      return;
    }
    windowRef?.setTimeout?.(callback, 0);
  };

  return windowRef?.setTimeout?.(run, delay) ?? null;
}
