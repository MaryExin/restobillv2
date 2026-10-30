import assert from "node:assert/strict";
import test from "node:test";
import { fetchMenuChickenHalves, fetchMenuCombinationHalves, fetchMenuProductVariants } from "../menuProductVariantFetch.js";
import { groupMenuProductVariants } from "../menuProductVariants.js";

const product = (product_id, item_name, selling_price, item_category = "BUFALLO WINGS") =>
  Object.freeze({ product_id, item_name, selling_price, item_category });
const wings = product("WINGS", "BUFALLO WINGS SOLO", 525);
const wingsHalf = product("WINGS-H", "BUFFALO WINGS SOLO HALF", 262.5);
const spicyHalf = product("SPICY-H", "BUFFALO WINGS SOLO SPICY HALF", 262.5);
const chickenHalf = product("GJ-H", "GJ FRIED CHICKEN SOLO HALF", 247.5, "GJ FRIED CHICKEN");
const group = groupMenuProductVariants([wings])[0];
const scope = { apiHost: "http://pos.test", categoryCode: "RESTAURANT", unitCode: "BRANCH", salesType: "TAKE OUT", group };
const response = (products, offset = 0) => ({ ok: true, json: async () => ({ status: "success", products, filters: { offset } }) });

test("a name-only pricing API loads whole and half wings despite catalog spelling differences", async () => {
  const products = [wings, wingsHalf, spicyHalf, chickenHalf,
    product("RICE-MEAL", "RM BUFFALO WINGS", 355, "RICE MEAL"),
    product("OTHER", "BUFFALO WINGS SOLO HALF", 50, "SPECIALS")];
  const actual = await fetchMenuProductVariants({ ...scope, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.search, "WINGS");
    assert.equal(payload.item_category, "");
    return response(products.filter((item) => item.item_name.includes(payload.search)));
  } });
  assert.deepEqual(actual, [wings, wingsHalf, spicyHalf]);
  assert.equal(actual[1], wingsHalf);
  assert.equal(group.variants.length, 1);
});

test("chicken half requests search both eligible categories with real scoped pricing and exact original objects", async () => {
  const controller = new AbortController();
  const actual = await fetchMenuCombinationHalves({ ...scope, signal: controller.signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://pos.test/api/get_pricing_selection.php");
      assert.equal(options.signal, controller.signal);
      assert.deepEqual(JSON.parse(options.body), {
        category_code: "RESTAURANT", unit_code: "BRANCH", sales_type: "TAKE OUT",
        item_category: "", search: "HALF", limit: 200, offset: 0,
      });
      return response([wingsHalf, spicyHalf, chickenHalf, wings,
        product("PLATTER", "HONEY GARLIC HALF", 267.5, "CHICKEN WINGS PLATTER"),
        product("PIZZA", '5 CHEESE 12" HALF', 475, "PIZZA"),
        product("NO-PRICE", "BUFFALO WINGS GROUP HALF", null),
      ]);
    },
  });
  assert.deepEqual(actual, [wingsHalf, spicyHalf, chickenHalf]);
  assert.equal(actual[2], chickenHalf);
  const chickenGroup = groupMenuProductVariants([product("GJ", "GJ FRIED CHICKEN SOLO", 495, "GJ FRIED CHICKEN")])[0];
  const fromChicken = await fetchMenuCombinationHalves({ ...scope, group: chickenGroup,
    fetchImpl: async () => response([wingsHalf, spicyHalf, chickenHalf]),
  });
  assert.deepEqual(fromChicken, actual, "both starting families load the same compatible half catalog");
});

test("chicken half pagination retains later flavors, scope and deduplicated IDs", async () => {
  const fillers = Array.from({ length: 199 }, (_, index) => product(`OTHER-${index}`, `FLAVOR ${index} HALF`, 100, "PIZZA"));
  const payloads = [];
  const actual = await fetchMenuChickenHalves({ ...scope, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    payloads.push(payload);
    return response(payload.offset === 0 ? [wingsHalf, ...fillers] : [wingsHalf, spicyHalf, chickenHalf], payload.offset);
  } });
  assert.deepEqual(actual, [wingsHalf, spicyHalf, chickenHalf]);
  assert.deepEqual(payloads.map((payload) => payload.offset), [0, 200]);
  for (const payload of payloads) {
    assert.equal(payload.search, "HALF");
    assert.equal(payload.category_code, scope.categoryCode);
    assert.equal(payload.unit_code, scope.unitCode);
    assert.equal(payload.sales_type, scope.salesType);
  }
});

test("invalid groups and aborted chicken loads never call the pricing API", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response([]); };
  assert.deepEqual(await fetchMenuChickenHalves({ ...scope, group: { item_category: "PIZZA", item_name: "5 CHEESE" }, fetchImpl }), []);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchMenuChickenHalves({ ...scope, signal: controller.signal, fetchImpl }), { name: "AbortError" });
  assert.equal(calls, 0);
});
