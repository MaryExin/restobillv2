import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as menuChickenCombination from "../../../utils/menuChickenCombination.js";
import { groupMenuProductVariants } from "../../../utils/menuProductVariants.js";

const compiled = transformSync(fs.readFileSync(new URL("../ChickenCombinationOptions.jsx", import.meta.url), "utf8"), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;
function harness() {
  const states = [];
  let index = 0;
  const modules = {
    react: { ...React, useMemo: (callback) => callback(), useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = value; }];
    } },
    "../../utils/menuChickenCombination": menuChickenCombination,
  };
  const context = { exports: {}, require(name) {
    assert(name in modules, `Unexpected module: ${name}`);
    return modules[name];
  } };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  return (props) => { index = 0; return context.module.exports.default(props); };
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
const flavors = (tree, position) => all(tree, (node) => node.type === "button" && node.props["aria-label"]?.startsWith(`${position} flavor `));
const flavor = (tree, position, name) => flavors(tree, position).find((node) => node.props["aria-label"].startsWith(`${position} flavor ${name},`));
const row = (product_id, item_name, item_category, selling_price) => Object.freeze({ product_id, item_name, item_category, selling_price });
// Actual grumpyjoe_pos rows audited on 2026-10-22. The GJ Double/Group portion
// prices and Buffalo Group prices deliberately differ from whole price / 2.
const wings = [
  row("BD-b4a9586fb5aa", "BUFALLO WINGS SOLO", "BUFALLO WINGS", 525),
  row("BD-99fcb5210190", "BUFALLO WINGS SOLO SPICY", "BUFALLO WINGS", 525),
  row("BD-bf723c7e4ef9", "BUFFALO WINGS SOLO HALF", "BUFALLO WINGS", 262.5),
  row("BD-ad3bafe022af", "BUFFALO WINGS SOLO SPICY HALF", "BUFALLO WINGS", 262.5),
  row("BD-009d350cb23d", "BUFALLO WINGS DOUBLE", "BUFALLO WINGS", 970),
  row("BD-130e2ada8e59", "BUFALLO WINGS DOUBLE SPICY", "BUFALLO WINGS", 970),
  row("BD-69686ec3f3c1", "BUFFALO WINGS DOUBLE HALF", "BUFALLO WINGS", 485),
  row("BD-acc5acfc1580", "BUFFALO WINGS DOUBLE SPICY HALF", "BUFALLO WINGS", 485),
  row("BD-1a6bc89f81da", "BUFALLO WINGS GROUP", "BUFALLO WINGS", 1410),
  row("BD-540db9a472d3", "BUFALLO WINGS GROUP SPICY", "BUFALLO WINGS", 1410),
  row("BD-d17ae4609bec", "BUFFALO WINGS GROUP HALF", "BUFALLO WINGS", 710),
  row("BD-ac78db9b9841", "BUFFALO WINGS GROUP SPICY HALF", "BUFALLO WINGS", 710),
];
const chicken = [
  row("BD-347b92b6cf0f", "GJ FRIED CHICKEN SOLO", "GJ FRIED CHICKEN", 495),
  row("BD-3b6b31828a43", "GJ FRIED CHICKEN SOLO HALF", "GJ FRIED CHICKEN", 247.5),
  row("BD-de5c052b097b", "GJ FRIED CHICKEN DOUBLE", "GJ FRIED CHICKEN", 935),
  row("BD-8cc22876d686", "GJ FRIED CHICKEN DOUBLE HALF", "GJ FRIED CHICKEN", 935),
  row("BD-7c8f7ae338c6", "GJ FRIED CHICKEN GROUP", "GJ FRIED CHICKEN", 1360),
  row("BD-d8b8512978e2", "GJ FRIED CHICKEN GROUP HALF", "GJ FRIED CHICKEN", 1360),
];
const products = [...wings, ...chicken];
const wingsGroup = () => groupMenuProductVariants(wings)[0];
const chickenGroup = () => groupMenuProductVariants(chicken)[0];
const half = (size, label) => products.find((product) => {
  const details = menuChickenCombination.getChickenVariantDetails(product);
  return details.portion === "half" && details.sizeLabel === size && details.flavorLabel === label;
});
const original = "BUFFALO WINGS Original";
const spicy = "BUFFALO WINGS Spicy";
const gj = "GJ FRIED CHICKEN";

test("Solo starts with Original and offers only same-size GJ as the second flavor without Half labels", () => {
  const render = harness();
  const selections = [];
  const props = { group: wingsGroup(), products: [...products,
    row("platter", "HONEY GARLIC HALF", "CHICKEN WINGS PLATTER", 267.5),
    row("rice", "RM BUFFALO WINGS", "RICE MEAL", 355),
  ], onSelect: (...rows) => selections.push(rows) };
  let tree = render(props);
  const sizes = all(tree, (node) => node.props?.["aria-label"] === "Chicken combination size")[0];
  assert.deepEqual(all(sizes, (node) => node.type === "button").map(text), ["Solo", "Double", "Group"]);
  assert.equal(button(tree, "Solo").props["aria-pressed"], true);
  assert.equal(flavor(tree, "First", original).props["aria-pressed"], true);
  assert.equal(flavors(tree, "First").length, 2);
  assert.equal(flavors(tree, "Second").length, 1);
  assert(flavor(tree, "First", spicy));
  assert.equal(flavor(tree, "Second", original), undefined);
  assert.equal(flavor(tree, "Second", spicy), undefined);
  assert(flavor(tree, "Second", gj));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections.length, 0);
  flavor(tree, "Second", gj).props.onClick();
  tree = render(props);
  assert(text(tree).includes("Order total₱510.00"));
  assert(text(tree).includes("₱262.50/ flavor portion"));
  assert.doesNotMatch(text(tree), /\bhalf\b/iu);
  assert.doesNotMatch(all(tree, (node) => node.props?.["aria-label"]).map((node) => node.props["aria-label"]).join(" "), /\bhalf\b/iu);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selections[0][0], half("Solo", original));
  assert.equal(selections[0][1], half("Solo", gj));
});

test("GJ combines with Buffalo Original or Spicy at every size using actual current portion prices", () => {
  for (const [size, total] of [["Solo", "₱510.00"], ["Double", "₱1,420.00"], ["Group", "₱2,070.00"]]) {
    for (const secondName of [original, spicy]) {
      const render = harness();
      const selected = [];
      const props = { group: chickenGroup(), products, onSelect: (...rows) => selected.push(rows) };
      let tree = render(props);
      button(tree, size).props.onClick();
      tree = render(props);
      assert.equal(flavors(tree, "First").length, 1);
      assert.equal(flavors(tree, "Second").length, 2);
      assert.equal(flavor(tree, "First", spicy), undefined);
      assert.equal(flavor(tree, "Second", gj), undefined);
      flavor(tree, "Second", secondName).props.onClick();
      tree = render(props);
      assert(text(tree).includes(`Order total${total}`));
      button(tree, "Combine flavor").props.onClick();
      assert.equal(selected[0][0], half(size, gj));
      assert.equal(selected[0][1], half(size, secondName));
    }
  }
});

test("Buffalo Original or Spicy combines only with GJ at each matching size, never another Buffalo flavor", () => {
  for (const [size, total] of [["Solo", "₱510.00"], ["Double", "₱1,420.00"], ["Group", "₱2,070.00"]]) {
    for (const firstName of [original, spicy]) {
      const render = harness();
      const selected = [];
      const props = { group: wingsGroup(), products, onSelect: (...rows) => selected.push(rows) };
      let tree = render(props);
      button(tree, size).props.onClick();
      tree = render(props);
      assert.equal(flavors(tree, "First").length, 2);
      flavor(tree, "First", firstName).props.onClick();
      tree = render(props);
      assert.equal(flavor(tree, "First", firstName).props["aria-pressed"], true);
      assert.equal(flavors(tree, "Second").length, 1);
      assert.equal(flavor(tree, "Second", spicy), undefined);
      assert.equal(flavor(tree, "Second", original), undefined);
      flavor(tree, "Second", gj).props.onClick();
      tree = render(props);
      assert(text(tree).includes(`Order total${total}`));
      button(tree, "Combine flavor").props.onClick();
      assert.equal(selected[0][0], half(size, firstName));
      assert.equal(selected[0][1], half(size, gj));
    }
  }
});

test("changing size, first flavor, or family clears confirmation and never retains a mismatched second SKU", () => {
  const render = harness();
  const props = { group: wingsGroup(), products };
  let tree = render(props);
  flavor(tree, "Second", gj).props.onClick();
  tree = render(props);
  button(tree, "Group").props.onClick();
  tree = render(props);
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  assert(flavors(tree, "Second").every((node) => node.props["aria-label"].includes(", Group,")));
  flavor(tree, "Second", gj).props.onClick();
  tree = render(props);
  assert.equal(button(tree, "Combine flavor").props.disabled, false);
  flavor(tree, "First", spicy).props.onClick();
  tree = render(props);
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  assert.equal(flavor(tree, "Second", spicy), undefined);
  assert.equal(flavor(tree, "Second", original), undefined);
  flavor(tree, "Second", gj).props.onClick();
  tree = render(props);
  assert.equal(button(tree, "Combine flavor").props.disabled, false);
  tree = render({ ...props, group: chickenGroup() });
  assert.equal(button(tree, "Solo").props["aria-pressed"], true);
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
});

test("refresh uses current first and second objects; removed or invalid selections cannot submit", () => {
  const render = harness();
  const selected = [];
  const props = { group: wingsGroup(), products, onSelect: (...rows) => selected.push(rows) };
  let tree = render(props);
  flavor(tree, "First", original).props.onClick();
  tree = render(props);
  flavor(tree, "Second", gj).props.onClick();
  const first = { ...half("Solo", original), selling_price: 270 };
  const second = { ...half("Solo", gj), selling_price: 250 };
  const currentGroup = { ...props.group, variants: props.group.variants.map((row) => row.product_id === first.product_id ? first : row) };
  tree = render({ ...props, group: currentGroup, products: [second] });
  assert(text(tree).includes("Order total₱520.00"));
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selected[0][0], first);
  assert.equal(selected[0][1], second);
  tree = render({ ...props, products: [{ ...second, selling_price: null }] });
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  tree = render({ ...props, products: [] });
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  assert(text(tree).includes("No other flavors are available"));
  tree = render({ ...props, group: { ...props.group, variants: props.group.variants.filter((row) => row.product_id !== first.product_id) } });
  assert(text(tree).includes("The selected first flavor is unavailable"));
  assert.equal(button(tree, "Solo").props["aria-pressed"], true);
  assert.equal(flavor(tree, "First", spicy).props["aria-pressed"], false,
    "a removed Original selection cannot silently become Spicy");
  assert.equal(flavor(tree, "Second", spicy), undefined);
  assert(flavors(tree, "Second").every((node) => !node.props["aria-pressed"]));
  assert.equal(button(tree, "Combine flavor").props.disabled, true);
  button(tree, "Combine flavor").props.onClick();
  assert.equal(selected.length, 1);
});

test("loading, errors, retry and missing source pairs never expose a confirmation action", () => {
  const render = harness();
  let retries = 0;
  const props = { group: wingsGroup(), products, onRetry: () => retries++ };
  let tree = render({ ...props, isLoading: true });
  assert.equal(button(tree, "Combine flavor"), undefined);
  assert.equal(button(tree, "Solo").props.disabled, true);
  assert.equal(flavors(tree, "Second").length, 0);
  tree = render({ ...props, error: "Unable to load prices" });
  assert.equal(button(tree, "Combine flavor"), undefined);
  button(tree, "Try again").props.onClick();
  assert.equal(retries, 1);
  tree = render({ ...props, group: { ...props.group, variants: [half("Solo", original)] } });
  assert(text(tree).includes("No sizes are available to combine"));
  assert.equal(button(tree, "Combine flavor"), undefined);
});
