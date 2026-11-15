/**
 * Prints a report's print area with the browser print (window.print), like
 * before. In the desktop app, when no printer is installed, the print area is
 * saved as a PDF instead (same "print as PDF" fallback as the receipts).
 *
 * areaId: id of the hidden print area (shown by the component's @media print
 * styles); the component's <style> tags are copied so the PDF looks the same.
 */
export async function printAreaWithPdfFallback({ areaId, fileName = "report.pdf" }) {
  const api = typeof window !== "undefined" ? window.electronAPI : null;
  if (!api?.printToPDF || !api?.getPrinters) {
    window.print();
    return { success: true };
  }

  let printers = [];
  try {
    printers = await api.getPrinters();
  } catch {
    printers = [];
  }
  if (Array.isArray(printers) && printers.length > 0) {
    window.print();
    return { success: true };
  }

  const area = document.getElementById(areaId);
  if (!area) {
    window.print();
    return { success: true };
  }
  const clone = area.cloneNode(true);
  clone.style.display = "block";
  const css = [...document.querySelectorAll("style")]
    .map((tag) => tag.textContent || "")
    .join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${clone.outerHTML}</body></html>`;

  const result = await api.printToPDF({ html, suggestedFileName: fileName });
  if (!result?.success && !result?.canceled) {
    window.alert(result?.message || "Saving the PDF failed.");
  }
  return { ...result, printFallback: true };
}
