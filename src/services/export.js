/**
 * Serviço Unificado de Exportação de Arquivos, Relatórios e Impressão Local (V15)
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & 100% Offline: Exportação direta para armazenamento do dispositivo e MediaStore Android.
 * - Resiliência e Fail-Closed: Retorna status explícito de sucesso/falha e caminho do arquivo.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export const PepFileExport = registerPlugin("PepFileExport");

let customFileExportPlugin = null;

export function setFileExportPlugin(plugin) {
  customFileExportPlugin = plugin;
}

function getFileExportPlugin() {
  return customFileExportPlugin || PepFileExport;
}

/**
 * Salva um conteúdo textual (JSON, CSV, texto) no armazenamento público do dispositivo.
 * No Android: salva em Downloads/ProtocoloPEP via MediaStore.
 * Na Web: utiliza a File System Access API (showSaveFilePicker) ou download com Blob seguro.
 *
 * @param {Object} options
 * @param {string} options.fileName - Nome do arquivo (ex: "protocolo-pep-backup-2026-09-04.json")
 * @param {string} options.content - Conteúdo serializado
 * @param {string} [options.mimeType="application/json"] - Tipo MIME
 * @param {string} [options.subDir="ProtocoloPEP"] - Subpasta de destino
 * @returns {Promise<{ success: boolean, path?: string, uri?: string, aborted?: boolean, error?: string }>}
 */
export async function exportFile({
  fileName,
  content,
  mimeType = "application/json",
  subDir = "ProtocoloPEP"
}) {
  if (!fileName || typeof fileName !== "string") {
    return { success: false, error: "Nome de arquivo inválido." };
  }
  if (content === undefined || content === null) {
    return { success: false, error: "Conteúdo para exportação não pode ser nulo." };
  }

  // 1. Android Nativo (Capacitor)
  if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
    try {
      const plugin = getFileExportPlugin();
      if (plugin && typeof plugin.saveFile === "function") {
        const res = await plugin.saveFile({
          fileName,
          content: String(content),
          mimeType,
          subDir
        });
        return {
          success: true,
          path: res.path || `Downloads/${subDir}/${fileName}`,
          uri: res.uri || null
        };
      }
    } catch (err) {
      console.error("[ExportService] Falha no plugin nativo de exportação:", err);
      return {
        success: false,
        error: err.message || "Falha ao salvar no armazenamento nativo."
      };
    }
  }

  // 2. Navegador Web com File System Access API (Salvar Como...)
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: mimeType === "application/json" ? "Arquivo JSON" : "Arquivo",
            accept: { [mimeType]: ext ? [ext] : [] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return {
        success: true,
        path: handle.name || fileName,
        isCustomLocation: true
      };
    } catch (err) {
      if (err && err.name === "AbortError") {
        return { success: false, aborted: true };
      }
      // Se der erro no picker, faz fallback seguro para downloadBlob
    }
  }

  // 3. Fallback Web Padrão (Blob Download)
  try {
    downloadBlob(content, fileName, mimeType);
    return {
      success: true,
      path: `Downloads/${fileName}`,
      isDownload: true
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Falha ao gerar download do arquivo."
    };
  }
}

/**
 * Abre a folha de compartilhamento nativa do sistema (Android Share Sheet ou Web Share).
 *
 * @param {Object} options
 * @param {string} options.fileName
 * @param {string} options.content
 * @param {string} [options.mimeType="application/json"]
 * @param {string} [options.title="Compartilhar arquivo"]
 * @returns {Promise<{ success: boolean, aborted?: boolean, error?: string }>}
 */
export async function shareExportedFile({
  fileName,
  content,
  mimeType = "application/json",
  title = "Compartilhar arquivo"
}) {
  if (!fileName || content === undefined || content === null) {
    return { success: false, error: "Parâmetros de compartilhamento inválidos." };
  }

  // 1. Android Nativo via PepFileExport Plugin
  if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
    try {
      const plugin = getFileExportPlugin();
      if (plugin && typeof plugin.shareFile === "function") {
        await plugin.shareFile({
          fileName,
          content: String(content),
          mimeType,
          title
        });
        return { success: true };
      }
    } catch (err) {
      console.error("[ExportService] Falha ao compartilhar via plugin nativo:", err);
      return { success: false, error: err.message || "Erro ao compartilhar arquivo." };
    }
  }

  // 2. Web Share API (se suportado com arquivos)
  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File !== "undefined") {
    try {
      const file = new File([content], fileName, { type: mimeType });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title
        });
        return { success: true };
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        return { success: false, aborted: true };
      }
    }
  }

  return { success: false, error: "Compartilhamento não suportado neste ambiente." };
}

/**
 * Cria um link temporário para download de Blob com limpeza postergada segura.
 */
export function downloadBlob(content, filename, mimeType = "text/plain;charset=utf-8") {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Mantém a URL viva tempo suficiente para o navegador despachar o download
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Imprime HTML localmente via iframe isolado sem dependência de rede.
 */
export function printReportHTML(htmlString) {
  if (typeof document === "undefined") return;
  const printIframe = document.createElement("iframe");
  printIframe.style.position = "fixed";
  printIframe.style.right = "0";
  printIframe.style.bottom = "0";
  printIframe.style.width = "0";
  printIframe.style.height = "0";
  printIframe.style.border = "0";
  document.body.appendChild(printIframe);

  const doc = printIframe.contentWindow.document;
  doc.open();
  doc.write(htmlString);
  doc.close();

  printIframe.contentWindow.focus();
  setTimeout(() => {
    printIframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(printIframe);
    }, 2000);
  }, 300);
}
