import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { transformSync } from "@swc/core";
import * as menuProductVariants from "../../../utils/menuProductVariants.js";
import * as menuPizzaCombination from "../../../utils/menuPizzaCombination.js";
import * as menuPlatterCombination from "../../../utils/menuPlatterCombination.js";
import * as menuChickenCombination from "../../../utils/menuChickenCombination.js";

const source = fs.readFileSync(new URL("../ProductVariantModal.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020" },
  module: { type: "commonjs" },
}).code;
const combinationOptions = () => null;
const platterCombinationOptions = () => null;
const chickenCombinationOptions = () => null;

// Render the real component and exercise its selection handlers without adding
// a DOM dependency. Parsing and grouping use the production helper unchanged.
function harness() {
  const states = [];
  let stateIndex = 0;
  const hooks = {
    ...React,
    useId: () => "product-options",
    useMemo: (callback) => callback(),
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
  };
  const modules = {
    react: hooks,
    "react-dom": { createPortal: (child) => child },
    "react-icons/fi": { FiX: () => null },
    "../../utils/menuProductVariants": menuProductVariants,
    "../../utils/menuPizzaCombination": menuPizzaCombination,
    "../../utils/menuPlatterCombination": menuPlatterCombination,
    "../../utils/menuChickenCombination": menuChickenCombination,
    "./PizzaCombinationOptions": { default: combinationOptions, __esModule: true },
    "./PlatterCombinationOptions": { default: platterCombinationOptions, __esModule: true },
    "./ChickenCombinationOptions": { default: chickenCombinationOptions, __esModule: true },
  };
  const context = {
    exports: {},
    document: { body: {} },
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
const labeledButton = (tree, label) => all(tree,
  (node) => node.type === "button" && node.props["aria-label"] === label)[0];
const variants = (tree) => all(tree,
  (node) => node.type === "button" && node.props["data-product-id"] !== undefined);
const wings = (size, price, spicy = false) => ({
  product_id: `wings-${size}${spicy ? "-spicy" : ""}`,
  item_name: `BUFALLO WINGS ${size.toUpperCase()}${spicy ? " SPICY" : ""}`,
  item_category: "BUFFALO WINGS", selling_price: price,
});
const solo = wings("solo", "525.00");
const double = wings("double", "970.00");
const group = wings("group", "1410.00");
const soloSpicy = wings("solo", "525.00", true);
const doubleSpicy = wings("double", "970.00", true);
const groupSpicy = wings("group", "1410.00", true);
const wingsGroup = () => menuProductVariants.groupMenuProductVariants([
  groupSpicy, group, doubleSpicy, solo, soloSpicy, double,
])[0];

test("wings show ordered sizes with Original/Spicy choices and select the original Group Spicy SKU", () => {
  const selected = [];
  const render = harness();
  const props = { group: wingsGroup(), onSelect: (product) => selected.push(product) };
  let tree = render(props);
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert(text(tree).includes("Choose Solo, Double, or Group, then select a flavor."));
  const sizes = all(tree, (node) => node.props?.role === "group" && node.props["aria-label"] === "Size")[0];
  assert.deepEqual(all(sizes, (node) => node.type === "button").map((node) => text(node)), ["Solo", "Double", "Group"]);
  assert.equal(labeledButton(tree, "Solo").props["aria-pressed"], true);
  assert(text(tree).includes("Solo flavors"));
  assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]),
    [solo.product_id, soloSpicy.product_id]);
  assert(text(variants(tree)[0]).startsWith("Original"));
  assert(text(variants(tree)[1]).startsWith("Spicy"));
  assert(text(variants(tree)[0]).includes("₱525.00"));
  labeledButton(tree, "Double").props.onClick();
  tree = render(props);
  assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]),
    [double.product_id, doubleSpicy.product_id]);
  assert(text(variants(tree)[0]).includes("₱970.00"));
  labeledButton(tree, "Group").props.onClick();
  tree = render(props);
  assert.equal(labeledButton(tree, "Group").props["aria-pressed"], true);
  assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]),
    [group.product_id, groupSpicy.product_id]);
  assert(text(variants(tree)[1]).includes("₱1,410.00"));
  variants(tree)[1].props.onClick();
  assert.equal(selected[0], groupSpicy);
  assert.equal(selected[0].selling_price, "1410.00");
});

test("wings loading and retry states retain size copy without pizza portion controls", () => {
  const render = harness();
  const family = { ...wingsGroup(), variants: [] };
  let tree = render({ group: family, isLoading: true });
  assert(text(tree).includes("Loading available sizes and prices"));
  assert(text(tree).includes("Choose Solo, Double, or Group, then select a flavor."));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  let retries = 0;
  tree = render({ group: family, error: "Unable to load prices", onRetry: () => retries++ });
  assert.equal(labeledButton(tree, "Half"), undefined);
  all(tree, (node) => node.type === "button" && text(node) === "Try again")[0].props.onClick();
  assert.equal(retries, 1);
});

test("a wings size without a valid price cannot be selected", () => {
  const selected = [];
  const family = menuProductVariants.groupMenuProductVariants([
    solo, { ...soloSpicy, selling_price: null }, double,
  ])[0];
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product) });
  const unavailable = variants(tree)[1];
  assert.equal(unavailable.props.disabled, true);
  assert(text(unavailable).includes("Price unavailable"));
  unavailable.props.onClick();
  assert.equal(selected.length, 0);
});

const chicken = (size, price) => ({
  product_id: `chicken-${size}`,
  item_name: `GJ FRIED CHICKEN ${size.toUpperCase()}`,
  item_category: "CHICKEN", selling_price: price,
});
const chickenSolo = chicken("solo", "495.00");
const chickenDouble = chicken("double", "935.00");
const chickenGroup = chicken("group", "1360.00");
const chickenFamily = () => menuProductVariants.groupMenuProductVariants([
  chickenGroup, chickenSolo, chickenDouble,
])[0];

test("fried chicken sizes are directly selectable in Solo, Double, Group order at their original prices", () => {
  const selected = [];
  const tree = harness()({ group: chickenFamily(), onSelect: (product) => selected.push(product) });
  assert(text(tree).includes("Choose a size: Solo, Double, or Group."));
  assert(text(tree).includes("Size options"));
  assert(!text(tree).includes("flavor"));
  assert(!text(tree).includes("Original"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.equal(all(tree, (node) => node.props?.role === "group" && node.props["aria-label"] === "Size").length, 0,
    "size-only products do not require a second selection after choosing their size");
  const choices = variants(tree);
  assert.deepEqual(choices.map((node) => node.props["data-product-id"]),
    [chickenSolo.product_id, chickenDouble.product_id, chickenGroup.product_id]);
  assert(text(choices[0]).startsWith("Solo"));
  assert(text(choices[0]).includes("₱495.00"));
  assert(text(choices[1]).startsWith("Double"));
  assert(text(choices[1]).includes("₱935.00"));
  assert(text(choices[2]).startsWith("Group"));
  assert(text(choices[2]).includes("₱1,360.00"));
  choices[1].props.onClick();
  assert.equal(selected[0], chickenDouble);
  assert.equal(selected[0].selling_price, "935.00");
});

test("fried chicken retains size-only guidance while loading or retrying without variants", () => {
  const render = harness();
  const family = { ...chickenFamily(), variants: [] };
  let tree = render({ group: family, isLoading: true });
  assert(text(tree).includes("Choose a size: Solo, Double, or Group."));
  assert(text(tree).includes("Loading available sizes and prices"));
  assert(!text(tree).includes("flavor"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(variants(tree).length, 0);
  let retries = 0;
  tree = render({ group: family, error: "Unable to load prices", onRetry: () => retries++ });
  assert(text(tree).includes("Choose a size: Solo, Double, or Group."));
  assert(!text(tree).includes("flavor"));
  assert.equal(labeledButton(tree, "Half"), undefined);
  all(tree, (node) => node.type === "button" && text(node) === "Try again")[0].props.onClick();
  assert.equal(retries, 1);
});

test("fried chicken disables an unavailable size while preserving the other size choices", () => {
  const selected = [];
  const family = menuProductVariants.groupMenuProductVariants([
    chickenGroup, { ...chickenDouble, selling_price: null }, chickenSolo,
  ])[0];
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product) });
  const choices = variants(tree);
  assert.equal(choices.length, 3);
  assert.equal(choices[1].props.disabled, true);
  assert(text(choices[1]).includes("Price unavailable"));
  choices[1].props.onClick();
  assert.equal(selected.length, 0);
  choices[2].props.onClick();
  assert.equal(selected[0], chickenGroup);
});

const gelato = (size, price) => ({
  product_id: `avocado-${size}-oz`, item_name: `GELATO AVOCADO ${size}OZ`,
  item_category: "GELATO", selling_price: price,
});
const gelato6 = gelato(6, "95.00");
const gelato8 = gelato(8, "145.00");
const gelato16 = gelato(16, "280.00");
const gelato22 = gelato(22, "350.00");
const gelatoFamily = () => menuProductVariants.groupMenuProductVariants([
  gelato22, gelato8, gelato16, gelato6,
])[0];

test("ounce sizes are directly selectable in numeric order with original product IDs and prices", () => {
  const selected = [];
  // Detail metadata also identifies ounce sizes if a caller omits the group marker.
  const family = { ...gelatoFamily(), sizeKind: undefined };
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product) });
  assert(text(tree).includes("Choose a size in ounces."));
  assert(text(tree).includes("Size options"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  const choices = variants(tree);
  assert.deepEqual(choices.map((node) => node.props["data-product-id"]),
    [gelato6.product_id, gelato8.product_id, gelato16.product_id, gelato22.product_id]);
  for (const [index, size] of [6, 8, 16, 22].entries()) {
    assert(text(choices[index]).startsWith(`${size} oz`));
  }
  assert(text(choices[0]).includes("₱95.00"));
  assert(text(choices[1]).includes("₱145.00"));
  choices[1].props.onClick();
  assert.equal(selected[0], gelato8);
  assert.equal(selected[0].selling_price, "145.00");
});

test("ounce groups keep size guidance through loading and retry without portion controls", () => {
  const render = harness();
  const family = { ...gelatoFamily(), variants: [] };
  let tree = render({ group: family, isLoading: true });
  assert(text(tree).includes("Choose a size in ounces."));
  assert(text(tree).includes("Loading available sizes and prices"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.equal(variants(tree).length, 0);
  let retries = 0;
  tree = render({ group: family, error: "Unable to load prices", onRetry: () => retries++ });
  assert(text(tree).includes("Choose a size in ounces."));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  all(tree, (node) => node.type === "button" && text(node) === "Try again")[0].props.onClick();
  assert.equal(retries, 1);
});

test("an ounce size without a price cannot be selected while priced sizes remain available", () => {
  const selected = [];
  const family = menuProductVariants.groupMenuProductVariants([
    { ...gelato8, selling_price: null }, gelato6,
  ])[0];
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product) });
  const choices = variants(tree);
  assert.equal(choices.length, 2);
  assert.equal(choices[1].props.disabled, true);
  assert(text(choices[1]).includes("Price unavailable"));
  choices[1].props.onClick();
  assert.equal(selected.length, 0);
  choices[0].props.onClick();
  assert.equal(selected[0], gelato6);
});

test("ounce sizes cannot enter pizza combinations even with an active combination flag", () => {
  const family = menuProductVariants.groupMenuProductVariants([
    { ...gelato6, item_category: "PIZZA" }, { ...gelato8, item_category: "PIZZA" },
  ])[0];
  const tree = harness()({ group: family, combinationMode: true, onSelectCombination: () => {} });
  assert(text(tree).includes("Choose a size in ounces."));
  assert.equal(all(tree, (node) => node.type === combinationOptions || node.type === platterCombinationOptions || node.type === chickenCombinationOptions).length, 0);
  assert.equal(all(tree, (node) => node.props?.["aria-label"] === "Whole pizza flavors").length, 0);
  assert.equal(variants(tree).length, 2);
});

const avocadoScoop = {
  product_id: "BD-0cd50f469514", item_name: "GELATO AVOCADO SCOOP",
  item_category: "GELATO", selling_price: "60.00",
};
const avocado6 = { ...gelato6, product_id: "BD-b3b4c148b9f9" };
const avocado8 = { ...gelato8, product_id: "BD-9c6ba5295e21" };

test("gelato offers Scoop before ounce sizes and preserves original Scoop and ounce products", () => {
  const selected = [];
  // Begin with an ounce row so Scoop is discovered from its variant metadata.
  const family = menuProductVariants.groupMenuProductVariants([avocado8, avocadoScoop, avocado6])[0];
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product),
    combinationMode: true, onSelectCombination: () => {} });
  assert(text(tree).includes("Choose a serving size."));
  assert(text(tree).includes("Size options"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.equal(all(tree, (node) => node.type === combinationOptions || node.type === platterCombinationOptions || node.type === chickenCombinationOptions).length, 0);
  const choices = variants(tree);
  assert.deepEqual(choices.map((node) => node.props["data-product-id"]),
    [avocadoScoop.product_id, avocado6.product_id, avocado8.product_id]);
  assert(text(choices[0]).startsWith("Scoop"));
  assert(text(choices[0]).includes("₱60.00"));
  assert(text(choices[1]).startsWith("6 oz"));
  assert(text(choices[1]).includes("₱95.00"));
  assert(text(choices[2]).startsWith("8 oz"));
  assert(text(choices[2]).includes("₱145.00"));
  choices[0].props.onClick();
  choices[2].props.onClick();
  assert.equal(selected[0], avocadoScoop);
  assert.equal(selected[1], avocado8);
});

test("Scoop-only group metadata retains direct serving guidance during loading and retry", () => {
  const render = harness();
  const family = menuProductVariants.groupMenuProductVariants([avocadoScoop])[0];
  let tree = render({ group: { ...family, variants: [] }, isLoading: true });
  assert(text(tree).includes("Choose a serving size."));
  assert(text(tree).includes("Loading available sizes and prices"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.equal(variants(tree).length, 0);
  let retries = 0;
  tree = render({ group: { ...family, variants: [] }, error: "Unable to load prices", onRetry: () => retries++ });
  assert(text(tree).includes("Choose a serving size."));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  all(tree, (node) => node.type === "button" && text(node) === "Try again")[0].props.onClick();
  assert.equal(retries, 1);
  tree = render({ group: family });
  assert.equal(variants(tree).length, 1);
  assert(text(variants(tree)[0]).startsWith("Scoop"));
  assert.equal(labeledButton(tree, "Half"), undefined);
});

test("an unavailable Scoop stays visible and disabled beside selectable ounce sizes", () => {
  const selected = [];
  const family = menuProductVariants.groupMenuProductVariants([
    { ...avocadoScoop, selling_price: null }, avocado6,
  ])[0];
  const tree = harness()({ group: family, onSelect: (product) => selected.push(product) });
  const choices = variants(tree);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].props.disabled, true);
  assert(text(choices[0]).includes("Price unavailable"));
  choices[0].props.onClick();
  assert.equal(selected.length, 0);
  choices[1].props.onClick();
  assert.equal(selected[0], avocado6);
});

test("pizza offers only whole sizes and preserves half SKUs for two-flavor combinations", () => {
  const whole12 = { product_id: "whole-12", item_name: '5 CHEESE 12"', item_category: "PIZZA", selling_price: 700 };
  const whole9 = { ...whole12, product_id: "whole-9", item_name: '5 CHEESE 9"', selling_price: 420 };
  const half9 = { ...whole9, product_id: "half-9", item_name: '5 CHEESE 9" HALF', selling_price: 335 };
  const secondHalf = { ...half9, product_id: "meat-half-9", item_name: 'ALL MEAT 9" HALF', selling_price: 400 };
  const family = menuProductVariants.groupMenuProductVariants([whole12, half9, whole9])[0];
  const render = harness();
  const selections = [];
  const combinationSelections = [];
  const modeChanges = [];
  const products = [half9, secondHalf];
  const props = {
    group: family, onSelect: (product) => selections.push(product),
    onSelectCombination: (...selected) => combinationSelections.push(selected),
    onCombinationModeChange: (value) => modeChanges.push(value),
    combinationOptions: { products, isLoading: false, error: "" },
  };
  let tree = render(props);
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert(text(tree).includes("Choose a size for one whole order."));
  assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]), ["whole-9", "whole-12"]);
  assert(text(variants(tree)[0]).includes("₱420.00"));
  variants(tree)[0].props.onClick();
  assert.equal(selections[0], whole9);
  const combinationButton = all(tree,
    (node) => node.type === "button" && text(node) === "Combine flavor")[0];
  combinationButton.props.onClick();
  assert.deepEqual(modeChanges, [true]);
  tree = render({ ...props, combinationMode: true });
  const picker = all(tree, (node) => node.type === combinationOptions)[0];
  assert(picker);
  assert.equal(variants(tree).length, 0);
  assert.equal(picker.props.group, family);
  assert.equal(picker.props.group.variants.find((product) => product.product_id === half9.product_id), half9);
  assert.equal(picker.props.products, products);
  assert.equal(picker.props.onSelect, props.onSelectCombination);
  picker.props.onSelect(half9, secondHalf);
  assert.equal(combinationSelections[0][0], half9);
  assert.equal(combinationSelections[0][1], secondHalf);
  all(tree, (node) => node.type === "button" && text(node) === "Single flavor")[0].props.onClick();
  assert.deepEqual(modeChanges, [true, false]);
  tree = render(props);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]), ["whole-9", "whole-12"]);
  variants(tree)[1].props.onClick();
  assert.equal(selections[1], whole12);
});

test("wing platters offer a whole single flavor or two-flavor picker with original half SKUs", () => {
  const whole = {
    product_id: "platter-whole", item_name: "HONEY GARLIC",
    item_category: "CHICKEN WINGS PLATTER", selling_price: "535.00",
  };
  const half = { ...whole, product_id: "platter-half", item_name: "HONEY GARLIC HALF", selling_price: "267.50" };
  const secondHalf = { ...half, product_id: "jerk-half", item_name: "JAMAICAN JERK HALF", selling_price: "275.00" };
  const family = menuProductVariants.groupMenuProductVariants([half, whole])[0];
  const selections = [];
  const combinationSelections = [];
  const modeChanges = [];
  const products = [half, secondHalf];
  const props = {
    group: family, onSelect: (product) => selections.push(product),
    onSelectCombination: (...selected) => combinationSelections.push(selected),
    onCombinationModeChange: (value) => modeChanges.push(value),
    combinationOptions: { products, isLoading: false, error: "" },
  };
  const render = harness();
  let tree = render(props);
  assert(text(tree).includes("Order one whole platter with a single flavor or a 2-flavor combination."));
  assert(!text(tree).includes("select a size"));
  assert.equal(labeledButton(tree, "Whole"), undefined);
  assert.equal(labeledButton(tree, "Half"), undefined);
  assert.equal(variants(tree).length, 1);
  assert.equal(variants(tree)[0].props["data-product-id"], whole.product_id);
  assert(text(variants(tree)[0]).includes("₱535.00"));
  variants(tree)[0].props.onClick();
  assert.equal(selections[0], whole);
  const flavorModes = all(tree, (node) => node.props?.["aria-label"] === "Whole platter flavors")[0];
  all(flavorModes, (node) => node.type === "button" && text(node) === "Combine flavor")[0].props.onClick();
  assert.deepEqual(modeChanges, [true]);
  tree = render({ ...props, combinationMode: true });
  const picker = all(tree, (node) => node.type === platterCombinationOptions)[0];
  assert(picker);
  assert.equal(variants(tree).length, 0);
  assert.equal(picker.props.group, family);
  assert.equal(picker.props.group.variants.find((product) => product.product_id === half.product_id), half);
  assert.equal(picker.props.products, products);
  assert.equal(picker.props.onSelect, props.onSelectCombination);
  picker.props.onSelect(half, secondHalf);
  assert.equal(combinationSelections[0][0], half);
  assert.equal(combinationSelections[0][1], secondHalf);
  assert.equal(all(tree, (node) => node.type === combinationOptions).length, 0);
  assert(text(tree).includes("one whole chicken wings platter"));
  all(tree, (node) => node.type === "button" && text(node) === "Single flavor")[0].props.onClick();
  assert.deepEqual(modeChanges, [true, false]);
  tree = render(props);
  assert.equal(all(tree, (node) => node.type === platterCombinationOptions).length, 0);
  assert.equal(variants(tree).length, 1);
  assert.equal(variants(tree)[0].props["data-product-id"], whole.product_id);
  assert.equal(labeledButton(tree, "Half"), undefined);
  tree = render({ ...props, group: { ...family, variants: [] }, isLoading: true });
  assert(text(tree).includes("Loading whole platter options and prices"));
  assert(!text(tree).includes("sizes"));
});

test("half-only fetched pizza and platter families never fall back to standalone half orders", () => {
  const scenarios = [
    { item_name: '5 CHEESE 9"', item_category: "PIZZA", picker: combinationOptions },
    { item_name: "HONEY GARLIC", item_category: "CHICKEN WINGS PLATTER", picker: platterCombinationOptions },
  ];
  for (const scenario of scenarios) {
    const whole = { product_id: `${scenario.item_category}-whole`, item_name: scenario.item_name,
      item_category: scenario.item_category, selling_price: "535.00" };
    const half = { ...whole, product_id: `${scenario.item_category}-half`,
      item_name: `${whole.item_name} HALF`, selling_price: "267.50" };
    const family = { ...menuProductVariants.groupMenuProductVariants([whole, half])[0], variants: [half] };
    const selections = [];
    const props = { group: family, onSelect: (product) => selections.push(product), onSelectCombination: () => {} };
    const render = harness();
    let tree = render(props);
    assert.equal(variants(tree).length, 0, scenario.item_category);
    assert.equal(labeledButton(tree, "Half"), undefined);
    assert(text(tree).includes("No whole-order options are available right now."));
    assert.equal(selections.length, 0);

    tree = render({ ...props, combinationMode: true });
    const picker = all(tree, (node) => node.type === scenario.picker)[0];
    assert(picker);
    assert.equal(variants(tree).length, 0);
    assert.equal(picker.props.group, family);
    assert.equal(picker.props.group.variants[0], half, "half-only catalog rows remain intact for combination validation");
    assert.equal(picker.props.group.variants[0].selling_price, "267.50");
  }
});

test("eligible Buffalo and GJ serving families retain whole choices and route Combine flavor to chicken options", () => {
  const wingsHalf = { ...solo, product_id: "wings-solo-half", item_name: "BUFFALO WINGS SOLO HALF", selling_price: 262.5 };
  const spicyHalf = { ...soloSpicy, product_id: "wings-solo-spicy-half", item_name: "BUFFALO WINGS SOLO SPICY HALF", selling_price: 262.5 };
  const gjWhole = { ...chickenSolo, item_category: "GJ FRIED CHICKEN" };
  const gjHalf = { ...gjWhole, product_id: "gj-solo-half", item_name: "GJ FRIED CHICKEN SOLO HALF", selling_price: 247.5 };
  for (const rows of [[solo, soloSpicy, wingsHalf, spicyHalf], [gjWhole, gjHalf]]) {
    const family = menuProductVariants.groupMenuProductVariants(rows)[0];
    const products = [wingsHalf, spicyHalf, gjHalf];
    const selections = [];
    const modeChanges = [];
    const combinationSelections = [];
    const props = { group: family,
      onSelect: (product) => selections.push(product),
      onCombinationModeChange: (mode) => modeChanges.push(mode),
      onSelectCombination: (...selected) => combinationSelections.push(selected),
      combinationOptions: { products, isLoading: false, error: "" },
    };
    const render = harness();
    let tree = render(props);
    const wholeRows = rows.filter((row) => !row.item_name.endsWith(" HALF"));
    assert.deepEqual(variants(tree).map((node) => node.props["data-product-id"]), wholeRows.map((row) => row.product_id));
    variants(tree)[0].props.onClick();
    assert.equal(selections[0], wholeRows[0]);
    const modes = all(tree, (node) => node.props?.["aria-label"] === "Whole chicken flavors")[0];
    assert(modes);
    all(modes, (node) => node.type === "button" && text(node) === "Combine flavor")[0].props.onClick();
    assert.deepEqual(modeChanges, [true]);
    tree = render({ ...props, combinationMode: true });
    const picker = all(tree, (node) => node.type === chickenCombinationOptions)[0];
    assert(picker);
    assert.equal(picker.props.group, family);
    assert.equal(picker.props.products, products);
    assert.equal(picker.props.onSelect, props.onSelectCombination);
    assert.equal(variants(tree).length, 0);
    assert.equal(all(tree, (node) => node.props?.role === "group" && node.props["aria-label"] === "Size").length, 0,
      "the parent does not duplicate the chicken picker's size control");
    assert.equal(all(tree, (node) => node.type === combinationOptions || node.type === platterCombinationOptions).length, 0);
    assert(text(tree).includes("one whole order of the same size"));
    picker.props.onSelect(wingsHalf, gjHalf);
    assert.equal(combinationSelections[0][0], wingsHalf);
    assert.equal(combinationSelections[0][1], gjHalf);
    all(tree, (node) => node.type === "button" && text(node) === "Single flavor")[0].props.onClick();
    assert.deepEqual(modeChanges, [true, false]);
    tree = render(props);
    assert.equal(variants(tree).length, wholeRows.length);
    assert.equal(labeledButton(tree, "Half"), undefined);
  }
});

test("unrelated serving categories cannot enter chicken combinations", () => {
  const tree = harness()({ group: chickenFamily(), combinationMode: true, onSelectCombination: () => {} });
  assert.equal(all(tree, (node) => node.type === chickenCombinationOptions).length, 0);
  assert.equal(all(tree, (node) => node.props?.["aria-label"] === "Whole chicken flavors").length, 0);
  assert.equal(variants(tree).length, 3);
  assert(text(tree).includes("Choose a size: Solo, Double, or Group."));
});

const shirtSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const shirts = shirtSizes.map((size, index) => Object.freeze({
  product_id: `SHIRT-${size}`, item_name: `PICKLE JOE SHIRT ${size}\"`,
  item_category: "OTHERS", selling_price: index < 5 ? "700.00" : "750.00",
}));
const shirtFamily = () => menuProductVariants.groupMenuProductVariants([
  shirts[5], shirts[3], shirts[1], shirts[6], shirts[4], shirts[2], shirts[0],
])[0];

test("shirt picker orders XS through 3XL and selects the actual sized SKU at its own price", () => {
  const selected = [];
  const family = shirtFamily();
  const tree = harness()({
    group: family, combinationMode: true, onSelectCombination: () => {},
    onSelect: (product) => selected.push(product),
  });
  assert(text(tree).includes("Choose a shirt size."));
  assert(text(tree).includes("Size options"));
  assert(!/flavor|whole|half/iu.test(text(tree)), "shirt choices do not use food or combination guidance");
  const choices = variants(tree);
  assert.deepEqual(choices.map((node) => node.props["data-product-id"]), shirts.map((item) => item.product_id));
  assert.deepEqual(choices.map((node) => text(node.props.children[0].props.children[0])), shirtSizes);
  assert(text(choices[0]).includes("₱700.00"));
  assert(text(choices[5]).includes("₱750.00"));
  assert(text(choices[6]).includes("₱750.00"));
  assert.equal(all(tree, (node) => node.type === combinationOptions
    || node.type === platterCombinationOptions || node.type === chickenCombinationOptions).length, 0);
  choices[5].props.onClick();
  assert.equal(selected.length, 1);
  assert.equal(selected[0], shirts[5]);
  assert.equal(selected[0].product_id, "SHIRT-2XL");
  assert.equal(selected[0].item_name, 'PICKLE JOE SHIRT 2XL"');
  assert.equal(selected[0].selling_price, "750.00");
  assert.equal(family.variants[0], shirts[5], "sorting options does not reorder the source catalog");
});

test("shirt picker keeps size-specific guidance while loading or empty and blocks missing prices", () => {
  const render = harness();
  const family = { ...shirtFamily(), variants: [] };
  let tree = render({ group: family, isLoading: true });
  assert(text(tree).includes("Choose a shirt size."));
  assert(text(tree).includes("Loading available sizes and prices"));
  assert(!/flavor|whole|half/iu.test(text(tree)));
  assert.equal(variants(tree).length, 0);
  tree = render({ group: family });
  assert(text(tree).includes("No sizes are available right now."));
  assert(!/flavor|whole|half/iu.test(text(tree)));
  const selected = [];
  tree = render({
    group: { ...family, variants: [shirts[5], { ...shirts[0], selling_price: null }] },
    onSelect: (product) => selected.push(product),
  });
  const choices = variants(tree);
  assert.equal(choices[0].props["data-product-id"], "SHIRT-XS");
  assert.equal(choices[0].props.disabled, true);
  assert(text(choices[0]).includes("Price unavailable"));
  choices[0].props.onClick();
  assert.equal(selected.length, 0);
  choices[1].props.onClick();
  assert.equal(selected[0], shirts[5]);
});
