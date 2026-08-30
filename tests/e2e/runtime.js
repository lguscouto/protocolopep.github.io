import { expect } from "@playwright/test";

/**
 * Anexa listeners de diagnóstico na página para garantir que nenhum erro de runtime,
 * console.error ou request externo/falho passe despercebido.
 * @param {import('@playwright/test').Page} page
 * @returns {{ getErrors: () => { pageErrors: string[], consoleErrors: string[], failedRequests: string[] }, assertCleanRuntime: () => void }}
 */
export function trackPageRuntime(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText || "failed"})`);
  });

  return {
    getErrors: () => ({ pageErrors, consoleErrors, failedRequests }),
    assertCleanRuntime: () => {
      expect(pageErrors, "Page errors detected during runtime").toEqual([]);
      expect(consoleErrors, "Console error logs detected during runtime").toEqual([]);
      expect(failedRequests, "Failed network requests detected").toEqual([]);
    }
  };
}

/**
 * Prepara o storage sintético para o teste e desabilita onboarding se desejado.
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {boolean} [options.skipOnboarding=true]
 * @param {Array} [options.peptides=[]]
 * @param {Object} [options.logs={}]
 */
export async function seedStorage(page, { skipOnboarding = true, peptides = [], logs = {} } = {}) {
  await page.addInitScript(({ skipOnboarding, peptides, logs }) => {
    localStorage.clear();
    if (skipOnboarding) {
      localStorage.setItem("pep_onboarding_version", "1");
    }
    if (peptides && peptides.length > 0) {
      localStorage.setItem("pep_protocol_v2", JSON.stringify(peptides));
    }
    if (logs && Object.keys(logs).length > 0) {
      localStorage.setItem("pep_logs_v2", JSON.stringify(logs));
    }
  }, { skipOnboarding, peptides, logs });
}
