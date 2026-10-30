import assert from "node:assert/strict";
import test from "node:test";
import {
  getPizzaCombinationSourceItem, groupPizzaCombinationCartRows,
  isSamePizzaCombination, pizzaCombinationKey,
} from "../pizzaCombinationCart.js";

const instruction = '2-flavor pizza 12": 5 CHEESE + ALL MEAT';
const pair = (overrides = {}) => [
  {
    lineId: "new-cheese", code: "CHEESE-HALF", name: '5 CHEESE 12" HALF',
    price: "475.00", quantity: 2, item_category: "PIZZA HALF",
    isLoadedFromDB: false, itemInstruction: instruction, ...overrides,
  },
  {
    lineId: "new-meat", code: "MEAT-HALF", name: 'ALL MEAT HALF 12"',
    price: 540, quantity: 2, item_category: "PIZZA", isLoadedFromDB: false,
    itemInstruction: instruction, ...overrides,
  },
];
const total = (rows) => rows.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
const assertUngrouped = (rows) => {
  const result = groupPizzaCombinationCartRows(rows);
  assert.deepEqual(result, rows);
  rows.forEach((row, index) => assert.equal(result[index], row));
};

test("a combination is one display row while real inventory rows and totals remain intact", () => {
  const rows = pair();
  const snapshot = structuredClone(rows);
  rows.forEach(Object.freeze);
  Object.freeze(rows);
  const result = groupPizzaCombinationCartRows(rows);
  assert.equal(result.length, 1);
  const combined = result[0];
  assert.equal(combined.name, '5 CHEESE + ALL MEAT · 12"');
  assert.equal(combined.combinationLabel, "Combine flavor · Whole pizza");
  assert.equal(combined._isPizzaCombination, true);
  assert.equal(combined.price, 1015);
  assert.equal(combined.quantity, 2);
  assert.equal(combined.item_category, "PIZZA");
  assert.equal(combined.lineId, rows[0].lineId);
  assert.equal(combined.code, rows[0].code);
  assert.equal(combined.itemInstruction, instruction);
  assert.equal(combined.displayInstruction, "");
  assert.equal(combined.combinationParts[0], rows[0]);
  assert.equal(combined.combinationParts[1], rows[1]);
  assert.equal(total(result), total(rows));
  assert.deepEqual(rows, snapshot);
  assert.equal(getPizzaCombinationSourceItem(combined), rows[0]);
});

test("loose halves and other products retain original objects and order", () => {
  const halves = pair();
  const loose = { ...halves[0], lineId: "loose", itemInstruction: "", quantity: 1 };
  const drink = { lineId: "drink", code: "COLA", name: "COLA", price: 80, quantity: 1 };
  const rows = [loose, halves[0], drink, halves[1]];
  const result = groupPizzaCombinationCartRows(rows);
  assert.equal(result.length, 3);
  assert.equal(result[0], loose);
  assert.equal(result[1].combinationParts[0], halves[0]);
  assert.equal(result[2], drink);
  assert.equal(total(result), total(rows));
  assert.equal(getPizzaCombinationSourceItem(loose), loose);
});

test("loaded and new combinations stay separate and loaded categories may be absent", () => {
  const loaded = pair({ isLoadedFromDB: true, item_category: "" });
  const added = pair({ quantity: 1 });
  const result = groupPizzaCombinationCartRows([...loaded, ...added]);
  assert.equal(result.length, 2);
  assert.equal(result[0].quantity, 2);
  assert.equal(result[0].isLoadedFromDB, true);
  assert.equal(result[0].item_category, "PIZZA");
  assert.equal(result[1].quantity, 1);
  assert.equal(result[1].isLoadedFromDB, false);
  assertUngrouped([loaded[0], added[1]]);
});

test("additional quantities copied from reopened rows group without category fields", () => {
  for (const item_category of ["", null, undefined]) {
    const loaded = pair({ isLoadedFromDB: true, item_category });
    const added = loaded.map((row) => ({ ...row, isLoadedFromDB: false, quantity: 1 }));
    const result = groupPizzaCombinationCartRows([...loaded, ...added]);
    assert.equal(result.length, 2);
    assert.equal(result[1].quantity, 1);
    assert.equal(result[1].item_category, "PIZZA");
    assert.equal(result[1].combinationParts[0], added[0]);
    assert.equal(getPizzaCombinationSourceItem(result[1]), added[0]);
    assert.equal(total(result), total([...loaded, ...added]));
  }
});

test("proxy keys, notes and locked state survive grouping without changing raw instructions", () => {
  const rows = pair({ itemInstruction: `${instruction}\nNo onions\nExtra crispy` });
  Object.assign(rows[0], { sourceLineId: "saved-1", mergedKey: "merge-1", hasAdditionalEntry: false });
  rows[1].hasAdditionalEntry = true;
  const [combined] = groupPizzaCombinationCartRows(rows);
  assert.equal(combined.sourceLineId, "saved-1");
  assert.equal(combined.mergedKey, "merge-1");
  assert.equal(combined.hasAdditionalEntry, true);
  assert.equal(combined.displayInstruction, "No onions\nExtra crispy");
  assert.equal(combined.itemInstruction, rows[0].itemInstruction);
  assert.equal(getPizzaCombinationSourceItem(combined), rows[0]);
  assertUngrouped([rows[0], { ...rows[1], itemInstruction: `${instruction}\nNo garlic` }]);
});

test("orphans, unequal quantities and ambiguous multiple pairs remain visible", () => {
  const rows = pair();
  assertUngrouped([rows[0]]);
  assertUngrouped([rows[0], { ...rows[1], quantity: 1 }]);
  assertUngrouped([...rows, { ...rows[0], lineId: "duplicate" }]);
  assertUngrouped([...rows, ...pair()]);
  assertUngrouped([rows[0], { ...rows[1], code: rows[0].code }]);
});

test("valid zero prices and quantities are retained, missing or invalid prices do not group", () => {
  assert.equal(groupPizzaCombinationCartRows(pair({ price: 0 }))[0].price, 0);
  assert.equal(groupPizzaCombinationCartRows(pair({ quantity: 0 }))[0].quantity, 0);
  for (const invalid of [null, undefined, "", " ", "NaN", Infinity, -1, true, []]) {
    const rows = pair();
    assertUngrouped([rows[0], { ...rows[1], price: invalid }]);
  }
  assertUngrouped(pair({ price: Number.MAX_VALUE }));
});

test("quantity editing stays grouped while both fields are blank but invalid quantities are exposed", () => {
  assert.equal(groupPizzaCombinationCartRows(pair({ quantity: "" }))[0]._isPizzaCombination, true);
  const rows = pair();
  assert.equal(groupPizzaCombinationCartRows([rows[0], { ...rows[1], quantity: "2" }]).length, 1);
  for (const invalid of [null, undefined, "", " ", "NaN", Infinity, -1, true, []]) {
    assertUngrouped([rows[0], { ...rows[1], quantity: invalid }]);
  }
});

test("invalid identifiers, flavor names, sizes and categories never hide a raw row", () => {
  const rows = pair();
  for (const code of [null, undefined, "", " ", true, {}, Infinity]) {
    assertUngrouped([rows[0], { ...rows[1], code }]);
  }
  for (const name of ['ALL MEAT 12"', 'ALL MEAT 9" HALF', "ALL MEAT HALF", '5 CHEESE 12" HALF']) {
    assertUngrouped([rows[0], { ...rows[1], name }]);
  }
  for (const item_category of ["DRINKS", "SPECIAL PIZZA HALF"]) {
    assertUngrouped([rows[0], { ...rows[1], item_category }]);
  }
  assertUngrouped(pair({ itemInstruction: '2-flavor pizza 9": 5 CHEESE + ALL MEAT' }));
  assertUngrouped(pair({ itemInstruction: '2-flavor pizza 12": 5 CHEESE + VEGETARIAN' }));
});

test("reversed saved line order still groups and an invalid display object does not unwrap", () => {
  const rows = pair().reverse();
  const result = groupPizzaCombinationCartRows(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, '5 CHEESE + ALL MEAT · 12"');
  assert.equal(getPizzaCombinationSourceItem(result[0]), rows[0]);
  const invalid = { _isPizzaCombination: true, combinationParts: [rows[0]] };
  assert.equal(getPizzaCombinationSourceItem(invalid), invalid);
  assert.equal(getPizzaCombinationSourceItem(null), null);
  assert.deepEqual(groupPizzaCombinationCartRows(null), []);
  assert.deepEqual(groupPizzaCombinationCartRows(result), result);
});

const platterInstruction = "2-flavor chicken wings platter: 5 ALARM + HONEY GARLIC";
const platterPair = (overrides = {}) => [
  {
    lineId: "new-alarm", code: "ALARM-HALF", name: "5 ALARM HALF",
    price: "267.50", quantity: 1, item_category: "CHICKEN WINGS PLATTER",
    isLoadedFromDB: false, itemInstruction: platterInstruction, ...overrides,
  },
  {
    lineId: "new-garlic", code: "GARLIC-HALF", name: "HONEY GARLIC HALF",
    price: 267.5, quantity: 1, item_category: "CHICKEN WINGS PLATTER",
    isLoadedFromDB: false, itemInstruction: platterInstruction, ...overrides,
  },
];

test("platter halves form one whole display row while preserving real products, quantities and source references", () => {
  const rows = platterPair();
  const snapshot = structuredClone(rows);
  rows.forEach(Object.freeze);
  Object.freeze(rows);
  const [combined] = groupPizzaCombinationCartRows(rows);
  assert.equal(combined.name, "5 ALARM + HONEY GARLIC · Whole");
  assert.equal(combined.combinationLabel, "Combine flavor · Whole platter");
  assert.equal(combined._isPizzaCombination, true);
  assert.equal(combined.price, 535);
  assert.equal(combined.quantity, 1);
  assert.equal(combined.item_category, "CHICKEN WINGS PLATTER");
  assert.equal(combined.lineId, rows[0].lineId);
  assert.equal(combined.code, rows[0].code);
  assert.equal(combined.combinationParts[0], rows[0]);
  assert.equal(combined.combinationParts[1], rows[1]);
  assert.equal(getPizzaCombinationSourceItem(combined), rows[0]);
  assert.equal(total([combined]), total(rows));
  assert.deepEqual(rows, snapshot);

  const withJerk = platterPair({ itemInstruction: "2-flavor chicken wings platter: 5 ALARM + JAMAICAN JERK" });
  Object.assign(withJerk[1], { code: "JERK-HALF", name: "JAMAICAN JERK HALF", price: 275 });
  assert.equal(groupPizzaCombinationCartRows(withJerk)[0].price, 542.5);
});

test("platter pairing keys retain notes, separate saved from new rows, and never match pizza keys", () => {
  const rows = platterPair({ itemInstruction: `${platterInstruction}\nExtra crispy` });
  assert.equal(pizzaCombinationKey(rows[0]), `${platterInstruction}\nExtra crispy`);
  assert.equal(isSamePizzaCombination(...rows), true);
  assert.equal(isSamePizzaCombination(rows[0], { ...rows[1], isLoadedFromDB: true }), false);
  assert.equal(isSamePizzaCombination(rows[0], { ...rows[1], itemInstruction: platterInstruction }), false);
  assert.equal(isSamePizzaCombination(rows[0], pair()[0]), false);
  for (const itemInstruction of ["", "2-flavor chicken wings platter: 5 ALARM", "2-flavor chicken wings: 5 ALARM + HONEY GARLIC"]) {
    assert.equal(pizzaCombinationKey({ itemInstruction }), "");
  }
});

test("reopened platter pairs recover without categories and additional quantities remain separate", () => {
  for (const item_category of ["", null, undefined]) {
    const saved = platterPair({ isLoadedFromDB: true, item_category, quantity: 2 });
    const added = saved.map((row) => ({ ...row, isLoadedFromDB: false, quantity: 1 }));
    const grouped = groupPizzaCombinationCartRows([...saved, ...added]);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].isLoadedFromDB, true);
    assert.equal(grouped[0].quantity, 2);
    assert.equal(grouped[1].quantity, 1);
    for (const row of grouped) assert.equal(row.item_category, "CHICKEN WINGS PLATTER");
    assert.equal(getPizzaCombinationSourceItem(grouped[0]), saved[0]);
    assert.equal(getPizzaCombinationSourceItem(grouped[1]), added[0]);
    assert.equal(total(grouped), total([...saved, ...added]));
    assertUngrouped([saved[0], added[1]]);
  }
});

test("reversed platter pairs preserve instruction flavor order, notes, proxy identity and locked state", () => {
  const rows = platterPair({ itemInstruction: `${platterInstruction}\nLess sauce\nExtra crispy` }).reverse();
  Object.assign(rows[0], { sourceLineId: "platter-saved-1", mergedKey: "platter-merge-1" });
  rows[1].hasAdditionalEntry = true;
  const [combined] = groupPizzaCombinationCartRows(rows);
  assert.equal(combined.name, "5 ALARM + HONEY GARLIC · Whole");
  assert.equal(combined.displayInstruction, "Less sauce\nExtra crispy");
  assert.equal(combined.itemInstruction, rows[0].itemInstruction);
  assert.equal(combined.sourceLineId, "platter-saved-1");
  assert.equal(combined.mergedKey, "platter-merge-1");
  assert.equal(combined.hasAdditionalEntry, true);
  assert.equal(getPizzaCombinationSourceItem(combined), rows[0]);
  assert.deepEqual(groupPizzaCombinationCartRows([combined]), [combined]);
});

test("platter grouping accepts only matching HALF flavor names and the exact normalized platter category", () => {
  const rows = platterPair();
  for (const item_category of [" chicken   wings platter ", "CHICKEN WINGS PLATTER HALF", "CHICKEN WINGS PLATTER WHOLE"]) {
    assert.equal(groupPizzaCombinationCartRows(platterPair({ item_category })).length, 1);
  }
  for (const item_category of ["PIZZA", "BUFFALO WINGS", "CHICKEN WINGS", "SPECIAL CHICKEN WINGS PLATTER"]) {
    assertUngrouped([rows[0], { ...rows[1], item_category }]);
  }
  for (const name of ["HONEY GARLIC", "HONEY GARLIC WHOLE", 'HONEY GARLIC 12" HALF', "HONEY GARLIC HALF 12\"", "HONEY GARLIC HALF HALF", "HALF", "5 ALARM HALF"]) {
    assertUngrouped([rows[0], { ...rows[1], name }]);
  }
  for (const itemInstruction of [
    "2-flavor chicken wings platter: 5 ALARM + BAKED PARMESAN",
    "2-flavor chicken wings platter: HONEY GARLIC + HONEY GARLIC",
    "2-flavor chicken wings platter: 5 ALARM + HONEY GARLIC + JAMAICAN JERK",
    "2-flavor pizza 12\": 5 ALARM + HONEY GARLIC",
  ]) assertUngrouped(platterPair({ itemInstruction }));
  assertUngrouped([rows[0], { ...rows[1], itemInstruction: `${platterInstruction}\nDifferent note` }]);
});

test("pizza, platter and Buffalo rows never merge even with copied instructions or missing categories", () => {
  const platter = platterPair();
  const pizza = pair();
  const grouped = groupPizzaCombinationCartRows([platter[0], pizza[0], platter[1], pizza[1]]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].combinationLabel, "Combine flavor · Whole platter");
  assert.equal(grouped[1].combinationLabel, "Combine flavor · Whole pizza");
  const pizzaWithPlatterHeader = pair({ item_category: "", itemInstruction: '2-flavor chicken wings platter: 5 CHEESE + ALL MEAT' });
  assertUngrouped(pizzaWithPlatterHeader);
  for (const name of ["BUFFALO WINGS HALF", "BUFFALO WINGS SOLO", "BUFFALO WINGS DOUBLE SPICY"]) {
    const rows = platterPair({ item_category: "", itemInstruction: "2-flavor chicken wings platter: 5 ALARM + BUFFALO WINGS" });
    rows[1].name = name;
    assertUngrouped(rows);
  }
  for (const flavor of ["BUFALLO WINGS", "BUFALLO WINGS SOLO", "GJ FRIED CHICKEN GROUP"]) {
    const rows = platterPair({ item_category: "", itemInstruction: `2-flavor chicken wings platter: 5 ALARM + ${flavor}` });
    rows[1].name = `${flavor} HALF`;
    assertUngrouped(rows);
  }
  assertUngrouped([platter[0], { ...pizza[1], itemInstruction: platterInstruction, item_category: "" }]);
});

test("invalid platter IDs, prices, quantities and ambiguous pairs stay visible", () => {
  const rows = platterPair();
  for (const code of [null, undefined, "", " ", true, {}, Infinity, rows[0].code]) {
    assertUngrouped([rows[0], { ...rows[1], code }]);
  }
  for (const invalid of [null, undefined, "", " ", "NaN", Infinity, -1, true, []]) {
    assertUngrouped([rows[0], { ...rows[1], price: invalid }]);
    assertUngrouped([rows[0], { ...rows[1], quantity: invalid }]);
  }
  assertUngrouped([rows[0], { ...rows[1], quantity: 2 }]);
  assertUngrouped(platterPair({ price: Number.MAX_VALUE }));
  assertUngrouped([rows[0]]);
  assertUngrouped([...rows, { ...rows[0], lineId: "duplicate-platter" }]);
  assertUngrouped([...rows, ...platterPair()]);
  const [editing] = groupPizzaCombinationCartRows(platterPair({ quantity: "" }));
  assert.equal(editing._isPizzaCombination, true);
  assert.equal(editing.quantity, "");
  assert.equal(groupPizzaCombinationCartRows(platterPair({ quantity: 0, price: 0 }))[0].price, 0);
  assert.equal(groupPizzaCombinationCartRows([rows[0], { ...rows[1], quantity: "1" }]).length, 1);
});
