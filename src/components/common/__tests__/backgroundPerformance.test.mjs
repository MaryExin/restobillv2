import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { transformSync } from "@swc/core";
import React from "react";
import { renderToString } from "react-dom/server";

const require = createRequire(import.meta.url);

function loadComponent(filename, mocks, globals = {}) {
  const code = transformSync(
    fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"),
    {
      jsc: {
        parser: { syntax: "ecmascript", jsx: true },
        transform: { react: { runtime: "automatic" } },
        target: "es2022",
      },
      module: { type: "commonjs" },
    },
  ).code;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => mocks[name] || require(name),
    ...globals,
  });
  return exports.default;
}

const flush = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

function mountSync() {
  let cleanup;
  let nextTimer = 1;
  const timers = new Map();
  const listeners = new Map();
  const calls = [];
  const events = [];
  const storage = new Map([
    ["access_token", "test-token"],
    ["apiendpoint", "http://pos.test"],
  ]);
  const registerTimer = (fn, ms, repeating) => {
    const id = nextTimer++;
    timers.set(id, { fn, ms, repeating });
    return id;
  };
  const Component = loadComponent("GlobalSync.jsx", {
    react: { useEffect: (fn) => { cleanup = fn(); } },
    "../../utils/posRoleFetch": { normalizePosApiHost: (value) => value },
  }, {
    Headers,
    AbortController,
    CustomEvent: class {
      constructor(type, init) { this.type = type; this.detail = init.detail; }
    },
    localStorage: { getItem: (key) => storage.get(key) ?? null },
    fetch: (url, options) => new Promise((resolve, reject) => {
      calls.push({ url, options, resolve, reject });
    }),
    console: { log() {}, error() {} },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name, fn) => {
        if (listeners.get(name) === fn) listeners.delete(name);
      },
      dispatchEvent: (event) => events.push(event),
    },
    setInterval: (fn, ms) => registerTimer(fn, ms, true),
    setTimeout: (fn, ms) => registerTimer(fn, ms, false),
    clearInterval: (id) => timers.delete(id),
    clearTimeout: (id) => timers.delete(id),
  });
  Component();
  return {
    timers, listeners, calls, events, storage,
    cleanup: () => cleanup(),
    storageEvent: (event) => listeners.get("storage")(event),
    runTimer: (id) => {
      const timer = timers.get(id);
      assert.ok(timer, "scheduled timer exists");
      if (!timer.repeating) timers.delete(id);
      return timer.fn();
    },
    respond: async (index, data) => {
      calls[index].resolve({ json: async () => data });
      await flush();
    },
  };
}

test("backup settings retain supported frequencies, default cadence and auth", async () => {
  for (const [frequency, expectedMs] of [
    ["1m", 60_000], ["30m", 1_800_000], ["1h", 3_600_000],
    ["2h", 7_200_000], ["unknown", 3_600_000],
  ]) {
    const sync = mountSync();
    assert.match(sync.calls[0].url, /action=get_settings$/);
    assert.equal(sync.calls[0].options.headers.get("Authorization"), "Bearer test-token");
    await sync.respond(0, { status: "success", frequency });
    assert.equal([...sync.timers.values()][0].ms, expectedMs);
    sync.cleanup();
  }
});

test("slow backups never overlap and cleanup suppresses late completion events", async () => {
  const sync = mountSync();
  await sync.respond(0, { status: "success", frequency: "1m" });
  const timer = [...sync.timers.keys()][0];
  sync.runTimer(timer);
  sync.runTimer(timer);
  assert.equal(sync.calls.length, 2);
  assert.match(sync.calls[1].url, /action=scheduled_export$/);
  assert.equal(sync.calls[1].options.method, "POST");
  await sync.respond(1, { status: "success" });
  assert.equal(sync.events.length, 1);
  assert.equal(sync.events[0].type, "backup-completed");
  sync.runTimer(timer);
  assert.equal(sync.calls.length, 3);
  sync.cleanup();
  assert.equal(sync.calls[2].options.signal.aborted, true);
  assert.equal(sync.timers.size, 0);
  assert.equal(sync.listeners.size, 0);
  await sync.respond(2, { status: "success" });
  assert.equal(sync.events.length, 1);
});

test("unrelated storage does not restart backups; auth bursts and stale settings are bounded", async () => {
  const sync = mountSync();
  await sync.respond(0, { status: "success", frequency: "1m" });
  const timer = [...sync.timers.keys()][0];
  sync.storageEvent({ key: "Cashier" });
  assert.equal(sync.timers.has(timer), true);
  sync.storage.set("access_token", "new-test-token");
  sync.storageEvent({ key: "access_token" });
  sync.storageEvent({});
  assert.equal(sync.timers.size, 1);
  assert.equal([...sync.timers.values()][0].ms, 150);
  sync.runTimer([...sync.timers.keys()][0]);
  assert.equal(sync.calls.length, 2);
  assert.equal(sync.calls[1].options.headers.get("Authorization"), "Bearer new-test-token");
  sync.storageEvent({ key: "apiendpoint" });
  assert.equal(sync.calls[1].options.signal.aborted, true);
  await sync.respond(1, { status: "success", frequency: "2h" });
  assert.equal([...sync.timers.values()].some((entry) => entry.repeating), false);
  sync.runTimer([...sync.timers.keys()][0]);
  await sync.respond(2, { status: "error" });
  assert.equal([...sync.timers.values()][0].ms, 30_000);
  sync.cleanup();
});

test("unopened dialogs do not import code and opening shows cancellable loading feedback", async () => {
  let resolve;
  let loads = 0;
  const lazyDialog = loadComponent("lazyDialog.jsx", {
    "react-dom": { createPortal: (children) => children },
  }, { document: { body: {} } });
  const Dialog = lazyDialog(() => {
    loads += 1;
    return new Promise((done) => { resolve = done; });
  });
  assert.equal(renderToString(React.createElement(Dialog, { isOpen: false })), "");
  assert.equal(loads, 0);
  const loading = renderToString(React.createElement(Dialog, { isOpen: true, onClose() {} }));
  assert.equal(loads, 1);
  assert.match(loading, /Loading…/);
  assert.match(loading, /Cancel/);
  resolve({ default: () => React.createElement("p", null, "Loaded report") });
  await flush();
  assert.match(renderToString(React.createElement(Dialog, { isOpen: true })), /Loaded report/);
  assert.equal(loads, 1);
});

test("opened dialog stays mounted on close with the same component and forwarded props", () => {
  let hasOpened = false;
  const effects = [];
  const lazyDialog = loadComponent("lazyDialog.jsx", {
    react: {
      ...React,
      useState: () => [hasOpened, (value) => { hasOpened = value; }],
      useEffect: (effect) => effects.push(effect),
    },
    "react-dom": { createPortal: (children) => children },
  }, { document: { body: {} } });
  const Dialog = lazyDialog(async () => ({ default: () => null }), "open");
  assert.equal(Dialog({ open: false }), null);
  const opened = Dialog({ open: true, reportData: "retained" });
  effects.forEach((effect) => effect());
  const closed = Dialog({ open: false, reportData: "retained" });
  assert.equal(closed.props.children.type, opened.props.children.type);
  assert.equal(closed.props.children.props.open, false);
  assert.equal(closed.props.children.props.reportData, "retained");
  assert.equal(closed.props.fallback, null);
});
