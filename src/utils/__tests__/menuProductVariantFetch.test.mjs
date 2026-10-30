import assert from "node:assert/strict";
import test from "node:test";
import { fetchMenuProductVariants } from "../menuProductVariantFetch.js";
import { groupMenuProductVariants } from "../menuProductVariants.js";

const makeProduct = (product_id, item_name, selling_price, item_category = "PIZZA") => ({
  product_id, item_name, selling_price, item_category,
});
const siblings = [
  makeProduct("CHEESE-9", '5 CHEESE 9"', 420),
  makeProduct("CHEESE-9-H", '5 CHEESE 9" HALF', 335, "PIZZA HALF"),
  makeProduct("CHEESE-12", '5 CHEESE 12"', 700),
  makeProduct("CHEESE-12-H", '5 CHEESE 12" HALF', 475, "PIZZA HALF"),
  makeProduct("CHEESE-16", '5 CHEESE 16"', 950),
  makeProduct("CHEESE-16-H", '5 CHEESE 16" HALF', 475, "PIZZA HALF"),
];
const scope = {
  apiHost: "http://pos.test",
  categoryCode: "BUSINESS-CATEGORY",
  unitCode: "BRANCH-CODE",
  salesType: "TAKE OUT",
  // A size/portion search can leave only one sibling in the displayed card.
  group: groupMenuProductVariants([siblings[3]])[0],
};
const response = (products, offset = 0) => ({
  ok: true,
  json: async () => ({ status: "success", products, filters: { offset } }),
});
const nonFamilyPage = (start = 0, length = 200) => Array.from({ length }, (_, index) =>
  makeProduct(`ALOHA-${start + index}`, `ALOHA 5 CHEESE ${index + 1}"`, 725));

test("opening a partial family loads whole and half categories in the original business and pricing scope", async () => {
  const controller = new AbortController();
  const requests = [];
  const unrelated = [
    makeProduct("ALOHA", 'ALOHA 5 CHEESE 12"', 725),
    makeProduct("OTHER-CATEGORY", '5 CHEESE 12"', 550, "DRINKS"),
    makeProduct("SIX-CHEESE", '6 CHEESE 12"', 800),
  ];
  const actual = await fetchMenuProductVariants({
    ...scope,
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response([...siblings, ...unrelated]);
    },
  });

  assert.deepEqual(actual, siblings);
  assert.equal(actual.filter((item) => item.item_category === "PIZZA").length, 3);
  assert.equal(actual.filter((item) => item.item_category === "PIZZA HALF").length, 3);
  assert.equal(actual[3], siblings[3], "a selected option keeps the API's actual identity and price");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://pos.test/api/get_pricing_selection.php");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.signal, controller.signal);
  assert.deepEqual(requests[0].options.headers, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    category_code: "BUSINESS-CATEGORY",
    unit_code: "BRANCH-CODE",
    sales_type: "TAKE OUT",
    item_category: "",
    search: "5 CHEESE",
    limit: 200,
    offset: 0,
  });
  assert.equal(scope.group.variants.length, 1, "fetching does not mutate the displayed group");
});

test("200-row pagination finds later siblings and deduplicates real product IDs", async () => {
  const pages = [
    [siblings[0], ...nonFamilyPage(0, 199)],
    [{ ...siblings[0], selling_price: 9999 }, siblings[1], ...nonFamilyPage(199, 198)],
    [siblings[1], ...siblings.slice(2), makeProduct("", '5 CHEESE 20"', 1000)],
  ];
  const payloads = [];
  const actual = await fetchMenuProductVariants({
    ...scope,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      payloads.push(payload);
      assert(payloads.length <= pages.length, "pagination stops after the short final page");
      return response(pages[payloads.length - 1], payload.offset);
    },
  });
  assert.deepEqual(actual, siblings);
  assert.deepEqual(payloads.map((payload) => payload.offset), [0, 200, 400]);
  payloads.forEach((payload) => {
    assert.equal(payload.limit, 200);
    assert.equal(payload.category_code, scope.categoryCode);
    assert.equal(payload.unit_code, scope.unitCode);
    assert.equal(payload.sales_type, scope.salesType);
    assert.equal(payload.search, "5 CHEESE");
  });
  assert.equal(actual[0].selling_price, 420, "overlapping pages cannot replace an already loaded product");
});

test("an empty successful result does not fall back to stale displayed variants", async () => {
  const actual = await fetchMenuProductVariants({ ...scope, fetchImpl: async () => response([]) });
  assert.deepEqual(actual, []);
});

test("response and network failures reject instead of presenting incomplete options", async (t) => {
  const cases = [
    ["HTTP failure", { ok: false, json: async () => ({ status: "success", products: siblings }) }],
    ["API error", { ok: true, json: async () => ({ status: "error", products: siblings }) }],
    ["missing product array", { ok: true, json: async () => ({ status: "success" }) }],
    ["invalid product array", { ok: true, json: async () => ({ status: "success", products: {} }) }],
    ["empty JSON", { ok: true, json: async () => null }],
  ];
  for (const [name, failedResponse] of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        fetchMenuProductVariants({ ...scope, fetchImpl: async () => failedResponse }),
        /Could not load product options/,
      );
    });
  }
  const networkError = new Error("Network unavailable");
  await assert.rejects(
    fetchMenuProductVariants({ ...scope, fetchImpl: async () => { throw networkError; } }),
    (error) => error === networkError,
  );
  const jsonError = new SyntaxError("Invalid JSON");
  await assert.rejects(
    fetchMenuProductVariants({
      ...scope,
      fetchImpl: async () => ({ ok: true, json: async () => { throw jsonError; } }),
    }),
    (error) => error === jsonError,
  );
});

test("an already aborted request does not contact the API", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(fetchMenuProductVariants({
    ...scope,
    signal: controller.signal,
    fetchImpl: async () => { calls += 1; return response(siblings); },
  }), { name: "AbortError" });
  assert.equal(calls, 0);
});

test("aborting while response JSON loads discards results and prevents another page", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchMenuProductVariants({
    ...scope,
    signal: controller.signal,
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(options.signal, controller.signal);
      return {
        ok: true,
        json: async () => {
          controller.abort();
          return { status: "success", products: [siblings[0], ...nonFamilyPage(0, 199)], filters: { offset: 0 } };
        },
      };
    },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("an older API without offset support fails before reporting a partial family", async () => {
  let calls = 0;
  await assert.rejects(fetchMenuProductVariants({
    ...scope,
    fetchImpl: async () => {
      calls += 1;
      assert(calls <= 2, "an old API cannot trigger an endless paging loop");
      return {
        ok: true,
        json: async () => ({ status: "success", products: [siblings[0], ...nonFamilyPage(0, 199)] }),
      };
    },
  }), /Update the pricing API/);
  assert.equal(calls, 2);
});

test("a wrong echoed offset fails even if the page contains new products", async () => {
  let calls = 0;
  await assert.rejects(fetchMenuProductVariants({
    ...scope,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? response(nonFamilyPage()) : response(siblings, 0);
    },
  }), /Update the pricing API/);
  assert.equal(calls, 2);
});

test("a repeated full page stops even when the server echoes the requested offset", async () => {
  const repeatedPage = [siblings[0], ...nonFamilyPage(0, 199)];
  let calls = 0;
  await assert.rejects(fetchMenuProductVariants({
    ...scope,
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert(calls <= 2, "repeated pages cannot trigger an endless paging loop");
      return response(repeatedPage, JSON.parse(options.body).offset);
    },
  }), /Product options could not be fully loaded/);
  assert.equal(calls, 2);
});

test("opening one spicy wing size retrieves all three sizes and both flavors in the same pricing scope", async () => {
  const wings = [["SOLO", 525], ["DOUBLE", 970], ["GROUP", 1410]].flatMap(([size, price]) => [
    makeProduct(`WINGS-${size}`, `BUFALLO WINGS ${size}`, price, "BUFALLO WINGS"),
    makeProduct(`WINGS-${size}-SPICY`, `BUFALLO WINGS ${size} SPICY`, price, "BUFALLO WINGS"),
  ]);
  const group = groupMenuProductVariants([wings[3]])[0];
  const result = await fetchMenuProductVariants({
    ...scope,
    group,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.search, "WINGS");
      assert.equal(payload.category_code, scope.categoryCode);
      assert.equal(payload.unit_code, scope.unitCode);
      assert.equal(payload.sales_type, scope.salesType);
      return response([
        ...wings,
        makeProduct("RICE-MEAL", "RM BUFFALO WINGS", 355, "RICE MEAL"),
        makeProduct("OTHER-CATEGORY", "BUFALLO WINGS SOLO", 100, "SPECIALS"),
      ]);
    },
  });
  assert.deepEqual(result, wings);
  assert.equal(result[5], wings[5], "Group Spicy keeps its actual product ID and price");
  assert.equal(group.variants.length, 1, "the filtered menu card is not mutated");
});

test("opening a filtered fried chicken size retrieves all three original products in the same pricing scope", async () => {
  const chicken = [["SOLO", 495], ["DOUBLE", 935], ["GROUP", 1360]].map(([size, price]) =>
    makeProduct(`CHICKEN-${size}`, `GJ FRIED CHICKEN ${size}`, price, "GJ FRIED CHICKEN"));
  const group = groupMenuProductVariants([chicken[1]])[0];
  const result = await fetchMenuProductVariants({
    ...scope,
    group,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.search, "GJ FRIED CHICKEN");
      assert.equal(payload.category_code, scope.categoryCode);
      assert.equal(payload.unit_code, scope.unitCode);
      assert.equal(payload.sales_type, scope.salesType);
      return response([
        ...chicken,
        makeProduct("RICE-MEAL", "RM GJ FRIED CHICKEN", 350, "RICE MEAL"),
        makeProduct("OTHER-CATEGORY", "GJ FRIED CHICKEN SOLO", 100, "SPECIALS"),
      ]);
    },
  });
  assert.deepEqual(result, chicken);
  chicken.forEach((item, index) => assert.equal(result[index], item));
  assert.equal(group.variants.length, 1, "fetching does not mutate the filtered menu card");
});

test("ounce and Scoop search cards fetch all flavor servings despite name spacing on older APIs", async () => {
  const six = makeProduct("AVOCADO-6", "GELATO AVOCADO 6OZ", 95, "GELATO");
  const eight = makeProduct("AVOCADO-8", "GELATO  AVOCADO 8OZ", 145, "GELATO");
  const scoop = makeProduct("SCOOP", "GELATO  AVOCADO SCOOP", 60, "GELATO");
  const catalog = [six, eight, scoop,
    makeProduct("PECAN-8", "GELATO BROWN BUTTER PECAN 8OZ", 260, "GELATO"),
    makeProduct("INCHES", 'GELATO AVOCADO 8"', 500, "GELATO"),
    makeProduct("OTHER", "GELATO AVOCADO 8OZ", 100, "INGREDIENTS"),
  ];
  for (const searchResult of [eight, scoop]) {
    const group = groupMenuProductVariants([searchResult])[0];
    const result = await fetchMenuProductVariants({ ...scope, group,
      fetchImpl: async (_url, options) => {
        const payload = JSON.parse(options.body);
        assert.deepEqual(payload, {
          category_code: scope.categoryCode, unit_code: scope.unitCode, sales_type: scope.salesType,
          item_category: "GELATO", search: "", limit: 200, offset: 0,
        });
        return response(catalog.filter((item) => payload.search
          ? item.item_name.includes(payload.search) : item.item_category === payload.item_category));
      },
    });
    assert.deepEqual(result, [six, eight, scoop]);
    assert.equal(result[1], eight);
    assert.equal(group.variants.length, 1);
  }
});

test("a partial shirt card loads every available size from Others at the current scoped prices", async () => {
  const shirts = ["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size, index) =>
    makeProduct(`SHIRT-${size}`, `PICKLE ${index % 2 ? " " : ""}JOE SHIRT ${size}\"`,
      index < 5 ? "700.00" : "750.00", "OTHERS"));
  const group = groupMenuProductVariants([shirts[5]])[0];
  const catalog = [...shirts,
    makeProduct("UNSIZED", "PICKLE JOE SHIRT", 700, "OTHERS"),
    makeProduct("CAP", "PICKLE JOE CAP", 300, "OTHERS"),
    makeProduct("OTHER-SHIRT", 'OTHER SHIRT S"', 650, "OTHERS"),
    makeProduct("OTHER-CATEGORY", 'PICKLE JOE SHIRT S"', 600, "UNIFORMS"),
  ];
  let requests = 0;
  const result = await fetchMenuProductVariants({
    ...scope, group,
    fetchImpl: async (_url, options) => {
      requests++;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload, {
        category_code: scope.categoryCode, unit_code: scope.unitCode, sales_type: scope.salesType,
        item_category: "OTHERS", search: "", limit: 200, offset: 0,
      });
      return response(catalog.filter((item) => item.item_category === payload.item_category));
    },
  });
  assert.equal(requests, 1);
  assert.deepEqual(result, shirts);
  shirts.forEach((item, index) => assert.equal(result[index], item, "use the original API product and price"));
  assert.equal(result[5].selling_price, "750.00");
  assert.equal(group.variants.length, 1, "loading options does not mutate the search result card");
});
