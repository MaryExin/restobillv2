import { getMenuVariantDetails } from "./menuProductVariants.js";
import { isCompatiblePizzaHalf, isPizzaVariantGroup } from "./menuPizzaCombination.js";
import { isCompatiblePlatterHalf, isPlatterVariantGroup } from "./menuPlatterCombination.js";
import { isCompatibleChickenHalf, isChickenVariantGroup } from "./menuChickenCombination.js";

const PAGE_SIZE = 200;

// Fetch only when a family is opened. Keep matching siblings, not the entire
// catalog, and page past the menu's normal result limit when necessary.
export async function fetchMenuProductVariants({
  apiHost,
  categoryCode,
  unitCode,
  salesType,
  group,
  signal,
  fetchImpl = fetch,
}) {
  const isOunceOrScoopGroup = group.sizeKind === "oz" || group.sizeKind === "scoop";
  const useCategorySearch = isOunceOrScoopGroup || group.sizeKind === "apparel";
  const isChickenWingsGroup = isChickenVariantGroup(group) && /WINGS$/iu.test(String(group.item_name).trim());
  return fetchPricingOptions({
    apiHost, categoryCode, unitCode, salesType, signal, fetchImpl,
    // Older pricing APIs search names literally. A category request also finds
    // ounce/Scoop or shirt siblings whose product names use different spacing.
    itemCategory: useCategorySearch ? group.item_category : "",
    // WINGS matches both the existing BUFALLO whole and new BUFFALO half names.
    search: useCategorySearch ? "" : isChickenWingsGroup ? "WINGS" : group.item_name,
    matches: (product) => getMenuVariantDetails(product).familyKey === group.familyKey,
  });
}

// Load the half-pizza catalog only while the two-flavor picker is open. Prices
// remain scoped to the same business unit and service type as the menu.
export async function fetchMenuPizzaHalves({
  apiHost, categoryCode, unitCode, salesType, group, signal, fetchImpl = fetch,
}) {
  signal?.throwIfAborted();
  if (!isPizzaVariantGroup(group)) return [];
  return fetchPricingOptions({
    apiHost, categoryCode, unitCode, salesType, signal, fetchImpl,
    search: "HALF",
    matches: (product) => isCompatiblePizzaHalf(product, group),
  });
}

export async function fetchMenuPlatterHalves({
  apiHost, categoryCode, unitCode, salesType, group, signal, fetchImpl = fetch,
}) {
  signal?.throwIfAborted();
  if (!isPlatterVariantGroup(group)) return [];
  return fetchPricingOptions({
    apiHost, categoryCode, unitCode, salesType, signal, fetchImpl,
    // Fetch the category itself: its flavor names (e.g. HONEY GARLIC HALF)
    // do not contain "CHICKEN WINGS PLATTER" on name-only search APIs.
    itemCategory: "CHICKEN WINGS PLATTER",
    search: "",
    matches: (product) => isCompatiblePlatterHalf(product, group),
  });
}

export async function fetchMenuChickenHalves({
  apiHost, categoryCode, unitCode, salesType, group, signal, fetchImpl = fetch,
}) {
  signal?.throwIfAborted();
  if (!isChickenVariantGroup(group)) return [];
  return fetchPricingOptions({
    apiHost, categoryCode, unitCode, salesType, signal, fetchImpl,
    // Both chicken categories are eligible; preserve the same sales-type scope
    // and filter actual HALF SKUs rather than deriving prices from whole items.
    search: "HALF",
    matches: (product) => isCompatibleChickenHalf(product, group),
  });
}

export function fetchMenuCombinationHalves(options) {
  if (isChickenVariantGroup(options.group)) return fetchMenuChickenHalves(options);
  return isPlatterVariantGroup(options.group)
    ? fetchMenuPlatterHalves(options)
    : fetchMenuPizzaHalves(options);
}

export async function fetchPricingOptions({
  apiHost, categoryCode, unitCode, salesType, signal, fetchImpl, search, matches,
  itemCategory = "",
}) {
  const variants = [];
  const seen = new Set();
  let offset = 0;

  while (true) {
    signal?.throwIfAborted();
    const response = await fetchImpl(`${apiHost}/api/get_pricing_selection.php`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_code: categoryCode,
        unit_code: unitCode,
        sales_type: salesType,
        item_category: itemCategory,
        search,
        limit: PAGE_SIZE,
        offset,
      }),
    });
    const result = await response.json();
    signal?.throwIfAborted();
    if (!response.ok || result?.status !== "success" || !Array.isArray(result.products)) {
      throw new Error("Could not load product options. Please try again.");
    }
    if (offset > 0 && Number(result.filters?.offset) !== offset) {
      throw new Error("Update the pricing API to load all product options.");
    }

    let newProducts = 0;
    for (const product of result.products) {
      const id = String(product.product_id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      newProducts++;
      if (matches(product)) {
        variants.push(product);
      }
    }
    if (result.products.length < PAGE_SIZE) return variants;
    if (newProducts === 0) {
      throw new Error("Product options could not be fully loaded. Please try again.");
    }
    offset += result.products.length;
  }
}
