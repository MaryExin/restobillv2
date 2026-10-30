import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import * as ReactDOMServer from "react-dom/server";
import * as QRCode from "qrcode.react";
import { transformSync } from "@swc/core";
import * as displayNames from "../orderItemDisplayName.js";
import { buildVoidRefundHtml } from "../BuildVoidRefundHtml.js";

// Render the production receipt templates with existing project dependencies.
// SWC handles JSX; ReactDOMServer supplies the same escaping used when printing.
const modules = new Map();
function loadJsx(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  if (modules.has(url.href)) return modules.get(url.href);
  const compiled = transformSync(fs.readFileSync(url, "utf8"), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
    module: { type: "commonjs" },
  }).code;
  const context = {
    exports: {}, console,
    localStorage: { getItem: () => "" },
    require(name) {
      if (name === "react") return React;
      if (name === "react-dom/server") return ReactDOMServer;
      if (name === "qrcode.react") return QRCode;
      if (name.endsWith("/orderItemDisplayName")) return displayNames;
      if (name.endsWith("/Receipt")) return loadJsx("../../components/MainComponents/Receipt.jsx");
      if (name.endsWith("/posAuthenticatedFetch")) return {
        posAuthenticatedFetch: () => assert.fail("Rendering a receipt must not perform a request"),
      };
      assert.fail(`Unexpected receipt dependency: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context, { filename: url.pathname });
  modules.set(url.href, context.module.exports);
  return context.module.exports;
}

const items = Object.freeze([
  Object.freeze({ ID: 1, product_id: "HALF-SKU-1", item_name: 'HONEY <GARLIC> & "CHILI" HALF',
    selling_price: "267.50", sales_quantity: "1", unit_of_measure: "PC", isDiscountable: "Yes" }),
  Object.freeze({ ID: 2, product_id: "HALF-SKU-2", item_name: "JAMAICAN JERK HALF",
    selling_price: "275.00", sales_quantity: "1", unit_of_measure: "PC", isDiscountable: "Yes" }),
]);
const transaction = Object.freeze({ transaction_id: "TX-1", transaction_date: "2026-10-21", Discount: 0 });
const computed = Object.freeze({ grossTotal: 542.5, totalAmountDue: 569.63, totalPaid: 600,
  changeAmount: 30.37, vatableSales: 484.38, vatableSalesVat: 58.12, totalVatExemption: 0 });
const originalItems = JSON.stringify(items);

function assertPresentation(html) {
  assert.match(html, /HONEY &lt;GARLIC&gt; &amp; &quot;CHILI&quot; \(COMBINE FLAVOR\)/iu);
  assert.match(html, /JAMAICAN JERK \(COMBINE FLAVOR\)/iu);
  assert.doesNotMatch(html, /<GARLIC>/iu, "product text must remain HTML-escaped");
  assert.doesNotMatch(html, /CHILI&quot; HALF|JAMAICAN JERK HALF/iu);
  assert.match(html, /267\.50/);
  assert.match(html, /275\.00/);
  assert.match(html, /542\.50/);
  assert.equal(JSON.stringify(items), originalItems, "printing must retain the original SKU names and amounts");
}

test("order and billing receipts rename display labels while retaining real rows and totals", () => {
  const { BuildOrderReceiptHtml, BuildBillingReceiptHtml } = loadJsx("../BuildOrderlistPrintHtml.jsx");
  const cart = Object.freeze(items.map(item => Object.freeze({
    code: item.product_id, name: item.item_name, price: Number(item.selling_price), quantity: 1,
  })));
  const order = BuildOrderReceiptHtml({ productcart: { items: cart }, totalPrice: 542.5,
    tableselected: "D1", transactionId: "TX-1" });
  assertPresentation(order);
  assert.match(order, /HALF-SKU-1/);
  assert.match(order, /HALF-SKU-2/);
  assert.equal(cart[0].name, items[0].item_name);
  assertPresentation(BuildBillingReceiptHtml({ transaction, detailedproduct: items }));
});

test("discount and payment receipts preserve all monetary values after display-name formatting", () => {
  const { BuildPrintableDiscountReceiptHtml } = loadJsx("../BuildPrintableDiscountReceiptHtml.jsx");
  const { BuildPosPaymentReceiptHtml } = loadJsx("../BuildPosPaymentReceiptHtml.jsx");
  const PaymentReceipt = loadJsx("../../components/MainComponents/PosPaymentReceipt.jsx").default;
  const props = { transaction, items, computed };
  const receipts = [
    BuildPrintableDiscountReceiptHtml(props),
    BuildPosPaymentReceiptHtml(props),
    ReactDOMServer.renderToStaticMarkup(React.createElement(PaymentReceipt, props)),
  ];
  for (const html of receipts) {
    assertPresentation(html);
    assert.match(html, /569\.63/);
    assert.match(html, /484\.38/);
    assert.match(html, /58\.12/);
  }
});

test("QR slip formatting preserves its encoded SKU, price and copy count", () => {
  const { BuildQrItemsHtml } = loadJsx("../BuildQrItemsHtml.jsx");
  const item = Object.freeze({ name: '5 CHEESE HALF 12"', code: "HALF-SKU-3", price: 475,
    qrValue: "ITEM:HALF-SKU-3|TABLE:D1|TX:TX-1|NO:1", qrCopyPerItem: 2, qrCopyNumber: 1, qrItemNumber: 1 });
  const html = BuildQrItemsHtml({ items: [item], table: "D1", transactionId: "TX-1" });
  assert.match(html, /5 CHEESE 12&quot; \(COMBINE FLAVOR\)/);
  assert.match(html, /HALF-SKU-3/);
  assert.match(html, /P475\.00/);
  assert.match(html, /ITEM 1 COPY 1\/2/);
  const expectedQr = ReactDOMServer.renderToStaticMarkup(React.createElement(QRCode.QRCodeSVG,
    { value: item.qrValue, size: 140, includeMargin: true }));
  assert(html.includes(expectedQr), "display labels must not alter the QR payload");
  assert.equal(item.name, '5 CHEESE HALF 12"');
});

test("void and refund receipts escape renamed items and preserve saved subtotals and quantities", () => {
  const voidItems = Object.freeze([
    Object.freeze({ ...items[0], vatable: "Yes" }),
    Object.freeze({ ...items[1], sales_quantity: "2", subtotal: "300.00", vatable: "No" }),
  ]);
  const source = JSON.stringify(voidItems);
  const receiptComputed = Object.freeze({ grossTotal: 567.5, totalAmountDue: 560 });
  for (const type of ["void", "refund"]) {
    const html = buildVoidRefundHtml({ type, transaction, items: voidItems, computed: receiptComputed });
    assert.match(html, /HONEY &lt;GARLIC&gt; &amp; &quot;CHILI&quot; \(COMBINE FLAVOR\) \(D\)/);
    assert.match(html, /JAMAICAN JERK \(COMBINE FLAVOR\) \(D\)/);
    assert.doesNotMatch(html, /<GARLIC>|JAMAICAN JERK HALF/);
    assert.match(html, /<td class="qty">1<\/td>\s*<td class="amt">267\.50V<\/td>/);
    assert.match(html, /<td class="qty">2<\/td>\s*<td class="amt">300\.00<\/td>/);
    assert.match(html, /567\.50/);
    assert.match(html, /560\.00/);
    assert(html.includes(`${type.toUpperCase()} RECEIPT`));
    assert.equal(JSON.stringify(voidItems), source);
  }
});

test("receipt and QR item labels hide CCL while preserving escaped flavor names and saved data", () => {
  const flavor = Object.freeze({ product_id: "FLAVOR-1", item_name: 'CCL <ALMOND> & "VANILLA"',
    selling_price: 25, sales_quantity: 1, unit_of_measure: "PC" });
  const cart = Object.freeze({ code: flavor.product_id, name: flavor.item_name, price: 25, quantity: 1 });
  const props = { transaction, items: [flavor], computed: { grossTotal: 25, totalAmountDue: 25 } };
  const { BuildOrderReceiptHtml, BuildBillingReceiptHtml } = loadJsx("../BuildOrderlistPrintHtml.jsx");
  const { BuildPrintableDiscountReceiptHtml } = loadJsx("../BuildPrintableDiscountReceiptHtml.jsx");
  const { BuildPosPaymentReceiptHtml } = loadJsx("../BuildPosPaymentReceiptHtml.jsx");
  const { BuildQrItemsHtml } = loadJsx("../BuildQrItemsHtml.jsx");
  const PaymentReceipt = loadJsx("../../components/MainComponents/PosPaymentReceipt.jsx").default;
  for (const html of [
    BuildOrderReceiptHtml({ productcart: [cart], totalPrice: 25 }),
    BuildBillingReceiptHtml({ transaction, detailedproduct: [flavor] }),
    BuildPrintableDiscountReceiptHtml(props),
    BuildPosPaymentReceiptHtml(props),
    buildVoidRefundHtml(props),
    BuildQrItemsHtml({ items: [{ ...cart, qrValue: "ITEM:FLAVOR-1" }] }),
    ReactDOMServer.renderToStaticMarkup(React.createElement(PaymentReceipt, props)),
  ]) {
    assert.match(html, /&lt;ALMOND&gt; &amp; &quot;VANILLA&quot;/);
    assert.doesNotMatch(html, /CCL |<ALMOND>/);
    assert.match(html, /25\.00/);
  }
  assert.equal(flavor.item_name, 'CCL <ALMOND> & "VANILLA"');
  assert.equal(cart.name, flavor.item_name);
});
