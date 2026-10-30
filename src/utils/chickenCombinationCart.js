import {
  createChickenCombination, getChickenCombinationInstruction, getChickenVariantDetails,
} from "./menuChickenCombination.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const isDisplayRow = (item) => Boolean(item?._isChickenCombination || item?._isPizzaCombination
  || item?._isCoffeeAddon || item?._isFolder || item?._isVariantGroup);
const hasQuantity = (value) => (typeof value === "number" || typeof value === "string")
  && tidy(value) !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

// Saved order rows can omit the catalog category. Infer it only from the two
// exact chicken families, then let the catalog parser validate size and portion.
function toProduct(item) {
  const name = tidy(item?.name);
  let category = tidy(item?.item_category);
  if (!category) {
    if (/^(?:BUFFALO|BUFALLO) WINGS(?:\s|$)/iu.test(name)) category = "BUFFALO WINGS";
    else if (/^GJ FRIED CHICKEN(?:\s|$)/iu.test(name)) category = "GJ FRIED CHICKEN";
  }
  return {
    product_id: item?.code, item_name: name, selling_price: item?.price,
    item_category: category,
  };
}

export function chickenCombinationKey(item) {
  const instruction = String(item?.itemInstruction || "");
  return /^2-flavor chicken (?:Solo|Double|Group): .+ \+ .+(?:\n|$)/u.test(instruction)
    ? instruction : "";
}

export function isSameChickenCombination(first, second) {
  const key = chickenCombinationKey(first);
  return Boolean(key && key === chickenCombinationKey(second)
    && Boolean(first.isLoadedFromDB) === Boolean(second.isLoadedFromDB));
}

function getPairDetails(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return null;
  const [first, second] = parts;
  if (!first || !second || isDisplayRow(first) || isDisplayRow(second)
    || !isSameChickenCombination(first, second)) return null;
  const bothBlank = first.quantity === "" && second.quantity === "";
  if (!bothBlank && (!hasQuantity(first.quantity) || !hasQuantity(second.quantity)
    || Number(first.quantity) !== Number(second.quantity))) return null;

  const firstProduct = toProduct(first);
  const secondProduct = toProduct(second);
  if (!createChickenCombination(firstProduct, secondProduct)) return null;
  const firstDetails = getChickenVariantDetails(firstProduct);
  const secondDetails = getChickenVariantDetails(secondProduct);
  const [header, ...notes] = chickenCombinationKey(first).split("\n");
  const normalizedHeader = tidy(header).toUpperCase();
  const sameOrder = normalizedHeader === tidy(getChickenCombinationInstruction(firstProduct, secondProduct)).toUpperCase();
  if (!sameOrder
    && normalizedHeader !== tidy(getChickenCombinationInstruction(secondProduct, firstProduct)).toUpperCase()) return null;
  const price = Number(first.price) + Number(second.price);
  if (!Number.isFinite(price)) return null;
  const flavors = sameOrder
    ? `${firstDetails.flavorLabel} + ${secondDetails.flavorLabel}`
    : `${secondDetails.flavorLabel} + ${firstDetails.flavorLabel}`;
  return {
    name: `${flavors} · ${firstDetails.sizeLabel}`,
    price,
    item_category: tidy(first.item_category) || tidy(second.item_category) || "CHICKEN COMBINATION",
    combinationLabel: "Combine flavor · Whole chicken",
    displayInstruction: notes.join("\n"),
  };
}

// Only the display is combined. Keep both original rows for inventory, saving,
// linked quantity/removal operations and the protected kitchen instruction.
export function groupChickenCombinationCartRows(items = []) {
  if (!Array.isArray(items)) return [];
  const candidates = new Map();
  for (const item of items) {
    const instruction = !isDisplayRow(item) && chickenCombinationKey(item);
    if (!instruction) continue;
    const key = JSON.stringify([instruction, Boolean(item.isLoadedFromDB)]);
    if (!candidates.has(key)) candidates.set(key, []);
    candidates.get(key).push(item);
  }
  const replacements = new Map();
  const hiddenParts = new Set();
  for (const parts of candidates.values()) {
    const details = getPairDetails(parts);
    if (!details) continue;
    const [first, second] = parts;
    replacements.set(first, {
      ...first, ...details, _isChickenCombination: true, combinationParts: parts,
      hasAdditionalEntry: Boolean(first.hasAdditionalEntry || second.hasAdditionalEntry),
    });
    hiddenParts.add(second);
  }
  return items.filter((item) => !hiddenParts.has(item))
    .map((item) => replacements.get(item) || item);
}

export function getChickenCombinationSourceItem(item) {
  return item?._isChickenCombination && getPairDetails(item.combinationParts)
    ? item.combinationParts[0] : item;
}
