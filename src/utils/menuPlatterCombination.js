import { getMenuVariantDetails } from "./menuProductVariants.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const categoryKey = (product) => tidy(product?.item_category)
  .replace(/\s+(HALF|WHOLE)$/iu, "").trim().toUpperCase();
const groupFamilyKey = (group) => group?.familyKey || getMenuVariantDetails(group).familyKey;

const hasPriceAndId = (product) => {
  const price = product?.selling_price;
  const id = product?.product_id;
  return !product?._isFolder && !product?._isVariantGroup
    && (typeof id === "string" || (typeof id === "number" && Number.isFinite(id)))
    && tidy(id) !== ""
    && (typeof price === "number" || typeof price === "string")
    && tidy(price) !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
};

const isUnsizedFlavor = (details) => details.baseName !== ""
  && details.sizeKind === null && details.sizeValue === null
  // A serving marker before HALF is not recognized by the main suffix parser.
  && getMenuVariantDetails({ item_name: details.baseName }).sizeKind === null;

export function isPlatterVariantGroup(group) {
  return Boolean(group && !group._isFolder
    && categoryKey(group) === "CHICKEN WINGS PLATTER");
}

export function isCompatiblePlatterHalf(product, group) {
  if (!isPlatterVariantGroup(group) || !hasPriceAndId(product)
    || categoryKey(product) !== categoryKey(group)) return false;
  const details = getMenuVariantDetails(product);
  // Only an actual HALF SKU is sellable as half of a combination. A flavor
  // containing the word "half" elsewhere must not be mistaken for one.
  return /\s+HALF$/iu.test(tidy(product.item_name))
    && details.portion === "half" && isUnsizedFlavor(details);
}

export function getPlatterCombinationPair(group) {
  if (!isPlatterVariantGroup(group) || !Array.isArray(group.variants)) return null;
  let whole = null;
  let half = null;
  for (const product of group.variants) {
    const details = getMenuVariantDetails(product);
    if (!hasPriceAndId(product) || categoryKey(product) !== categoryKey(group)
      || !isUnsizedFlavor(details) || details.familyKey !== groupFamilyKey(group)) continue;
    if (isCompatiblePlatterHalf(product, group)) half ??= product;
    else if (details.portion === "whole") whole ??= product;
  }
  return whole && half && tidy(whole.product_id) !== tidy(half.product_id)
    ? { whole, half } : null;
}

export function getPlatterCombinationChoices(group, products) {
  if (!isPlatterVariantGroup(group) || !Array.isArray(products)) return [];
  const familyIds = new Set((Array.isArray(group.variants) ? group.variants : [])
    .map((product) => tidy(product?.product_id)).filter(Boolean));
  const seen = new Set();
  return products.filter((product) => {
    const details = getMenuVariantDetails(product);
    const id = tidy(product?.product_id);
    if (!isCompatiblePlatterHalf(product, group)
      || details.familyKey === groupFamilyKey(group) || familyIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((first, second) => {
    const nameOrder = getMenuVariantDetails(first).baseName.localeCompare(
      getMenuVariantDetails(second).baseName, undefined, { numeric: true, sensitivity: "base" },
    );
    return nameOrder || tidy(first.product_id).localeCompare(tidy(second.product_id));
  });
}

export function createPlatterCombination(first, second) {
  if (!isCompatiblePlatterHalf(first, first) || !isCompatiblePlatterHalf(second, first)) return null;
  const firstDetails = getMenuVariantDetails(first);
  const secondDetails = getMenuVariantDetails(second);
  if (firstDetails.familyKey === secondDetails.familyKey
    || tidy(first.product_id) === tidy(second.product_id)) return null;
  const sum = Number(first.selling_price) + Number(second.selling_price);
  const total = Math.round((sum + Number.EPSILON) * 100) / 100;
  return Number.isFinite(total) ? { products: [first, second], total } : null;
}

export function getPlatterCombinationInstruction(first, second) {
  if (!createPlatterCombination(first, second)) return "";
  return `2-flavor chicken wings platter: ${getMenuVariantDetails(first).baseName} + ${getMenuVariantDetails(second).baseName}`;
}
