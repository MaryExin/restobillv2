const text = (value) => String(value ?? "").trim();
const yes = (value) => [true, 1, "1", "true", "yes"].includes(typeof value === "string" ? value.toLowerCase() : value);
export const roundProductGroupMoney = (value) => {
  const [coefficient, exponent = "0"] = String(Number(value)).split("e");
  const shifted = Number(`${coefficient}e${Number(exponent) + 2}`);
  return Number(`${Math.round(shifted + Number.EPSILON * Math.max(1, Math.abs(shifted)) * 4)}e-2`);
};
export const isGroupedProduct = (product) => yes(product?.product_group?.enabled) && Boolean(text(product?.product_group?.name));
export const productGroupKey = (product) => text(product?.product_group?.name).toLowerCase();
export const productGroupSizeKey = (product) => text(product?.group_size).toLowerCase();
export const productGroupOptionKey = (product) => `${product?.product_id || product?.build_code || ""}|${product?.group_size_id || ""}`;
export const hasGroupPrice = (product) => !product?.group_price_error && product?.srp !== null && product?.srp !== "" && Number.isFinite(Number(product?.srp)) && Number(product.srp) >= 0;

export const productGroupUnitPrice = (products, portion) => {
  if (products.length !== (portion === "half_and_half" ? 2 : 1) || products.some((p) => !hasGroupPrice(p))) return null;
  return roundProductGroupMoney(products.reduce((total, product) => total + Number(product.srp) * (portion === "whole" ? 1 : .5), 0));
};

export const groupChoiceProduct = (product) => ({
  ...product,
  build_code: product.product_id,
  srp: product.selling_price,
  cost_per_uom: Number(product.unit_cost || 0),
  tax_type: yes(product.vatable) ? "VATABLE" : "VAT EXEMPT",
});

// Resolve only against the complete active unit/price-list catalog. An unsynced
// or unavailable replacement must leave the existing product sellable.
export function resolveProductGroupAlias(product, allGroupProducts = []) {
  const alias = product?.group_alias;
  if (!yes(alias?.enabled) || !text(alias?.canonical_build_code)) return product;
  return allGroupProducts.find((choice) => text(choice.product_id).toLowerCase() === text(alias.canonical_build_code).toLowerCase()
    && (text(alias.size_id) ? text(choice.group_size_id) === text(alias.size_id) : !choice.group_size_id && Boolean(text(choice.group_size)))
    && isGroupedProduct(choice) && hasGroupPrice(groupChoiceProduct(choice))
    && (!choice.group_size_id || yes(choice.group_recipe_configured))) || product;
}

export function groupMenuProducts(products = [], allGroupProducts = []) {
  const result = [];
  const seen = new Set();
  for (const source of products) {
    const product = resolveProductGroupAlias(source, allGroupProducts);
    if (!isGroupedProduct(product)) { result.push(product); continue; }
    const key = productGroupKey(product);
    if (seen.has(key)) continue;
    seen.add(key);
    const options = allGroupProducts.filter((entry) => isGroupedProduct(entry) && productGroupKey(entry) === key
      && resolveProductGroupAlias(entry, allGroupProducts) === entry);
    const prices = (options.length ? options : [product]).map(groupChoiceProduct).filter(hasGroupPrice).map((p) => Number(p.srp));
    result.push({ ...product, _isProductGroup: true, product_id: `group:${key}`, item_name: product.product_group.name,
      selling_price: prices.length ? Math.min(...prices) : 0, variantCount: options.length || 1 });
  }
  return result;
}

export function productGroupLabel(selection) {
  const portion = selection.portion === "half_and_half" ? "Half & half" : selection.portion === "half" ? "Half" : "Whole";
  return `${selection.group_name} · ${selection.size} · ${portion}: ${(selection.variant_names || selection.variants || []).join(" / ")}`;
}

export function createGroupCartItem({ products, portion, count = 1, pricingCategory, selectionId, lineId }) {
  if (!["whole", "half", "half_and_half"].includes(portion) || !Number.isInteger(count) || count < 1 || count > 10000 ||
      products.some((p) => !isGroupedProduct(p))) throw new Error("Choose a valid product group and quantity.");
  const price = productGroupUnitPrice(products, portion);
  if (price === null) throw new Error("Choose variants with a valid whole-item price.");
  if (new Set(products.map((p) => p.build_code)).size !== products.length || products.some((p) =>
      productGroupKey(p) !== productGroupKey(products[0]) || productGroupSizeKey(p) !== productGroupSizeKey(products[0]))) {
    throw new Error("Choose different variants from the same product group and size.");
  }
  if (products.some((p) => (portion === "half" && !yes(p.product_group.allow_half)) ||
      (portion === "half_and_half" && !yes(p.product_group.allow_half_and_half)))) throw new Error("This portion is not enabled for the selected variants.");
  if (new Set(products.map((p) => p.tax_type)).size > 1) throw new Error("The selected variants must use the same tax type.");
  if (new Set(products.map((p) => text(p.unit_of_measure).toLowerCase())).size > 1) throw new Error("The selected variants must use the same unit of measure.");
  const sized = products.some((p) => Boolean(p.group_size_id));
  if (sized && products.some((p) => !p.group_size_id || !yes(p.group_recipe_configured))) {
    throw new Error("Set a size and its ingredients for every selected variant before combining them.");
  }
  const selection = { selection_id: selectionId, group_name: products[0].product_group.name, size: products[0].group_size,
    portion, variants: products.map((p) => p.build_code), variant_names: products.map((p) => p.group_variant),
    whole_prices: Object.fromEntries(products.map((p) => [p.build_code, Number(p.srp)])), unit_count: count, unit_price: price, pricing_category: pricingCategory };
  if (sized) {
    selection.schema_version = 2;
    selection.variant_options = products.map((p) => ({ product_id: p.build_code, size_id: p.group_size_id }));
  }
  return { lineId, code: products[0].build_code, name: productGroupLabel(selection), price, quantity: count,
    unit_cost: products.reduce((sum, p) => sum + Number(p.unit_cost || 0) * (portion === "whole" ? 1 : .5), 0),
    isDiscountable: products.every((p) => text(p.isDiscountable).toLowerCase() !== "no") ? "Yes" : "No",
    vatable: products[0].vatable, itemInstruction: "", item_category: products[0].item_category || "",
    isLoadedFromDB: false, group_selection: selection };
}

export function setGroupItemQuantity(item, count) {
  if (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 10000) return item;
  return { ...item, quantity: Number(count), group_selection: { ...item.group_selection, unit_count: Number(count) } };
}

// The server keeps the real inventory variants as fractional detail rows. Restore
// the cashier's one selection without merging another order using the same flavor.
export function groupSavedOrderItems(rows = []) {
  const result = [];
  const seen = new Set();
  for (const row of rows) {
    const selection = row.group_selection;
    if (!selection?.selection_id) { result.push(row); continue; }
    if (seen.has(selection.selection_id)) continue;
    seen.add(selection.selection_id);
    const parts = rows.filter((entry) => entry.group_selection?.selection_id === selection.selection_id);
    const quantity = Number(selection.unit_count);
    const price = Number(selection.unit_price);
    result.push({ ...row, product_id: selection.variants[0], item_name: productGroupLabel(selection),
      sales_quantity: quantity, selling_price: price,
      unit_cost: parts.reduce((sum, entry) => sum + Number(entry.unit_cost || 0) * Number(entry.sales_quantity || 0), 0) / quantity,
      isDiscountable: parts.some((entry) => text(entry.isDiscountable).toLowerCase() === "no") ? "No" : "Yes",
      group_selection: { ...selection, part_index: undefined }, group_physical_ids: parts.map((entry) => entry.ID) });
  }
  return result;
}

export const groupCartMergeKey = (item) => item.group_selection?.selection_id ? `selection:${item.group_selection.selection_id}` : null;

export function serializeOrderCartItems(items) {
  return items.map((item) => ({ product_id: item.code, sku: item.code, sales_quantity: Number(item.quantity), landing_cost: 0,
    unit_cost: Number(item.unit_cost || 0), selling_price: Number(item.price || 0), vatable: item.group_selection ? item.vatable : "Yes",
    isDiscountable: item.isDiscountable, order_status: "ACTIVE", item_instruction: item.itemInstruction || "",
    ...(item.group_selection ? { group_selection: { ...item.group_selection, unit_count: Number(item.quantity) } } : {}),
  }));
}

export function repriceGroupCartItem(item, products, pricingCategory) {
  const selection = item.group_selection;
  const variants = selection.variants.map((code) => {
    const sizeId = selection.variant_options?.find((option) => option.product_id === code)?.size_id;
    return products.find((product) => product.product_id === code && (sizeId ? product.group_size_id === sizeId : !product.group_size_id));
  });
  if (variants.some((entry) => !entry)) return { ...item, group_price_error: "A selected variant has no price in this service type. Choose the product group again." };
  try {
    const updated = createGroupCartItem({ products: variants.map(groupChoiceProduct), portion: selection.portion,
      count: Number(item.quantity), pricingCategory, selectionId: selection.selection_id, lineId: item.lineId });
    return { ...updated, itemInstruction: item.itemInstruction, group_price_error: null };
  } catch (error) { return { ...item, group_price_error: error.message }; }
}
