import assert from "node:assert/strict";
import test from "node:test";
import {
  chickenCombinationKey, isSameChickenCombination, groupChickenCombinationCartRows,
  getChickenCombinationSourceItem,
} from "../chickenCombinationCart.js";

const flavors = {
  original: { code: "WINGS", name: "BUFFALO WINGS", suffix: "", label: "BUFFALO WINGS Original", price: 177.5, item_category: "BUFALLO WINGS" },
  spicy: { code: "SPICY", name: "BUFFALO WINGS", suffix: " SPICY", label: "BUFFALO WINGS Spicy", price: 177.5, item_category: "BUFALLO WINGS" },
  fried: { code: "GJ", name: "GJ FRIED CHICKEN", suffix: "", label: "GJ FRIED CHICKEN", price: 175, item_category: "GJ FRIED CHICKEN" },
};
const pair = ({ first = "fried", second = "original", size = "Solo", ...overrides } = {}) => {
  const instruction = `2-flavor chicken ${size}: ${flavors[first].label} + ${flavors[second].label}`;
  return [flavors[first], flavors[second]].map((flavor) => ({
    lineId: `${flavor.code}-line`, code: `${flavor.code}-${size}`,
    name: `${flavor.name} ${size.toUpperCase()}${flavor.suffix} HALF`,
    price: flavor.price, quantity: 1, item_category: flavor.item_category,
    isLoadedFromDB: false, itemInstruction: instruction, ...overrides,
  }));
};
const assertUngrouped = (rows) => {
  const result = groupChickenCombinationCartRows(rows);
  assert.deepEqual(result, rows);
  rows.forEach((row, index) => assert.equal(result[index], row));
};

test("all three distinct chicken flavor pairs group at every serving size in either order", () => {
  for (const size of ["Solo", "Double", "Group"]) {
    for (const [first, second] of [["fried", "original"], ["fried", "spicy"], ["original", "spicy"]]) {
      for (const order of [[first, second], [second, first]]) {
        const rows = pair({ first: order[0], second: order[1], size });
        const grouped = groupChickenCombinationCartRows(rows);
        assert.equal(grouped.length, 1);
        assert.equal(grouped[0].name, `${flavors[order[0]].label} + ${flavors[order[1]].label} · ${size}`);
        assert.equal(grouped[0].price, rows[0].price + rows[1].price);
        assert.equal(grouped[0].quantity, 1);
        assert.equal(grouped[0]._isChickenCombination, true);
        assert.equal(grouped[0].combinationLabel, "Combine flavor · Whole chicken");
        assert.equal(grouped[0].combinationParts[0], rows[0]);
        assert.equal(grouped[0].combinationParts[1], rows[1]);
      }
    }
  }
});

test("grouped chicken keeps original rows, protected notes, source metadata and total without mutation", () => {
  const rows = pair({ quantity: 3 });
  rows[0].sourceLineId = "saved-gj";
  rows[0].mergedKey = "gj-key";
  rows[1].hasAdditionalEntry = true;
  rows.forEach((row) => { row.itemInstruction += "\nSauce on side\nExtra crispy"; });
  const snapshot = structuredClone(rows);
  rows.forEach(Object.freeze);
  Object.freeze(rows);
  const [grouped] = groupChickenCombinationCartRows(rows);
  assert.equal(grouped.sourceLineId, "saved-gj");
  assert.equal(grouped.mergedKey, "gj-key");
  assert.equal(grouped.hasAdditionalEntry, true);
  assert.equal(grouped.displayInstruction, "Sauce on side\nExtra crispy");
  assert.equal(grouped.itemInstruction, rows[0].itemInstruction);
  assert.equal(getChickenCombinationSourceItem(grouped), rows[0]);
  assert.equal(grouped.price * grouped.quantity, rows.reduce((sum, row) => sum + row.price * row.quantity, 0));
  assert.deepEqual(rows, snapshot);
});

test("saved category-free rows recover header order and remain separate from new additions", () => {
  for (const item_category of [undefined, null, ""]) {
    const saved = pair({ item_category, isLoadedFromDB: true, quantity: 2 });
    const added = pair({ item_category });
    const regular = { ...saved[0], code: "REGULAR", itemInstruction: "" };
    const result = groupChickenCombinationCartRows([saved[1], regular, saved[0], ...added]);
    assert.equal(result.length, 3);
    assert.equal(result[0].name, "GJ FRIED CHICKEN + BUFFALO WINGS Original · Solo");
    assert.equal(result[0].item_category, "CHICKEN COMBINATION");
    assert.equal(result[0].quantity, 2);
    assert.equal(result[0].isLoadedFromDB, true);
    assert.equal(getChickenCombinationSourceItem(result[0]), saved[1]);
    assert.equal(result[1], regular);
    assert.equal(result[2].quantity, 1);
    assert.equal(result[2].isLoadedFromDB, false);
    assertUngrouped([saved[0], added[1]]);
  }
  const misspelled = pair({ item_category: undefined });
  misspelled[1].name = "BUFALLO WINGS SOLO HALF";
  assert.equal(groupChickenCombinationCartRows(misspelled).length, 1);
});

test("keys retain the complete instruction and loaded boundary without recognizing older combination kinds", () => {
  const rows = pair();
  rows.forEach((row) => { row.itemInstruction += "\nNo sauce"; });
  assert.equal(chickenCombinationKey(rows[0]), rows[0].itemInstruction);
  assert(isSameChickenCombination(...rows));
  assert.equal(isSameChickenCombination(rows[0], { ...rows[1], isLoadedFromDB: true }), false);
  assert.equal(isSameChickenCombination(rows[0], { ...rows[1], itemInstruction: pair()[0].itemInstruction }), false);
  for (const itemInstruction of ["", "No sauce", "2-flavor chicken wings platter: 5 ALARM + HONEY GARLIC",
    '2-flavor pizza 12": A + B', "Coffee add-on: CAFE LATTE + CCL ALMOND",
    "2-flavor chicken Solo: GJ FRIED CHICKEN", "2-flavor chicken Family: GJ FRIED CHICKEN + BUFFALO WINGS Original"]) {
    assert.equal(chickenCombinationKey({ itemInstruction }), "");
  }
});

test("wrong protected flavor or serving headers never hide unrelated rows", () => {
  const rows = pair();
  for (const itemInstruction of [
    "2-flavor chicken Double: GJ FRIED CHICKEN + BUFFALO WINGS Original",
    "2-flavor chicken Solo: GJ FRIED CHICKEN + BUFFALO WINGS Spicy",
    "2-flavor chicken Solo: GJ FRIED CHICKEN + 5 ALARM",
    `${rows[0].itemInstruction} + BUFFALO WINGS Spicy`,
    `${rows[0].itemInstruction} extra`, "",
  ]) assertUngrouped(pair({ itemInstruction }));
  assertUngrouped([rows[0], { ...rows[1], itemInstruction: `${rows[1].itemInstruction}\nNo sauce` }]);
});

test("same flavor, duplicate identity, whole products, wrong sizes and wrong categories stay ungrouped", () => {
  const rows = pair();
  assertUngrouped(pair({ first: "original", second: "original" }));
  assertUngrouped(pair({ first: "fried", second: "fried" }));
  for (const changed of [
    { ...rows[1], code: rows[0].code },
    { ...rows[1], name: "BUFFALO WINGS SOLO" },
    { ...rows[1], name: "BUFFALO WINGS DOUBLE HALF" },
    { ...rows[1], name: "5 ALARM HALF", item_category: "CHICKEN WINGS PLATTER" },
    { ...rows[1], name: 'ALL MEAT 12" HALF', item_category: "PIZZA HALF" },
    { ...rows[1], name: "HALF FRIED CHICKEN", item_category: undefined },
    { ...rows[1], name: "BUFFALO WINGS SOLO HONEY GARLIC HALF", item_category: undefined },
    { ...rows[1], item_category: "CHICKEN WINGS PLATTER" },
    { ...rows[1], item_category: "GJ FRIED CHICKEN" },
    { ...rows[1], _isPizzaCombination: true },
    { ...rows[1], _isCoffeeAddon: true },
    { ...rows[1], _isVariantGroup: true },
  ]) assertUngrouped([rows[0], changed]);
});

test("orphan and ambiguous instructions never combine extra rows", () => {
  const rows = pair();
  assertUngrouped([rows[0]]);
  assertUngrouped([rows[1]]);
  assertUngrouped([...rows, { ...rows[1], lineId: "extra" }]);
  assertUngrouped([...rows, ...pair()]);
  const regular = { ...rows[0], itemInstruction: "" };
  assertUngrouped([regular, rows[1]]);
});

test("invalid raw prices, IDs or unequal quantities remain visible; zero and blank editing values are retained", () => {
  const rows = pair();
  for (const code of [null, undefined, "", " ", true, {}, Infinity]) {
    assertUngrouped([rows[0], { ...rows[1], code }]);
  }
  for (const value of [null, undefined, "", " ", "NaN", Infinity, -1, true, []]) {
    assertUngrouped([rows[0], { ...rows[1], price: value }]);
    assertUngrouped([rows[0], { ...rows[1], quantity: value }]);
  }
  assertUngrouped([rows[0], { ...rows[1], quantity: 2 }]);
  assertUngrouped(pair({ price: Number.MAX_VALUE }));
  assert.equal(groupChickenCombinationCartRows(pair({ price: 0 }))[0].price, 0);
  assert.equal(groupChickenCombinationCartRows(pair({ quantity: 0 }))[0].quantity, 0);
  assert.equal(groupChickenCombinationCartRows(pair({ quantity: "" }))[0].quantity, "");
  assert.equal(groupChickenCombinationCartRows([rows[0], { ...rows[1], price: "177.50", quantity: "1" }]).length, 1);
});

test("grouping is idempotent and invalid display proxies do not unwrap raw unrelated items", () => {
  const result = groupChickenCombinationCartRows(pair());
  assert.deepEqual(groupChickenCombinationCartRows(result), result);
  for (const combinationParts of [null, [], [pair()[0]], pair({ itemInstruction: "No sauce" })]) {
    const invalid = { _isChickenCombination: true, combinationParts };
    assert.equal(getChickenCombinationSourceItem(invalid), invalid);
  }
  assert.deepEqual(groupChickenCombinationCartRows(null), []);
  assert.equal(getChickenCombinationSourceItem(null), null);
});
