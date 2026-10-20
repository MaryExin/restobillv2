import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGroupCartItem, groupCartMergeKey, groupChoiceProduct, groupMenuProducts, groupSavedOrderItems,
  repriceGroupCartItem, resolveProductGroupAlias, serializeOrderCartItems, setGroupItemQuantity } from "../productGroups.js";

const variant = (product_id, selling_price, extra = {}) => ({ product_id, selling_price, item_name: product_id,
  group_variant: product_id, group_size: "Large", product_group: { name: "Family choices", enabled: true, allow_half: true, allow_half_and_half: true },
  unit_cost: 50, unit_of_measure: "PC", vatable: "Yes", isDiscountable: "Yes", ...extra });
const a = variant("A", 400); const b = variant("B", 500);
const create = (products = [a, b], portion = "half_and_half", count = 1) => createGroupCartItem({
  products: products.map(groupChoiceProduct), portion, count, selectionId: "selection-0001", lineId: "line-1", pricingCategory: "DINING" });

test("optional groups collapse the menu while ordinary products retain their data", () => {
  const ordinary = { product_id: "C", selling_price: 100 };
  const disabled = variant("D", 200, { product_group: { name: "Disabled", enabled: false } });
  const cards = groupMenuProducts([a, b, ordinary, disabled], [a, b]);
  assert.equal(cards.length, 3); assert.equal(cards[0].item_name, "Family choices");
  assert.equal(cards[0]._isProductGroup, true); assert.equal(cards[1], ordinary); assert.equal(cards[2], disabled);
});

test("legacy aliases become one group only when the complete active catalog has a ready replacement", () => {
  const old = { product_id: "OLD-A12-HALF", item_name: "Old Hawaiian 12 half", selling_price: 200,
    group_alias: { canonical_build_code: "A", enabled: true } };
  const another = { ...old, product_id: "OLD-A16" };
  assert.equal(resolveProductGroupAlias(old, [a, b]), a);
  const cards = groupMenuProducts([old, another, a, b], [a, b]);
  assert.equal(cards.length, 1); assert.equal(cards[0].item_name, "Family choices");
  assert.equal(groupMenuProducts([old], [a, b])[0]._isProductGroup, true);
  const oldGrouped = { ...a, ...old };
  assert.equal(groupMenuProducts([oldGrouped, a, b], [oldGrouped, a, b])[0].variantCount, 2);
  for (const unavailable of [[], [b], [{ ...a, selling_price: null }], [{ ...a, group_price_error: "Missing price" }],
    [{ ...a, product_group: { ...a.product_group, enabled: false } }], [{ ...a, group_size_id: "PGS-A12", group_recipe_configured: false }]]) {
    assert.equal(resolveProductGroupAlias(old, unavailable), old);
    assert.equal(groupMenuProducts([old], unavailable)[0], old);
  }
  assert.equal(resolveProductGroupAlias({ ...old, group_alias: { ...old.group_alias, enabled: false } }, [a]).product_id, old.product_id);
  const a9 = { ...a, group_size_id: "PGS-A9", group_size: "9 inch", group_recipe_configured: true };
  const a12 = { ...a, group_size_id: "PGS-A12", group_size: "12 inch", group_recipe_configured: true };
  const sizedAlias = { ...old, group_alias: { ...old.group_alias, size_id: "PGS-A12" } };
  assert.equal(resolveProductGroupAlias(sizedAlias, [a9, a12]), a12);
  assert.equal(resolveProductGroupAlias(sizedAlias, [a9]), sizedAlias);
  assert.equal(resolveProductGroupAlias(sizedAlias, [a9, { ...a12, selling_price: null }]), sizedAlias);
  assert.equal(resolveProductGroupAlias(old, [a9, a12]), old);
  const history = { ...old, sales_quantity: .5 };
  assert.equal(groupSavedOrderItems([history])[0], history);
});

test("one cart item carries both variants, correct portion price and conservative discount eligibility", () => {
  const item = create([a, { ...b, isDiscountable: "No" }]);
  assert.equal(item.price, 450); assert.equal(item.quantity, 1); assert.equal(item.isDiscountable, "No");
  assert.deepEqual(item.group_selection.variants, ["A", "B"]);
  assert.equal(create([a], "whole").price, 400); assert.equal(create([a], "half").price, 200);
  assert.equal(create([variant("A", 4.27)], "half").price, 2.14);
  assert.equal(create([variant("A", 2.325)], "half").price, 1.16);
  assert.equal(create([variant("A", 2.325), variant("B", 3.325)]).price, 2.83);
});

test("legacy half aliases derive the chosen size's whole price instead of the old half price", () => {
  const hawaiian16 = variant("HAWAIIAN-16", 900, { group_size: "16 inch", group_variant: "Hawaiian" });
  const hawaiian12 = variant("HAWAIIAN-12", 655, { group_size: "12 inch", group_variant: "Hawaiian" });
  const pepperoni12 = variant("PEPPERONI-12", 670, { group_size: "12 inch", group_variant: "Pepperoni" });
  const oldHalf = { product_id: "OLD-HALF", selling_price: 1, group_alias: { canonical_build_code: "HAWAIIAN-16", size_id: "", enabled: true } };
  const target = resolveProductGroupAlias(oldHalf, [hawaiian12, hawaiian16, pepperoni12]);
  assert.equal(create([target], "whole").price, 900);
  assert.equal(create([target], "half").price, 450);
  assert.equal(create([hawaiian12, pepperoni12]).price, 662.5);
  assert.equal(oldHalf.selling_price, 1);
});

test("quantity edits and save preserve one complete selection without changing an ordinary same-code line", () => {
  const item = create(); const changed = setGroupItemQuantity(item, 3);
  assert.equal(changed.quantity, 3); assert.equal(changed.group_selection.unit_count, 3);
  assert.equal(item.quantity, 1); assert.equal(setGroupItemQuantity(item, .5), item); assert.equal(setGroupItemQuantity(item, 10001), item);
  const ordinary = { code: "A", price: 400, quantity: 2 };
  const payload = serializeOrderCartItems([changed, ordinary]);
  assert.equal(payload[0].sales_quantity, 3); assert.equal(payload[0].selling_price, 450);
  assert.deepEqual(payload[0].group_selection.variants, ["A", "B"]);
  assert.equal(payload[1].sales_quantity, 2); assert.equal(payload[1].group_selection, undefined);
  assert.notEqual(groupCartMergeKey(changed), groupCartMergeKey(ordinary));
  assert.notEqual(groupCartMergeKey(changed), groupCartMergeKey({ ...changed, group_selection: { ...changed.group_selection, selection_id: "selection-0002" } }));
});

test("saved fractional physical rows become one cart and receipt line using saved labels after rename", () => {
  const item = create();
  const parts = [a, b].map((product, index) => ({ ID: index + 1, product_id: product.product_id, item_name: "Renamed in catalog",
    sales_quantity: .5, selling_price: product.selling_price, unit_cost: 50, vatable: "Yes", isDiscountable: "Yes",
    group_selection: { ...item.group_selection, variant_names: ["Original A", "Original B"], part_index: index } }));
  const ordinary = { product_id: "A", sales_quantity: 2, selling_price: 400, item_name: "Ordinary" };
  const recalled = groupSavedOrderItems(JSON.parse(JSON.stringify([...parts, ordinary])));
  assert.equal(recalled.length, 2); assert.equal(recalled[0].sales_quantity, 1); assert.equal(recalled[0].selling_price, 450);
  assert.match(recalled[0].item_name, /Original A \/ Original B/); assert.equal(recalled[0].unit_cost, 50);
  assert.deepEqual(recalled[1], ordinary); assert.equal(recalled[0].group_selection.part_index, undefined);
});

test("service-type repricing uses every selected variant and rejects missing or incompatible options", () => {
  const item = create();
  const updated = repriceGroupCartItem(item, [{ ...a, selling_price: 500 }, { ...b, selling_price: 700 }], "DELIVERY");
  assert.equal(updated.price, 600); assert.equal(updated.group_selection.pricing_category, "DELIVERY");
  assert.equal(updated.group_selection.selection_id, item.group_selection.selection_id);
  assert.ok(repriceGroupCartItem(item, [a], "DELIVERY").group_price_error);
  assert.throws(() => create([a, { ...b, vatable: "No" }]), /same tax type/);
  assert.throws(() => create([a, { ...b, unit_of_measure: "BOX" }]), /same unit/);
  assert.throws(() => create([a, a]), /different variants/);
  assert.throws(() => create([a, { ...b, group_size: "Small" }]), /same product group/);
  assert.equal(create([a, { ...b, group_size: " large " }]).price, 450);
});

test("actual /ordering UI serializes metadata and uses complete catalog options on card and scan paths", () => {
  const source = readFileSync(new URL("../../components/MainComponents/Orderlist.jsx", import.meta.url), "utf8");
  assert.match(source, /serializeOrderCartItems\(mergedCartItemsForSave\)/);
  assert.match(source, /groupSavedOrderItems\(data\.order_details\)/);
  assert.match(source, /setGroupProducts\(Array\.isArray\(result\.group_products\)/);
  assert.match(source, /addToCart\(scannedMatch, options\)/);
  assert.match(source, /\.flatMap\(\(item\) => item\.group_selection\?\.variants/);
  assert.match(source, /groupCartMergeKey\(item\)/);
  assert.match(source, /Print the order slip for product groups/);
  assert.match(source, /Table transfer or split is unavailable/);
});

test("one master product carries independent size choices through half pricing, save and repricing", () => {
  const size = (product, sizeId, label, price) => ({ ...product, group_size_id: sizeId, group_size: label,
    group_recipe_configured: true, selling_price: price });
  const a9 = size(a, "PGS-A9", "9 inch", 200);
  const a12 = size(a, "PGS-A12", "12 inch", 400);
  const a16 = size(a, "PGS-A16", "16 inch", 600);
  const b12 = size(b, "PGS-B12", "12 inch", 500);
  const item = create([a12, b12]);
  assert.deepEqual(item.group_selection.variant_options, [{ product_id: "A", size_id: "PGS-A12" }, { product_id: "B", size_id: "PGS-B12" }]);
  assert.equal(item.group_selection.schema_version, 2);
  assert.equal(create([a9], "half").price, 100);
  assert.equal(serializeOrderCartItems([item])[0].product_id, "A");
  const updated = repriceGroupCartItem(item, [a9, a16, { ...a12, selling_price: 500 }, { ...b12, selling_price: 700 }], "DELIVERY");
  assert.equal(updated.price, 600); assert.equal(updated.group_selection.size, "12 inch");
  assert.ok(repriceGroupCartItem(item, [a9, a16, b12], "DELIVERY").group_price_error);
  assert.throws(() => create([{ ...a12, group_recipe_configured: false }], "whole"), /ingredients/);
  assert.throws(() => create([a12, { ...b, group_size: "12 inch" }]), /ingredients/);
});
