import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "@swc/core";

const compiled = transformSync(fs.readFileSync(new URL("../useCoffeeAddonOptions.js", import.meta.url), "utf8"), {
  jsc: { parser: { syntax: "ecmascript" }, target: "es2020" }, module: { type: "commonjs" },
}).code;
const identity = (product) => product;
const settle = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };
const coffee = () => ({ product_id: "LATTE", item_name: "CAFE LATTE", item_category: "DRINKS", selling_price: 175 });
const addon = { product_id: "ALMOND", item_name: "CCL ALMOND", item_category: "ADD ONS", selling_price: "27.00" };
const fresh = (product, price = 180) => ({ product: { ...product, selling_price: price }, addons: [addon] });

// Deliberately separate renders from passive effects to catch stale prices
// appearing during a new modal opening, retry, or service/business scope change.
function harness() {
  const states = [], effectSlots = [], requests = [], timers = new Map();
  let stateIndex = 0, effectIndex = 0, timerId = 0, pending = [];
  const hooks = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect(effect, dependencies) {
      const index = effectIndex++;
      const previous = effectSlots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pending.push({ index, effect });
        effectSlots[index] = { dependencies, cleanup: previous?.cleanup };
      }
    },
  };
  const context = { exports: {}, AbortController,
    window: {
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
    require(name) {
      if (name === "react") return hooks;
      if (name === "../utils/menuCoffeeAddons.js") return {
        fetchCoffeeAddonOptions: options => new Promise((resolve, reject) => requests.push({ options, resolve, reject })),
      };
      assert.fail(`Unexpected hook import: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  return {
    requests, timers,
    render(product, overrides = {}) {
      stateIndex = effectIndex = 0;
      return context.module.exports.default({ product, apiHost: "http://pos.test", categoryCode: "RESTAURANT",
        unitCode: "BRANCH-1", salesType: "DINE IN", mapProduct: identity, ...overrides });
    },
    flushEffects() {
      const jobs = pending;
      pending = [];
      for (const { index, effect } of jobs) {
        effectSlots[index].cleanup?.();
        effectSlots[index].cleanup = effect();
      }
    },
    expire() { for (const callback of [...timers.values()]) callback(); },
  };
}

function assertPending(result) {
  assert.equal(result.product, null);
  assert.equal(result.addons.length, 0);
  assert.equal(result.isLoading, true);
  assert.equal(result.error, "");
}

test("each opening waits for refreshed drink and add-on prices and maps both with the stable mapper", async () => {
  const hook = harness();
  const product = coffee();
  const mapProduct = row => ({ ...row, selling_price: Number(row.selling_price), mapped: true });
  assertPending(hook.render(product, { mapProduct }));
  hook.flushEffects();
  const options = fresh(product);
  hook.requests[0].resolve(options);
  await settle();
  const loaded = hook.render(product, { mapProduct });
  assert.equal(loaded.product.selling_price, 180);
  assert.equal(loaded.addons[0].selling_price, 27);
  assert(loaded.product.mapped && loaded.addons[0].mapped);
  assert.equal(options.addons[0].selling_price, "27.00", "mapping cannot modify the source API object");
  assert.equal(hook.timers.size, 0);

  const reopened = { ...product };
  assertPending(hook.render(reopened, { mapProduct }));
  hook.flushEffects();
  assert(hook.requests[0].options.signal.aborted);
  hook.requests[1].resolve(fresh(reopened, 190));
  await settle();
  assert.equal(hook.render(reopened, { mapProduct }).product.selling_price, 190);
});

test("close clears options and late responses cannot replace another selected drink", async () => {
  const hook = harness();
  const first = coffee();
  const second = { ...first, product_id: "ICED-LATTE", item_name: "ICED CAFE LATTE" };
  hook.render(first);
  hook.flushEffects();
  assertPending(hook.render(second));
  hook.flushEffects();
  const current = fresh(second, 170);
  hook.requests[1].resolve(current);
  await settle();
  hook.requests[0].resolve(fresh(first, 999));
  await settle();
  assert.equal(hook.render(second).product, current.product);

  const closed = hook.render(null);
  assert.equal(closed.product, null);
  assert.equal(closed.addons.length, 0);
  assert.equal(closed.isLoading, false);
  hook.flushEffects();
  assert(hook.requests[1].options.signal.aborted);
  assertPending(hook.render(second));
});

test("every pricing scope change hides prior options before starting the replacement fetch", async () => {
  for (const overrides of [{ apiHost: "http://other-pos.test" }, { categoryCode: "OTHER-BUSINESS" },
    { unitCode: "BRANCH-2" }, { salesType: "TAKE OUT" }]) {
    const hook = harness();
    const product = coffee();
    hook.render(product);
    hook.flushEffects();
    hook.requests[0].resolve(fresh(product));
    await settle();
    assert.equal(hook.render(product).product.selling_price, 180);
    assertPending(hook.render(product, overrides));
    hook.flushEffects();
    assert(hook.requests[0].options.signal.aborted);
    for (const [field, value] of Object.entries(overrides)) assert.equal(hook.requests[1].options[field], value);
    const options = fresh(product, 205);
    hook.requests[1].resolve(options);
    await settle();
    assert.equal(hook.render(product, overrides).product, options.product);
  }
});

test("failed requests expose no old price and retry starts with an empty selection", async () => {
  const hook = harness();
  const product = coffee();
  hook.render(product);
  hook.flushEffects();
  hook.requests[0].reject(new Error("Price service unavailable"));
  await settle();
  const failed = hook.render(product);
  assert.equal(failed.product, null);
  assert.equal(failed.addons.length, 0);
  assert.equal(failed.error, "Price service unavailable");
  assert.equal(failed.isLoading, false);
  failed.retry();
  assertPending(hook.render(product));
  hook.flushEffects();
  assert.equal(hook.requests.length, 2);
  const options = fresh(product);
  hook.requests[1].resolve(options);
  await settle();
  assert.equal(hook.render(product).product, options.product);
});

test("incomplete scope and timeout cannot leave selectable stale prices", async () => {
  const hook = harness();
  const product = coffee();
  hook.render(product, { unitCode: "" });
  hook.flushEffects();
  await settle();
  const invalid = hook.render(product, { unitCode: "" });
  assert.match(invalid.error, /Select a service type/);
  assert.equal(invalid.product, null);
  assert.equal(hook.requests.length, 0);
  assert.equal(hook.timers.size, 0);

  hook.render(product);
  hook.flushEffects();
  hook.expire();
  assert(hook.requests[0].options.signal.aborted);
  // Even a transport that ignores AbortSignal cannot publish its late result.
  hook.requests[0].resolve(fresh(product));
  await settle();
  const timedOut = hook.render(product);
  assert.match(timedOut.error, /timed out/);
  assert.equal(timedOut.product, null);
  assert.equal(timedOut.addons.length, 0);
  assert.equal(timedOut.isLoading, false);
});
