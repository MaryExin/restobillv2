import assert from "node:assert/strict";
import test from "node:test";
import { getOrderItemDisplayName } from "../orderItemDisplayName.js";

test("portion SKU names display Combine flavor without changing saved values", () => {
  const item = Object.freeze({ item_name: '5 CHEESE 12" HALF', item_code: "P42", price: 199.5 });
  assert.equal(getOrderItemDisplayName(item), '5 CHEESE 12" (Combine flavor)');
  assert.deepEqual(item, { item_name: '5 CHEESE 12" HALF', item_code: "P42", price: 199.5 });
  assert.equal(getOrderItemDisplayName({ name: "HONEY GARLIC HALF" }), "HONEY GARLIC (Combine flavor)");
});

test("portion labels support either size order without losing punctuation", () => {
  for (const size of ['12"', "12”", "12″", "12 IN", "12in.", "12 INCH", "12 INCHES", '9.5"']) {
    for (const name of ["FISHERMAN'S", "PEPPERONI W/ MUSHROOM"]) {
      assert.equal(getOrderItemDisplayName(`${name} ${size} HALF`), `${name} ${size} (Combine flavor)`);
      assert.equal(getOrderItemDisplayName(`${name} HALF ${size}`), `${name} ${size} (Combine flavor)`);
    }
  }
});

test("ordinary products, whole orders and already formatted names remain unchanged", () => {
  for (const name of ["HALF FRIED CHICKEN", "HALFWAY HOUSE", "HALF", "PIZZA WHOLE", "LATTE 12 OZ", "GELATO 2 SCOOPS", "GJ FRIED CHICKEN SOLO", "HONEY GARLIC (Combine flavor)"]) {
    assert.equal(getOrderItemDisplayName(name), name);
  }
  assert.equal(getOrderItemDisplayName(null), "");
  assert.equal(getOrderItemDisplayName({}), "");
});

test("leading CCL is hidden in display names while original catalog and cart rows remain unchanged", () => {
  const catalog = Object.freeze({ product_id: "ALMOND", item_name: "CCL ALMOND", selling_price: 25 });
  const cart = Object.freeze({ code: "HAZELNUT", name: "  ccl\tHazelnut  ", price: 25, quantity: 2 });
  assert.equal(getOrderItemDisplayName(catalog), "ALMOND");
  assert.equal(getOrderItemDisplayName(cart), "Hazelnut");
  assert.equal(getOrderItemDisplayName("CCL ALMOND HALF"), "ALMOND (Combine flavor)");
  assert.equal(getOrderItemDisplayName("ALMOND"), "ALMOND", "formatting a display label twice is safe");
  assert.deepEqual(catalog, { product_id: "ALMOND", item_name: "CCL ALMOND", selling_price: 25 });
  assert.deepEqual(cart, { code: "HAZELNUT", name: "  ccl\tHazelnut  ", price: 25, quantity: 2 });
  for (const name of ["VANILLA CCL BLEND", "ALMOND CCL", "CCLASSIC SYRUP", "ACCL ALMOND"]) {
    assert.equal(getOrderItemDisplayName(name), name);
  }
});
