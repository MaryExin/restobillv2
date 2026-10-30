import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as orderItemDisplayName from "../../../utils/orderItemDisplayName.js";

const compiled = transformSync(fs.readFileSync(new URL("../CoffeeAddonModal.jsx", import.meta.url), "utf8"), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;

function harness(document = { body: {} }) {
  const states = [];
  const refs = [];
  const effects = [];
  let pendingEffects = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let idIndex = 0;
  const hooks = {
    ...React,
    useId: () => `coffee-option-${idIndex++}`,
    useRef(value) {
      const index = refIndex++;
      return refs[index] ??= { current: value };
    },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useEffect(callback, dependencies) {
      const index = effectIndex++;
      const previous = effects[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const modules = {
    react: hooks,
    "react-dom": { createPortal: (child) => child },
    "react-icons/fi": { FiX: () => null },
    "../../utils/orderItemDisplayName": orderItemDisplayName,
  };
  const context = { exports: {}, document, require(name) {
    assert(name in modules, `Unexpected module: ${name}`);
    return modules[name];
  } };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  return {
    render(props) {
      stateIndex = refIndex = effectIndex = idIndex = 0;
      pendingEffects = [];
      return context.module.exports.default(props);
    },
    flushEffects() { pendingEffects.splice(0).forEach((callback) => callback()); },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
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
const button = (tree, label) => all(tree, (node) => node.type === "button" && text(node) === label)[0];
const radios = (tree) => all(tree, (node) => node.type === "input" && node.props.type === "radio");
const radio = (tree, label) => radios(tree).find((node) => node.props["aria-label"] === label);
const total = (tree) => text(all(tree, (node) => node.props?.["aria-live"] === "polite")[0]);
const product = Object.freeze({ product_id: "coffee-1", item_name: "ICED LATTE", selling_price: "145.00" });
const oat = Object.freeze({ product_id: "ccl-oat", item_name: "CCL OAT MILK", selling_price: "45.00" });
const espresso = Object.freeze({ product_id: "ccl-shot", item_name: "CCL ESPRESSO SHOT", selling_price: "35.00" });

test("add-on display and accessible names omit CCL while confirmation preserves the original catalog row", () => {
  const app = harness();
  const selected = [];
  const almond = Object.freeze({ product_id: "ccl-almond", item_name: "CCL Almond", selling_price: "45.00" });
  const hazelnut = Object.freeze({ product_id: "ccl-hazelnut", item_name: "CCL Hazelnut", selling_price: "35.00" });
  const unnamed = Object.freeze({ product_id: "ccl-unnamed", item_name: "  ", selling_price: "20.00" });
  const props = { product, addons: [almond, hazelnut, unnamed], onSelect: (addon) => selected.push(addon) };
  let tree = app.render(props);
  assert.deepEqual(radios(tree).map((node) => node.props["aria-label"]), ["Regular", "Almond", "Hazelnut", "Coffee add-on"]);
  assert.doesNotMatch(text(tree), /\bCCL\b/iu);
  assert(text(tree).includes("Almond"));
  assert(text(tree).includes("Hazelnut"));
  radio(tree, "Almond").props.onChange();
  tree = app.render(props);
  assert.equal(total(tree), "Order total₱190.00");
  button(tree, "Add to order").props.onClick();
  assert.equal(selected[0], almond);
  assert.equal(selected[0].item_name, "CCL Almond");
  assert.equal(selected[0].product_id, "ccl-almond");
});

test("Regular defaults to the original drink price and confirms no add-on", () => {
  const selected = [];
  const tree = harness().render({ product, addons: [oat, espresso], onSelect: (addon) => selected.push(addon) });
  assert.equal(radio(tree, "Regular").props.checked, true);
  assert.equal(radios(tree).filter((node) => node.props.checked).length, 1);
  assert(text(tree).includes("+₱0.00"));
  assert.equal(total(tree), "Order total₱145.00");
  assert.equal(button(tree, "Add to order").props.disabled, false);
  button(tree, "Add to order").props.onClick();
  assert.deepEqual(selected, [null]);
  assert.equal(product.selling_price, "145.00");
});

test("selecting one actual add-on replaces the prior choice and shows its fee plus drink total", () => {
  const app = harness();
  const selected = [];
  const props = { product, addons: [oat, espresso], onSelect: (addon) => selected.push(addon) };
  let tree = app.render(props);
  assert(text(tree).includes("+₱45.00"));
  assert(text(tree).includes("Total ₱190.00"));
  radio(tree, "OAT MILK").props.onChange();
  tree = app.render(props);
  assert.equal(total(tree), "Order total₱190.00");
  button(tree, "Add to order").props.onClick();
  assert.equal(selected[0], oat);
  radio(tree, "ESPRESSO SHOT").props.onChange();
  tree = app.render(props);
  assert.equal(total(tree), "Order total₱180.00");
  assert.equal(radio(tree, "OAT MILK").props.checked, false);
  assert.equal(radios(tree).filter((node) => node.props.checked).length, 1);
  button(tree, "Add to order").props.onClick();
  assert.equal(selected[1], espresso);
  radio(tree, "Regular").props.onChange();
  tree = app.render(props);
  assert.equal(total(tree), "Order total₱145.00");
  button(tree, "Add to order").props.onClick();
  assert.equal(selected[2], null);
});

test("refresh resolves the current original SKU and prices instead of keeping stale add-on data", () => {
  const app = harness();
  const selected = [];
  const props = { product, addons: [oat], onSelect: (addon) => selected.push(addon) };
  let tree = app.render(props);
  radio(tree, "OAT MILK").props.onChange();
  const currentProduct = Object.freeze({ ...product, selling_price: "150.15" });
  const currentAddon = Object.freeze({ ...oat, selling_price: "45.15" });
  tree = app.render({ ...props, product: currentProduct, addons: [currentAddon] });
  assert.equal(total(tree), "Order total₱195.30");
  button(tree, "Add to order").props.onClick();
  assert.equal(selected[0], currentAddon);
  assert.equal(currentProduct.selling_price, "150.15");
  assert.equal(currentAddon.selling_price, "45.15");
  tree = app.render({ ...props, addons: [espresso] });
  assert.equal(button(tree, "Add to order").props.disabled, true);
  assert(text(tree).includes("This add-on is no longer available"));
  button(tree, "Add to order").props.onClick();
  assert.equal(selected.length, 1);
  radio(tree, "Regular").props.onChange();
  tree = app.render({ ...props, addons: [espresso] });
  assert.equal(button(tree, "Add to order").props.disabled, false);
});

test("opening a different drink resets to Regular rather than carrying over another drink's selection", () => {
  const app = harness();
  const props = { product, addons: [oat] };
  let tree = app.render(props);
  radio(tree, "OAT MILK").props.onChange();
  tree = app.render({ ...props, product: { ...product, product_id: "coffee-2", selling_price: "175.00" } });
  assert.equal(radio(tree, "Regular").props.checked, true);
  assert.equal(total(tree), "Order total₱175.00");
});

test("missing, blank, invalid and negative prices cannot be selected or confirmed while zero is valid", () => {
  for (const invalid of [null, undefined, "", "  ", "invalid", NaN, Infinity, -1, "-5.00", false]) {
    const app = harness();
    const selected = [];
    const invalidAddon = { ...oat, selling_price: invalid };
    let tree = app.render({ product, addons: [invalidAddon], onSelect: (addon) => selected.push(addon) });
    assert.equal(radio(tree, "OAT MILK").props.disabled, true, String(invalid));
    assert(text(tree).includes("Price unavailable"));
    radio(tree, "OAT MILK").props.onChange();
    tree = app.render({ product, addons: [invalidAddon], onSelect: (addon) => selected.push(addon) });
    assert.equal(radio(tree, "Regular").props.checked, true);
    tree = app.render({ product: { ...product, selling_price: invalid }, addons: [oat], onSelect: (addon) => selected.push(addon) });
    assert.equal(button(tree, "Add to order").props.disabled, true, String(invalid));
    button(tree, "Add to order").props.onClick();
    assert.equal(selected.length, 0);
  }
  const app = harness();
  const freeAddon = { ...oat, selling_price: "0.00" };
  let tree = app.render({ product, addons: [freeAddon] });
  assert.equal(radio(tree, "OAT MILK").props.disabled, false);
  radio(tree, "OAT MILK").props.onChange();
  tree = app.render({ product, addons: [freeAddon] });
  assert.equal(total(tree), "Order total₱145.00");
  assert.equal(button(tree, "Add to order").props.disabled, false);
});

test("a selected add-on becoming invalid blocks confirmation until another option is chosen", () => {
  const app = harness();
  const selected = [];
  const props = { product, addons: [oat], onSelect: (addon) => selected.push(addon) };
  let tree = app.render(props);
  radio(tree, "OAT MILK").props.onChange();
  tree = app.render({ ...props, addons: [{ ...oat, selling_price: null }] });
  assert.equal(button(tree, "Add to order").props.disabled, true);
  assert.equal(total(tree), "Order total—");
  button(tree, "Add to order").props.onClick();
  assert.equal(selected.length, 0);
});

test("loading, errors and absent current drink block adding and retry retains the requested drink name", () => {
  const app = harness();
  const selected = [];
  let retries = 0;
  const props = { product: null, drinkName: "ICED LATTE", addons: [oat], onRetry: () => retries++, onSelect: (addon) => selected.push(addon) };
  let tree = app.render({ ...props, isLoading: true });
  assert(text(tree).includes("ICED LATTE"));
  assert(text(tree).includes("Loading coffee options and prices"));
  assert.equal(radios(tree).length, 0);
  assert.equal(button(tree, "Add to order").props.disabled, true);
  button(tree, "Add to order").props.onClick();
  tree = app.render({ ...props, product, error: "Prices unavailable" });
  assert.equal(button(tree, "Add to order").props.disabled, true);
  button(tree, "Add to order").props.onClick();
  button(tree, "Try again").props.onClick();
  assert.equal(retries, 1);
  tree = app.render(props);
  assert.equal(button(tree, "Add to order").props.disabled, true);
  assert.equal(radio(tree, "Regular").props.disabled, true);
  button(tree, "Add to order").props.onClick();
  assert.equal(selected.length, 0);
  button(tree, "Try again").props.onClick();
  assert.equal(retries, 2);
  tree = app.render({ ...props, product, addons: [] });
  assert.equal(button(tree, "Add to order").props.disabled, false);
  button(tree, "Add to order").props.onClick();
  assert.deepEqual(selected, [null]);
});

test("dialog traps focus, closes on Escape/backdrop, and restores focus and body scroll on cleanup", () => {
  const listeners = new Map();
  const document = { body: { style: { overflow: "scroll" } },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const element = () => ({ isConnected: true, focus() { document.activeElement = this; }, getClientRects: () => [{}] });
  const opener = element();
  const close = element();
  const confirm = element();
  let focusable = [close, confirm];
  const dialog = { ...element(), querySelectorAll: () => focusable,
    contains: (target) => target === dialog || focusable.includes(target) };
  opener.focus();
  const app = harness(document);
  let closed = 0;
  const props = { product, addons: [oat], onClose: () => closed++ };
  let tree = app.render(props);
  const dialogNode = all(tree, (node) => node.props?.role === "dialog")[0];
  assert.equal(dialogNode.props["aria-modal"], "true");
  assert.notEqual(dialogNode.props["aria-labelledby"], dialogNode.props["aria-describedby"]);
  dialogNode.ref.current = dialog;
  const closeNode = all(tree, (node) => node.props?.["aria-label"] === "Close coffee options")[0];
  closeNode.ref.current = close;
  app.flushEffects();
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(document.activeElement, close);
  const key = (key, shiftKey = false) => {
    let prevented = false;
    listeners.get("keydown")({ key, shiftKey, preventDefault() { prevented = true; }, stopPropagation() {} });
    return prevented;
  };
  assert.equal(key("Tab", true), true);
  assert.equal(document.activeElement, confirm);
  assert.equal(key("Tab"), true);
  assert.equal(document.activeElement, close);
  opener.focus();
  listeners.get("focusin")({ target: opener });
  assert.equal(document.activeElement, close);
  focusable = [];
  assert.equal(key("Tab"), true);
  assert.equal(document.activeElement, dialog);
  focusable = [close, confirm];
  let latestClosed = 0;
  tree = app.render({ ...props, onClose: () => latestClosed++ });
  app.flushEffects();
  assert.equal(key("Escape"), true);
  assert.equal(closed, 0);
  assert.equal(latestClosed, 1);
  tree.props.onMouseDown({ target: dialog, currentTarget: {} });
  assert.equal(latestClosed, 1, "clicking inside does not dismiss");
  const backdrop = {};
  tree.props.onMouseDown({ target: backdrop, currentTarget: backdrop });
  assert.equal(latestClosed, 2);
  app.unmount();
  assert.equal(document.body.style.overflow, "scroll");
  assert.equal(document.activeElement, opener);
  assert.equal(listeners.size, 0);
});
