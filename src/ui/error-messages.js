import { i18nService } from "../services/i18n.js";

const ERROR_KEYS = Object.freeze({
  STORAGE_WRITE_FAILED: "dialogs.storageWriteFailed",
  ATOMIC_STORAGE_UNAVAILABLE: "dialogs.atomicStorageUnavailable",
  VIAL_MISSING_CONCENTRATION: "dialogs.vialMissingConcentration",
  STOCK_INSUFFICIENT: "dialogs.stockInsufficient",
  ORAL_PACKAGE_NOT_FOUND: "dialogs.oralPackageNotFound",
  VALIDATION_FAILED: "dialogs.invalidDataMessage",
  EXPORT_FAILED: "modals.report.exportErrorMsg"
});

/** Resolve a stable service/domain code to a localized user-facing message. */
export function resolveUiError(result, fallbackKey = "common.genericError") {
  const code = typeof result === "string" ? result : result?.error;
  const key = ERROR_KEYS[code] || fallbackKey;
  const translated = i18nService.t(key, { error: "" });
  if (translated === key) return i18nService.t("common.genericError");
  return translated;
}
