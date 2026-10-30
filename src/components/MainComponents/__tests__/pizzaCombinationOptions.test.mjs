import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as menuProductVariants from "../../../utils/menuProductVariants.js";
import * as menuPizzaCombination from "../../../utils/menuPizzaCombination.js";

const source = fs.readFileSync(new URL("../PizzaCombinationOptions.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;

// Exercise the actual selection handlers with React elements and real price
// helpers, following the existing component harness without a DOM dependency.
function harness() {
  const states = [];
  let stateIndex = 0;
  const hooks = {
    ...React,
    useId: () => "combination-search",
    useMemo: (callback) => callback(),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
  };
  const modules = {
    react: hooks,
    "../../utils/menuProductVariants": menuProductVariants,
    "../../utils/menuPizzaCombination": menuPizzaCombination,
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
const search = (tree) => all(tree, (node) => node.type === "input" && node.props.type === "search")[0];
const flavorButton = (tree, name) => flavors(tree).find((node) => node.props["aria-label"].startsWith(`Second flavor ${name},`));
const product = (name, size, portion, price) => ({
  product_id: `${name}-${size}-${portion}`,
  item_name: `${name} ${size}"${portion === "half" ? " HALF" : ""}`,
  item_category: "PIZZA",
  selling_price: price,
});
const cheese9 = product("5 CHEESE", 9, "half", "335.00");
const cheese12 = product("5 CHEESE", 12, "half", 475);
const cheeseGroup = {
  familyKey: '["PIZZA","5 CHEESE"]',
  item_name: "5 CHEESE",
  item_category: "PIZZA",
  variants: [
    product("5 CHEESE", 12, "whole", 700), cheese12,
    product("5 CHEESE", 9, "whole", 420), cheese9,
  ],
};
const meat9 = product("ALL MEAT", 9, "half", 400);
const meat12 = product("ALL MEAT", 12, "half", "550.50");
const aloha9 = product("ALOHA 5 CHEESE", 9, "half", 350);
const products = [meat12, meat9, aloha9, cheese9];

test("starts at the smallest supported size and adds the two original half SKUs at their sum", () => {
  const render = harness();
  const selections = [];
  const props = { group: cheeseGroup, products, onSelect: (...selected) => selections.push(selected) };
  let tree = render(props);
  assert.equal(button(tree, '9"').props["aria-pressed"], true);
  assert(text(tree).includes("₱335.00"));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  assert(!flavorButton(tree, "5 CHEESE"), "the first flavor cannot be chosen twice");
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render(props);
  assert.equal(flavorButton(tree, "ALL MEAT").props["aria-pressed"], true);
  assert(text(tree).includes("₱735.00"));
  assert.equal(button(tree, "Combine flavor").props.disabled, false);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][0], cheese9);
  assert.equal(selections[0][1], meat9);
});

test("changing sizes clears the second flavor and only offers matching half sizes", () => {
  const render = harness();
  const selections = [];
  const props = { group: cheeseGroup, products, onSelect: (...selected) => selections.push(selected) };
  let tree = render(props);
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render(props);
  button(tree, '12"').props.onClick();
  tree = render(props);
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  assert.equal(flavors(tree).length, 1);
  assert.equal(flavorButton(tree, "ALL MEAT").props["aria-pressed"], false);
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render(props);
  assert(text(tree).includes("₱1,025.50"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][0], cheese12);
  assert.equal(selections[0][1], meat12);
});

test("second-flavor search matches partial words in any order without changing a confirmed choice", () => {
  const render = harness();
  const selections = [];
  const props = { group: cheeseGroup, products, onSelect: (...selected) => selections.push(selected) };
  let tree = render(props);
  search(tree).props.onChange({ target: { value: "  ChEeSe ALO  " } });
  tree = render(props);
  assert.equal(flavors(tree).length, 1);
  flavorButton(tree, "ALOHA 5 CHEESE").props.onClick();
  tree = render(props);
  search(tree).props.onChange({ target: { value: "not-a-flavor" } });
  tree = render(props);
  assert.equal(flavors(tree).length, 0);
  assert(text(tree).includes("No flavors match"));
  assert(text(tree).includes('5 CHEESE + ALOHA 5 CHEESE · 9" Whole'));
  assert(text(tree).includes("₱685.00"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][1], aloha9, "search never silently swaps the selected flavor");
});

test("loading and failed catalogs hide confirmation, offer retry, and use refreshed original product prices", () => {
  const render = harness();
  const selections = [];
  let retries = 0;
  const props = {
    group: cheeseGroup, products,
    onSelect: (...selected) => selections.push(selected), onRetry: () => retries++,
  };
  let tree = render(props);
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render({ ...props, isLoading: true });
  assert.equal(button(tree, "Combine flavor"), undefined);
  assert.equal(flavors(tree).length, 0);
  assert.equal(button(tree, '9"').props.disabled, true);
  assert(text(tree).includes("Loading available flavors"));
  tree = render({ ...props, error: "Unable to load prices" });
  assert.equal(button(tree, "Combine flavor"), undefined);
  assert.equal(flavors(tree).length, 0);
  button(tree, "Try again").props.onClick();
  assert.equal(retries, 1);
  const updatedMeat = { ...meat9, selling_price: 450 };
  tree = render({ ...props, products: [updatedMeat] });
  assert(text(tree).includes("₱785.00"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 1);
  assert.equal(selections[0][1], updatedMeat, "the callback gets the current catalogue row");
});

test("a removed or invalid-price selection cannot be submitted and missing sizes have clear feedback", () => {
  const render = harness();
  const selections = [];
  const props = { group: cheeseGroup, products, onSelect: (...selected) => selections.push(selected) };
  let tree = render(props);
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render({ ...props, products: [{ ...meat9, selling_price: null }] });
  assert(text(tree).includes('No other flavors are available for a 9" two-flavor pizza'));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  tree = render({ ...props, group: { ...cheeseGroup, variants: [cheese9] } });
  assert(text(tree).includes("not available for a two-flavor pizza"));
  assert.equal(button(tree, "Combine flavor"), undefined);
});

test("pizza combination copy labels contribution prices without exposing standalone Half options", () => {
  const render = harness();
  const props = { group: cheeseGroup, products };
  let tree = render(props);
  assert(text(tree).includes("one whole pizza"));
  assert(text(tree).includes("₱335.00/ flavor portion"));
  assert(text(flavorButton(tree, "ALL MEAT")).includes("₱400.00/ flavor portion"));
  assert(flavorButton(tree, "ALL MEAT").props["aria-label"].includes("flavor portion price ₱400.00"));
  flavorButton(tree, "ALL MEAT").props.onClick();
  tree = render(props);
  assert(text(tree).includes('5 CHEESE + ALL MEAT · 9" Whole'));
  assert(text(tree).includes("Combination total₱735.00"));

  const states = [
    tree,
    render({ ...props, isLoading: true }),
    render({ ...props, products: [] }),
    render({ ...props, group: { ...cheeseGroup, variants: [cheese9] } }),
  ];
  for (const state of states) {
    const accessibleLabels = all(state, (node) => node.props?.["aria-label"])
      .map((node) => node.props["aria-label"]).join(" ");
    assert.doesNotMatch(text(state), /\bhalf\b/iu);
    assert.doesNotMatch(accessibleLabels, /\bhalf\b/iu);
  }
});

test("changing the first flavor invalidates an existing second-flavor selection", () => {
  const render = harness();
  const props = { group: cheeseGroup, products };
  let tree = render(props);
  flavorButton(tree, "ALL MEAT").props.onClick();
  const nextGroup = {
    item_name: "ALOHA 5 CHEESE", item_category: "PIZZA",
    familyKey: '["PIZZA","ALOHA 5 CHEESE"]',
    variants: [product("ALOHA 5 CHEESE", 9, "whole", 500), aloha9],
  };
  tree = render({ ...props, group: nextGroup });
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  assert.equal(flavorButton(tree, "ALL MEAT").props["aria-pressed"], false);
});

test("large flavor catalogs mount 30 cards at a time while search includes every flavor", () => {
  const render = harness();
  const manyProducts = Array.from({ length: 65 }, (_, index) => product(`FLAVOR ${index + 1}`, 9, "half", 300 + index));
  const props = { group: cheeseGroup, products: manyProducts };
  let tree = render(props);
  assert.equal(flavors(tree).length, 30);
  button(tree, "Show more flavors (35 remaining)").props.onClick();
  tree = render(props);
  assert.equal(flavors(tree).length, 60);
  button(tree, "Show more flavors (5 remaining)").props.onClick();
  tree = render(props);
  assert.equal(flavors(tree).length, 65);
  search(tree).props.onChange({ target: { value: "65 flavor" } });
  tree = render(props);
  assert.equal(flavors(tree).length, 1);
  assert(flavorButton(tree, "FLAVOR 65"));
  search(tree).props.onChange({ target: { value: "FLAVOR" } });
  tree = render(props);
  assert.equal(flavors(tree).length, 30, "a changed search resets pagination");
});
