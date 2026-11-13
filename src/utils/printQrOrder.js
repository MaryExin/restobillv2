import { BuildOrderReceiptHtml } from "./BuildOrderlistPrintHtml.jsx";
import { printWithPdfFallback } from "./printWithPdfFallback.js";

// QR notes come from a guest phone. Keep their text, but never send printer
// control bytes (ESC/GS/cut commands) to the physical device.
const printerText = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();

export function buildQrOrderPrintPayload({ order, transactionId, printMode = "new" }) {
  const transaction = printerText(transactionId);
  if (!transaction) throw new Error("Accept the QR order before printing it.");
  if (!["new", "additional", "duplicate"].includes(printMode)) throw new Error("Invalid QR order print mode.");
  if (!Array.isArray(order?.items) || order.items.length === 0) throw new Error("This QR order has no items to print.");
  const items = order.items.map((item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.selling_price);
    if (!Number.isFinite(quantity) || quantity <= 0 || item.selling_price == null || !Number.isFinite(price) || price < 0) {
      throw new Error("This QR order contains an invalid quantity or price. Refresh the order before printing.");
    }
    return {
      code: printerText(item.product_id), product_id: printerText(item.product_id),
      name: printerText(item.item_name), item_name: printerText(item.item_name),
      item_category: printerText(item.item_category),
      quantity, price, selling_price: price,
      itemInstruction: printerText(item.item_instruction),
    };
  });
  const total = Number(order.total_amount);
  if (order.total_amount == null || !Number.isFinite(total) || total < 0) throw new Error("This QR order has an invalid total. Refresh before printing.");
  const instructions = [
    `QR order: ${printerText(order.order_id)}`,
    `Transaction: ${transaction}`,
    [printerText(order.order_type), `Guests: ${Number(order.customer_head_count) || 1}`].filter(Boolean).join(" - "),
    order.customer_name ? `Customer: ${printerText(order.customer_name)}` : "",
    printerText(order.notes),
  ].filter(Boolean).join("\n");
  return { table: printerText(order.table_number), transactionId: transaction, printMode, items, total, instructions };
}

export async function printQrOrder({ order, transactionId, printMode = "new" }) {
  let payload;
  try { payload = buildQrOrderPrintPayload({ order, transactionId, printMode }); }
  catch (error) { return { success: false, message: error.message }; }
  if (!window.electronAPI?.printEscPos) return { success: false, message: "Open the installed POS app to print this order." };
  try { payload.printerName = printerText(await window.appConfig?.getDefaultPrinterName?.()); }
  catch { payload.printerName = ""; }
  let partialPrint = false;
  const result = await printWithPdfFallback({
    attempt: async () => {
      // New and additional QR batches contain only their own items. The normal
      // ESC/POS handler routes them by category and labels additional tickets.
      // Reprints use the same duplicate pathway as the normal POS.
      const printed = printMode === "duplicate"
        ? await window.electronAPI.printEscPosDuplicate(payload)
        : await window.electronAPI.printEscPos(payload);
      if (printed?.success && Array.isArray(printed.results) && printed.results.some((entry) => !entry?.success)) {
        partialPrint = true;
        return { ...printed, success: false, message: "Some kitchen printers failed. Check the saved PDF before retrying to avoid duplicate tickets." };
      }
      return printed;
    },
    buildFallbackHtml: () => BuildOrderReceiptHtml({
      productcart: { customer: payload.table, items: payload.items }, totalPrice: payload.total,
      tableselected: payload.table, instructions: payload.instructions,
      transactionId: payload.transactionId, printMode: payload.printMode,
    }),
    fileName: `qr-order-${payload.transactionId.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`,
  });
  return partialPrint ? { ...result, partialPrint: true } : result;
}
