import { describe, it, expect, beforeEach } from "vitest";
import { calculateBackfillDates } from "../../src/domain/schedule.js";
import { backfillPeptideDoseLogs } from "../../src/domain/dose-service.js";
import { DoseService } from "../../src/services/dose-service.js";

describe("Preenchimento Retroativo de Doses (Data da Primeira Dose)", () => {
  let mockStorage;
  let storedLogs = {};
  let storedInventory = [];
  let storedPeptides = [];

  beforeEach(() => {
    storedLogs = {};
    storedInventory = [];
    storedPeptides = [];

    mockStorage = {
      getLogs: () => ({ ...storedLogs }),
      setLogs: (newLogs) => {
        storedLogs = { ...newLogs };
        return { success: true };
      },
      getInventory: () => [...storedInventory],
      setInventory: (newInv) => {
        storedInventory = [...newInv];
        return { success: true };
      },
      getPeptides: () => [...storedPeptides],
      takeSnapshot: () => ({ logs: { ...storedLogs }, inventory: [...storedInventory] }),
      restoreSnapshot: (snap) => {
        storedLogs = { ...snap.logs };
        storedInventory = [...snap.inventory];
      }
    };
  });

  describe("calculateBackfillDates (Cálculo Puro)", () => {
    it("deve calcular as 4 quartas-feiras exatas do exemplo do usuário (05/08, 12/08, 19/08, 26/08 para cadastro em 31/08)", () => {
      const peptide = {
        id: "pep_tirz",
        name: "Tirzepatida",
        days: [3], // Quarta-feira (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)
        time: "08:00",
        perDay: 1,
        dose: "2.5 mg",
        ui: 25
      };

      const startDate = "2026-08-05"; // Quarta-feira
      const todayDate = "2026-08-31"; // Segunda-feira

      const backfillDates = calculateBackfillDates(peptide, startDate, todayDate);

      expect(backfillDates.length).toBe(4);
      expect(backfillDates.map((b) => b.dateKey)).toEqual([
        "2026-08-05",
        "2026-08-12",
        "2026-08-19",
        "2026-08-26"
      ]);
      expect(backfillDates[0].times).toEqual(["08:00"]);
    });

    it("deve calcular ocorrências diárias de 25/08 até ontem (30/08) quando hoje for 31/08", () => {
      const peptide = {
        id: "pep_bpc",
        name: "BPC-157",
        days: [0, 1, 2, 3, 4, 5, 6], // Todos os dias
        time: "09:00",
        perDay: 1
      };

      const startDate = "2026-08-25";
      const todayDate = "2026-08-31";

      const backfillDates = calculateBackfillDates(peptide, startDate, todayDate);

      expect(backfillDates.length).toBe(6); // 25, 26, 27, 28, 29, 30
      expect(backfillDates.map((b) => b.dateKey)).toEqual([
        "2026-08-25",
        "2026-08-26",
        "2026-08-27",
        "2026-08-28",
        "2026-08-29",
        "2026-08-30"
      ]);
    });

    it("deve calcular ocorrências cíclicas (A cada 3 dias)", () => {
      const peptide = {
        id: "pep_cycle",
        name: "CJC-1295",
        interval: 3,
        start: "2026-08-10",
        time: "22:00",
        perDay: 1
      };

      const startDate = "2026-08-10";
      const todayDate = "2026-08-25";

      const backfillDates = calculateBackfillDates(peptide, startDate, todayDate);

      // 10, 13, 16, 19, 22 (25 não entra porque é hoje)
      expect(backfillDates.map((b) => b.dateKey)).toEqual([
        "2026-08-10",
        "2026-08-13",
        "2026-08-16",
        "2026-08-19",
        "2026-08-22"
      ]);
    });

    it("deve suportar múltiplas doses por dia (perDay = 2)", () => {
      const peptide = {
        id: "pep_multi",
        name: "TB-500",
        days: [1, 4], // Seg e Qui
        times: ["08:00", "20:00"],
        perDay: 2
      };

      const startDate = "2026-08-10"; // Segunda
      const todayDate = "2026-08-18"; // Terça

      const backfillDates = calculateBackfillDates(peptide, startDate, todayDate);

      // 10 (Seg), 13 (Qui), 17 (Seg)
      expect(backfillDates.map((b) => b.dateKey)).toEqual([
        "2026-08-10",
        "2026-08-13",
        "2026-08-17"
      ]);
      expect(backfillDates[0].times).toEqual(["08:00", "20:00"]);
    });

    it("deve retornar vazio se a data inicial for hoje ou no futuro", () => {
      const peptide = { id: "p1", days: null, time: "08:00" };
      expect(calculateBackfillDates(peptide, "2026-08-31", "2026-08-31")).toEqual([]);
      expect(calculateBackfillDates(peptide, "2026-09-05", "2026-08-31")).toEqual([]);
    });

    it("deve retornar vazio se datas forem inválidas", () => {
      const peptide = { id: "p1", days: null };
      expect(calculateBackfillDates(peptide, "data-invalida", "2026-08-31")).toEqual([]);
      expect(calculateBackfillDates(null, "2026-08-01", "2026-08-31")).toEqual([]);
    });
  });

  describe("backfillPeptideDoseLogs (Transição de Estado Pura)", () => {
    it("deve inserir logs com status applied e retroactive true sem inventário", () => {
      const peptide = {
        id: "pep_123",
        name: "Tirzepatida",
        dose: "2.5 mg",
        ui: 25,
        time: "08:00"
      };

      const backfillDates = [
        { dateKey: "2026-08-05", times: ["08:00"] },
        { dateKey: "2026-08-12", times: ["08:00"] }
      ];

      const initialLogs = {};
      const result = backfillPeptideDoseLogs(initialLogs, peptide, backfillDates);

      expect(result.addedCount).toBe(2);
      expect(result.datesAdded).toEqual(["2026-08-05", "2026-08-12"]);

      const logAug5 = result.logs["2026-08-05"]["pep_123"];
      expect(logAug5).toHaveLength(1);
      expect(logAug5[0].status).toBe("applied");
      expect(logAug5[0].retroactive).toBe(true);
      expect(logAug5[0].dose).toBe("2.5 mg");
      expect(logAug5[0].ui).toBe(25);
      expect(logAug5[0].vialId).toBeNull();
      expect(logAug5[0].inventoryMovementId).toBeNull();
    });

    it("deve ser idempotente e não duplicar se a data já possuir log deste peptídeo", () => {
      const peptide = {
        id: "pep_123",
        name: "Tirzepatida",
        dose: "2.5 mg",
        ui: 25,
        time: "08:00"
      };

      const initialLogs = {
        "2026-08-05": {
          pep_123: [{ id: "existing_log", time: "08:30", dose: "2.5 mg", status: "applied" }]
        }
      };

      const backfillDates = [
        { dateKey: "2026-08-05", times: ["08:00"] },
        { dateKey: "2026-08-12", times: ["08:00"] }
      ];

      const result = backfillPeptideDoseLogs(initialLogs, peptide, backfillDates);

      expect(result.addedCount).toBe(1); // Apenas 12/08 foi adicionada
      expect(result.datesAdded).toEqual(["2026-08-12"]);

      // 05/08 mantém o log original
      expect(result.logs["2026-08-05"]["pep_123"][0].id).toBe("existing_log");
      // 12/08 recebeu a dose retroativa
      expect(result.logs["2026-08-12"]["pep_123"]).toHaveLength(1);
    });
  });

  describe("DoseService.backfillPeptideDoses (Persistência no Storage)", () => {
    it("deve persistir atomicamente no storage e manter o inventário inalterado", () => {
      storedInventory = [
        { id: "vial_1", peptideName: "Tirzepatida", remainingMcg: 10000, status: "active" }
      ];

      const doseService = new DoseService(mockStorage);

      const peptide = {
        id: "pep_tirz",
        name: "Tirzepatida",
        days: [3],
        time: "08:00",
        perDay: 1,
        dose: "2.5 mg",
        ui: 25
      };

      const res = doseService.backfillPeptideDoses({
        peptide,
        startDate: "2026-08-05",
        todayDate: "2026-08-31"
      });

      expect(res.success).toBe(true);
      expect(res.addedCount).toBe(4);

      const logs = mockStorage.getLogs();
      expect(logs["2026-08-05"]["pep_tirz"]).toBeDefined();
      expect(logs["2026-08-12"]["pep_tirz"]).toBeDefined();
      expect(logs["2026-08-19"]["pep_tirz"]).toBeDefined();
      expect(logs["2026-08-26"]["pep_tirz"]).toBeDefined();

      // Inventário permanece com saldo intacto (conforme alinhado no Grill-Me)
      const inv = mockStorage.getInventory();
      expect(inv[0].remainingMcg).toBe(10000);
    });
  });
});
