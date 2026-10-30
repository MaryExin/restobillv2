import assert from "node:assert/strict";
import test from "node:test";
import { fetchMenuPlatterHalves, fetchMenuCombinationHalves, fetchMenuProductVariants } from "../menuProductVariantFetch.js";
import { groupMenuProductVariants } from "../menuProductVariants.js";

const product = (id, item_name, selling_price = 267.5, item_category = "CHICKEN WINGS PLATTER") => ({
  product_id: id, item_name, selling_price, item_category,
});
const whole = product("GARLIC-WHOLE", "HONEY GARLIC", 535);
const garlic = product("GARLIC-HALF", "HONEY GARLIC HALF");
const jerk = product("JERK-HALF", "JAMAICAN JERK HALF", 275);
const scope = {
  apiHost: "http://pos.test", categoryCode: "RESTAURANT", unitCode: "BRANCH", salesType: "TAKE OUT",
  group: groupMenuProductVariants([whole])[0],
};
const response = (products, offset = 0) => ({
  ok: true, json: async () => ({ status: "success", products, filters: { offset } }),
});

test("platter combination loads real Half products in the same branch and service type without pizza or wings sizes", async () => {
  const actual = await fetchMenuCombinationHalves({
    ...scope,
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://pos.test/api/get_pricing_selection.php");
      assert.deepEqual(JSON.parse(options.body), {
        category_code: "RESTAURANT", unit_code: "BRANCH", sales_type: "TAKE OUT",
        item_category: "CHICKEN WINGS PLATTER", search: "", limit: 200, offset: 0,
      });
      return response([garlic, jerk, whole,
        product("PIZZA", 'ALL MEAT 12" HALF', 550, "PIZZA"),
        product("WINGS", "BUFALLO WINGS SOLO", 525, "BUFALLO WINGS"),
        product("NO-PRICE", "5 ALARM HALF", null),
        product("", "BAKED PARMESAN HALF"),
      ]);
    },
  });
  assert.deepEqual(actual, [garlic, jerk]);
  assert.equal(actual[0], garlic);
  assert.equal(actual[1], jerk);
});

test("name-only pricing APIs still return all five platter Half flavors through the category filter", async () => {
  const names = ["5 ALARM", "BAKED PARMESAN", "HONEY GARLIC", "JALAPENO CHEDDAR", "JAMAICAN JERK"];
  const catalog = names.flatMap((name) => [
    product(`${name}-WHOLE`, name, name === "JAMAICAN JERK" ? 550 : 535),
    product(`${name}-HALF`, `${name} HALF`, name === "JAMAICAN JERK" ? 275 : 267.5),
  ]);
  const actual = await fetchMenuPlatterHalves({
    ...scope,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      // Match the older deployed API: searches inspect item_name, and an
      // empty search allows the exact item_category filter to take effect.
      return response(catalog.filter((item) => payload.search
        ? item.item_name.toLowerCase().includes(payload.search.toLowerCase())
        : item.item_category === payload.item_category));
    },
  });
  assert.deepEqual(actual.map((item) => item.item_name), names.map((name) => `${name} HALF`));
  assert.deepEqual(actual.map((item) => item.selling_price), [267.5, 267.5, 267.5, 267.5, 275]);
});

test("a whole-only platter search still loads its matching original Whole and Half rows", async () => {
  const actual = await fetchMenuProductVariants({ ...scope, fetchImpl: async (_url, options) => {
    assert.equal(JSON.parse(options.body).search, "HONEY GARLIC");
    return response([whole, garlic, product("DIP", "HONEY GARLIC", 55, "ADD ONS")]);
  } });
  assert.deepEqual(actual, [whole, garlic]);
});

test("platter flavor pagination deduplicates IDs and fails closed for wrong offsets", async () => {
  const full = Array.from({ length: 200 }, (_, index) => product(`WHOLE-${index}`, `FLAVOR ${index}`, 535));
  let calls = 0;
  const actual = await fetchMenuPlatterHalves({ ...scope, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    const offset = payload.offset;
    assert.equal(payload.item_category, "CHICKEN WINGS PLATTER");
    assert.equal(payload.search, "");
    assert.equal(offset, calls * 200);
    calls++;
    return offset === 0 ? response(full) : response([jerk, { ...jerk, selling_price: 999 }], offset);
  } });
  assert.equal(calls, 2);
  assert.deepEqual(actual, [jerk]);
  calls = 0;
  await assert.rejects(fetchMenuPlatterHalves({ ...scope, fetchImpl: async () => {
    calls++;
    return calls === 1 ? response(full) : response([jerk], 0);
  } }), /Update the pricing API/);
});

test("invalid groups, empty results, failures, and cancellation never return old platter flavors", async () => {
  assert.deepEqual(await fetchMenuPlatterHalves({ ...scope, group: { item_category: "BUFALLO WINGS" },
    fetchImpl: async () => assert.fail("another category must not load platter flavors"),
  }), []);
  assert.deepEqual(await fetchMenuPlatterHalves({ ...scope, fetchImpl: async () => response([]) }), []);
  await assert.rejects(fetchMenuPlatterHalves({ ...scope,
    fetchImpl: async () => ({ ok: false, json: async () => ({ status: "error" }) }),
  }), /Could not load product options/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchMenuPlatterHalves({ ...scope, signal: controller.signal,
    fetchImpl: async () => assert.fail("an aborted request must not fetch"),
  }), { name: "AbortError" });
});

test("pizza combinations still use the pizza Half catalog", async () => {
  const half = product("PIZZA", 'ALL MEAT 12" HALF', 550, "PIZZA");
  const actual = await fetchMenuCombinationHalves({ ...scope, group: { item_category: "PIZZA" },
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).search, "HALF");
      return response([half, garlic]);
    },
  });
  assert.deepEqual(actual, [half]);
});
