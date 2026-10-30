import assert from "node:assert/strict";
import test from "node:test";
import {
  createChickenCombination, getChickenCombinationChoices, getChickenCombinationInstruction,
  getChickenCombinationSizes, getChickenVariantDetails, isChickenVariantGroup, isCompatibleChickenHalf,
} from "../menuChickenCombination.js";
import { getMenuVariantDetails, groupMenuProductVariants } from "../menuProductVariants.js";

const product = (product_id, item_name, selling_price, item_category = "BUFALLO WINGS") =>
  Object.freeze({ product_id, item_name, selling_price, item_category });
const original = product("BD-b4a9586fb5aa", "BUFALLO WINGS SOLO", 525);
const originalHalf = product("BD-bf723c7e4ef9", "BUFFALO WINGS SOLO HALF", "262.50");
const spicy = product("BD-99fcb5210190", "BUFALLO WINGS SOLO SPICY", 525);
const spicyHalf = product("BD-ad3bafe022af", "BUFFALO WINGS SOLO SPICY HALF", 262.5);
const chicken = product("BD-347b92b6cf0f", "GJ FRIED CHICKEN SOLO", 495, "GJ FRIED CHICKEN");
const chickenHalf = product("BD-3b6b31828a43", "GJ FRIED CHICKEN SOLO HALF", 247.5, "GJ FRIED CHICKEN");
const groupHalf = product("BD-d17ae4609bec", "BUFFALO WINGS GROUP HALF", 710);
const wingsGroup = groupMenuProductVariants([original, originalHalf, spicy, spicyHalf])[0];
const chickenGroup = groupMenuProductVariants([chicken, chickenHalf])[0];

test("chicken details recognize both wings spellings, serving sizes and exact flavor/portion tags", () => {
  assert.deepEqual(getChickenVariantDetails(originalHalf), {
    kind: "wings", servingSize: "solo", sizeLabel: "Solo",
    flavorLabel: "BUFFALO WINGS Original", flavorKey: "wings:original", portion: "half",
  });
  assert.deepEqual(getChickenVariantDetails(chickenHalf), {
    kind: "fried-chicken", servingSize: "solo", sizeLabel: "Solo",
    flavorLabel: "GJ FRIED CHICKEN", flavorKey: "fried-chicken", portion: "half",
  });
  assert.deepEqual(getChickenVariantDetails(product("SPICY", "  buffalo  wings DOUBLE spicy HALF ", 485, " Buffalo Wings HALF ")), {
    kind: "wings", servingSize: "double", sizeLabel: "Double",
    flavorLabel: "BUFFALO WINGS Spicy", flavorKey: "wings:spicy", portion: "half",
  });
  assert.equal(getChickenVariantDetails(groupHalf).sizeLabel, "Group");
  assert.equal(getChickenVariantDetails(original).portion, "whole");
});

test("new chicken halves share existing serving families without changing raw source identity", () => {
  const groups = groupMenuProductVariants([original, originalHalf, spicy, spicyHalf, chicken, chickenHalf]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].familyKey, JSON.stringify(["BUFALLO WINGS", "BUFALLO WINGS"]));
  assert.equal(groups[0].item_name, "BUFALLO WINGS");
  assert.equal(groups[0].sizeKind, "serving");
  assert.equal(groups[0].variants[1], originalHalf);
  assert.equal(groups[1].variants[1], chickenHalf);
  assert.equal(getMenuVariantDetails(spicyHalf).portion, "half", "orderable-product filtering recognizes hidden half ingredients");
  assert.equal(getMenuVariantDetails(spicyHalf).flavorLabel, "Spicy");
  assert.equal(getMenuVariantDetails(chickenHalf).baseName, "GJ FRIED CHICKEN");
  assert.equal(getMenuVariantDetails(originalHalf).familyKey, getMenuVariantDetails(original).familyKey);
  assert.equal(originalHalf.item_name, "BUFFALO WINGS SOLO HALF");
});

test("chicken size choices require actual whole and half SKUs for Original, Spicy and GJ", () => {
  assert.deepEqual(getChickenCombinationSizes(wingsGroup), [{
    servingSize: "solo", sizeLabel: "Solo", options: [
      { whole: original, half: originalHalf, flavorLabel: "BUFFALO WINGS Original" },
      { whole: spicy, half: spicyHalf, flavorLabel: "BUFFALO WINGS Spicy" },
    ],
  }]);
  assert.deepEqual(getChickenCombinationSizes(chickenGroup)[0].options, [
    { whole: chicken, half: chickenHalf, flavorLabel: "GJ FRIED CHICKEN" },
  ]);
  const missingPair = { ...wingsGroup, variants: [original, spicyHalf, groupHalf, chicken, chickenHalf] };
  assert.deepEqual(getChickenCombinationSizes(missingPair), []);
  assert.deepEqual(getChickenCombinationSizes({ ...wingsGroup, variants: [original, { ...originalHalf, selling_price: null }] }), []);
  assert.deepEqual(getChickenCombinationSizes(null), []);
  assert.deepEqual(getChickenCombinationSizes({ ...wingsGroup, variants: [spicy, spicyHalf] })[0].options, [
    { whole: spicy, half: spicyHalf, flavorLabel: "BUFFALO WINGS Spicy" },
  ]);
});

test("size choices stay Solo Double Group and use catalog prices without dividing wholes", () => {
  const groupWhole = product("GROUP", "BUFALLO WINGS GROUP", 1410);
  const doubleWhole = product("DOUBLE", "BUFALLO WINGS DOUBLE", 970);
  const doubleHalf = product("DOUBLE-H", "BUFFALO WINGS DOUBLE HALF", 485);
  const group = groupMenuProductVariants([groupHalf, groupWhole, doubleHalf, doubleWhole, originalHalf, original])[0];
  const result = getChickenCombinationSizes(group);
  assert.deepEqual(result.map((size) => size.servingSize), ["solo", "double", "group"]);
  assert.equal(result[2].options[0].half, groupHalf);
  assert.equal(result[2].options[0].half.selling_price, 710, "Group half is not synthesized as 1410 / 2");
});

test("second chicken flavor comes only from the other family at the same size", () => {
  const catalog = [groupHalf, originalHalf, chickenHalf, spicyHalf, original, { ...spicyHalf }];
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "solo", catalog, originalHalf), [chickenHalf]);
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "solo", catalog, spicyHalf), [chickenHalf]);
  assert.deepEqual(getChickenCombinationChoices(chickenGroup, "solo", catalog, chickenHalf), [originalHalf, spicyHalf]);
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "solo", catalog), [chickenHalf]);
  assert.deepEqual(getChickenCombinationChoices(chickenGroup, "solo", catalog), [originalHalf, spicyHalf]);
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "solo", catalog, chickenHalf), [], "anchor belongs to the opened family");
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "double", catalog, originalHalf), []);
  assert.deepEqual(getChickenCombinationChoices(wingsGroup, "unknown", catalog, originalHalf), []);
});

test("current and previously saved pairings sum real half prices and preserve selected order and identity", () => {
  for (const [first, second, total] of [
    [originalHalf, chickenHalf, 510], [chickenHalf, spicyHalf, 510], [spicyHalf, originalHalf, 525],
  ]) {
    const result = createChickenCombination(first, second);
    assert.deepEqual(result, { products: [first, second], total });
    assert.equal(result.products[0], first);
    assert.equal(result.products[1], second);
    assert.equal(first.selling_price, first === originalHalf ? "262.50" : first === chickenHalf ? 247.5 : 262.5);
  }
  assert.equal(getChickenCombinationInstruction(chickenHalf, originalHalf),
    "2-flavor chicken Solo: GJ FRIED CHICKEN + BUFFALO WINGS Original");
  assert.equal(getChickenCombinationInstruction(spicyHalf, originalHalf),
    "2-flavor chicken Solo: BUFFALO WINGS Spicy + BUFFALO WINGS Original");
});

test("whole products, size mismatches, duplicate IDs and same flavors cannot be combined", () => {
  const invalidPairs = [
    [original, chickenHalf], [originalHalf, chicken], [groupHalf, chickenHalf],
    [originalHalf, { ...spicyHalf, product_id: originalHalf.product_id }],
    [originalHalf, { ...originalHalf, product_id: "ANOTHER-ORIGINAL" }],
    [chickenHalf, { ...chickenHalf, product_id: "ANOTHER-CHICKEN" }],
    [null, chickenHalf], [originalHalf, null],
  ];
  for (const [first, second] of invalidPairs) {
    assert.equal(createChickenCombination(first, second), null);
    assert.equal(getChickenCombinationInstruction(first, second), "");
  }
});

test("null, blank, nonnumeric and negative prices are rejected while zero is an actual valid price", () => {
  for (const selling_price of [null, undefined, "", " ", true, false, [], {}, "unknown", -1, NaN, Infinity]) {
    const invalid = { ...originalHalf, selling_price };
    assert.equal(isCompatibleChickenHalf(invalid, chickenGroup), false, String(selling_price));
    assert.equal(createChickenCombination(invalid, chickenHalf), null);
  }
  for (const product_id of [null, undefined, "", " ", false, {}, NaN, Infinity]) {
    assert.equal(createChickenCombination({ ...originalHalf, product_id }, chickenHalf), null);
  }
  assert.equal(createChickenCombination({ ...originalHalf, selling_price: 0 }, chickenHalf).total, 247.5);
  assert.equal(createChickenCombination({ ...originalHalf, selling_price: "0.10" }, { ...chickenHalf, selling_price: "0.20" }).total, 0.3);
});

test("strict chicken eligibility excludes rice meals, platters, other categories, unsupported sizes and malformed names", () => {
  const invalid = [
    product("RM", "RM BUFFALO WINGS", 355, "RICE MEAL"),
    product("PLATTER", "HONEY GARLIC HALF", 267.5, "CHICKEN WINGS PLATTER"),
    product("CATEGORY", "BUFFALO WINGS SOLO HALF", 262.5, "SPECIALS"),
    product("CROSS-CATEGORY", "GJ FRIED CHICKEN SOLO HALF", 247.5, "BUFALLO WINGS"),
    product("MISSING-CATEGORY", "BUFFALO WINGS SOLO HALF", 262.5, null),
    product("PREFIX", "HALF FRIED CHICKEN", 100, "GJ FRIED CHICKEN"),
    product("UNSIZED", "BUFFALO WINGS HALF", 100),
    product("INCHES", 'BUFFALO WINGS 12" HALF', 100),
    product("OUNCES", "BUFFALO WINGS 8OZ HALF", 100),
    product("SUFFIX", "BUFFALO WINGS SOLO HALF SPECIAL", 100),
    product("UNKNOWN-FLAVOR", "BUFFALO WINGS SOLO HONEY HALF", 100),
    { ...originalHalf, _isFolder: true }, { ...originalHalf, _isVariantGroup: true }, null,
  ];
  for (const item of invalid) {
    assert.equal(getChickenVariantDetails(item), null, item?.item_name);
    assert.equal(isCompatibleChickenHalf(item, wingsGroup), false);
    assert.equal(createChickenCombination(item, chickenHalf), null);
  }
  assert.equal(isChickenVariantGroup(wingsGroup), true);
  assert.equal(isChickenVariantGroup(chickenGroup), true);
  assert.equal(isChickenVariantGroup({ ...wingsGroup, _isFolder: true }), false);
  assert.equal(isChickenVariantGroup({ item_name: "CHICKEN WINGS PLATTER", item_category: "CHICKEN WINGS PLATTER" }), false);
});
