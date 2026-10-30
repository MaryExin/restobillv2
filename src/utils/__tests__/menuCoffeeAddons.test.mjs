import assert from "node:assert/strict";
import test from "node:test";
import { fetchCoffeeAddonOptions, isCclAddon, isCoffeeAddonDrink } from "../menuCoffeeAddons.js";

const drink = Object.freeze({ product_id: "COFFEE", item_name: "CAFE LATTE", item_category: "DRINKS", selling_price: 175 });
const refreshed = Object.freeze({ ...drink, selling_price: "180.00" });
const almond = Object.freeze({ product_id: "ALMOND", item_name: "CCL ALMOND", item_category: "ADD ONS", selling_price: "30.50" });
const hazelnut = Object.freeze({ product_id: "HAZELNUT", item_name: "CCL HAZELNUT", item_category: "ADD ONS", selling_price: 32 });
const scope = { product: drink, apiHost: "http://pos.test", categoryCode: "RESTAURANT", unitCode: "BRANCH-1", salesType: "TAKE OUT" };
const response = (products, offset = 0) => ({ ok: true,
  json: async () => ({ status: "success", products, filters: { offset } }) });

test("coffee and CCL classifiers accept supported spellings without expanding unrelated latte products", () => {
  for (const name of ["CAPPUCINO", "CAPPUCCINO", "Iced Cappuccino", "CAFE LATTE", "ICED CAFE LATTE", "  iced  Café\tLatté  "]) {
    assert(isCoffeeAddonDrink({ item_name: name, item_category: " drinks " }), name);
  }
  for (const product of [null, {}, { item_name: "CAFE LATTE", item_category: "DESSERTS" },
    { item_name: "GREEN TEA LATTE", item_category: "DRINKS" },
    { item_name: "CAPPUCCINOLATTE", item_category: "DRINKS" },
    { item_name: "CAFE LATTEX", item_category: "DRINKS" }]) {
    assert.equal(isCoffeeAddonDrink(product), false);
  }
  for (const category of ["ADD ON", "ADD ONS", "add-ons", "ADD_ONS", " addons "]) {
    assert(isCclAddon({ item_name: " ccl Almond ", item_category: category }));
  }
  for (const product of [null, {}, { ...almond, item_category: "DRINKS" },
    { ...almond, item_name: "ALMOND CCL" }, { ...almond, item_name: "CCLASSIC SYRUP" },
    { ...almond, item_category: "ADD ONS EXTRA" }]) {
    assert.equal(isCclAddon(product), false);
  }
});

test("coffee options refresh the exact drink and use scoped API add-on prices and original identities", async () => {
  const requests = [];
  const controller = new AbortController();
  const result = await fetchCoffeeAddonOptions({ ...scope, signal: controller.signal,
    fetchImpl: async (url, options) => {
      const payload = JSON.parse(options.body);
      requests.push({ url, options, payload });
      return response(payload.codes ? [{ ...refreshed, product_id: "OTHER" }, refreshed] : [hazelnut, almond]);
    },
  });
  assert.equal(result.product, refreshed);
  assert.deepEqual(result.addons, [almond, hazelnut]);
  assert.equal(result.addons[0], almond);
  assert.equal(result.product.selling_price, "180.00");
  assert.equal(result.addons[0].selling_price, "30.50", "do not substitute a fixed surcharge or master price");
  assert.equal(drink.selling_price, 175, "refreshing does not overwrite the menu object");
  assert.equal(requests.length, 2);
  for (const { url, options, payload } of requests) {
    assert.equal(url, "http://pos.test/api/get_pricing_selection.php");
    assert.equal(options.method, "POST");
    assert.equal(options.signal, controller.signal);
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.equal(payload.category_code, scope.categoryCode);
    assert.equal(payload.unit_code, scope.unitCode);
    assert.equal(payload.sales_type, scope.salesType);
  }
  assert.deepEqual(requests.find(request => request.payload.codes).payload.codes, [drink.product_id]);
  const addonRequest = requests.find(request => !request.payload.codes).payload;
  assert.equal(addonRequest.search, "CCL");
  assert.equal(addonRequest.item_category, "", "category spelling variants are filtered after fetching");
  assert.equal(addonRequest.limit, 200);
  assert.equal(addonRequest.offset, 0);
});

test("CCL pagination finds later flavors and excludes other categories, invalid IDs and missing prices", async () => {
  const requests = [];
  const unrelated = Array.from({ length: 199 }, (_, index) => ({ ...almond, product_id: `OTHER-${index}`, item_category: "DRINKS" }));
  const free = { ...almond, product_id: "FREE", item_name: "CCL FREE", selling_price: "0.00" };
  const invalidPrices = [null, undefined, "", " ", "unknown", -1, Infinity, false, []]
    .map((selling_price, index) => ({ ...almond, product_id: `BAD-${index}`, selling_price }));
  const pages = [[hazelnut, ...unrelated], [hazelnut, almond, free, ...invalidPrices,
    { ...almond, product_id: "" }, { ...almond, product_id: false },
    { ...almond, product_id: "INSIDE", item_name: "VANILLA CCL" }]];
  const result = await fetchCoffeeAddonOptions({ ...scope,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      if (payload.codes) return response([refreshed]);
      requests.push(payload);
      assert(requests.length <= 2);
      return response(pages[requests.length - 1], payload.offset);
    },
  });
  assert.deepEqual(requests.map(request => request.offset), [0, 200]);
  assert.deepEqual(result.addons, [almond, free, hazelnut]);
});

test("unavailable drink prices cannot fall back to the stale menu price", async () => {
  for (const products of [[], [{ ...refreshed, product_id: "OTHER" }],
    [{ ...refreshed, item_category: "FOOD" }], ...[null, "", " ", "unknown", -1, false, Infinity]
      .map(selling_price => [{ ...refreshed, selling_price }])]) {
    await assert.rejects(fetchCoffeeAddonOptions({ ...scope,
      fetchImpl: async (_url, options) => response(JSON.parse(options.body).codes ? products : [almond]),
    }), /no available price/);
  }
  const freeDrink = { ...refreshed, selling_price: 0 };
  const result = await fetchCoffeeAddonOptions({ ...scope,
    fetchImpl: async (_url, options) => response(JSON.parse(options.body).codes ? [freeDrink] : []),
  });
  assert.equal(result.product, freeDrink);
  assert.deepEqual(result.addons, [], "a current drink with no add-on choices still supports Regular");
});

test("invalid selections and incomplete scopes never contact the pricing API", async () => {
  for (const overrides of [{ product: null }, { product: almond }, { product: { ...drink, product_id: "" } },
    { product: { ...drink, _isVariantGroup: true } }, { apiHost: "" }, { unitCode: "" }, { categoryCode: "" }, { salesType: "" }]) {
    await assert.rejects(fetchCoffeeAddonOptions({ ...scope, ...overrides,
      fetchImpl: () => assert.fail("invalid context must not make a request"),
    }), /Select a/);
  }
});

test("HTTP, API and pagination failures cannot expose partial coffee options", async () => {
  for (const failed of [{ ok: false, json: async () => ({ status: "success", products: [almond] }) },
    { ok: true, json: async () => ({ status: "error", products: [almond] }) },
    { ok: true, json: async () => ({ status: "success", products: null }) }]) {
    await assert.rejects(fetchCoffeeAddonOptions({ ...scope,
      fetchImpl: async (_url, options) => JSON.parse(options.body).codes ? response([refreshed]) : failed,
    }), /Could not load/);
  }
  let addonCalls = 0;
  const page = Array.from({ length: 200 }, (_, index) => ({ ...almond, product_id: `P-${index}` }));
  await assert.rejects(fetchCoffeeAddonOptions({ ...scope,
    fetchImpl: async (_url, options) => {
      if (JSON.parse(options.body).codes) return response([refreshed]);
      addonCalls++;
      return response(addonCalls === 1 ? page : [almond], 0);
    },
  }), /Update the pricing API/);
  assert.equal(addonCalls, 2);
});

test("abort before fetching or while reading a response prevents stale coffee options", async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(fetchCoffeeAddonOptions({ ...scope, signal: alreadyAborted.signal,
    fetchImpl: () => assert.fail("aborted request must not start"),
  }), { name: "AbortError" });
  const controller = new AbortController();
  await assert.rejects(fetchCoffeeAddonOptions({ ...scope, signal: controller.signal,
    fetchImpl: async (_url, options) => {
      if (JSON.parse(options.body).codes) return response([refreshed]);
      return { ok: true, json: async () => {
        controller.abort();
        return { status: "success", products: [almond] };
      } };
    },
  }), { name: "AbortError" });
});
