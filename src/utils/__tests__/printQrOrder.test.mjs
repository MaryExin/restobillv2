import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { transformSync } from "@swc/core";
import * as displayNames from "../orderItemDisplayName.js";

const require = createRequire(import.meta.url);
const compile = (relative, mocks, window) => {
  const code = transformSync(fs.readFileSync(new URL(relative, import.meta.url), "utf8"), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" }, module: { type: "commonjs" },
  }).code;
  const exports = {};
  vm.runInNewContext(code, { exports, window, require: (name) => name in mocks ? mocks[name] : require(name) });
  return exports;
};

function load(window) {
  const receipts = compile("../BuildOrderlistPrintHtml.jsx", {
    "../components/MainComponents/Receipt": { default: () => null },
    "./orderItemDisplayName": displayNames,
  }, window);
  const fallback = compile("../printWithPdfFallback.js", {}, window);
  return compile("../printQrOrder.js", { "./BuildOrderlistPrintHtml.jsx": receipts, "./printWithPdfFallback.js": fallback }, window);
}

const order = Object.freeze({ order_id: "QR-1", table_number: "Table 01", order_type: "DINE IN", customer_head_count: 2,
  notes: "No salt", total_amount: "375.50", items: Object.freeze([
    Object.freeze({ product_id: "PRODUCT-1", item_name: "Chicken", quantity: "2", selling_price: "187.75", item_category: "KITCHEN", item_instruction: "Sauce on side" }),
  ]),
});

test("maps authoritative QR items to existing kitchen routing without mutating the saved snapshot", async () => {
  const prints = [];
  const { printQrOrder } = load({ appConfig: { getDefaultPrinterName: async () => "Kitchen" }, electronAPI: {
    printEscPos: async (payload) => { prints.push(payload); return { success: true }; },
    printToPDF: async () => { throw new Error("Successful print must not create a PDF"); },
  } });
  assert.equal((await printQrOrder({ order, transactionId: "1000001" })).success, true);
  assert.equal(prints.length, 1);
  const payload = prints[0];
  assert.equal(payload.printMode, "new");
  assert.equal(payload.table, "Table 01");
  assert.equal(payload.total, 375.50);
  assert.equal(payload.printerName, "Kitchen");
  assert.equal(payload.items[0].name, "Chicken");
  assert.equal(payload.items[0].price, 187.75);
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.items[0].item_category, "KITCHEN");
  assert.equal(payload.items[0].itemInstruction, "Sauce on side");
  assert.match(payload.instructions, /QR order: QR-1\nTransaction: 1000001\nDINE IN - Guests: 2\nNo salt/);
  assert.equal(order.items[0].selling_price, "187.75");
});

test("duplicate print uses the existing duplicate handler, and printing cannot precede acceptance", async () => {
  const duplicates = [];
  const { printQrOrder } = load({ electronAPI: {
    printEscPos: async () => { throw new Error("Should use duplicate printer"); },
    printEscPosDuplicate: async (payload) => { duplicates.push(payload); return { success: true }; },
  } });
  assert.equal((await printQrOrder({ order, transactionId: "1000001", printMode: "duplicate" })).success, true);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].printMode, "duplicate");
  assert.equal((await printQrOrder({ order, transactionId: "" })).success, false);
  assert.equal(duplicates.length, 1);
});

test("additional orders print only the new batch under the existing transaction", async () => {
  const prints = [];
  const { printQrOrder } = load({ electronAPI: {
    printEscPos: async (payload) => { prints.push(payload); return { success: true }; },
    printEscPosDuplicate: async () => { throw new Error("Additional orders must use the kitchen routing pathway"); },
  } });
  const additional = Object.freeze({ ...order, order_id: "QR-2", notes: "Second batch", total_amount: "237.75", items: Object.freeze([
    Object.freeze({ ...order.items[0], quantity: "1" }),
    Object.freeze({ product_id: "PRODUCT-2", item_name: "Soup", quantity: 1, selling_price: 50, item_category: "SOUP", item_instruction: "No pepper" }),
  ]) });
  assert.equal((await printQrOrder({ order, transactionId: "1000001" })).success, true);
  assert.equal((await printQrOrder({ order: additional, transactionId: "1000001", printMode: "additional" })).success, true);
  assert.equal(prints.length, 2);
  const ticket = prints[1];
  assert.equal(ticket.transactionId, prints[0].transactionId);
  assert.equal(ticket.printMode, "additional");
  assert.equal(ticket.items.length, 2);
  assert.equal(ticket.items[0].product_id, "PRODUCT-1");
  assert.equal(ticket.items[0].quantity, 1, "the previous two portions are not printed again");
  assert.equal(ticket.items[1].product_id, "PRODUCT-2");
  assert.equal(ticket.items[1].item_category, "SOUP");
  assert.equal(ticket.total, 237.75, "the ticket total covers this batch only");
  assert.match(ticket.instructions, /QR order: QR-2/);
  assert.doesNotMatch(ticket.instructions, /No salt/);
  assert.equal(order.items[0].quantity, "2");
});

test("additional order PDF fallback carries the additional label and only its batch items", async () => {
  let pdf;
  const { printQrOrder } = load({ electronAPI: {
    printEscPos: async (payload) => {
      assert.equal(payload.printMode, "additional");
      return { success: false, message: "Kitchen printer unavailable" };
    },
    printToPDF: async (payload) => { pdf = payload; return { success: true, filePath: "/tmp/additional-order.pdf" }; },
  } });
  const additional = { ...order, order_id: "QR-2", total_amount: 50, items: [
    { product_id: "PRODUCT-2", item_name: "Soup", quantity: 1, selling_price: 50, item_category: "SOUP", item_instruction: "No pepper" },
  ] };
  const result = await printQrOrder({ order: additional, transactionId: "1000001", printMode: "additional" });
  assert.equal(result.success, true);
  assert.equal(result.printFallback, true);
  assert.match(pdf.html, /class="status-banner">Additional Order<\/div>/);
  assert.match(pdf.html, /Soup/);
  assert.doesNotMatch(pdf.html, /Chicken|New Order|Duplicate Copy/);
  assert.match(pdf.html, /50.00/);
});

test("PDF fallback escapes guest HTML and strips physical printer control bytes", async () => {
  let printed, pdf;
  const { printQrOrder } = load({ electronAPI: {
    printEscPos: async (payload) => { printed = payload; return { success: false, message: "Printer unavailable" }; },
    printToPDF: async (payload) => { pdf = payload; return { success: true, filePath: "/tmp/receipt.pdf" }; },
  } });
  const hostileOrder = { ...order, table_number: '<img src=x onerror="alert(1)">', notes: "\x1b\x40<script>alert(1)</script>", items: [{ ...order.items[0], item_instruction: '<iframe src="https://evil.test">' }] };
  const result = await printQrOrder({ order: hostileOrder, transactionId: "TX/123" });
  assert.equal(result.success, true);
  assert.equal(result.printFallback, true);
  assert.equal(pdf.suggestedFileName, "qr-order-TX_123.pdf");
  assert.doesNotMatch(printed.instructions, /\x1b/);
  assert.doesNotMatch(pdf.html, /<script>|<iframe|<img src=x/);
  assert.match(pdf.html, /&lt;script&gt;/);
  assert.match(pdf.html, /&lt;iframe/);
  assert.match(pdf.html, /375.50/);
});

test("partial kitchen failure is visible and PDF cancellation stays canceled", async () => {
  const { printQrOrder } = load({ electronAPI: {
    printEscPos: async () => ({ success: true, results: [{ success: true }, { success: false }] }),
    printToPDF: async () => ({ success: false, canceled: true }),
  } });
  const result = await printQrOrder({ order, transactionId: "1000001" });
  assert.equal(result.success, false);
  assert.equal(result.canceled, true);
  assert.equal(result.partialPrint, true);
  assert.match(result.originalMessage, /Some kitchen printers failed/);
});

test("invalid order values and browser-only contexts report failure without printing", async () => {
  const { printQrOrder } = load({});
  assert.equal((await printQrOrder({ order, transactionId: "1000001" })).success, false);
  for (const invalid of [{ ...order, total_amount: null }, { ...order, items: [] }, { ...order, items: [{ ...order.items[0], quantity: -1 }] }, { ...order, items: [{ ...order.items[0], selling_price: null }] }]) {
    assert.equal((await printQrOrder({ order: invalid, transactionId: "1000001" })).success, false);
  }
});
