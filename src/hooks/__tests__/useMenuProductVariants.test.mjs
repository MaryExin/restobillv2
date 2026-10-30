import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "@swc/core";

const identity = (product) => product;
const source = fs.readFileSync(new URL("../useMenuProductVariants.js", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript" }, target: "es2020" },
  module: { type: "commonjs" },
}).code;
const settle = async () => { for (let index = 0; index < 6; index += 1) await Promise.resolve(); };

// Run renders separately from passive effects so stale data exposed during the
// first render of a new opening is caught, even before the fetch starts.
function harness() {
  const states = [];
  const effectSlots = [];
  const timers = new Map();
  const requests = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let timerId = 0;
  let pending = [];
  const hooks = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
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
  const context = {
    exports: {},
    AbortController,
    window: {
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
    require(name) {
      if (name === "react") return hooks;
      if (name === "../utils/menuProductVariantFetch.js") {
        return {
          fetchMenuProductVariants: (options) => new Promise((resolve, reject) => {
            requests.push({ options, resolve, reject });
          }),
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);

  return {
    requests,
    render(group, overrides = {}) {
      stateIndex = effectIndex = 0;
      return context.module.exports.default({
        group,
        apiHost: "http://pos.test",
        categoryCode: "RESTAURANT",
        unitCode: "UNIT-1",
        salesType: "DINE IN",
        mapProduct: identity,
        ...overrides,
      });
    },
    flushEffects() {
      const jobs = pending;
      pending = [];
      for (const { index, effect } of jobs) {
        effectSlots[index].cleanup?.();
        effectSlots[index].cleanup = effect();
      }
    },
  };
}

const family = () => ({ familyKey: '["PIZZA","5 CHEESE"]', item_name: "5 CHEESE" });

test("a fresh opening of the same family blocks prior prices before its request effect", async () => {
  const hook = harness();
  const first = family();
  hook.render(first);
  hook.flushEffects();
  const oldPrice = { product_id: "CHEESE-12", selling_price: 700 };
  hook.requests[0].resolve([oldPrice]);
  await settle();
  assert.equal(hook.render(first).variants[0], oldPrice);

  const reopened = { ...first };
  const beforeEffect = hook.render(reopened);
  assert.equal(beforeEffect.isLoading, true);
  assert.equal(beforeEffect.variants.length, 0);
  hook.flushEffects();
  assert.equal(hook.requests[0].options.signal.aborted, true);
  const newPrice = { product_id: "CHEESE-12", selling_price: 750 };
  hook.requests[1].resolve([newPrice]);
  await settle();
  assert.equal(hook.render(reopened).variants[0], newPrice);
});

test("closing clears cached prices even if the same family object is later reused", async () => {
  const hook = harness();
  const group = family();
  hook.render(group);
  hook.flushEffects();
  hook.requests[0].resolve([{ product_id: "CHEESE-12", selling_price: 700 }]);
  await settle();
  assert.equal(hook.render(group).variants.length, 1);

  assert.equal(hook.render(null).variants.length, 0);
  hook.flushEffects();
  const reopened = hook.render(group);
  assert.equal(reopened.isLoading, true);
  assert.equal(reopened.variants.length, 0);
});

test("late responses from a closed opening cannot replace the current family", async () => {
  const hook = harness();
  const cheese = family();
  const aloha = { familyKey: '["PIZZA","ALOHA 5 CHEESE"]', item_name: "ALOHA 5 CHEESE" };
  hook.render(cheese);
  hook.flushEffects();
  hook.render(aloha);
  hook.flushEffects();
  assert.equal(hook.requests[0].options.signal.aborted, true);
  const current = { product_id: "ALOHA-12", selling_price: 725 };
  hook.requests[1].resolve([current]);
  await settle();
  hook.requests[0].resolve([{ product_id: "CHEESE-12", selling_price: 700 }]);
  await settle();
  assert.equal(hook.render(aloha).variants[0], current);
});

test("service-type changes and retries hide previous results before effects run", async () => {
  const hook = harness();
  const group = family();
  hook.render(group);
  hook.flushEffects();
  hook.requests[0].resolve([{ product_id: "CHEESE-12", selling_price: 700 }]);
  await settle();
  const newService = hook.render(group, { salesType: "TAKE OUT" });
  assert.equal(newService.isLoading, true);
  assert.equal(newService.variants.length, 0);
  hook.flushEffects();
  hook.requests[1].reject(new Error("Connection unavailable"));
  await settle();
  const failed = hook.render(group, { salesType: "TAKE OUT" });
  assert.equal(failed.error, "Connection unavailable");
  failed.retry();
  const retry = hook.render(group, { salesType: "TAKE OUT" });
  assert.equal(retry.isLoading, true);
  assert.equal(retry.error, "");
  assert.equal(retry.variants.length, 0);
});
