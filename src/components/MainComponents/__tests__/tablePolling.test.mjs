import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformSync } from "@swc/core";

const source = fs.readFileSync(new URL("../ViewOrdering.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
  module: { type: "commonjs" },
}).code;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const Orderlist = () => null;
const noop = () => null;

function all(tree, predicate, result = []) {
  if (Array.isArray(tree)) tree.forEach(node => all(node, predicate, result));
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

async function mountTables({ floorLayout = false } = {}) {
  const states = [], refs = [], requests = [], errors = [], timers = new Map();
  let stateIndex, refIndex, effects, tree, nextTimer = 0, pollingDependencies, pollingCleanup;
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
    useMemo: callback => callback(),
    useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
  };
  const modules = {
    react: hooks,
    "react-router-dom": { useNavigate: () => noop, useLocation: () => ({ pathname: "/ordering", state: {} }) },
    "../../context/useZustandLayoutMode": () => ({ layoutMode: "Restaurant" }),
    "../../context/ThemeContext": { useTheme: () => ({ themeSettings: {} }) },
    "../../hooks/useApiHost": () => "http://pos.test",
    "../../hooks/useRoomReservations": () => ({ getRoomReservation: () => null }),
    "../../hooks/usePersistedViewMode": (key, allowed, fallback) => hooks.useState(fallback),
    "../Reservations/ReservedRoomTag": () => null,
    "../../utils/guestInfo": { roomServiceCardNote: () => "" },
    "./Orderlist": Orderlist,
  };
  const context = {
    exports: {},
    AbortController,
    console: { error: (...args) => errors.push(args) },
    localStorage: { getItem: () => "" },
    setInterval(callback, ms) {
      assert.equal(ms, 3000);
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearInterval: id => timers.delete(id),
    fetch: (url, options = {}) => {
      const response = data => ({ ok: true, json: async () => data });
      if (url.includes("get_open_shift_date.php")) return Promise.resolve(response({ selectedDate: "2026-10-21" }));
      if (url.includes("pos_table_layout_settings.php")) return Promise.resolve(response({ success: true, data: { table_layout_enabled: floorLayout } }));
      assert(url.includes("table_list.php"), `Unexpected request: ${url}`);
      // Keep aborted requests resolvable to verify that late responses are ignored.
      return new Promise((resolve, reject) => requests.push({
        url, options, reject, respond: data => resolve(response(data)),
      }));
    },
    require: name => modules[name] || (name.startsWith("react-icons/") ? new Proxy({}, { get: (_, key) => key }) : noop),
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);

  function render() {
    stateIndex = refIndex = 0;
    effects = [];
    tree = context.module.exports.default();
    const polling = effects.find(effect => effect.callback.toString().includes("onlyPending=true"));
    if (!pollingDependencies || polling.dependencies.some((value, index) => !Object.is(value, pollingDependencies[index]))) {
      pollingCleanup?.();
      pollingDependencies = polling.dependencies;
      pollingCleanup = polling.callback();
    }
    return tree;
  }

  render();
  effects.find(effect => effect.callback.toString().includes("get_open_shift_date.php")).callback();
  effects.find(effect => effect.callback.toString().includes("pos_table_layout_settings.php")).callback();
  await flush();
  render();
  return {
    requests, errors, timers, render,
    get tree() { return tree; },
    poll() { for (const callback of timers.values()) callback(); },
    cleanup() { pollingCleanup?.(); },
  };
}

test("table polling pauses and aborts behind an order, then refreshes immediately on close without stale results", async () => {
  const tables = await mountTables();
  try {
    assert.equal(tables.requests.length, 1);
    tables.requests[0].respond([{ table_number: "TEST1", transaction_id: "TEST-TX" }]);
    await flush();
    tables.render();
    tables.poll();
    assert.equal(tables.requests.length, 2);
    tables.poll();
    assert.equal(tables.requests.length, 2, "slow requests must not overlap");
    const tableButton = all(tables.tree, node => node.type === "button" && node.key === "TEST1")[0];
    assert(tableButton);
    tableButton.props.onClick();
    tables.render();
    const proceed = all(tables.tree, node => node.type === "button" && text(node).trim() === "Proceed")[0];
    assert(proceed);
    proceed.props.onClick();
    tables.render();
    assert.equal(tables.timers.size, 0);
    assert.equal(tables.requests[1].options.signal.aborted, true);
    tables.poll();
    assert.equal(tables.requests.length, 2);
    const order = all(tables.tree, node => node.type === Orderlist)[0];
    assert(order);
    order.props.onOrderSaved();
    tables.render();
    assert.equal(tables.requests.length, 2, "saving an order does not restart the covered picker");
    order.props.setshoworderlist(false);
    tables.render();
    assert.equal(tables.requests.length, 3, "closing refreshes immediately, without waiting three seconds");
    assert.equal(tables.timers.size, 1);
    tables.requests[2].respond([{ table_number: "FRESH", transaction_id: "FRESH-TX" }]);
    await flush();
    tables.requests[1].respond([{ table_number: "STALE", transaction_id: "OLD-TX" }]);
    await flush();
    tables.render();
    assert(all(tables.tree, node => node.type === "button" && node.key === "FRESH").length);
    assert.equal(all(tables.tree, node => node.type === "button" && node.key === "STALE").length, 0);
    assert.equal(tables.errors.length, 0);
  } finally { tables.cleanup(); }
});

test("floor polling waits for both requests, aborts a failed sibling and cleans up pending work", async () => {
  const tables = await mountTables({ floorLayout: true });
  try {
    assert.equal(tables.requests.length, 2);
    const [pending, master] = tables.requests;
    assert.equal(pending.options.signal, master.options.signal);
    pending.respond([]);
    await flush();
    tables.poll();
    assert.equal(tables.requests.length, 2, "the remaining master request must finish before another poll");
    master.reject(new Error("Master list unavailable"));
    await flush();
    assert.equal(pending.options.signal.aborted, true);
    assert.equal(tables.errors.length, 1);
    tables.poll();
    assert.equal(tables.requests.length, 4, "a failed poll permits a later retry");
    tables.cleanup();
    assert.equal(tables.timers.size, 0);
    assert(tables.requests.slice(2).every(request => request.options.signal.aborted));
    tables.requests.slice(2).forEach(request => request.reject(Object.assign(new Error("Canceled"), { name: "AbortError" })));
    await flush();
    assert.equal(tables.errors.length, 1, "cleanup cancellation is not reported as a load failure");
  } finally { tables.cleanup(); }
});
