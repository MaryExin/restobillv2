import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlatterCombination, getPlatterCombinationChoices, getPlatterCombinationInstruction,
  getPlatterCombinationPair, isCompatiblePlatterHalf, isPlatterVariantGroup,
} from "../menuPlatterCombination.js";
import { groupMenuProductVariants } from "../menuProductVariants.js";

const product = (name, price = 267.5, id = name, category = "CHICKEN WINGS PLATTER") => ({
  product_id: id, item_name: name, selling_price: price, item_category: category,
});
const whole = product("5 ALARM", 535, "BD-6acd037f92eb");
const first = product("5 ALARM HALF", "267.50", "BD-03b1a595e14a");
const second = product("JAMAICAN JERK HALF", "275.00", "BD-f6a16253c685");
const family = (...variants) => groupMenuProductVariants(variants)[0];

test("platter combinations are limited to the exact category, normalizing portion suffixes", () => {
  for (const category of ["CHICKEN WINGS PLATTER", " chicken  wings platter half ", "CHICKEN WINGS PLATTER WHOLE"]) {
    assert.equal(isPlatterVariantGroup({ item_category: category }), true, category);
  }
  for (const category of ["", "PIZZA HALF", "BUFALLO WINGS", "SPECIAL CHICKEN WINGS PLATTER", null]) {
    assert.equal(isPlatterVariantGroup({ item_category: category }), false, category);
  }
  assert.equal(isPlatterVariantGroup(null), false);
  assert.equal(isPlatterVariantGroup({ ...whole, _isFolder: true }), false);
});

test("a combination requires separate real whole and half SKUs of the opened flavor", () => {
  const group = family(whole, first);
  group.variants.push(second, product("5 ALARM HALF", 267.5, "other", "PIZZA"));
  assert.deepEqual(getPlatterCombinationPair(group), { whole, half: first });
  assert.equal(getPlatterCombinationPair(group).half, first);
  for (const variants of [[first], [whole], [whole, second], [whole, { ...first, product_id: whole.product_id }]]) {
    assert.equal(getPlatterCombinationPair(family(...variants)), null);
  }
  assert.equal(getPlatterCombinationPair(null), null);
  assert.equal(getPlatterCombinationPair({ ...group, variants: null }), null);
  const explicitWhole = product("5 ALARM WHOLE", 535);
  assert.equal(getPlatterCombinationPair(family(explicitWhole, first)).whole, explicitWhole);
});

test("flavor choices preserve original rows and prices, deduplicate IDs and exclude incompatible options", () => {
  const baked = product("BAKED PARMESAN HALF", 267.5, "baked", " chicken wings platter half ");
  const source = [second, baked, { ...second, selling_price: 999 }, first, whole,
    product("HONEY GARLIC HALF", 267.5, first.product_id),
    product("HONEY GARLIC HALF", 267.5, "other-category", "BUFALLO WINGS"),
    product('HONEY GARLIC 12" HALF'), product("BUFALLO WINGS SOLO HALF"),
    product("HALF BAKED PARMESAN"), product("HONEY GARLIC HALF", null)];
  const choices = getPlatterCombinationChoices(family(whole, first), source);
  assert.deepEqual(choices, [baked, second]);
  assert.equal(choices[1], second);
  assert.equal(choices[1].selling_price, "275.00");
  assert.equal(source[0], second, "sorting does not mutate catalog order");
  assert.deepEqual(getPlatterCombinationChoices(null, source), []);
  assert.deepEqual(getPlatterCombinationChoices(family(whole, first), null), []);
});

test("mixed platter uses both actual half prices and keeps their identities for the cart", () => {
  const combo = createPlatterCombination(first, second);
  assert.deepEqual(combo, { products: [first, second], total: 542.5 });
  assert.equal(combo.products[0], first);
  assert.equal(combo.products[1], second);
  assert.equal(createPlatterCombination(first, product("HONEY GARLIC HALF")).total, 535);
  assert.equal(createPlatterCombination({ ...first, selling_price: "0.1" }, { ...second, selling_price: "0.2" }).total, 0.3);
  assert.equal(createPlatterCombination({ ...first, selling_price: 0 }, { ...second, selling_price: 0 }).total, 0);
  assert.equal(getPlatterCombinationInstruction(first, second), "2-flavor chicken wings platter: 5 ALARM + JAMAICAN JERK");
});

test("missing or invalid IDs and prices cannot become selectable halves or valid family pairs", () => {
  for (const selling_price of [null, undefined, "", " ", "NaN", Infinity, -1, true, []]) {
    const invalid = { ...first, selling_price };
    assert.equal(isCompatiblePlatterHalf(invalid, whole), false);
    assert.equal(getPlatterCombinationPair(family(whole, invalid)), null);
    assert.equal(getPlatterCombinationPair(family({ ...whole, selling_price }, first)), null);
    assert.equal(createPlatterCombination(invalid, second), null);
  }
  for (const product_id of [null, undefined, "", " ", false, {}, Infinity]) {
    const invalid = { ...first, product_id };
    assert.equal(isCompatiblePlatterHalf(invalid, whole), false);
    assert.equal(getPlatterCombinationPair(family(whole, invalid)), null);
    assert.equal(createPlatterCombination(invalid, second), null);
  }
});

test("invalid combinations cannot produce kitchen instructions", () => {
  const invalidPairs = [
    [null, second], [first, null], [first, first], [whole, second],
    [first, { ...first, product_id: "same-flavor-other-id" }],
    [first, { ...second, product_id: first.product_id }],
    [first, { ...second, item_category: "PIZZA HALF" }],
    [first, { ...second, _isFolder: true }], [first, { ...second, _isVariantGroup: true }],
    [first, product('HONEY GARLIC 12" HALF')], [first, product("GJ FRIED CHICKEN SOLO HALF")],
    [first, product("HALF BAKED PARMESAN")],
    [{ ...first, selling_price: Number.MAX_VALUE }, { ...second, selling_price: Number.MAX_VALUE }],
  ];
  for (const pair of invalidPairs) {
    assert.equal(createPlatterCombination(...pair), null);
    assert.equal(getPlatterCombinationInstruction(...pair), "");
  }
});
