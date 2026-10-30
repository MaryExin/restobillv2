import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import * as ReactDOMServer from "react-dom/server";
import { transformSync } from "@swc/core";
import * as discountMath from "../../../utils/discountLineMath.js";
import * as displayNames from "../../../utils/orderItemDisplayName.js";

const root = new URL("../../../../", import.meta.url);
const require = createRequire(import.meta.url);
const noop = () => {};
const flush = async () => { for (let index = 0; index < 16; index += 1) await Promise.resolve(); };
const all = (tree, predicate) => Array.isArray(tree) ? tree.flatMap(node => all(node, predicate))
  : tree && typeof tree === "object" ? [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)] : [];
const child = (tree, name) => all(tree, node => node.type?.name === name)[0];

function compile(relative, modules, globals = {}) {
  const filename = fileURLToPath(new URL(relative, root));
  const source = transformSync(fs.readFileSync(filename, "utf8"), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
    module: { type: "commonjs" },
  }).code;
  const context = {
    exports: {}, console, localStorage: { getItem: () => "" }, ...globals,
    require(name) {
      if (Object.hasOwn(modules, name)) return modules[name];
      if (name.startsWith("react-icons/")) return new Proxy({}, { get: (_, key) => key });
      assert.fail(`Unexpected dependency: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}

function paymentHarness(details) {
  const states = [], posted = [], printed = [];
  let index = 0, effects = [];
  const hooks = {
    ...React,
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }];
    },
    useEffect(effect) { effects.push(effect); },
    useMemo(factory) { return factory(); },
  };
  const modules = {
    react: hooks,
    "./Common/ButtonComponent": noop,
    "../../utils/BuildPosPaymentReceiptHtml": noop,
    "../../utils/printWithPdfFallback": { printWithPdfFallback: ({ attempt }) => attempt() },
    "../../hooks/useGetDefaultPrinter": () => "",
    "../../hooks/useBusinessInfo": () => ({ businessInfo: {}, isBusInfoLoading: false }),
    "../../utils/discountLineMath": discountMath,
    "../../utils/orderItemDisplayName": displayNames,
    "../../utils/posAuthenticatedFetch": { posAuthenticatedFetch: () => assert.fail("Unexpected authenticated request") },
  };
  const component = compile("src/components/MainComponents/TransactionPaymentModal.jsx", modules, {
    AbortController, setTimeout: noop,
    localStorage: { getItem: key => ({ user_id: "TEST", username: "Test cashier" })[key] || "" },
    window: { electronAPI: {
      printReceipt: noop,
      pospaymentreceipt: async payload => { printed.push(payload); return { success: true }; },
    } },
    fetch: async (url, options) => {
      if (url.endsWith("/pos_payment_read_transaction_details.php")) return { ok: true, json: async () => details };
      if (url.endsWith("/pos_payment_post_transaction.php")) {
        posted.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ success: true, invoice_no: "TEST-INVOICE" }) };
      }
      assert.fail(`Unexpected payment request: ${url}`);
    },
  }).default;
  const props = { isOpen: true, transaction: details.transaction_summary, apiHost: "http://pos.test",
    isDark: false, modeOfPayments: [{ mop: "Cash" }], chargeOptions: [], onClose: noop, onSaved: noop };
  return {
    posted, printed,
    render() {
      index = 0; effects = [];
      const tree = component(props);
      return { tree, effects, computed: child(tree, "DiscountSetupModal").props.computed };
    },
  };
}

function savedBill({ sales = 4000, discount = 0, vatExemption = 0, service = 0, corkage = 250 } = {}) {
  const charges = [
    ...(service > 0 ? [{ particulars: "Service charge", amount: service, reference: "AUTO" }] : []),
    ...(corkage > 0 ? [{ particulars: "Corkage", amount: corkage, reference: "AUTO" }] : []),
  ];
  const due = sales - discount - vatExemption + service + corkage;
  return {
    transaction_summary: { transaction_id: "CORKAGE-TEST", billing_no: 1, invoice_no: 0,
      Category_Code: "TEST", Unit_Code: "TEST", order_type: "DINE IN", customer_head_count: 1,
      TotalSales: sales, Discount: discount, OtherCharges: service + corkage, TotalAmountDue: due,
      VATableSales: 3000, VATableSales_VAT: 360, VATExemptSales: 0, VATExemptSales_VAT: vatExemption, VATZeroRatedSales: 0 },
    items: [{ ID: 1, product_id: "ITEM-1", item_name: "Test meal", selling_price: sales, sales_quantity: 1,
      vatable: "Yes", isDiscountable: "Yes" }],
    payments: [], other_charges: charges,
    discount_rows: [], discount_counts: { senior: 0, pwd: 0, naac: 0, soloParent: 0, manual: 0 },
  };
}

async function loadSavedBill(details) {
  const harness = paymentHarness(details);
  let state = harness.render();
  const load = state.effects.find(effect => effect.toString().includes("pos_payment_read_transaction_details.php"));
  assert(load, "exercise the real saved billing detail loader");
  load(); await flush(); state = harness.render();
  return { harness, state };
}

test("saved fixed Corkage loads into payment, preserves the 4000 + 250 total and posts a named charge", async () => {
  const details = savedBill();
  const { harness, state: initial } = await loadSavedBill(details);
  let state = initial;
  assert.equal(state.computed.grossTotal, 4000);
  assert.equal(state.computed.totalOtherCharges, 250);
  assert.equal(state.computed.totalAmountDue, 4250);
  assert.equal(state.computed.totalDiscount, 0);
  assert.equal(state.computed.vatableSales, 3000);
  assert.equal(state.computed.vatableSalesVat, 360);
  const charges = child(state.tree, "OtherChargesModal").props.rows;
  assert.deepEqual(Array.from(charges, row => [row.particulars, Number(row.amount), row.reference]), [["Corkage", 250, "AUTO"]]);
  child(state.tree, "InputPaymentsModal").props.setPayments([{ payment_method: "Cash", payment_amount: 4500, payment_reference: "" }]);
  state = harness.render();
  const confirm = all(state.tree, node => node.props?.title === "Confirm Payment Submission")[0];
  await confirm.props.onYes();
  assert.equal(harness.posted.length, 1);
  const payload = harness.posted[0];
  assert.deepEqual(payload.cart_items, [{ databaseID: 1, sales_quantity: 1, selling_price: 4000 }],
    "payment sends the loaded item identity and quantity so a concurrent split cannot post a stale receipt");
  assert.equal(payload.OtherCharges, 250);
  assert.equal(payload.TotalAmountDue, 4250);
  assert.equal(payload.change_amount, 250);
  assert.deepEqual(payload.other_charges.map(row => [row.particulars, row.amount]), [["Corkage", 250]]);
  assert.equal(payload.other_charges[0].reference, "AUTO", "payment preserves billing ownership for a later re-bill");
  state = harness.render();
  child(state.tree, "SuccessModal").props.onPrint();
  state = harness.render();
  assert.equal(child(state.tree, "ChangeDueModal").props.isOpen, true);
  await child(state.tree, "ChangeDueModal").props.onClose();
  assert.equal(harness.printed.length, 1);
  assert.equal(harness.printed[0].computed.totalAmountDue, 4250);
  assert.deepEqual(Array.from(harness.printed[0].otherCharges, row => [row.particulars, row.amount]), [["Corkage", 250]]);
});

test("editing payment charges retains saved discounts, VAT and service charge while Corkage adds once", async () => {
  const { harness, state: initial } = await loadSavedBill(savedBill({ sales: 4400, discount: 300, vatExemption: 100, service: 200 }));
  let state = initial;
  assert.equal(state.computed.totalAmountDue, 4450);
  const charges = child(state.tree, "OtherChargesModal");
  charges.props.setRows([...charges.props.rows, { particulars: "Delivery", amount: 50, reference: "manual" }]);
  state = harness.render();
  assert.equal(state.computed.totalOtherCharges, 500);
  assert.equal(state.computed.totalAmountDue, 4500);
  assert.equal(state.computed.totalDiscount, 300);
  assert.equal(state.computed.totalVatExemption, 100);
  assert.equal(state.computed.vatableSales, 3000);
  assert.equal(state.computed.vatableSalesVat, 360);
  assert.equal(state.computed.serviceChargeAmount, 0, "payment must not recompute percentage service charges");
});

async function nativePrinterHarness() {
  const handlers = new Map(), printed = [], errors = [];
  const electronDirectory = fileURLToPath(new URL("electron/", root));
  const filename = path.join(electronDirectory, "main.cjs");
  const app = new EventEmitter();
  Object.assign(app, { isPackaged: false, whenReady: () => Promise.resolve(), quit: noop });
  class Window extends EventEmitter {
    constructor() { super(); this.webContents = { openDevTools: noop }; }
    maximize() {}
    loadURL() {}
    static getAllWindows() { return []; }
  }
  const context = vm.createContext({
    require(name) {
      if (name === "electron") return {
        app, BrowserWindow: Window, ipcMain: { handle: (name, handler) => handlers.set(name, handler), on: noop },
        protocol: { registerSchemesAsPrivileged: noop },
        session: { defaultSession: { webRequest: { onHeadersReceived: noop } } }, screen: {}, dialog: {},
      };
      if (name === "fs") return { existsSync: () => true, readFileSync: () => "{}" };
      if (name === "net") return { Socket: class { constructor() { throw new Error("Tests must never access a printer socket"); } } };
      if (["serialport", "escpos-usb"].includes(name)) throw new Error("Tests must never access a physical printer");
      return require(name);
    },
    process: { platform: "win32", resourcesPath: "/test-resources", on: noop },
    __dirname: electronDirectory, Buffer, setTimeout, clearTimeout,
    console: { log: noop, warn: noop, error: (...args) => errors.push(args) },
    capturePrint: async buffer => { printed.push(buffer.toString("ascii")); return { success: true }; },
  });
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, {
    filename, importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  vm.runInContext("writeEscposBuffer = capturePrint;", context);
  await new Promise(resolve => setImmediate(resolve));
  return { handlers, printed, errors };
}

test("billing and payment HTML/native receipts print fixed Corkage once and retain the final amount", async () => {
  const modules = { react: React, "react-dom/server": ReactDOMServer,
    "./orderItemDisplayName": displayNames };
  const { BuildPrintableDiscountReceiptHtml } = compile("src/utils/BuildPrintableDiscountReceiptHtml.jsx", modules);
  const { BuildPosPaymentReceiptHtml } = compile("src/utils/BuildPosPaymentReceiptHtml.jsx", modules);
  const PaymentReceipt = compile("src/components/MainComponents/PosPaymentReceipt.jsx", {
    react: React, "../../utils/orderItemDisplayName": displayNames,
    "../../utils/posAuthenticatedFetch": { posAuthenticatedFetch: () => assert.fail("Receipt rendering must not request data") },
  }).default;
  const native = await nativePrinterHarness();
  for (const service of [0, 200]) {
    const details = savedBill({ service });
    const amountDue = 4250 + service;
    const payload = {
      transaction: details.transaction_summary, items: details.items,
      otherCharges: details.other_charges, payments: [],
      computed: { grossTotal: 4000, netAfterDiscount: 4000, totalDiscount: 0, totalVatExemption: 0,
        totalOtherCharges: service + 250, totalAmountDue: amountDue, vatableSales: 3000, vatableSalesVat: 360,
        appliedCharges: details.other_charges.map((charge, index) => ({
          id: index, particulars: charge.particulars, rate_type: "Fixed", rate: charge.amount, computedAmount: charge.amount,
        })) },
    };
    const original = JSON.stringify(payload);
    const htmlReceipts = [BuildPrintableDiscountReceiptHtml(payload), BuildPosPaymentReceiptHtml(payload),
      ReactDOMServer.renderToStaticMarkup(React.createElement(PaymentReceipt, payload))];
    for (const html of htmlReceipts) {
      const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      assert.equal((text.match(/CORKAGE:/g) || []).length, 1);
      assert.match(text, /CORKAGE: 250\.00/);
      assert(text.includes(amountDue.toLocaleString("en-PH", { minimumFractionDigits: 2 })));
      assert(text.includes("3,000.00") && text.includes("360.00"), "receipt retains the supplied VAT values");
    }
    for (const channel of ["print-escposdiscount", "print-escpospospaymentreceipt"]) {
      const result = await native.handlers.get(channel)({}, payload);
      assert.equal(result.success, true, `${channel}: ${JSON.stringify(native.errors)}`);
      const text = native.printed.at(-1);
      assert.equal((text.match(/CORKAGE:/g) || []).length, 1);
      assert.match(text, /CORKAGE:\s+250\.00/);
      assert(text.includes(amountDue.toLocaleString("en-PH", { minimumFractionDigits: 2 })));
      assert(text.includes("3,000.00") && text.includes("360.00"));
    }
    assert.equal(JSON.stringify(payload), original, "receipts do not change saved charges or tax values");
  }
  assert.equal(native.errors.length, 0);
});
