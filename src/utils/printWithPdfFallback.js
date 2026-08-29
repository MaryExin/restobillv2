export async function printWithPdfFallback({
  attempt,
  buildFallbackHtml,
  fileName = "document.pdf",
}) {
  let result;

  try {
    result = await attempt();
  } catch (error) {
    result = { success: false, message: error?.message || "Print failed." };
  }

  if (result?.success) return result;

  const html =
    typeof buildFallbackHtml === "function" ? buildFallbackHtml() : "";

  if (!html) return result;

  try {
    const pdfResult = await window.electronAPI.printToPDF({
      html,
      suggestedFileName: fileName,
    });

    return {
      ...pdfResult,
      printFallback: true,
      originalMessage: result?.message,
    };
  } catch (pdfError) {
    return { ...result, pdfFallbackError: pdfError?.message };
  }
}
