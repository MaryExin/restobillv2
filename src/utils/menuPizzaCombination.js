import { getMenuVariantDetails } from "./menuProductVariants.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const categoryKey = (product) => tidy(product?.item_category)
  .replace(/\s+(HALF|WHOLE)$/iu, "").trim().toUpperCase();

const hasPriceAndId = (product) => {
  const price = product?.selling_price;
  const id = product?.product_id;
  return !product?._isFolder && !product?._isVariantGroup
    && (typeof id === "string" || (typeof id === "number" && Number.isFinite(id)))
    && tidy(id) !== ""
    && (typeof price === "number" || typeof price === "string")
    && tidy(price) !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
};

const groupFamilyKey = (group) => group?.familyKey || getMenuVariantDetails(group).familyKey;

export function isPizzaVariantGroup(group) {
  return Boolean(group && !group._isFolder && /\bPIZZA\b/u.test(categoryKey(group)));
}

// Shared by the catalog fetch and selection validation so incomplete API rows
// can never become a selectable flavor or a manufactured zero-price option.
export function isCompatiblePizzaHalf(product, group) {
  if (!isPizzaVariantGroup(group) || !hasPriceAndId(product)
    || categoryKey(product) !== categoryKey(group)) return false;
  const details = getMenuVariantDetails(product);
  return details.portion === "half" && Number.isFinite(details.sizeValue)
    && details.sizeValue > 0 && details.baseName !== "";
}

export function getPizzaCombinationSizes(group) {
  if (!isPizzaVariantGroup(group) || !Array.isArray(group.variants)) return [];
  const sizes = new Map();
  for (const product of group.variants) {
    const details = getMenuVariantDetails(product);
    if (!hasPriceAndId(product) || !Number.isFinite(details.sizeValue) || !(details.sizeValue > 0)
      || details.familyKey !== groupFamilyKey(group)) continue;
    let size = sizes.get(details.sizeValue);
    if (!size) {
      size = { sizeValue: details.sizeValue, sizeLabel: details.sizeLabel, whole: null, half: null };
      sizes.set(details.sizeValue, size);
    }
    size[details.portion] ??= product;
  }
  return [...sizes.values()].filter((size) => size.whole && size.half)
    .sort((first, second) => first.sizeValue - second.sizeValue);
}

export function getPizzaCombinationChoices(group, sizeValue, products) {
  if (!isPizzaVariantGroup(group) || !(Number(sizeValue) > 0) || !Array.isArray(products)) return [];
  const seen = new Set();
  return products.filter((product) => {
    const details = getMenuVariantDetails(product);
    const id = tidy(product?.product_id);
    if (!isCompatiblePizzaHalf(product, group) || details.sizeValue !== Number(sizeValue)
      || details.familyKey === groupFamilyKey(group) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((first, second) => {
    const nameOrder = getMenuVariantDetails(first).baseName.localeCompare(
      getMenuVariantDetails(second).baseName, undefined, { numeric: true, sensitivity: "base" },
    );
    return nameOrder || tidy(first.product_id).localeCompare(tidy(second.product_id));
  });
}

export function createPizzaCombination(first, second) {
  if (!isCompatiblePizzaHalf(first, first) || !isCompatiblePizzaHalf(second, first)) return null;
  const firstDetails = getMenuVariantDetails(first);
  const secondDetails = getMenuVariantDetails(second);
  if (firstDetails.sizeValue !== secondDetails.sizeValue
    || firstDetails.familyKey === secondDetails.familyKey
    || tidy(first.product_id) === tidy(second.product_id)) return null;
  const sum = Number(first.selling_price) + Number(second.selling_price);
  const total = Math.round((sum + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(total)) return null;
  return { products: [first, second], total };
}

export function getPizzaCombinationInstruction(first, second) {
  if (!createPizzaCombination(first, second)) return "";
  const firstDetails = getMenuVariantDetails(first);
  const secondDetails = getMenuVariantDetails(second);
  return `2-flavor pizza ${firstDetails.sizeLabel}: ${firstDetails.baseName} + ${secondDetails.baseName}`;
}
