/**
 * Serviço de Diagnósticos Técnicos Desidentificados (V09)
 * 
 * Regra de Segurança: NUNCA exportar nomes de peptídeos, doses, horários específicos,
 * observações ou dados médicos. Apenas métricas de integridade, contadores e versões.
 */

import { getBackupStatus } from "../ui/backup-status.js";

export function calculateStorageSize() {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      totalBytes += (key ? key.length * 2 : 0) + (val ? val.length * 2 : 0);
    }
  } catch {
    totalBytes = 0;
  }
  return totalBytes;
}

export function sanitizeTechnicalReport(rawReport) {
  const serialized = JSON.stringify(rawReport);
  
  // Lista de chaves proibidas que nunca podem constar em um relatório de diagnóstico
  const forbiddenPatterns = [
    /"peptideName":/i,
    /"peptideId":/i,
    /"peptides":/i,
    /"logs":/i,
    /"dose":/i,
    /"doseValue":/i,
    /"sub":/i,
    /"note":/i,
    /"notes":/i,
    /"protocol":/i,
    /"substance":/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(`Violação de privacidade detectada no diagnóstico: padrão proibido ${pattern}`);
    }
  }

  return rawReport;
}

export function generateDiagnosticReport({
  storage = null,
  appVersion = "2.9.0",
  notificationsActive = false
} = {}) {
  let peptidesCount = 0;
  let logDatesCount = 0;
  let totalLoggedDosesCount = 0;
  let schemaVersion = 1;

  if (storage) {
    try {
      const peps = storage.getPeptides() || [];
      peptidesCount = Array.isArray(peps) ? peps.length : 0;

      const logs = storage.getLogs() || {};
      const dateKeys = Object.keys(logs);
      logDatesCount = dateKeys.length;

      dateKeys.forEach((d) => {
        const dayLogs = logs[d] || {};
        Object.values(dayLogs).forEach((entries) => {
          if (Array.isArray(entries)) {
            totalLoggedDosesCount += entries.length;
          } else if (entries) {
            totalLoggedDosesCount += 1;
          }
        });
      });
    } catch {
      // Falha silenciosa em contagem de métricas
    }
  }

  const backupStatus = getBackupStatus();
  const storageBytes = calculateStorageSize();

  const report = {
    app: {
      appName: "Protocolo PEP Android",
      version: appVersion,
      schemaVersion: schemaVersion,
      environment: "local-first-webview"
    },
    metrics: {
      totalPeptidesCount: peptidesCount,
      totalLogDatesCount: logDatesCount,
      totalRecordedDosesCount: totalLoggedDosesCount,
      storageEstimatedKb: Math.round(storageBytes / 1024 * 10) / 10
    },
    subsystems: {
      notificationsConfigured: Boolean(notificationsActive),
      lastBackupExport: backupStatus.lastExport ? backupStatus.lastExport.date : null,
      lastBackupRestore: backupStatus.lastRestore ? backupStatus.lastRestore.date : null
    },
    deviceContext: {
      screenResolution: typeof window !== "undefined" && window.screen ? `${window.screen.width}x${window.screen.height}` : "unknown",
      userAgentSanitized: typeof navigator !== "undefined" ? navigator.userAgent.replace(/\([^)]+\)/g, "(platform)") : "unknown",
      locale: typeof navigator !== "undefined" ? navigator.language : "pt-BR"
    },
    privacyDeclaration: "Este relatório contém exclusivamente métricas estruturais e não inclui dados terapêuticos, nomes de substâncias nem anotações.",
    generatedAt: new Date().toISOString()
  };

  return sanitizeTechnicalReport(report);
}
