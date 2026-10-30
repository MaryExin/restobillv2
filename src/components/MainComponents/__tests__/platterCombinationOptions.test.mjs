import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as menuProductVariants from "../../../utils/menuProductVariants.js";
import * as menuPlatterCombination from "../../../utils/menuPlatterCombination.js";

const source = fs.readFileSync(new URL("../PlatterCombinationOptions.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;

// Exercise the real picker handlers with real catalog validation and pricing.
function harness() {
  const states = [];
  let stateIndex = 0;
  const hooks = {
    ...React,
    useId: () => "platter-flavor-search",
    useMemo: (callback) => callback(),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
  };
  const modules = {
    react: hooks,
    "../../utils/menuProductVariants": menuProductVariants,
    "../../utils/menuPlatterCombination": menuPlatterCombination,
  };
  const context = {
    exports: {},
    require(name) {
      assert(name in modules, `Unexpected module: ${name}`);
      return modules[name];
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  return (props) => {
    stateIndex = 0;
    return context.module.exports.default(props);
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
const flavors = (tree) => all(tree, (node) => node.type === "button" && node.props["aria-label"]?.startsWith("Second flavor "));
const flavorButton = (tree, name) => flavors(tree).find((node) => node.props["aria-label"].startsWith(`Second flavor ${name},`));
const search = (tree) => all(tree, (node) => node.type === "input" && node.props.type === "search")[0];
const product = (name, half, price) => ({
  product_id: `${name}-${half ? "half" : "whole"}`,
  item_name: `${name}${half ? " HALF" : ""}`,
  item_category: "CHICKEN WINGS PLATTER", selling_price: price,
});
const honeyWhole = product("HONEY GARLIC", false, "535.00");
const honeyHalf = product("HONEY GARLIC", true, "267.50");
const jerkHalf = product("JAMAICAN JERK", true, "275.00");
const parmesanHalf = product("BAKED PARMESAN", true, "267.50");
const honeyFamily = menuProductVariants.groupMenuProductVariants([honeyWhole, honeyHalf])[0];
const catalog = [jerkHalf, parmesanHalf, honeyHalf];

test("platter combinations add two distinct original Half SKUs at their sum without pizza sizes", () => {
  const render = harness();
  const selections = [];
  const props = { group: honeyFamily, products: catalog, onSelect: (...products) => selections.push(products) };
  let tree = render(props);
  assert(text(tree).includes("one whole chicken wings platter"));
  assert(text(tree).includes("₱267.50"));
  assert(!text(tree).includes("pizza"));
  assert(!text(tree).includes("Choose a size"));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  assert.equal(flavorButton(tree, "HONEY GARLIC"), undefined);
  flavorButton(tree, "JAMAICAN JERK").props.onClick();
  tree = render(props);
  assert.equal(flavorButton(tree, "JAMAICAN JERK").props["aria-pressed"], true);
  assert(text(tree).includes("HONEY GARLIC + JAMAICAN JERK · Whole platter"));
  assert(text(tree).includes("₱542.50"));
  assert.equal(button(tree, "Combine flavor").props.disabled, false);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][0], honeyHalf);
  assert.equal(selections[0][1], jerkHalf);
});

test("platter search matches words in any order and keeps a selected flavor while searching", () => {
  const render = harness();
  const selections = [];
  const props = { group: honeyFamily, products: catalog, onSelect: (...products) => selections.push(products) };
  let tree = render(props);
  search(tree).props.onChange({ target: { value: "  PARM BAKE  " } });
  tree = render(props);
  assert.equal(flavors(tree).length, 1);
  flavorButton(tree, "BAKED PARMESAN").props.onClick();
  tree = render(props);
  search(tree).props.onChange({ target: { value: "missing flavor" } });
  tree = render(props);
  assert.equal(flavors(tree).length, 0);
  assert(text(tree).includes("No flavors match"));
  assert(text(tree).includes("₱535.00"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][1], parmesanHalf);
});

test("loading and errors prevent submission, retry works, and refreshed prices use current products", () => {
  const render = harness();
  const selections = [];
  let retries = 0;
  const props = {
    group: honeyFamily, products: catalog,
    onSelect: (...products) => selections.push(products), onRetry: () => retries++,
  };
  let tree = render(props);
  flavorButton(tree, "JAMAICAN JERK").props.onClick();
  tree = render({ ...props, isLoading: true });
  assert.equal(button(tree, "Combine flavor"), undefined);
  assert.equal(flavors(tree).length, 0);
  assert(text(tree).includes("Loading available flavors"));
  tree = render({ ...props, error: "Unable to load prices" });
  assert.equal(button(tree, "Combine flavor"), undefined);
  button(tree, "Try again").props.onClick();
  assert.equal(retries, 1);
  const updatedJerk = { ...jerkHalf, selling_price: "280.00" };
  tree = render({ ...props, products: [updatedJerk] });
  assert(text(tree).includes("₱547.50"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][1], updatedJerk);
});

test("removed or invalid-price choices cannot be submitted and incomplete first pairs show feedback", () => {
  const render = harness();
  const selections = [];
  const props = { group: honeyFamily, products: catalog, onSelect: (...products) => selections.push(products) };
  let tree = render(props);
  flavorButton(tree, "JAMAICAN JERK").props.onClick();
  tree = render({ ...props, products: [parmesanHalf] });
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  tree = render({ ...props, products: [{ ...jerkHalf, selling_price: null }] });
  assert(text(tree).includes("No other flavors are available for a two-flavor platter"));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  tree = render({ ...props, group: { ...honeyFamily, variants: [honeyHalf] } });
  assert(text(tree).includes("not available for a two-flavor platter"));
  assert.equal(button(tree, "Combine flavor"), undefined);
});

test("platter combination copy labels contribution prices without exposing standalone Half options", () => {
  const render = harness();
  const props = { group: honeyFamily, products: catalog };
  let tree = render(props);
  assert(text(tree).includes("one whole chicken wings platter"));
  assert(text(tree).includes("₱267.50/ flavor portion"));
  assert(text(flavorButton(tree, "JAMAICAN JERK")).includes("₱275.00/ flavor portion"));
  assert(flavorButton(tree, "JAMAICAN JERK").props["aria-label"].includes("flavor portion price ₱275.00"));
  flavorButton(tree, "JAMAICAN JERK").props.onClick();
  tree = render(props);
  assert(text(tree).includes("HONEY GARLIC + JAMAICAN JERK · Whole platter"));
  assert(text(tree).includes("Combination total₱542.50"));

  const states = [
    tree,
    render({ ...props, isLoading: true }),
    render({ ...props, products: [] }),
    render({ ...props, group: { ...honeyFamily, variants: [honeyHalf] } }),
  ];
  for (const state of states) {
    const accessibleLabels = all(state, (node) => node.props?.["aria-label"])
      .map((node) => node.props["aria-label"]).join(" ");
    assert.doesNotMatch(text(state), /\bhalf\b/iu);
    assert.doesNotMatch(accessibleLabels, /\bhalf\b/iu);
  }
});

test("changing the first platter family clears a previous second flavor", () => {
  const render = harness();
  const props = { group: honeyFamily, products: catalog };
  let tree = render(props);
  flavorButton(tree, "JAMAICAN JERK").props.onClick();
  const nextGroup = menuProductVariants.groupMenuProductVariants([
    product("BAKED PARMESAN", false, 535), parmesanHalf,
  ])[0];
  tree = render({ ...props, group: nextGroup });
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  assert.equal(flavorButton(tree, "JAMAICAN JERK").props["aria-pressed"], false);
});
