import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformSync } from "@swc/core";
import * as productOptions from "../../../utils/productOptions.js";

// The pre-order picker (reservations and room service) uses the same
// "Item Instruction" modal as the ordering screen: suggested option chips
// open right after an item with option groups is added, and the picks are
// saved on the item as its special instruction.
const source = fs.readFileSync(new URL("../PreOrderPicker.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
  module: { type: "commonjs" },
}).code;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const Chips = () => null;
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

const SERVE = { group_name: "Serve", select_type: "single", options: ["Neat", "On the rocks"], default_option: "Neat" };
const PRODUCTS = [
  { product_id: "P1", item_name: "ABSOLUT VODKA (SHOT)", selling_price: 165, item_category: "SPIRITS" },
  { product_id: "P2", item_name: "BOTTLED WATER", selling_price: 40, item_category: "MINIBAR" },
  { product_id: "P3", item_name: "JACK DANIELS (SHOT)", selling_price: 180, item_category: "SPIRITS" },
];

async function mountPicker() {
  const states = [], refs = [], requests = [], stored = {}, timers = [];
  let stateIndex, refIndex, effects, previousEffects = [], tree;
  let value = { salesType: "", items: [] };
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
    useMemo: callback => callback(),
    useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
  };
  const modules = {
    react: hooks,
    "../../context/ThemeContext": { useTheme: () => ({ theme: "light" }) },
    "../MainComponents/Common/ProductOptionChips": Chips,
    "../../utils/productOptions": {
      ...productOptions,
      productOptionsEndpoint: host => `${host}/api/pos_product_options.php`,
    },
  };
  const context = {
    exports: {},
    AbortController,
    URLSearchParams,
    console,
    localStorage: { getItem: key => stored[key] ?? null, setItem: (key, val) => { stored[key] = val; } },
    setTimeout: callback => timers.push(callback) && timers.length,
    clearTimeout: noop,
    fetch: (url, options = {}) => {
      requests.push({ url, options });
      const response = data => ({ ok: true, json: async () => data });
      if (url.includes("pos_product_options.php")) {
        return Promise.resolve(response({
          success: true,
          message: "ok",
          data: { options: {}, category_options: { SPIRITS: [SERVE] } },
        }));
      }
      assert(url.includes("get_pricing_selection.php"), `Unexpected request: ${url}`);
      const body = JSON.parse(options.body);
      const products = body.codes ? PRODUCTS.filter(p => body.codes.includes(p.product_id)) : PRODUCTS;
      return Promise.resolve(response({ status: "success", products }));
    },
    require: name => modules[name] || (name.startsWith("react-icons/") ? new Proxy({}, { get: (_, key) => key }) : noop),
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  const Picker = context.module.exports.default;

  function render() {
    stateIndex = refIndex = 0;
    effects = [];
    tree = Picker({
      apiHost: "http://pos.test",
      scope: { category_code: "Richwell", unit_code: "BU-1" },
      salesTypes: [{ sales_type_id: 1, sales_type: "ROOM SERVICE" }],
      suggestedSalesType: "ROOM SERVICE",
      value,
      onChange: next => { value = next; },
      startExpanded: true,
    });
    effects.forEach((effect, index) => {
      const previous = previousEffects[index];
      const changed = !previous || effect.dependencies.some((dep, i) => !Object.is(dep, previous.dependencies[i]));
      if (!changed) { effect.cleanup = previous.cleanup; return; }
      previous?.cleanup?.();
      effect.cleanup = effect.callback();
    });
    previousEffects = effects;
    return tree;
  }
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await flush();
      render();
      while (timers.length) timers.shift()();
      await flush();
      render();
    }
  };
  render();
  await settle();
  const button = label => all(tree, node => node.type === "button" && text(node).trim() === label)[0];
  const byAria = label => all(tree, node => node.type === "button" && node.props["aria-label"] === label)[0];
  return {
    requests, stored, render, settle, button, byAria,
    get tree() { return tree; },
    get value() { return value; },
    product: name => all(tree, node => node.type === "button" && text(node).includes(name))[0],
    modal: () => all(tree, node => node.props?.role === "dialog")[0],
    chips: () => all(tree, node => node.type === Chips)[0],
    textarea: () => all(tree, node => node.type === "textarea")[0],
  };
}

test("options are loaded for the POS scope and the response envelope is unwrapped", async () => {
  const picker = await mountPicker();
  const optionsRequest = picker.requests.find(r => r.url.includes("pos_product_options.php"));
  assert(optionsRequest, "options are fetched when the picker opens");
  assert.match(optionsRequest.url, /category_code=Richwell/);
  assert.match(optionsRequest.url, /unit_code=BU-1/);
  assert.equal(picker.value.salesType, "ROOM SERVICE");
  assert(picker.product("ABSOLUT VODKA"), "menu results are listed");
});

test("adding an item with suggested options opens the Item Instruction modal; the picks become its instruction", async () => {
  const picker = await mountPicker();
  picker.product("ABSOLUT VODKA").props.onClick();
  picker.render();
  assert.equal(picker.value.items.length, 1, "the item is added before the options are asked");
  const modal = picker.modal();
  assert(modal, "the Item Instruction modal opens for a product with option groups");
  assert.match(text(modal), /Item Instruction/);
  assert.match(text(modal), /ABSOLUT VODKA \(SHOT\)/);
  assert.match(text(modal), /Suggested options/);
  assert.match(text(modal), /Other request \(optional\)/);
  assert(picker.button("Add to order") && picker.button("Skip"), "add mode uses Add to order / Skip");
  const chips = picker.chips();
  assert.deepEqual(chips.props.groups, [SERVE]);
  assert.deepEqual(chips.props.selections, { Serve: "Neat" });

  chips.props.onChange({ Serve: "On the rocks" });
  picker.render();
  picker.textarea().props.onChange({ target: { value: "extra lime" } });
  picker.render();
  picker.button("Add to order").props.onClick();
  picker.render();
  assert.equal(picker.modal(), undefined, "the modal closes after saving");
  assert.equal(picker.value.items[0].item_instruction, "Serve: On the rocks\nextra lime");
  assert.match(text(picker.tree), /Serve: On the rocks · extra lime/, "the summary shows under the item");

  // Reset to default clears the choice: only differences from the default are kept.
  picker.byAria("Instruction for ABSOLUT VODKA (SHOT)").props.onClick();
  picker.render();
  assert(picker.button("Save") && picker.button("Cancel"), "edit mode uses Save / Cancel");
  assert.deepEqual(picker.chips().props.selections, { Serve: "On the rocks" });
  picker.button("Reset to default").props.onClick();
  picker.render();
  picker.button("Save").props.onClick();
  picker.render();
  assert.equal(picker.value.items[0].item_instruction, "extra lime");
});

test("Skip keeps the item without a note; Cancel leaves an edited line unchanged", async () => {
  const picker = await mountPicker();
  picker.product("JACK DANIELS").props.onClick();
  picker.render();
  assert(picker.modal());
  picker.chips().props.onChange({ Serve: "On the rocks" });
  picker.render();
  picker.button("Skip").props.onClick();
  picker.render();
  assert.equal(picker.modal(), undefined);
  assert.equal(JSON.stringify(picker.value.items.map(i => [i.product_id, i.quantity, i.item_instruction])), JSON.stringify([["P3", 1, ""]]));

  picker.product("JACK DANIELS").props.onClick();
  picker.render();
  assert.equal(picker.modal(), undefined, "adding the same item again only adds to the quantity");
  assert.equal(picker.value.items[0].quantity, 2);

  picker.byAria("Instruction for JACK DANIELS (SHOT)").props.onClick();
  picker.render();
  picker.textarea().props.onChange({ target: { value: "double" } });
  picker.render();
  picker.button("Cancel").props.onClick();
  picker.render();
  assert.equal(picker.value.items[0].item_instruction, "");
});

test("a product without option groups gets a plain special-instruction box, and the prompt can be turned off", async () => {
  const picker = await mountPicker();
  picker.product("BOTTLED WATER").props.onClick();
  picker.render();
  assert.equal(picker.modal(), undefined, "no prompt when the product has no suggested options");
  picker.byAria("Instruction for BOTTLED WATER").props.onClick();
  picker.render();
  const modal = picker.modal();
  assert(modal);
  assert.match(text(modal), /Special instruction/);
  assert.equal(picker.chips(), undefined, "no chips without groups");
  assert.doesNotMatch(text(modal), /Ask for options/);
  picker.textarea().props.onChange({ target: { value: "cold, no ice" } });
  picker.render();
  picker.button("Save").props.onClick();
  picker.render();
  assert.equal(picker.value.items[0].item_instruction, "cold, no ice");

  // Turning the prompt off is remembered like on the ordering screen.
  picker.product("ABSOLUT VODKA").props.onClick();
  picker.render();
  const checkbox = all(picker.tree, node => node.type === "input" && node.props.type === "checkbox")[0];
  assert(checkbox && checkbox.props.checked === true);
  checkbox.props.onChange({ target: { checked: false } });
  picker.render();
  assert.equal(picker.stored.posAskItemOptions, "false");
  picker.button("Skip").props.onClick();
  picker.render();
  picker.product("JACK DANIELS").props.onClick();
  picker.render();
  assert.equal(picker.modal(), undefined, "no prompt once it is turned off");
  assert.equal(picker.value.items.length, 3);
});
