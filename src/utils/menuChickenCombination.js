const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const categoryKey = (product) => tidy(product?.item_category)
  .replace(/\s+(HALF|WHOLE)$/iu, "").trim().toUpperCase();
const wingsName = /^(?:BUFALLO|BUFFALO) WINGS (SOLO|DOUBLE|GROUP)(?: (SPICY))?(?: (HALF|WHOLE))?$/iu;
const chickenName = /^GJ FRIED CHICKEN (SOLO|DOUBLE|GROUP)(?: (HALF|WHOLE))?$/iu;
const sizes = { solo: "Solo", double: "Double", group: "Group" };

function categoryKind(product) {
  const category = categoryKey(product);
  if (category === "BUFALLO WINGS" || category === "BUFFALO WINGS") return "wings";
  return category === "GJ FRIED CHICKEN" ? "fried-chicken" : null;
}

// Categories and names are both required. Rice meals, platters and unrelated
// chicken products must not become interchangeable combination ingredients.
export function getChickenVariantDetails(product) {
  if (!product || product._isFolder || product._isVariantGroup) return null;
  const kind = categoryKind(product);
  const match = tidy(product.item_name).match(kind === "wings" ? wingsName : chickenName);
  if (!kind || !match) return null;
  const servingSize = match[1].toLowerCase();
  const spicy = kind === "wings" && Boolean(match[2]);
  return {
    kind,
    servingSize,
    sizeLabel: sizes[servingSize],
    flavorLabel: kind === "wings" ? `BUFFALO WINGS ${spicy ? "Spicy" : "Original"}` : "GJ FRIED CHICKEN",
    flavorKey: kind === "wings" ? `wings:${spicy ? "spicy" : "original"}` : "fried-chicken",
    portion: (match[kind === "wings" ? 3 : 2] || "WHOLE").toLowerCase(),
  };
}

export function isChickenVariantGroup(group) {
  if (!group || group._isFolder) return false;
  const kind = categoryKind(group);
  const name = tidy(group.item_name);
  return kind === "wings"
    ? /^(?:BUFALLO|BUFFALO) WINGS$/iu.test(name) || wingsName.test(name)
    : kind === "fried-chicken" && (name.toUpperCase() === "GJ FRIED CHICKEN" || chickenName.test(name));
}

function hasPriceAndId(product) {
  const price = product?.selling_price;
  const id = product?.product_id;
  return !product?._isFolder && !product?._isVariantGroup
    && (typeof id === "string" || (typeof id === "number" && Number.isFinite(id)))
    && tidy(id) !== ""
    && (typeof price === "number" || typeof price === "string")
    && tidy(price) !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
}

export function isCompatibleChickenHalf(product, group) {
  return isChickenVariantGroup(group) && hasPriceAndId(product)
    && getChickenVariantDetails(product)?.portion === "half";
}

export function getChickenCombinationSizes(group) {
  if (!isChickenVariantGroup(group) || !Array.isArray(group.variants)) return [];
  const kind = categoryKind(group);
  const pairs = new Map();
  for (const product of group.variants) {
    const details = getChickenVariantDetails(product);
    if (!details || details.kind !== kind || !hasPriceAndId(product)) continue;
    const key = `${details.servingSize}:${details.flavorKey}`;
    const pair = pairs.get(key) || { details, whole: null, half: null };
    pair[details.portion] ??= product;
    pairs.set(key, pair);
  }
  return Object.entries(sizes).flatMap(([servingSize, sizeLabel]) => {
    const options = [...pairs.values()]
      .filter(({ details, whole, half }) => details.servingSize === servingSize && whole && half
        && tidy(whole.product_id) !== tidy(half.product_id))
      .sort((first, second) => first.details.flavorKey.localeCompare(second.details.flavorKey))
      .map(({ whole, half, details }) => ({ whole, half, flavorLabel: details.flavorLabel }));
    return options.length ? [{ servingSize, sizeLabel, options }] : [];
  });
}

export function getChickenCombinationChoices(group, servingSize, products, firstHalf) {
  if (!isChickenVariantGroup(group) || !Object.hasOwn(sizes, servingSize) || !Array.isArray(products)) return [];
  const anchor = firstHalf == null ? null : getChickenVariantDetails(firstHalf);
  if (firstHalf != null && (!isCompatibleChickenHalf(firstHalf, group)
    || anchor.kind !== categoryKind(group) || anchor.servingSize !== servingSize)) return [];
  const seen = new Set();
  return products.filter((product) => {
    if (!isCompatibleChickenHalf(product, group)) return false;
    const details = getChickenVariantDetails(product);
    const id = tidy(product.product_id);
    if (details.servingSize !== servingSize || details.kind === categoryKind(group) || seen.has(id)
      || (anchor && !createChickenCombination(firstHalf, product))) return false;
    seen.add(id);
    return true;
  }).sort((first, second) => getChickenVariantDetails(first).flavorLabel.localeCompare(
    getChickenVariantDetails(second).flavorLabel, undefined, { sensitivity: "base" },
  ) || tidy(first.product_id).localeCompare(tidy(second.product_id)));
}

export function createChickenCombination(first, second) {
  // Keep previously saved same-family combinations readable; new choices are filtered above.
  if (!isCompatibleChickenHalf(first, first) || !isCompatibleChickenHalf(second, first)) return null;
  const firstDetails = getChickenVariantDetails(first);
  const secondDetails = getChickenVariantDetails(second);
  if (firstDetails.servingSize !== secondDetails.servingSize || firstDetails.flavorKey === secondDetails.flavorKey
    || tidy(first.product_id) === tidy(second.product_id)) return null;
  const total = Math.round((Number(first.selling_price) + Number(second.selling_price) + Number.EPSILON) * 100) / 100;
  return Number.isFinite(total) ? { products: [first, second], total } : null;
}

export function getChickenCombinationInstruction(first, second) {
  if (!createChickenCombination(first, second)) return "";
  const firstDetails = getChickenVariantDetails(first);
  return `2-flavor chicken ${firstDetails.sizeLabel}: ${firstDetails.flavorLabel} + ${getChickenVariantDetails(second).flavorLabel}`;
}
