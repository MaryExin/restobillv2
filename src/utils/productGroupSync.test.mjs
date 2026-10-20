import test from "node:test";
import assert from "node:assert/strict";
import { hasProductGroupChange, productGroupSyncFields, productGroupSyncDescription, productSyncAction } from "./productGroupSync.js";

const grouped = {
  product_group: { name: "Pizza", enabled: true, allow_half: true, allow_half_and_half: true },
  group_size: "Large", group_variant: "Hawaiian",
};

test("optional aliases compare independently and older sources preserve saved mappings", () => {
  const alias = { group_alias: { canonical_build_code: "MASTER", size_id: "SIZE9", enabled: true } };
  assert.deepEqual(productGroupSyncFields(alias), alias);
  assert.equal(hasProductGroupChange({}, alias), false);
  assert.equal(hasProductGroupChange({ product_group: null }, { product_group: null, ...alias }), false);
  assert.equal(hasProductGroupChange(alias, {}), true);
  assert.equal(hasProductGroupChange(structuredClone(alias), alias), false);
  assert.equal(hasProductGroupChange({ group_alias: null }, alias), true);
  assert.equal(hasProductGroupChange({ group_alias: { ...alias.group_alias, size_id: "SIZE12" } }, alias), true);
  assert.equal(hasProductGroupChange({ group_alias: { ...alias.group_alias, enabled: false } }, alias), true);
  assert.equal(productSyncAction({ group_changed: true }, { srp: 50 }), "group_change");
  assert.match(productGroupSyncDescription(alias), /Mapped to MASTER.*SIZE9/);
});

test("a grouping-only update can sync without changing its price", () => {
  const diff = { price_changed: false, cost_changed: false, group_changed: hasProductGroupChange(grouped, {}) };
  assert.equal(productSyncAction(diff, { srp: 400 }), "group_change");
  assert.equal(productSyncAction({ ...diff, price_changed: true }, { srp: 300 }), "price_change");
  assert.equal(productSyncAction(diff, null), "new_product");
});

test("older sources cannot clear grouping; explicit off and null can", () => {
  assert.equal(hasProductGroupChange({}, grouped), false);
  assert.deepEqual(productGroupSyncFields({}), {});
  assert.equal(hasProductGroupChange({ product_group: null }, grouped), true);
  assert.equal(hasProductGroupChange({ ...grouped, product_group: { ...grouped.product_group, enabled: false } }, grouped), true);
  assert.equal(hasProductGroupChange({ product_group: null }, {}), false);
});

test("group, size, variant and both portion switches participate in comparisons", () => {
  assert.equal(hasProductGroupChange(grouped, structuredClone(grouped)), false);
  for (const row of [
    { ...grouped, group_size: "Small" },
    { ...grouped, group_variant: "Pepperoni" },
    { ...grouped, product_group: { ...grouped.product_group, name: "Cake" } },
    { ...grouped, product_group: { ...grouped.product_group, allow_half: false } },
    { ...grouped, product_group: { ...grouped.product_group, allow_half_and_half: false } },
  ]) assert.equal(hasProductGroupChange(row, grouped), true);
  assert.match(productGroupSyncDescription(grouped), /Pizza.*Large.*Hawaiian.*Two variants/);
});

test("nested size prices and ingredients pass through and trigger configuration-only sync", () => {
  const sized = { ...grouped, group_size: "", group_sizes: [
    { size_id: "PGS-A9", size_name: "9 inch", enabled: true, recipe_configured: true,
      prices: [{ pricing_category: "P1", srp: 200, cost_per_uom: 60 }],
      components: [{ component_code: "RM-CHEESE", component_class: "RM", qty: 90, description: "Cheese", uom: "G", uomval: 1, category: "INGREDIENTS", cost_per_uom: .5 }] },
  ] };
  assert.deepEqual(productGroupSyncFields(sized).group_sizes, sized.group_sizes);
  const fromSql = structuredClone(sized);
  Object.assign(fromSql.group_sizes[0].prices[0], { srp: "200.0000", cost_per_uom: "60.000000" });
  Object.assign(fromSql.group_sizes[0].components[0], { qty: "90.000000", uomval: "1.000000", cost_per_uom: "0.500000" });
  assert.equal(hasProductGroupChange(sized, fromSql), false);
  for (const change of [
    (size) => { size.size_name = "Small"; },
    (size) => { size.prices[0].srp = 210; },
    (size) => { size.components[0].qty = 95; },
    (size) => { size.components[0].uom = "KG"; },
    (size) => { size.recipe_configured = false; },
    (size) => { size.enabled = false; },
  ]) {
    const updated = structuredClone(sized); change(updated.group_sizes[0]);
    assert.equal(productSyncAction({ group_changed: hasProductGroupChange(updated, sized) }, { srp: 200 }), "group_change");
  }
  assert.equal(hasProductGroupChange({ ...sized, group_sizes: [] }, sized), true);
  assert.match(productGroupSyncDescription(sized), /9 inch.*Hawaiian/);
});
