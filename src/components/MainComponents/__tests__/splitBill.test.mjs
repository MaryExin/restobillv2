import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as splitSelection from "../../../utils/splitBillSelection.js";
import * as displayName from "../../../utils/orderItemDisplayName.js";

const rows = [
  { ID: "11", product_id: "COFFEE", item_name: "Coffee", item_instruction: "No sugar", sales_quantity: "2", selling_price: "100" },
  { ID: "12", product_id: "COFFEE", item_name: "Coffee", item_instruction: "Extra sugar", sales_quantity: "1", selling_price: "100" },
];

test("split selection moves the chosen detail row and keeps other identical products", () => {
  const result = splitSelection.getSplitBillSelection(rows, { 11: "1" });
  assert.equal(result.error, "");
  assert.deepEqual(result.items, [{ detail_id: "11", quantity: 1 }]);
  assert.equal(result.movedSubtotal, 100);
  assert.equal(result.remainingSubtotal, 200);
});

test("split selection supports part of one row and decimal quantities", () => {
  const result = splitSelection.getSplitBillSelection([rows[0]], { 11: "0.125" });
  assert.equal(result.error, "");
  assert.equal(result.movedSubtotal, 12.5);
  assert.equal(result.remainingSubtotal, 187.5);
});

test("split subtotals round after summing fractional lines, like billing", () => {
  const fractional = rows.map((row) => ({ ...row, sales_quantity: 1, selling_price: 0.04 }));
  const result = splitSelection.getSplitBillSelection(fractional, { 11: "0.1", 12: "0.1" });
  assert.equal(result.error, "");
  assert.equal(result.movedSubtotal, 0.01);
  assert.equal(result.remainingSubtotal, 0.07);
});

test("empty, excessive, malformed and all-item splits are rejected", () => {
  for (const quantities of [{}, { 11: "0" }, { 11: "-1" }, { 11: "3" }, { 11: "" },
    { 11: "NaN" }, { 11: "Infinity" }, { 11: "1.00001" }, { 11: "2", 12: "1" }]) {
    assert(splitSelection.getSplitBillSelection(rows, quantities).error, JSON.stringify(quantities));
  }
});

test("a zero-price item may remain on the original bill", () => {
  const result = splitSelection.getSplitBillSelection([rows[0], { ...rows[1], selling_price: "0" }], { 11: "2" });
  assert.equal(result.error, "");
  assert.equal(result.remainingSubtotal, 0);
});

const compiled = transformSync(fs.readFileSync(new URL("../SplitBillModal.jsx", import.meta.url), "utf8")
  .replace("import.meta.env.VITE_POS_SPLIT_BILL_ENDPOINT", '"/api/split_bill.php"'), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;

function harness({ canSplit = true, postResponse, postError, failRead = false, holdPost = false, readBody, readStatus } = {}) {
  const states = [], effects = [], memos = [], refs = [];
  let stateIndex, effectIndex, memoIndex, refIndex, dirty, pendingEffects, tree, saving = false;
  let releasePost;
  const calls = [], successes = [], closes = [];
  const header = { transaction_id: "1001", Category_Code: "RESTAURANT", Unit_Code: "BRANCH", table_number: "Table 1" };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const slot = stateIndex++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (next) => { states[slot] = typeof next === "function" ? next(states[slot]) : next; dirty = true; }];
    },
    useRef(initial) { const slot = refIndex++; return refs[slot] ||= { current: initial }; },
    useMemo(factory, dependencies) {
      const slot = memoIndex++;
      if (!same(memos[slot]?.dependencies, dependencies)) memos[slot] = { dependencies, value: factory() };
      return memos[slot].value;
    },
    useEffect(effect, dependencies) {
      const slot = effectIndex++;
      if (!same(effects[slot]?.dependencies, dependencies)) pendingEffects.push(() => {
        effects[slot]?.cleanup?.(); effects[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  const modules = {
    react: hooks,
    "../../utils/orderItemDisplayName": displayName,
    "../../utils/splitBillSelection": splitSelection,
    "../../hooks/useCustomSecuredMutation": { useCustomSecuredMutation: (url) => ({
      isLoading: saving,
      async mutateAsync(payload) {
        saving = true; dirty = true; calls.push({ method: "POST", url, payload });
        if (holdPost) await new Promise((resolve) => { releasePost = resolve; });
        saving = false; dirty = true;
        if (postError) throw postError;
        return postResponse || { status: "success", source_transaction_id: "1001", transaction_id: "1002",
          source_transaction: header, transaction: { ...header, transaction_id: "1002" } };
      },
    }) },
  };
  const context = {
    exports: {}, URLSearchParams, AbortController,
    localStorage: { getItem: (key) => ({ user_id: "TEST-USER", username: "Test cashier" })[key] || "" },
    async fetch(url) {
      calls.push({ method: "GET", url });
      const data = failRead ? { status: "error", message: "Cannot load transaction." } : {
        status: "success", transaction: header, snapshot_token: `snapshot-${calls.length}`, items: rows,
        can_split: canSplit, reason: canSplit ? null : "Remove discounts before splitting.",
      };
      const status = readStatus ?? (failRead ? 500 : 200);
      return { ok: status >= 200 && status < 300, status,
        text: async () => readBody === undefined ? JSON.stringify(data) : readBody };
    },
    require(name) {
      if (name.startsWith("react-icons/")) return new Proxy({}, { get: (_, key) => key });
      assert(name in modules, `Unexpected import ${name}`); return modules[name];
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  const component = context.module.exports.default;
  return {
    calls, successes, closes, get tree() { return tree; },
    release() { releasePost(); },
    async render() {
      for (let pass = 0; pass < 20; pass++) {
        stateIndex = effectIndex = memoIndex = refIndex = 0; dirty = false; pendingEffects = [];
        tree = component({ transaction: header, apiHost: "http://pos.test", onClose: () => closes.push(true), onSuccess: (value) => successes.push(value) });
        pendingEffects.forEach((effect) => effect());
        for (let tick = 0; tick < 15; tick++) await Promise.resolve();
        if (!dirty) return;
      }
      assert.fail("Split modal effects did not settle");
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
const button = (app, label) => all(app.tree, (node) => node.type === "button" && text(node).trim() === label)[0];
const checkbox = (app) => all(app.tree, (node) => node.type === "input" && node.props.type === "checkbox")[0];

test("split modal reads scoped saved items and submits only detail identities/quantities", async () => {
  const app = harness(); await app.render();
  const params = new URL(app.calls[0].url).searchParams;
  assert.equal(params.get("Category_Code"), "RESTAURANT");
  assert.equal(params.get("Unit_Code"), "BRANCH");
  assert.equal(params.get("transaction_id"), "1001");
  assert.equal(button(app, "Create separate bill").props.disabled, true);
  checkbox(app).props.onChange({ target: { checked: true } }); await app.render();
  const quantity = all(app.tree, (node) => node.type === "input" && node.props.type === "number")[0];
  quantity.props.onChange({ target: { value: "1" } }); await app.render();
  await button(app, "Create separate bill").props.onClick(); await app.render();
  const request = JSON.parse(JSON.stringify(app.calls.find((call) => call.method === "POST").payload));
  assert.deepEqual(request.items, [{ detail_id: "11", quantity: 1 }]);
  assert.equal(request.snapshot_token, "snapshot-1");
  assert.equal(request.user_id, "TEST-USER");
  assert.equal(request.user_name, "Test cashier");
  assert.equal(request.Category_Code, "RESTAURANT");
  assert.equal(request.Unit_Code, "BRANCH");
  assert.equal(app.successes[0].transaction.transaction_id, "1002");
  assert(text(app.tree).includes("No sugar"), "item instructions are visible");
});

test("server rejection keeps modal open and requires refreshing before another attempt", async () => {
  const app = harness({ postResponse: { status: "error", message: "Items changed. Refresh first." } }); await app.render();
  checkbox(app).props.onChange({ target: { checked: true } }); await app.render();
  await button(app, "Create separate bill").props.onClick(); await app.render();
  assert.equal(app.successes.length, 0);
  assert(text(app.tree).includes("Items changed. Refresh first."));
  assert.equal(button(app, "Create separate bill").props.disabled, true);
  button(app, "Refresh items").props.onClick(); await app.render();
  assert.equal(checkbox(app).props.checked, false);
  assert.equal(app.calls.filter((call) => call.method === "GET").length, 2);
});

test("ineligible or failed loads cannot create a transaction", async () => {
  for (const options of [{ canSplit: false }, { failRead: true }]) {
    const app = harness(options); await app.render();
    assert.equal(button(app, "Create separate bill").props.disabled, true);
    await button(app, "Create separate bill").props.onClick();
    assert.equal(app.calls.filter((call) => call.method === "POST").length, 0);
  }
});

test("a pending split blocks double submission and closing", async () => {
  const app = harness({ holdPost: true }); await app.render();
  checkbox(app).props.onChange({ target: { checked: true } }); await app.render();
  const submit = button(app, "Create separate bill").props.onClick;
  const pending = submit(); await submit(); await app.render();
  button(app, "Cancel").props.onClick();
  assert.equal(app.closes.length, 0);
  assert.equal(button(app, "Cancel").props.disabled, true);
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
  app.release(); await pending; await app.render();
  assert.equal(app.successes.length, 1);
});

test("empty and HTML server responses show a recoverable load error without enabling splitting", async () => {
  for (const [readBody, readStatus, message] of [
    ["", 200, /empty response/],
    [" \n", 500, /HTTP 500.*empty response/],
    ["<html><h1>Not found</h1></html>", 404, /HTTP 404.*valid billing data/],
    ["<?php warning", 200, /valid billing data/],
  ]) {
    const app = harness({ readBody, readStatus }); await app.render();
    const alert = all(app.tree, (node) => node.props?.role === "alert")[0];
    assert.match(text(alert), message);
    assert.doesNotMatch(text(alert), /Unexpected end|Not found|php warning/);
    assert.equal(button(app, "Create separate bill").props.disabled, true);
    assert.equal(button(app, "Refresh items").props.disabled, false);
    await button(app, "Create separate bill").props.onClick();
    assert.equal(app.calls.filter((call) => call.method === "POST").length, 0);
  }
});

test("unreadable save responses require refreshing before any retry", async () => {
  const app = harness({ postError: new SyntaxError("Unexpected end of JSON input") }); await app.render();
  checkbox(app).props.onChange({ target: { checked: true } }); await app.render();
  await button(app, "Create separate bill").props.onClick(); await app.render();
  assert.match(text(app.tree), /server did not confirm the split/);
  assert.doesNotMatch(text(app.tree), /Unexpected end of JSON/);
  assert.equal(button(app, "Create separate bill").props.disabled, true);
  assert.equal(app.successes.length, 0);
});
