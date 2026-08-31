/**
 * Serviço de Gerenciamento e Persistência Atômica de Doses e Estoque (P0)
 */

import { registerDoseState, undoDoseState, deleteDoseState } from "../domain/dose-service.js";

export class DoseService {
  constructor(storageService) {
    this.storage = storageService;
  }

  /**
   * Registra uma dose garantindo consistência atômica entre logs e inventário.
   */
  registerDose({
    peptideId,
    scheduledDate,
    time,
    dose,
    ui,
    site,
    note,
    status = "applied",
    statusReason = "",
    retroactive = false
  }) {
    const logs = this.storage.getLogs();
    const inventory = this.storage.getInventory();
    const peptides = this.storage.getPeptides();

    const result = registerDoseState({
      logs,
      inventory,
      peptides,
      peptideId,
      scheduledDate,
      time,
      dose,
      ui,
      site,
      note,
      status,
      statusReason,
      retroactive
    });

    if (!result.success) {
      return result;
    }

    // Persistência com snapshot e rollback atômico
    const snapshot = this.storage.takeSnapshot();
    const saveLogsRes = this.storage.setLogs(result.logs);
    if (!saveLogsRes.success) {
      this.storage.restoreSnapshot(snapshot);
      return { success: false, error: saveLogsRes.error || "Falha ao gravar logs de dose" };
    }

    if (result.vial) {
      const saveInvRes = this.storage.setInventory(result.inventory);
      if (!saveInvRes.success) {
        this.storage.restoreSnapshot(snapshot);
        return { success: false, error: saveInvRes.error || "Falha ao atualizar inventário" };
      }
    }

    return {
      success: true,
      doseLog: result.doseLog,
      vial: result.vial,
      debitedMcg: result.debitedMcg
    };
  }

  /**
   * Desfaz a dose estornando no frasco original se houver vínculo
   */
  undoDose({ peptideId, scheduledDate, doseLogId = null }) {
    const logs = this.storage.getLogs();
    const inventory = this.storage.getInventory();

    const result = undoDoseState({
      logs,
      inventory,
      peptideId,
      scheduledDate,
      doseLogId
    });

    if (!result.success) {
      return result;
    }

    const snapshot = this.storage.takeSnapshot();
    const saveLogsRes = this.storage.setLogs(result.logs);
    if (!saveLogsRes.success) {
      this.storage.restoreSnapshot(snapshot);
      return { success: false, error: saveLogsRes.error || "Falha ao atualizar logs" };
    }

    if (result.vial) {
      const saveInvRes = this.storage.setInventory(result.inventory);
      if (!saveInvRes.success) {
        this.storage.restoreSnapshot(snapshot);
        return { success: false, error: saveInvRes.error || "Falha ao estornar inventário" };
      }
    }

    return {
      success: true,
      removedLog: result.removedLog,
      vial: result.vial,
      creditedMcg: result.creditedMcg
    };
  }

  /**
   * Remove uma dose do histórico com estorno seguro
   */
  deleteDose({ peptideId, scheduledDate, doseLogId = null }) {
    return this.undoDose({ peptideId, scheduledDate, doseLogId });
  }
}
