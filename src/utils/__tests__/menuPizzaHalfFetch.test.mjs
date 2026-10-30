import assert from "node:assert/strict";
import test from "node:test";
import { fetchMenuPizzaHalves } from "../menuProductVariantFetch.js";

const product = (id, item_name, selling_price = 475, item_category = "PIZZA HALF") => ({
  product_id: id, item_name, selling_price, item_category,
});
const scope = {
  apiHost: "http://pos.test", categoryCode: "RESTAURANT", unitCode: "BRANCH", salesType: "DINE IN",
  group: { familyKey: '["PIZZA","5 CHEESE"]', item_name: "5 CHEESE", item_category: "PIZZA" },
};
const response = (products, offset = 0) => ({
  ok: true, json: async () => ({ status: "success", products, filters: { offset } }),
});
const unrelatedPage = () => Array.from({ length: 200 }, (_, index) => product(`CAKE-${index}`, `CAKE ${index} HALF`, 100, "CAKES"));

test("half catalog search keeps original pricing scope and only valid compatible half pizzas", async () => {
  const expected = [product("CHEESE", '5 CHEESE 12" HALF'), product("MEAT", 'ALL MEAT HALF 16"', "540.00", "PIZZA")];
  const actual = await fetchMenuPizzaHalves({
    ...scope,
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://pos.test/api/get_pricing_selection.php");
      assert.deepEqual(JSON.parse(options.body), {
        category_code: "RESTAURANT", unit_code: "BRANCH", sales_type: "DINE IN",
        item_category: "", search: "HALF", limit: 200, offset: 0,
      });
      return response([...expected,
        product("WHOLE", 'ALL MEAT 12"', 1080, "PIZZA"),
        product("SPECIAL", 'ALL MEAT 12" HALF', 500, "SPECIAL PIZZA"),
        product("MISSING-PRICE", 'VEGETARIAN 12" HALF', null),
        product("MISSING-SIZE", "VEGETARIAN HALF"),
        product("", 'VEGETARIAN 12" HALF'),
      ]);
    },
  });
  assert.deepEqual(actual, expected);
  assert.equal(actual[1], expected[1]);
});

test("paginates beyond unrelated HALF matches and removes duplicate IDs", async () => {
  const half = product("MEAT", 'ALL MEAT 12" HALF', 540);
  let calls = 0;
  const actual = await fetchMenuPizzaHalves({ ...scope, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.search, "HALF");
    assert.equal(payload.offset, calls * 200);
    calls += 1;
    return calls === 1 ? response(unrelatedPage()) : response([half, { ...half, selling_price: 9999 }], 200);
  } });
  assert.equal(calls, 2);
  assert.deepEqual(actual, [half]);
});

test("non-pizza groups do not fetch and empty responses do not reuse old variants", async () => {
  let calls = 0;
  assert.deepEqual(await fetchMenuPizzaHalves({ ...scope,
    group: { item_category: "CAKES" }, fetchImpl: async () => { calls++; return response([]); },
  }), []);
  assert.equal(calls, 0);
  assert.deepEqual(await fetchMenuPizzaHalves({ ...scope, fetchImpl: async () => response([]) }), []);
});

test("fails on old pagination APIs, invalid responses, repeated pages, and abort", async () => {
  let calls = 0;
  await assert.rejects(fetchMenuPizzaHalves({ ...scope, fetchImpl: async () => {
    calls++;
    return { ok: true, json: async () => ({ status: "success", products: unrelatedPage() }) };
  } }), /Update the pricing API/);
  assert.equal(calls, 2);
  await assert.rejects(fetchMenuPizzaHalves({ ...scope,
    fetchImpl: async () => ({ ok: false, json: async () => ({ status: "error" }) }),
  }), /Could not load product options/);
  await assert.rejects(fetchMenuPizzaHalves({ ...scope, fetchImpl: async (_url, options) =>
    response(unrelatedPage(), JSON.parse(options.body).offset),
  }), /could not be fully loaded/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchMenuPizzaHalves({ ...scope, signal: controller.signal,
    fetchImpl: async () => { assert.fail("aborted request must not fetch"); },
  }), { name: "AbortError" });
});
