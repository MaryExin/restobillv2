import assert from "node:assert/strict";
import test from "node:test";
import {
  getCoffeeAddonInstruction, coffeeAddonKey, isSameCoffeeAddon,
  groupCoffeeAddonCartRows, getCoffeeAddonSourceItem,
} from "../coffeeAddonCart.js";

const instruction = "Coffee add-on: ICED CAFE LATTE + CCL VANILLA";
const pair = (overrides = {}) => [
  {
    lineId: "coffee-line", code: "COFFEE", name: "ICED CAFE LATTE", price: "145.00",
    quantity: 1, item_category: "DRINKS", isLoadedFromDB: false,
    itemInstruction: instruction, ...overrides,
  },
  {
    lineId: "addon-line", code: "VANILLA", name: "CCL VANILLA", price: 25,
    quantity: 1, item_category: "ADD ONS", isLoadedFromDB: false,
    itemInstruction: instruction, ...overrides,
  },
];
const total = (rows) => rows.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
const assertUngrouped = (rows) => {
  const result = groupCoffeeAddonCartRows(rows);
  assert.deepEqual(result, rows);
  rows.forEach((row, index) => assert.equal(result[index], row));
};

test("coffee instructions accept original catalog or cart rows and reject unrelated products", () => {
  const rows = pair();
  assert.equal(getCoffeeAddonInstruction(...rows), instruction);
  const catalogRows = rows.map(({ code, name, price, item_category }) => ({
    product_id: code, item_name: name, selling_price: price, item_category,
  }));
  assert.equal(getCoffeeAddonInstruction(...catalogRows), instruction);
  assert.equal(getCoffeeAddonInstruction(rows[1], rows[0]), "");
  for (const name of ["GREEN TEA LATTE", "COLA", "CAPPUCINO CAKE", "5 CHEESE HALF"]) {
    const item_category = name.includes("CAKE") ? "CAKES" : "DRINKS";
    assert.equal(getCoffeeAddonInstruction({ ...rows[0], name, item_category }, rows[1]), "");
  }
  for (const addon of [
    { ...rows[1], name: "VANILLA" }, { ...rows[1], item_category: "CAKES" },
    { ...rows[1], code: rows[0].code }, { ...rows[1], price: null },
    { ...rows[1], _isCoffeeAddon: true },
  ]) assert.equal(getCoffeeAddonInstruction(rows[0], addon), "");
});

test("one coffee row retains both real SKUs, total, source references and editable metadata", () => {
  const rows = pair({ quantity: 3, itemInstruction: `${instruction}\nLess ice\nNo sugar` });
  Object.assign(rows[0], { sourceLineId: "saved-coffee", mergedKey: "coffee-key" });
  rows[1].hasAdditionalEntry = true;
  const snapshot = structuredClone(rows);
  rows.forEach(Object.freeze);
  Object.freeze(rows);
  const [combined] = groupCoffeeAddonCartRows(rows);
  assert.equal(combined._isCoffeeAddon, true);
  assert.equal(combined._isPizzaCombination, undefined);
  assert.equal(combined.name, "ICED CAFE LATTE · VANILLA");
  assert.equal(combined.combinationLabel, "Coffee with add-on");
  assert.equal(combined.price, 170);
  assert.equal(combined.quantity, 3);
  assert.equal(combined.item_category, "DRINKS");
  assert.equal(combined.displayInstruction, "Less ice\nNo sugar");
  assert.equal(combined.itemInstruction, rows[0].itemInstruction);
  assert.equal(coffeeAddonKey(combined), `${instruction}\nLess ice\nNo sugar`,
    "the hidden display prefix remains in the saved pairing instruction");
  assert.equal(combined.sourceLineId, "saved-coffee");
  assert.equal(combined.mergedKey, "coffee-key");
  assert.equal(combined.hasAdditionalEntry, true);
  assert.equal(combined.combinationParts[0], rows[0]);
  assert.equal(combined.combinationParts[1], rows[1]);
  assert.equal(combined.combinationParts[1].name, "CCL VANILLA");
  assert.equal(getCoffeeAddonSourceItem(combined), rows[0]);
  assert.equal(total([combined]), total(rows));
  assert.deepEqual(rows, snapshot);
});

test("reopened reversed rows recover the drink identity without categories and separate new additions", () => {
  for (const item_category of [undefined, null, ""]) {
    const saved = pair({ item_category, isLoadedFromDB: true, quantity: 2 });
    const added = pair({ item_category, quantity: 1 });
    const regular = { ...saved[0], code: "REGULAR", itemInstruction: "", quantity: 1 };
    const result = groupCoffeeAddonCartRows([saved[1], regular, saved[0], ...added]);
    assert.equal(result.length, 3);
    assert.equal(result[0].code, saved[0].code);
    assert.equal(result[0].lineId, saved[0].lineId);
    assert.equal(result[0].combinationParts[0], saved[0]);
    assert.equal(result[0].combinationParts[1], saved[1]);
    assert.equal(getCoffeeAddonSourceItem(result[0]), saved[0]);
    assert.equal(result[0].isLoadedFromDB, true);
    assert.equal(result[0].name, "ICED CAFE LATTE · VANILLA");
    assert.equal(result[0].item_category, "DRINKS");
    assert.equal(result[1], regular);
    assert.equal(result[2].quantity, 1);
    assert.equal(result[2].isLoadedFromDB, false);
    assertUngrouped([saved[0], added[1]]);
  }
});

test("pair keys keep notes and loaded state while regular and different selections stay separate", () => {
  const rows = pair({ itemInstruction: `${instruction}\nLess ice` });
  assert.equal(coffeeAddonKey(rows[0]), `${instruction}\nLess ice`);
  assert(isSameCoffeeAddon(...rows));
  assert.equal(isSameCoffeeAddon(rows[0], { ...rows[1], isLoadedFromDB: true }), false);
  assert.equal(isSameCoffeeAddon(rows[0], { ...rows[1], itemInstruction: instruction }), false);
  for (const itemInstruction of ["", "Less ice", "Coffee add-on: ICED CAFE LATTE", "2-flavor pizza 12\": A + B"]) {
    assert.equal(coffeeAddonKey({ itemInstruction }), "");
  }
  assertUngrouped(pair({ itemInstruction: "" }));
  assertUngrouped([rows[0], { ...rows[1], itemInstruction: `${instruction}\nNo ice` }]);
});

test("wrong headers, categories and drink/add-on identities never hide raw rows", () => {
  const rows = pair();
  for (const itemInstruction of [
    "Coffee add-on: ICED CAFE LATTE + CCL CARAMEL",
    "Coffee add-on: CAPPUCINO + CCL VANILLA",
    "Coffee add-on: CCL VANILLA + ICED CAFE LATTE",
    `${instruction} + CCL CARAMEL`,
    `Coffee add-on: ICED CAFE LATTE + CCL VANILLA extra`,
  ]) assertUngrouped(pair({ itemInstruction }));
  for (const item_category of ["PIZZA", "FOOD", "ADD ONS"]) {
    assertUngrouped([{ ...rows[0], item_category }, rows[1]]);
  }
  for (const item_category of ["DRINKS", "FOOD", "CHICKEN WINGS PLATTER"]) {
    assertUngrouped([rows[0], { ...rows[1], item_category }]);
  }
  const missingCategories = pair({ item_category: "" });
  for (const name of ["GREEN TEA LATTE", "COLA", "CCL VANILLA", '5 CHEESE 12" HALF']) {
    const changed = [{ ...missingCategories[0], name }, missingCategories[1]];
    changed.forEach((row) => { row.itemInstruction = `Coffee add-on: ${name} + CCL VANILLA`; });
    assertUngrouped(changed);
  }
  assertUngrouped([rows[0], { ...rows[1], _isPizzaCombination: true }]);
  assertUngrouped([rows[0], { ...rows[1], _isVariantGroup: true }]);
});

test("orphans, multiple add-ons and duplicate rows remain visible instead of ambiguous grouping", () => {
  const rows = pair();
  assertUngrouped([rows[0]]);
  assertUngrouped([rows[1]]);
  assertUngrouped([...rows, { ...rows[1], lineId: "extra-addon" }]);
  assertUngrouped([...rows, ...pair()]);
  assertUngrouped([rows[0], { ...rows[1], code: rows[0].code }]);
});

test("invalid IDs, prices and quantities stay visible while valid zero and editing values survive", () => {
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
  assert.equal(groupCoffeeAddonCartRows(pair({ price: 0 }))[0].price, 0);
  assert.equal(groupCoffeeAddonCartRows(pair({ quantity: 0 }))[0].quantity, 0);
  assert.equal(groupCoffeeAddonCartRows(pair({ quantity: "" }))[0].quantity, "");
  assert.equal(groupCoffeeAddonCartRows([rows[0], { ...rows[1], quantity: "1" }]).length, 1);
});

test("display grouping is idempotent and invalid grouped objects cannot unwrap unrelated items", () => {
  const result = groupCoffeeAddonCartRows(pair());
  assert.deepEqual(groupCoffeeAddonCartRows(result), result);
  const invalid = { _isCoffeeAddon: true, combinationParts: [pair()[0]] };
  assert.equal(getCoffeeAddonSourceItem(invalid), invalid);
  assert.equal(getCoffeeAddonSourceItem(null), null);
  assert.deepEqual(groupCoffeeAddonCartRows(null), []);
});
