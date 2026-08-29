/**
 * Serviço de Exportação de Relatórios e Impressão Local (V08)
 */

export function downloadBlob(content, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printReportHTML(htmlString) {
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
