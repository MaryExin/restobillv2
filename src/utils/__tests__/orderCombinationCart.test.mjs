import assert from "node:assert/strict";
import test from "node:test";
import {
  orderCombinationKey, isSameOrderCombination, groupOrderCombinationCartRows,
  getOrderCombinationSourceItem, isGroupedOrderItem,
} from "../orderCombinationCart.js";

const row = (code, name, price, item_category, itemInstruction) => ({
  code, name, price, quantity: 1, item_category, itemInstruction, isLoadedFromDB: false,
});
const pizza = [
  row("CHEESE", '5 CHEESE 12" HALF', 350, "PIZZA HALF", '2-flavor pizza 12": 5 CHEESE + ALL MEAT'),
  row("MEAT", 'ALL MEAT 12" HALF', 377.5, "PIZZA HALF", '2-flavor pizza 12": 5 CHEESE + ALL MEAT'),
];
const platter = [
  row("ALARM", "5 ALARM HALF", 267.5, "CHICKEN WINGS PLATTER", "2-flavor chicken wings platter: 5 ALARM + HONEY GARLIC"),
  row("GARLIC", "HONEY GARLIC HALF", 267.5, "CHICKEN WINGS PLATTER", "2-flavor chicken wings platter: 5 ALARM + HONEY GARLIC"),
];
const coffee = [
  row("LATTE", "CAFE LATTE", 140, "DRINKS", "Coffee add-on: CAFE LATTE + CCL VANILLA"),
  row("VANILLA", "CCL VANILLA", 25, "ADD ONS", "Coffee add-on: CAFE LATTE + CCL VANILLA"),
];

test("mixed cart keeps pizza/platter behavior and groups coffee without losing ordinary row order", () => {
  const regular = row("REGULAR", "CAFE LATTE", 140, "DRINKS", "");
  const rows = [pizza[0], coffee[1], regular, platter[0], coffee[0], pizza[1], platter[1]];
  const result = groupOrderCombinationCartRows(rows);
  assert.equal(result.length, 4);
  assert.equal(result[0].name, '5 CHEESE + ALL MEAT · 12"');
  assert.equal(result[0].price, 727.5);
  assert.equal(result[1].name, "CAFE LATTE · VANILLA");
  assert.equal(result[1].price, 165);
  assert.equal(result[2], regular);
  assert.equal(result[3].name, "5 ALARM + HONEY GARLIC · Whole");
  assert.equal(result[3].price, 535);
  assert.equal(getOrderCombinationSourceItem(result[0]), pizza[0]);
  assert.equal(getOrderCombinationSourceItem(result[1]), coffee[0]);
  assert.equal(getOrderCombinationSourceItem(result[2]), regular);
  assert.equal(getOrderCombinationSourceItem(result[3]), platter[0]);
  assert.deepEqual(result.map(isGroupedOrderItem), [true, true, false, true]);
  assert.deepEqual(groupOrderCombinationCartRows(result), result);
});

test("wrapper keys and pair matching retain instruction/loaded boundaries without mixing kinds", () => {
  for (const pair of [pizza, platter, coffee]) {
    assert.equal(orderCombinationKey(pair[0]), pair[0].itemInstruction);
    assert(isSameOrderCombination(...pair));
    assert.equal(isSameOrderCombination(pair[0], { ...pair[1], isLoadedFromDB: true }), false);
  }
  assert.equal(isSameOrderCombination(pizza[0], coffee[0]), false);
  assert.equal(isSameOrderCombination(platter[0], coffee[1]), false);
  assert.equal(orderCombinationKey({ itemInstruction: "No sugar" }), "");
  assert.equal(isGroupedOrderItem(null), false);
  assert.deepEqual(groupOrderCombinationCartRows(null), []);
  assert.equal(getOrderCombinationSourceItem(null), null);
});

test("mixed chicken pairs join existing combinations without changing old rows, boundaries or source identities", () => {
  const instruction = "2-flavor chicken Solo: GJ FRIED CHICKEN + BUFFALO WINGS Spicy";
  const chicken = [
    row("GJ", "GJ FRIED CHICKEN SOLO HALF", 175, "GJ FRIED CHICKEN", instruction),
    row("SPICY", "BUFFALO WINGS SOLO SPICY HALF", 177.5, "BUFALLO WINGS", instruction),
  ];
  const result = groupOrderCombinationCartRows([...chicken, ...pizza, ...platter, ...coffee]);
  assert.equal(result.length, 4);
  assert.equal(result[0].name, "GJ FRIED CHICKEN + BUFFALO WINGS Spicy · Solo");
  assert.equal(result[0].price, 352.5);
  assert.equal(isGroupedOrderItem(result[0]), true);
  assert.equal(getOrderCombinationSourceItem(result[0]), chicken[0]);
  assert.equal(orderCombinationKey(result[0]), instruction);
  assert.equal(isSameOrderCombination(...chicken), true);
  assert.equal(isSameOrderCombination(chicken[0], { ...chicken[1], isLoadedFromDB: true }), false);
  for (const other of [pizza[0], platter[0], coffee[0]]) assert.equal(isSameOrderCombination(chicken[0], other), false);
  assert.deepEqual(result.slice(1), groupOrderCombinationCartRows([...pizza, ...platter, ...coffee]));
  assert.deepEqual(groupOrderCombinationCartRows(result), result);
});
