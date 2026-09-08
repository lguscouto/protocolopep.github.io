/** Persistence boundary: logs and inventory are committed together or neither is changed. */
import { registerDoseState, undoDoseState, editDoseState, backfillPeptideDoseLogs } from "../domain/dose-service.js";
import { calculateBackfillDates } from "../domain/schedule.js";

export class DoseService {
  constructor(storageService) { this.storage = storageService; }

  commit(result) {
    if (!result.success) return result;
    if (typeof this.storage.commitDoseState !== "function") {
      return { success: false, error: "ATOMIC_STORAGE_UNAVAILABLE", message: "A gravação conjunta de histórico e estoque não está disponível." };
    }
    try {
      const saved = this.storage.commitDoseState({ logs: result.logs, inventory: result.inventory });
      if (!saved?.success) return { success: false, error: saved?.error || "STORAGE_WRITE_FAILED", message: saved?.message || "Não foi possível gravar o histórico e o estoque. Nenhuma confirmação foi emitida." };
      const { logs, inventory, ...committed } = result;
      return committed;
    } catch {
      return { success: false, error: "STORAGE_WRITE_FAILED", message: "Não foi possível confirmar a gravação do registro." };
    }
  }

  registerDose(options) {
    return this.commit(registerDoseState({ ...options, logs: this.storage.getLogs(), inventory: this.storage.getInventory(), peptides: this.storage.getPeptides() }));
  }

  undoDose(options) {
    return this.commit(undoDoseState({ ...options, logs: this.storage.getLogs(), inventory: this.storage.getInventory() }));
  }

  deleteDose(options) { return this.undoDose(options); }

  editDose(options) {
    return this.commit(editDoseState({ ...options, logs: this.storage.getLogs(), inventory: this.storage.getInventory() }));
  }

  backfillPeptideDoses({ peptide, startDate, todayDate = new Date() }) {
    if (!peptide || !startDate) return { success: true, addedCount: 0, datesAdded: [] };
    const dates = calculateBackfillDates(peptide, startDate, todayDate);
    const result = backfillPeptideDoseLogs(this.storage.getLogs(), peptide, dates);
    if (!result.addedCount) return { success: true, addedCount: 0, datesAdded: [] };
    return this.commit({ ...result, success: true, inventory: this.storage.getInventory() });
  }
}
