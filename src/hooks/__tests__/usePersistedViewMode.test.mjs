import assert from "node:assert/strict";
import test from "node:test";
import { readPersistedViewMode } from "../usePersistedViewMode.js";

const withStorage = (store, run) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = store;
  try {
    return run();
  } finally {
    globalThis.localStorage = previous;
  }
};

test("the saved view comes back, unknown or missing values fall back to the default", () => {
  const stored = {};
  const store = { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } };
  withStorage(store, () => {
    assert.equal(readPersistedViewMode("posNewTransactionViewMode", ["card", "table"], "card"), "card");
    store.setItem("posNewTransactionViewMode", "table");
    assert.equal(readPersistedViewMode("posNewTransactionViewMode", ["card", "table"], "card"), "table");
    store.setItem("posNewTransactionViewMode", "list");
    assert.equal(readPersistedViewMode("posNewTransactionViewMode", ["card", "table"], "card"), "card");
  });
});

test("a blocked storage never breaks the screen", () => {
  const broken = { getItem() { throw new Error("blocked"); } };
  withStorage(broken, () => {
    assert.equal(readPersistedViewMode("posBillingViewMode", ["grid", "list"], "grid"), "grid");
  });
});
