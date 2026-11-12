import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as discountLineMath from "../../../utils/discountLineMath.js";
import * as serviceChargeMath from "../../../utils/serviceChargeMath.js";
import * as serviceChargeDefaults from "../../../utils/serviceChargeDefaults.js";
import * as orderItemDisplayName from "../../../utils/orderItemDisplayName.js";
import * as billDocument from "../../../utils/billDocument.js";

// Run the actual modal's hooks, event handlers, math and API lifecycle using the
// established Node/SWC approach. API and printer boundaries are isolated; these
// checks do not write to a real transaction or send a receipt to a printer.
const compiled = transformSync(fs.readFileSync(new URL("../ModalDiscountTransaction.jsx", import.meta.url), "utf8"), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;
const clone = (value) => JSON.parse(JSON.stringify(value));
const transaction = Object.freeze({
  transaction_id: "CORKAGE-TEST", Category_Code: "TEST", Unit_Code: "TEST-BRANCH",
  customer_head_count: 1, order_type: "Dine In", cashier: "Test cashier",
});
const baseRecord = () => ({
  items: [{ ID: 1, product_id: "TEST-MEAL", item_name: "Test meal", selling_price: 5000,
    sales_quantity: 1, vatable: "No", isDiscountable: "Yes" }],
  transaction_summary: { customer_head_count: 1 },
  discount_counts: { senior: 0, pwd: 0, naac: 0, soloParent: 0, manual: 1 },
  discount_rows: [{ discount_type: "Manual Discount", discount_amount: 1000, qualified_count: 1 }],
  other_charge_rows: [],
});
const receiptRecord = () => ({
  items: [175, 535, 350, 345, 355].map((selling_price, i) => ({
    ID: i + 1, product_id: `RECEIPT-${i + 1}`, item_name: `Receipt item ${i + 1}`,
    selling_price, sales_quantity: 1, vatable: "Yes", isDiscountable: "Yes",
  })),
  transaction_summary: { customer_head_count: 4 },
  discount_counts: { senior: 1, pwd: 0, naac: 0, soloParent: 0, manual: 0 },
  discount_rows: [], other_charge_rows: [],
});
const serviceCharge = Object.freeze({ ID: 7, particulars: "SERVICE CHARGE", amount: 5,
  rate_type: "Percentage", is_enabled: 1 });

function mockApi({ record = baseRecord(), charges = [], enabled = false,
  basis = serviceChargeMath.DEFAULT_SERVICE_CHARGE_BASIS,
  saveFailure = false, acknowledgeCharges = true, printResult = { success: true },
  settingsResponses = {} } = {}) {
  const records = new Map([[transaction.transaction_id, clone(record)]]);
  const calls = [], prints = [], events = [], alerts = [];
  const response = (data, ok = true) => ({ ok, json: async () => clone(data) });
  const api = {
    calls, prints, events, alerts, records,
    async fetch(url, options = {}) {
      const endpoint = new URL(url).pathname;
      const payload = options.body ? JSON.parse(options.body) : null;
      calls.push({ endpoint, method: options.method || "GET", payload });
      if (Object.hasOwn(settingsResponses, endpoint)) return response(settingsResponses[endpoint]);
      if (endpoint === "/api/transaction_discount_items.php") {
        return response({ success: true, ...(records.get(payload.transaction_id) || baseRecord()) });
      }
      if (endpoint === "/api/pos_service_charge.php") return response({ success: true, data: {
        service_charge_enabled: enabled, service_charge_basis: basis,
      } });
      if (endpoint === "/api/pos_manage_other_charges.php") return response({ success: true, charges });
      if (endpoint === "/api/pos_discount_types.php") return response({ success: true, data: { discount_types: [] } });
      if (endpoint === "/api/pos_discount_ceiling.php") return response({ success: true, data: { discount_ceiling: 0 } });
      if (endpoint === "/api/pos_discount_mode.php") return response({ success: true, data: { discount_mode: "PerCustomer" } });
      if (endpoint === "/api/pos_customer_info_settings.php") return response({ success: true, data: { customer_info_enabled: false } });
      if (endpoint === "/api/billing.php") {
        events.push("save-request");
        if (saveFailure) return response({ status: "error", message: "Billing save failed." }, false);
        if (acknowledgeCharges && Array.isArray(payload.billing_charges)) {
          const current = records.get(payload.transaction_id) || baseRecord();
          records.set(payload.transaction_id, { ...current,
            transaction_summary: { ...current.transaction_summary, billing_no: "CORKAGE-BILL" },
            other_charge_rows: [
            ...current.other_charge_rows.filter((row) => row.reference !== "AUTO"),
            ...payload.billing_charges.map((row) => ({ ...row, reference: "AUTO" })),
          ] });
          events.push("charges-persisted");
        }
        return response({ status: "success", billing_no: "CORKAGE-BILL", billing_charges_saved: acknowledgeCharges });
      }
      throw new Error(`Unexpected API call: ${options.method || "GET"} ${endpoint}`);
    },
    electronAPI: {
      getPrinters: async () => [{ name: "Test printer", isDefault: true }],
      async printEscposDiscount(payload) {
        events.push("print");
        prints.push(clone(payload));
        return printResult;
      },
    },
  };
  return api;
}

function harness(api = mockApi()) {
  const states = [], memoSlots = [], effectSlots = [];
  let stateIndex = 0, memoIndex = 0, effectIndex = 0, dirty = false, scheduled = [];
  const sameDependencies = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((entry, index) => Object.is(entry, b[index]));
  const hooks = {
    ...React,
    useState(initial) {
      const slot = stateIndex++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (value) => {
        const next = typeof value === "function" ? value(states[slot]) : value;
        if (!Object.is(next, states[slot])) { states[slot] = next; dirty = true; }
      }];
    },
    useMemo(factory, dependencies) {
      const slot = memoIndex++;
      if (!sameDependencies(memoSlots[slot]?.dependencies, dependencies)) {
        memoSlots[slot] = { dependencies, value: factory() };
      }
      return memoSlots[slot].value;
    },
    useEffect(effect, dependencies) {
      const slot = effectIndex++;
      if (!sameDependencies(effectSlots[slot]?.dependencies, dependencies)) {
        scheduled.push(() => {
          effectSlots[slot]?.cleanup?.();
          effectSlots[slot] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const modules = {
    react: hooks,
    "./Common/ButtonComponent": (props) => React.createElement("button", props),
    "../../hooks/useGetDefaultPrinter": () => "Test printer",
    "../../hooks/useBusinessInfo": () => ({ businessInfo: { business_name: "Test restaurant" }, isBusInfoLoading: false }),
    "../../utils/discountLineMath": discountLineMath,
    "../../utils/serviceChargeMath": serviceChargeMath,
    "../../utils/serviceChargeDefaults": serviceChargeDefaults,
    "../../utils/orderItemDisplayName": orderItemDisplayName,
    "../../utils/billDocument": billDocument,
    "../../utils/BuildPrintableDiscountReceiptHtml": { BuildPrintableDiscountReceiptHtml: () => "<html>Receipt</html>" },
    "../../utils/printWithPdfFallback": { printWithPdfFallback: ({ attempt }) => attempt() },
  };
  const context = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: () => "" }, fetch: api.fetch,
    window: { electronAPI: api.electronAPI }, alert: (message) => api.alerts.push(message),
    require(name) {
      if (name.startsWith("react-icons/")) return new Proxy({}, { get: (_, key) => key });
      assert(name in modules, `Unexpected modal import ${name}`);
      return modules[name];
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  const component = context.module.exports.default;
  let props = { isOpen: true, onClose() {}, transaction, dateFrom: "2026-10-22", apiHost: "http://pos.test", isDark: false };
  let tree;
  return {
    api,
    get tree() { return tree; },
    async render(nextProps = {}) {
      props = { ...props, ...nextProps };
      for (let pass = 0; pass < 25; pass++) {
        stateIndex = memoIndex = effectIndex = 0;
        dirty = false;
        scheduled = [];
        tree = component(props);
        scheduled.forEach((effect) => effect());
        // Mock fetch responses resolve immediately, but nested Promise.all and
        // JSON parsing still need their normal microtask turns before rerender.
        for (let tick = 0; tick < 30; tick++) await Promise.resolve();
        if (!dirty) return tree;
      }
      assert.fail("Modal effects failed to settle");
    },
    async changeCorkage(value) {
      corkageInput(tree).props.onChange({ target: { value } });
      return this.render();
    },
    async print() {
      const control = action(tree, "Print Bill");
      assert(control, "Print Bill action exists");
      await control.props.onClick();
      return this.render();
    },
  };
}

function all(tree, predicate, result = []) {
  if (Array.isArray(tree)) tree.forEach((node) => all(node, predicate, result));
  else if (tree && typeof tree === "object") {
    if (predicate(tree)) result.push(tree);
    all(tree.props?.children, predicate, result);
  }
  return result;
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const action = (tree, label) => all(tree, (node) => typeof node.props?.onClick === "function" && text(node).trim() === label)[0];
const summaryRow = (tree, label) => all(tree, (node) => node.type === "div" && React.Children.toArray(node.props.children)
  .some((child) => child?.type === "span" && text(child).trim() === label))[0];
const lastBilling = (api) => api.calls.filter((call) => call.endpoint === "/api/billing.php").at(-1)?.payload;
function corkageInput(tree) {
  const label = all(tree, (node) => node.type === "label" && text(node).trim() === "Corkage")[0];
  assert(label?.props.htmlFor, "Corkage has an associated label");
  const input = all(tree, (node) => node.type === "input" && node.props.id === label.props.htmlFor)[0];
  assert(input, "Corkage input is present");
  return input;
}
const savedRows = (api, id = transaction.transaction_id) => api.records.get(id)?.other_charge_rows || [];
const corkageRows = (rows) => rows.filter((row) => row.particulars === "Corkage");

test("Corkage adds ₱250 after a ₱1,000 discount, saves ₱4,250 before printing and supplies a named fixed receipt charge", async () => {
  const app = harness();
  await app.render();
  const input = corkageInput(app.tree);
  assert.equal(input.props.type, "number");
  assert.equal(Number(input.props.min), 0);
  assert.equal(Number(input.props.step), 0.01);
  assert.equal(Number(input.props.value || 0), 0);
  assert.match(text(summaryRow(app.tree, "Amount Due")), /4,000\.00/);
  await app.changeCorkage("250");
  assert.match(text(summaryRow(app.tree, "Amount Due")), /4,250\.00/);
  assert.match(text(summaryRow(app.tree, "Total Discount")), /1,000\.00/);
  await app.print();
  const billing = lastBilling(app.api);
  assert.equal(billing.TotalSales, 5000);
  assert.equal(billing.Discount, 1000);
  assert.equal(billing.OtherCharges, 250);
  assert.equal(billing.TotalAmountDue, 4250);
  assert.deepEqual(billing.billing_charges, [{ particulars: "Corkage", amount: 250 }]);
  assert.deepEqual(app.api.events, ["save-request", "charges-persisted", "print"]);
  assert.equal(app.api.prints.length, 1);
  const printed = app.api.prints[0];
  assert.equal(printed.dateFrom, "2026-10-22");
  assert.equal(printed.computed.totalAmountDue, 4250);
  assert.equal(printed.computed.totalDiscount, 1000);
  assert.equal(printed.computed.totalVatExemption, 0);
  assert.equal(printed.computed.totalOtherCharges, 250);
  assert.deepEqual(printed.computed.appliedCharges.find((row) => row.id === "corkage"), {
    id: "corkage", particulars: "Corkage", rate_type: "Fixed", rate: 250, computedAmount: 250,
  });
  assert.deepEqual(corkageRows(savedRows(app.api)), [{ particulars: "Corkage", amount: 250, reference: "AUTO" }]);
  assert(!app.api.calls.some((call) => call.endpoint === "/api/pos_save_transaction_charges.php"), "no post-print charge write");
  assert.deepEqual(app.api.alerts, []);
});

test("empty or zero Corkage removes a previously saved AUTO charge and keeps the discounted total", async () => {
  for (const value of ["", "0"]) {
    const record = baseRecord();
    record.other_charge_rows = [{ particulars: "Corkage", amount: "250.00", reference: "AUTO" }];
    const app = harness(mockApi({ record }));
    await app.render();
    assert.equal(Number(corkageInput(app.tree).props.value), 250);
    await app.changeCorkage(value);
    assert.match(text(summaryRow(app.tree, "Amount Due")), /4,000\.00/);
    await app.print();
    assert.equal(lastBilling(app.api).OtherCharges, 0);
    assert.equal(lastBilling(app.api).TotalAmountDue, 4000);
    assert.deepEqual(lastBilling(app.api).billing_charges, []);
    assert.deepEqual(corkageRows(savedRows(app.api)), []);
    assert(!app.api.prints[0].computed.appliedCharges.some((row) => row.id === "corkage"));
  }
});

test("Corkage restores from saved rows on reopening and does not leak into another transaction or unsaved reopening", async () => {
  const app = harness();
  await app.render();
  await app.changeCorkage("250.50");
  await app.print();
  await app.render({ isOpen: false });
  await app.render({ isOpen: true });
  assert.equal(Number(corkageInput(app.tree).props.value), 250.5);
  assert.match(text(summaryRow(app.tree, "Amount Due")), /4,250\.50/);
  await app.render({ transaction: { ...transaction, transaction_id: "SECOND-CORKAGE-TEST" } });
  assert.equal(Number(corkageInput(app.tree).props.value || 0), 0);
  assert.match(text(summaryRow(app.tree, "Amount Due")), /4,000\.00/);
  await app.changeCorkage("99");
  await app.render({ isOpen: false });
  await app.render({ isOpen: true });
  assert.equal(Number(corkageInput(app.tree).props.value || 0), 0);
});

test("negative, nonfinite and sub-cent Corkage values cannot be billed or printed", async () => {
  for (const value of ["-1", "NaN", "Infinity", "1e309", "250.005"]) {
    const app = harness();
    await app.render();
    await app.changeCorkage(value);
    assert.equal(action(app.tree, "Print Bill").props.disabled, true, `${value} disables print`);
    // An event handler must also guard against stale/programmatic invocation.
    await app.print();
    assert.equal(lastBilling(app.api), undefined, `${value} sends no billing write`);
    assert.equal(app.api.prints.length, 0);
    assert.doesNotMatch(text(summaryRow(app.tree, "Amount Due")), /NaN|Infinity/);
  }
});

test("Corkage does not change statutory discounts, VAT exemption or either service-charge basis", async () => {
  for (const [basis, serviceAmount, amountDue] of [
    [serviceChargeMath.DEFAULT_SERVICE_CHARGE_BASIS, 72.96, 1707.25],
    [serviceChargeMath.VAT_EXCLUSIVE_LESS_DISCOUNT, 74.64, 1708.93],
  ]) {
    const app = harness(mockApi({ record: receiptRecord(), charges: [serviceCharge], enabled: true, basis }));
    await app.render();
    action(app.tree, "OFF").props.onClick();
    await app.render();
    const priorBase = text(summaryRow(app.tree, "Service charge base"));
    await app.changeCorkage("250");
    assert.equal(text(summaryRow(app.tree, "Service charge base")), priorBase);
    await app.print();
    const billing = lastBilling(app.api);
    assert.equal(billing.Discount, 78.57);
    assert.equal(billing.VATExemptSales_VAT, 47.14);
    assert.equal(billing.OtherCharges, serviceAmount + 250);
    assert(Math.abs(billing.TotalAmountDue - amountDue - 250) < 0.005);
    assert.deepEqual(billing.billing_charges, [
      { particulars: "SERVICE CHARGE", amount: serviceAmount }, { particulars: "Corkage", amount: 250 },
    ]);
    assert.equal(app.api.prints[0].computed.appliedCharges.find((row) => row.id === serviceCharge.ID).computedAmount, serviceAmount);
  }
});

test("reopening restores service toggles by AUTO particulars and preserves separate manual charges in totals", async () => {
  const record = baseRecord();
  const manualCharge = { ID: 92, particulars: "Private room", amount: "80.00", reference: "MANUAL" };
  record.other_charge_rows = [
    { particulars: "Corkage", amount: "250.00", reference: "AUTO" },
    { particulars: "SERVICE CHARGE", amount: "178.57", reference: "AUTO" }, manualCharge,
  ];
  const app = harness(mockApi({ record, charges: [serviceCharge], enabled: true }));
  await app.render();
  assert(action(app.tree, "ON"), "persisted service charge is enabled after load");
  assert.equal(Number(corkageInput(app.tree).props.value), 250);
  assert.match(text(summaryRow(app.tree, "Amount Due")), /4,508\.57/);
  await app.print();
  const billing = lastBilling(app.api);
  assert.equal(billing.OtherCharges, 508.57);
  assert.equal(billing.TotalAmountDue, 4508.57);
  assert.deepEqual(billing.billing_charges, [
    { particulars: "SERVICE CHARGE", amount: 178.57 }, { particulars: "Corkage", amount: 250 },
  ], "manual rows are not resent as AUTO charges");
  assert.deepEqual(savedRows(app.api).find((row) => row.ID === 92), manualCharge);
});

test("printer failure or cancellation happens after Corkage persistence and reopening restores it", async () => {
  for (const printResult of [{ success: false, message: "Printer unavailable." }, { success: false, canceled: true }]) {
    const app = harness(mockApi({ printResult }));
    await app.render();
    await app.changeCorkage("250");
    await app.print();
    assert.deepEqual(app.api.events, ["save-request", "charges-persisted", "print"]);
    assert.equal(corkageRows(savedRows(app.api))[0].amount, 250);
    await app.render({ isOpen: false });
    await app.render({ isOpen: true });
    assert.equal(Number(corkageInput(app.tree).props.value), 250);
    assert.match(text(summaryRow(app.tree, "Amount Due")), /4,250\.00/);
  }
});

test("failed billing save or missing charge-save acknowledgement prevents printing", async () => {
  for (const options of [{ saveFailure: true }, { acknowledgeCharges: false }]) {
    const app = harness(mockApi(options));
    await app.render();
    await app.changeCorkage("250");
    await app.print();
    assert(lastBilling(app.api), "billing save is attempted");
    assert.equal(app.api.prints.length, 0);
    assert.deepEqual(corkageRows(savedRows(app.api)), []);
    assert(app.api.alerts.length > 0, "cashier sees the save failure");
    assert.equal(Number(corkageInput(app.tree).props.value), 250, "unsaved entry is retained for retry");
  }
});

test("an old or failed transaction-load response cannot silently discard saved charges when printing", async () => {
  for (const record of [
    { ...baseRecord(), other_charge_rows: undefined },
    { ...baseRecord(), success: false, message: "Transaction could not be loaded." },
  ]) {
    const app = harness(mockApi({ record }));
    await app.render();
    assert.equal(action(app.tree, "Print Bill").props.disabled, true);
    await app.print();
    assert.equal(lastBilling(app.api), undefined);
    assert.equal(app.api.prints.length, 0);
  }
});

test("malformed HTTP-200 charge settings block billing and preserve existing AUTO Corkage and service charges", async () => {
  const malformedResponses = [
    ["/api/pos_service_charge.php", {}],
    ["/api/pos_service_charge.php", { success: false, data: { service_charge_enabled: true } }],
    ["/api/pos_service_charge.php", { success: true, data: {} }],
    ["/api/pos_service_charge.php", { success: true, data: { service_charge_enabled: "true" } }],
    ["/api/pos_service_charge.php", { success: true, data: { service_charge_enabled: 1 } }],
    ["/api/pos_manage_other_charges.php", {}],
    ["/api/pos_manage_other_charges.php", { success: false, charges: [serviceCharge] }],
    ["/api/pos_manage_other_charges.php", { success: true, charges: null }],
    ["/api/pos_manage_other_charges.php", { success: true, charges: {} }],
    ["/api/pos_discount_mode.php", {}],
    ["/api/pos_discount_mode.php", { success: false, data: { discount_mode: "PerCustomer" } }],
    ["/api/pos_discount_mode.php", { success: true, data: {} }],
    ["/api/pos_discount_mode.php", { success: true, data: { discount_mode: "unknown" } }],
  ];
  for (const [endpoint, response] of malformedResponses) {
    const record = baseRecord();
    record.other_charge_rows = [
      { particulars: "Corkage", amount: "250.00", reference: "AUTO" },
      { particulars: "SERVICE CHARGE", amount: "178.57", reference: "AUTO" },
    ];
    const app = harness(mockApi({ record, charges: [serviceCharge], enabled: true,
      settingsResponses: { [endpoint]: response } }));
    await app.render();
    const scenario = `${endpoint}: ${JSON.stringify(response)}`;
    assert.equal(action(app.tree, "Print Bill").props.disabled, true, scenario);
    // The handler must independently reject the save even if the disabled
    // control is invoked programmatically or by a previously captured callback.
    await app.print();
    assert.equal(lastBilling(app.api), undefined, scenario);
    assert.equal(app.api.prints.length, 0, scenario);
    assert.deepEqual(app.api.events, [], scenario);
    assert.deepEqual(savedRows(app.api), record.other_charge_rows, scenario);
  }
});

test("assigned dine-in charge automatically reaches billing, receipt and saved rows exactly once", async () => {
  const charge = { ...serviceCharge, auto_sales_types: ["DINE IN"] };
  const app = harness(mockApi({ record: receiptRecord(), charges: [charge], enabled: true,
    basis: serviceChargeMath.VAT_EXCLUSIVE_LESS_DISCOUNT }));
  await app.render();
  assert(action(app.tree, "ON"), "assigned charge starts ON without a click");
  assert.match(text(summaryRow(app.tree, "Amount Due")), /1,708\.93/);
  await app.print();
  assert.deepEqual(lastBilling(app.api).billing_charges, [{ particulars: "SERVICE CHARGE", amount: 74.64 }]);
  assert.equal(app.api.prints[0].computed.totalOtherCharges, 74.64);
  await app.render({ isOpen: false });
  await app.render({ isOpen: true });
  assert(action(app.tree, "ON"));
  await app.print();
  assert.equal(savedRows(app.api).length, 1);
  assert.equal(lastBilling(app.api).OtherCharges, 74.64);
});

test("cashier can turn an automatic charge OFF and a saved bill keeps it OFF on reopening", async () => {
  const app = harness(mockApi({ charges: [{ ...serviceCharge, auto_sales_types: ["DINE IN"] }], enabled: true }));
  await app.render();
  action(app.tree, "ON").props.onClick();
  await app.render();
  assert(action(app.tree, "OFF"));
  await app.changeCorkage("20");
  assert(action(app.tree, "OFF"), "editing another input does not reset the override");
  await app.changeCorkage("");
  await app.print();
  assert.equal(lastBilling(app.api).OtherCharges, 0);
  assert.deepEqual(savedRows(app.api), []);
  await app.render({ isOpen: false });
  await app.render({ isOpen: true });
  assert(action(app.tree, "OFF"), "saved empty charge list is respected");
  await app.print();
  assert.equal(lastBilling(app.api).OtherCharges, 0);
});

test("defaults use the loaded order type and do not leak when switching transactions", async () => {
  const record = baseRecord();
  record.transaction_summary.order_type = "TAKE OUT";
  const api = mockApi({ record, charges: [{ ...serviceCharge, auto_sales_types: ["DINE IN"] }], enabled: true });
  const app = harness(api);
  await app.render();
  assert(action(app.tree, "OFF"), "backend order type overrides stale Dine In props");
  api.records.set("SECOND", { ...baseRecord(), transaction_summary: { customer_head_count: 1, order_type: "dine in" } });
  await app.render({ transaction: { ...transaction, transaction_id: "SECOND", order_type: "TAKE OUT" } });
  assert(action(app.tree, "ON"), "matching next order receives its own default");
  api.records.set("THIRD", { ...baseRecord(), transaction_summary: { customer_head_count: 1, order_type: "GRAB" } });
  await app.render({ transaction: { ...transaction, transaction_id: "THIRD" } });
  assert(action(app.tree, "OFF"));
});

test("master OFF, charge OFF and no assignments cannot add automatic charges", async () => {
  for (const options of [
    { enabled: false, charges: [{ ...serviceCharge, auto_sales_types: ["DINE IN"] }] },
    { enabled: true, charges: [{ ...serviceCharge, is_enabled: 0, auto_sales_types: ["DINE IN"] }] },
    { enabled: true, charges: [serviceCharge] },
  ]) {
    const app = harness(mockApi(options));
    await app.render();
    await app.print();
    assert.equal(lastBilling(app.api).OtherCharges, 0);
    assert.deepEqual(lastBilling(app.api).billing_charges, []);
  }
});
