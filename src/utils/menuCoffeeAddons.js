import { fetchPricingOptions } from "./menuProductVariantFetch.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const normalized = (value) => tidy(value).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const hasId = (product) => {
  const id = product?.product_id;
  return (typeof id === "string" || (typeof id === "number" && Number.isFinite(id))) && tidy(id) !== "";
};
const hasPrice = (product) => {
  const price = product?.selling_price;
  return (typeof price === "number" || typeof price === "string")
    && tidy(price) !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
};

// Classifiers describe the catalog; price and ID validation happens after the
// current service-type prices have been fetched, never from master-list prices.
export function isCclAddon(product) {
  return /^CCL\b/iu.test(tidy(product?.item_name))
    && /^ADD[\s_-]*ONS?$/iu.test(tidy(product?.item_category));
}

export function isCoffeeAddonDrink(product) {
  return normalized(product?.item_category) === "DRINKS"
    && /\b(?:CAPPUCC?INO|CAFE\s+LATTE)\b/u.test(normalized(product?.item_name));
}

export async function fetchCoffeeAddonOptions({
  product, apiHost, categoryCode, unitCode, salesType, signal, fetchImpl = fetch,
}) {
  signal?.throwIfAborted();
  if (!isCoffeeAddonDrink(product) || !hasId(product) || product._isFolder || product._isVariantGroup) {
    throw new Error("Select a coffee to load its add-ons.");
  }
  if (!apiHost || !categoryCode || !unitCode || !salesType) {
    throw new Error("Select a service type to load coffee options.");
  }
  const productId = tidy(product.product_id);

  const loadDrink = async () => {
    const response = await fetchImpl(`${apiHost}/api/get_pricing_selection.php`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_code: categoryCode,
        unit_code: unitCode,
        sales_type: salesType,
        codes: [productId],
      }),
    });
    const result = await response.json();
    signal?.throwIfAborted();
    if (!response.ok || result?.status !== "success" || !Array.isArray(result.products)) {
      throw new Error("Could not load coffee options. Please try again.");
    }
    const refreshed = result.products.find((row) => hasId(row) && tidy(row.product_id) === productId);
    if (!isCoffeeAddonDrink(refreshed) || !hasPrice(refreshed)) {
      throw new Error("This coffee has no available price for the selected service type.");
    }
    return refreshed;
  };

  const [refreshedProduct, addons] = await Promise.all([
    loadDrink(),
    fetchPricingOptions({
      apiHost, categoryCode, unitCode, salesType, signal, fetchImpl, search: "CCL",
      matches: (row) => isCclAddon(row) && hasId(row) && hasPrice(row)
        && tidy(row.product_id) !== productId,
    }),
  ]);
  signal?.throwIfAborted();
  return {
    product: refreshedProduct,
    addons: addons.sort((first, second) => tidy(first.item_name).localeCompare(tidy(second.item_name),
      undefined, { sensitivity: "base", numeric: true }) || tidy(first.product_id).localeCompare(tidy(second.product_id))),
  };
}
