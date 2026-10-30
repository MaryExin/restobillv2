import assert from "node:assert/strict";
import test from "node:test";
import {
  createPizzaCombination, getPizzaCombinationChoices, getPizzaCombinationInstruction,
  getPizzaCombinationSizes, isPizzaVariantGroup,
} from "../menuPizzaCombination.js";
import { groupMenuProductVariants } from "../menuProductVariants.js";

const product = (name, price = 475, category = "PIZZA HALF", id = name) => ({
  product_id: id, item_name: name, selling_price: price, item_category: category,
});
const whole = (name = '5 CHEESE 12"', price = 700) => product(name, price, "PIZZA");
const first = product('5 CHEESE 12" HALF', "475.00");
const second = product('ALL MEAT 12" HALF', "540.00");
const family = (...variants) => groupMenuProductVariants(variants)[0];

test("only pizza categories enable combinations, with portion suffixes normalized", () => {
  for (const category of ["PIZZA", " pizza half ", "PIZZA WHOLE", "SPECIAL PIZZA HALF"]) {
    assert.equal(isPizzaVariantGroup({ item_category: category }), true, category);
  }
  for (const category of ["", "DRINKS", "PIZZAS", "PIZZARELLA", null]) {
    assert.equal(isPizzaVariantGroup({ item_category: category }), false, category);
  }
  assert.equal(isPizzaVariantGroup(null), false);
  assert.equal(isPizzaVariantGroup({ item_category: "PIZZA", _isFolder: true }), false);
});

test("sizes require actual whole and half SKUs of the opened family and sort numerically", () => {
  const nineWhole = whole('5 CHEESE 9"', 420);
  const nineHalf = product('5 CHEESE HALF 9 INCHES', 335);
  const group = family(whole('5 CHEESE 16"', 950), product('5 CHEESE 16" HALF'), whole(), first, nineWhole, nineHalf);
  group.variants.push(whole('5 CHEESE 20"'), product('5 CHEESE 21" HALF'));
  group.variants.push(product('ALL MEAT 20" HALF'), product('5 CHEESE 22" HALF', 100, "DRINKS"));
  const sizes = getPizzaCombinationSizes(group);
  assert.deepEqual(sizes.map(({ sizeValue, sizeLabel }) => [sizeValue, sizeLabel]), [[9, '9"'], [12, '12"'], [16, '16"']]);
  assert.equal(sizes[0].whole, nineWhole);
  assert.equal(sizes[0].half, nineHalf);
  assert.equal(sizes[1].half, first);
  assert.deepEqual(getPizzaCombinationSizes(null), []);
  assert.deepEqual(getPizzaCombinationSizes({ item_category: "PIZZA", variants: null }), []);
});

test("missing or invalid prices and IDs cannot create a selectable combination size", () => {
  for (const price of [null, undefined, "", "  ", "NaN", Infinity, -1, true, []]) {
    assert.equal(getPizzaCombinationSizes(family(whole(), { ...first, selling_price: price })).length, 0);
    assert.equal(getPizzaCombinationSizes(family({ ...whole(), selling_price: price }, first)).length, 0);
  }
  for (const id of [null, undefined, "", "  ", false, {}, Infinity]) {
    assert.equal(getPizzaCombinationSizes(family(whole(), { ...first, product_id: id })).length, 0);
  }
  assert.equal(getPizzaCombinationSizes(family(whole(), { ...first, selling_price: 0 })).length, 1);
});

test("flavor choices include different families of the same size and base pizza category only", () => {
  const aloha = product('ALOHA 5 CHEESE 12" HALF', 205, " PIZZA half ");
  const source = [
    aloha, first, second, { ...second, selling_price: 9999 },
    product('ALL MEAT 9" HALF'), product('VEGETARIAN 12"', 680, "PIZZA"),
    product('VEGETARIAN 12" HALF', 340, "SPECIAL PIZZA HALF"),
    product('VEGETARIAN 12" HALF', null), product('MEATBALL 12" HALF', 300, "PIZZA HALF", ""),
  ];
  const result = getPizzaCombinationChoices(family(whole(), first), "12", source);
  assert.deepEqual(result, [second, aloha]);
  assert.equal(result[0], second, "actual product identity and price are preserved");
  assert.equal(result[0].selling_price, "540.00");
  assert.equal(source[0], aloha, "sorting does not mutate the source catalog");
  assert.deepEqual(getPizzaCombinationChoices(null, 12, source), []);
  assert.deepEqual(getPizzaCombinationChoices(family(whole(), first), 0, source), []);
});

test("combination total adds the two actual half prices and retains both original SKUs", () => {
  const combo = createPizzaCombination(first, second);
  assert.deepEqual(combo, { products: [first, second], total: 1015 });
  assert.equal(combo.products[0], first);
  assert.equal(combo.products[1], second);
  assert.equal(createPizzaCombination({ ...first, selling_price: "0.1" }, { ...second, selling_price: "0.2" }).total, 0.3);
  assert.equal(createPizzaCombination({ ...first, selling_price: 0 }, { ...second, selling_price: 0 }).total, 0);
  assert.equal(getPizzaCombinationInstruction(first, second), '2-flavor pizza 12": 5 CHEESE + ALL MEAT');
});

test("invalid flavor pairs cannot enter the cart or produce kitchen instructions", () => {
  const invalidPairs = [
    [first, first], [first, { ...first, product_id: "another-code" }],
    [first, { ...second, product_id: first.product_id }],
    [first, product('ALL MEAT 9" HALF')], [whole(), second],
    [first, { ...second, selling_price: "" }], [first, { ...second, selling_price: -1 }],
    [first, { ...second, product_id: " " }], [first, { ...second, item_category: "DRINKS" }],
    [first, { ...second, item_category: "SPECIAL PIZZA HALF" }],
    [product("5 CHEESE HALF"), product("ALL MEAT HALF")], [null, second],
  ];
  for (const pair of invalidPairs) {
    assert.equal(createPizzaCombination(...pair), null);
    assert.equal(getPizzaCombinationInstruction(...pair), "");
  }
});
