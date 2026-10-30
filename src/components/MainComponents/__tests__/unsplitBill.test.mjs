import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as displayName from "../../../utils/orderItemDisplayName.js";

const source = { transaction_id: "1001", Category_Code: "TEST", Unit_Code: "BRANCH", table_number: "Table 1", remarks: "Pending for Payment" };
const child = { ...source, transaction_id: "1002", split_source_transaction_id: "1001" };
const product = { ID: "15", product_id: "COFFEE", item_name: "Coffee", item_instruction: "No sugar", sales_quantity: "2", selling_price: "100" };
const success = { status: "success", removed_transaction_id: "1002", source_transaction_id: "1001", source_transaction: source,
  transaction: { ...child, status: "Cancelled" } };

function renderComponent(file, modules, context, initialProps) {
  const states = [], effects = [], refs = [], memos = [];
  let stateIndex, effectIndex, refIndex, memoIndex, dirty, scheduled, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const slot = stateIndex++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (value) => { states[slot] = typeof value === "function" ? value(states[slot]) : value; dirty = true; }];
    },
    useRef(initial) { const slot = refIndex++; return refs[slot] ||= { current: initial }; },
    useMemo(factory, dependencies) {
      const slot = memoIndex++;
      if (!same(memos[slot]?.dependencies, dependencies)) memos[slot] = { dependencies, value: factory() };
      return memos[slot].value;
    },
    useEffect(effect, dependencies) {
      const slot = effectIndex++;
      if (!same(effects[slot]?.dependencies, dependencies)) scheduled.push(() => {
        effects[slot]?.cleanup?.(); effects[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  const compiled = transformSync(fs.readFileSync(new URL(file, import.meta.url), "utf8")
    .replace("import.meta.env.VITE_POS_UNSPLIT_BILL_ENDPOINT", '"/api/unsplit_bill.php"'), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" }, module: { type: "commonjs" },
  }).code;
  const sandbox = { exports: {}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: (key) => ({ user_id: "USER", username: "Cashier" })[key] || "" },
    ...context,
    require(name) {
      if (name === "react") return hooks;
      if (name.startsWith("react-icons/")) return new Proxy({}, { get: (_, key) => key });
      assert(name in modules, `Unexpected import ${name}`); return modules[name];
    },
  };
  sandbox.module = { exports: sandbox.exports };
  vm.runInNewContext(compiled, sandbox);
  const component = sandbox.module.exports.default;
  let props = initialProps;
  return {
    get tree() { return tree; },
    async render(nextProps = {}) {
      props = { ...props, ...nextProps };
      for (let pass = 0; pass < 20; pass++) {
        stateIndex = effectIndex = refIndex = memoIndex = 0; dirty = false; scheduled = [];
        tree = component(props); scheduled.forEach((effect) => effect());
        for (let tick = 0; tick < 20; tick++) await Promise.resolve();
        if (!dirty) return;
      }
      assert.fail("Effects did not settle");
    },
  };
}

function harness({ canUnsplit = true, response = success, postError, readBody, readStatus = 200, holdPost = false, previewOverrides = {} } = {}) {
  const calls = [], successes = [], closes = [];
  let saving = false, release;
  const app = renderComponent("../UnsplitBillModal.jsx", {
    "../../utils/orderItemDisplayName": displayName,
    "../../hooks/useCustomSecuredMutation": { useCustomSecuredMutation: (url) => ({
      isLoading: saving,
      async mutateAsync(payload) {
        saving = true; calls.push({ method: "POST", url, payload });
        if (holdPost) await new Promise((resolve) => { release = resolve; });
        saving = false;
        if (postError) throw postError;
        return response;
      },
    }) },
  }, {
    async fetch(url) {
      calls.push({ method: "GET", url });
      return { ok: readStatus >= 200 && readStatus < 300, status: readStatus,
        text: async () => readBody ?? JSON.stringify({ status: "success", transaction: child, source_transaction: source,
          items: [product], can_unsplit: canUnsplit, reason: canUnsplit ? null : "The original bill is already paid.", snapshot_token: `snapshot-${calls.length}`, ...previewOverrides }) };
    },
  }, { transaction: child, apiHost: "http://pos.test", onClose: () => closes.push(true), onSuccess: (result) => successes.push(result) });
  return { ...app, get tree() { return app.tree; }, calls, successes, closes, release: () => release() };
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
const buttons = (app, label) => all(app.tree, (node) => node.type === "button" && text(node).trim() === label);
const button = (app, label) => buttons(app, label)[0];

test("unsplit previews both bills and returns the entire child through a scoped snapshot request", async () => {
  const app = harness(); await app.render();
  const url = new URL(app.calls[0].url);
  assert.equal(url.pathname, "/api/unsplit_bill.php");
  assert.equal(url.searchParams.get("transaction_id"), "1002");
  assert.equal(url.searchParams.get("Category_Code"), "TEST");
  assert.equal(url.searchParams.get("Unit_Code"), "BRANCH");
  assert.match(text(app.tree), /Original transaction: 1001/);
  assert.match(text(app.tree), /No sugar/);
  assert.match(text(app.tree), /Qty 2/);
  assert.equal(button(app, "Unsplit bill").props.disabled, false);
  await button(app, "Unsplit bill").props.onClick(); await app.render();
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls.find((call) => call.method === "POST").payload)), {
    transaction_id: "1002", Category_Code: "TEST", Unit_Code: "BRANCH", snapshot_token: "snapshot-1", user_id: "USER", user_name: "Cashier",
  });
  assert.equal(app.successes[0].removed_transaction_id, "1002");
});

test("paid or otherwise ineligible bills cannot be unsplit", async () => {
  const app = harness({ canUnsplit: false }); await app.render();
  assert.match(text(app.tree), /original bill is already paid/);
  assert.equal(button(app, "Unsplit bill").props.disabled, true);
  await button(app, "Unsplit bill").props.onClick();
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 0);
});

test("an already-undone bill without an original link shows the server reason", async () => {
  const app = harness({ canUnsplit: false, previewOverrides: {
    source_transaction: null, reason: "This split bill has already been unsplit.", items: [], snapshot_token: "",
  } }); await app.render();
  assert.match(text(app.tree), /This split bill has already been unsplit/);
  assert.doesNotMatch(text(app.tree), /Incomplete split bill details/);
  assert.equal(button(app, "Unsplit bill").props.disabled, true);
  assert.equal(button(app, "Refresh details").props.disabled, false);
});

test("stale or unreadable mutation results require refreshing and leave bills open", async () => {
  for (const options of [
    { response: { status: "error", message: "Bills changed. Refresh details." } },
    { postError: new SyntaxError("Unexpected end of JSON input") },
    { response: { ...success, removed_transaction_id: "different-bill" } },
  ]) {
    const app = harness(options); await app.render();
    await button(app, "Unsplit bill").props.onClick(); await app.render();
    assert.equal(button(app, "Unsplit bill").props.disabled, true);
    assert.equal(app.successes.length, 0); assert.equal(app.closes.length, 0);
    assert.doesNotMatch(text(app.tree), /Unexpected end of JSON/);
    await button(app, "Unsplit bill").props.onClick();
    assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
    button(app, "Refresh details").props.onClick(); await app.render();
    assert.equal(button(app, "Unsplit bill").props.disabled, false);
    assert.equal(app.calls.filter((call) => call.method === "GET").length, 2);
  }
});

test("empty and non-JSON previews disable unsplit and offer refresh", async () => {
  for (const [readBody, readStatus] of [["", 404], ["<html>Server error</html>", 500]]) {
    const app = harness({ readBody, readStatus }); await app.render();
    assert.match(text(app.tree), new RegExp(`HTTP ${readStatus}`));
    assert.equal(button(app, "Unsplit bill").props.disabled, true);
    assert.equal(button(app, "Refresh details").props.disabled, false);
  }
});

test("a pending unsplit blocks duplicate requests and closing", async () => {
  const app = harness({ holdPost: true }); await app.render();
  const submit = button(app, "Unsplit bill").props.onClick;
  const pending = submit(); await submit(); await app.render();
  button(app, "Keep split bill").props.onClick();
  assert.equal(app.closes.length, 0);
  assert.equal(button(app, "Keep split bill").props.disabled, true);
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
  app.release(); await pending; await app.render();
  assert.equal(app.successes.length, 1);
});

const SplitStub = () => null, UnsplitStub = () => null, BillingStub = () => null;
function listHarness(data = [source, child]) {
  const requests = [], parentRefreshes = [];
  const app = renderComponent("../ModalTrans_List.jsx", {
    "react-to-print": { useReactToPrint: () => () => {} },
    "./Receipt": () => null,
    "../../context/ThemeContext": { useTheme: () => ({ isDark: false }) },
    "../../hooks/useApiHost": () => "http://pos.test",
    "./ModalDiscountTransaction": BillingStub,
    "./SplitBillModal": SplitStub,
    "./UnsplitBillModal": UnsplitStub,
  }, { fetch: (url) => new Promise((resolve) => { requests.push({ url, resolve }); }) }, {
    tableselected: "Table 1", data, dateFrom: "2026-10-27", setshowtranslistpertable() {},
    onTransactionsChanged: () => parentRefreshes.push(true),
  });
  return { ...app, get tree() { return app.tree; }, requests, parentRefreshes };
}
const childModal = (app, type) => all(app.tree, (node) => node.type === type)[0];

test("reopened transaction list offers unsplit only for a pending split child", async () => {
  const app = listHarness([source, child, { ...child, transaction_id: "1003", remarks: "Paid" }]); await app.render();
  assert.equal(buttons(app, "Unsplit").length, 1);
  button(app, "Unsplit").props.onClick({ stopPropagation() {} }); await app.render();
  assert.equal(childModal(app, UnsplitStub).props.transaction.transaction_id, "1002");
  childModal(app, UnsplitStub).props.onClose(); await app.render();
  button(app, "Paid").props.onClick(); await app.render();
  assert.equal(buttons(app, "Unsplit").length, 0);
});

test("undo removes the child, clears stale billing and split banner, and ignores an older list refresh", async () => {
  const app = listHarness([source]); await app.render();
  button(app, "Split bill").props.onClick({ stopPropagation() {} }); await app.render();
  childModal(app, SplitStub).props.onSuccess({ status: "success", transaction_id: "1002", source_transaction_id: "1001",
    transaction: { ...source, transaction_id: "1002" }, source_transaction: source }); await app.render();
  assert.equal(buttons(app, "Unsplit").length, 2, "immediate banner and created row offer unsplit");
  button(app, "Bill new transaction").props.onClick(); await app.render();
  assert.equal(typeof childModal(app, BillingStub).props.onUnsplitRequest, "function");
  childModal(app, BillingStub).props.onUnsplitRequest(); await app.render();
  childModal(app, UnsplitStub).props.onSuccess(success); await app.render();
  assert.equal(childModal(app, BillingStub), undefined);
  assert.equal(childModal(app, UnsplitStub), undefined);
  assert.equal(button(app, "Bill new transaction"), undefined);
  assert.equal(buttons(app, "Unsplit").length, 0);
  assert(button(app, "Bill original transaction"));
  assert.equal(app.parentRefreshes.length, 2);
  app.requests[1].resolve({ ok: true, json: async () => ({ data: [source] }) }); await app.render();
  app.requests[0].resolve({ ok: true, json: async () => ({ data: [source, child] }) }); await app.render();
  assert.equal(buttons(app, "Unsplit").length, 0, "old split refresh cannot resurrect discarded child");
  button(app, "Bill original transaction").props.onClick(); await app.render();
  assert.equal(childModal(app, BillingStub).props.transaction.transaction_id, "1001");
});
