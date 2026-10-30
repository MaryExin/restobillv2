import { isCclAddon, isCoffeeAddonDrink } from "./menuCoffeeAddons.js";
import { getOrderItemDisplayName } from "./orderItemDisplayName.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const nameOf = (item) => tidy(item?.name ?? item?.item_name);
const hasNumericValue = (value) => (typeof value === "number" || typeof value === "string")
  && tidy(value) !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
const hasCode = (code) => (typeof code === "string"
  || (typeof code === "number" && Number.isFinite(code))) && tidy(code) !== "";
const isDisplayRow = (item) => Boolean(item?._isCoffeeAddon || item?._isPizzaCombination
  || item?._isFolder || item?._isVariantGroup);

// Saved order rows can omit categories. A matching protected instruction and
// the same strict product-name classifiers recover their original pairing.
const matchesDrink = (item) => isCoffeeAddonDrink({
  item_name: nameOf(item), item_category: tidy(item?.item_category) || "DRINKS",
});
const matchesAddon = (item) => isCclAddon({
  item_name: nameOf(item), item_category: tidy(item?.item_category) || "ADD ONS",
});

export function getCoffeeAddonInstruction(drink, addon) {
  const drinkCode = drink?.code ?? drink?.product_id;
  const addonCode = addon?.code ?? addon?.product_id;
  if (isDisplayRow(drink) || isDisplayRow(addon) || !matchesDrink(drink) || !matchesAddon(addon)
    || !hasCode(drinkCode) || !hasCode(addonCode) || tidy(drinkCode) === tidy(addonCode)
    || !hasNumericValue(drink?.price ?? drink?.selling_price)
    || !hasNumericValue(addon?.price ?? addon?.selling_price)) return "";
  return `Coffee add-on: ${nameOf(drink)} + ${nameOf(addon)}`;
}

export function coffeeAddonKey(item) {
  const instruction = String(item?.itemInstruction || "");
  return /^Coffee add-on: .+ \+ .+(?:\n|$)/u.test(instruction) ? instruction : "";
}

export function isSameCoffeeAddon(first, second) {
  const key = coffeeAddonKey(first);
  return Boolean(key && key === coffeeAddonKey(second)
    && Boolean(first.isLoadedFromDB) === Boolean(second.isLoadedFromDB));
}

function getPairDetails(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return null;
  const [first, second] = parts;
  if (!first || !second || isDisplayRow(first) || isDisplayRow(second)
    || !isSameCoffeeAddon(first, second) || !hasCode(first.code) || !hasCode(second.code)
    || tidy(first.code) === tidy(second.code)
    || !hasNumericValue(first.price) || !hasNumericValue(second.price)) return null;

  // Match the existing grouped cart's controlled quantity editing behavior.
  const bothBlank = first.quantity === "" && second.quantity === "";
  if (!bothBlank && (!hasNumericValue(first.quantity) || !hasNumericValue(second.quantity)
    || Number(first.quantity) !== Number(second.quantity))) return null;

  const drink = matchesDrink(first) ? first : matchesDrink(second) ? second : null;
  const addon = matchesAddon(first) ? first : matchesAddon(second) ? second : null;
  if (!drink || !addon || drink === addon) return null;
  const [header, ...notes] = coffeeAddonKey(first).split("\n");
  const expectedHeader = getCoffeeAddonInstruction(drink, addon);
  if (!expectedHeader || tidy(header).toUpperCase() !== expectedHeader.toUpperCase()) return null;
  const price = Number(drink.price) + Number(addon.price);
  if (!Number.isFinite(price)) return null;

  return {
    drink, addon,
    display: {
      name: `${getOrderItemDisplayName(nameOf(drink))} · ${getOrderItemDisplayName(nameOf(addon))}`,
      price,
      item_category: tidy(drink.item_category) || "DRINKS",
      combinationLabel: "Coffee with add-on",
      displayInstruction: notes.join("\n"),
    },
  };
}

// Group only for presentation. Both original rows remain the source of truth
// for saving, quantities, inventory deductions and kitchen instructions.
export function groupCoffeeAddonCartRows(items = []) {
  if (!Array.isArray(items)) return [];
  const candidates = new Map();
  for (const item of items) {
    const instruction = !isDisplayRow(item) && coffeeAddonKey(item);
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
    const { drink, addon, display } = details;
    replacements.set(parts[0], {
      ...drink,
      ...display,
      _isCoffeeAddon: true,
      combinationParts: [drink, addon],
      hasAdditionalEntry: Boolean(drink.hasAdditionalEntry || addon.hasAdditionalEntry),
    });
    hiddenParts.add(parts[1]);
  }
  return items.filter((item) => !hiddenParts.has(item))
    .map((item) => replacements.get(item) || item);
}

export function getCoffeeAddonSourceItem(item) {
  return item?._isCoffeeAddon && getPairDetails(item.combinationParts)?.drink || item;
}
