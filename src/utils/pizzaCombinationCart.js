import { getMenuVariantDetails } from "./menuProductVariants.js";

// The kitchen instruction is saved with both real HALF rows, so pairing also
// survives reopening an order without introducing a synthetic product code.
export function pizzaCombinationKey(item) {
  const instruction = String(item?.itemInstruction || "");
  return /^2-flavor (?:pizza \d+(?:\.\d+)?"|chicken wings platter): .+ \+ .+(?:\n|$)/u.test(instruction)
    ? instruction
    : "";
}

export function isSamePizzaCombination(first, second) {
  const key = pizzaCombinationKey(first);
  return Boolean(key && key === pizzaCombinationKey(second) &&
    Boolean(first.isLoadedFromDB) === Boolean(second.isLoadedFromDB));
}
const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const categoryKey = (item) => tidy(item?.item_category)
  .replace(/\s+(HALF|WHOLE)$/iu, "").trim().toUpperCase();
const hasNumericValue = (value) => (typeof value === "number" || typeof value === "string")
  && tidy(value) !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
const hasCode = (item) => (typeof item?.code === "string"
  || (typeof item?.code === "number" && Number.isFinite(item.code))) && tidy(item.code) !== "";
const platterCategory = "CHICKEN WINGS PLATTER";

function getPlatterFlavor(item) {
  const name = tidy(item?.name);
  const match = name.match(/^(.+)\s+HALF$/iu);
  if (!match || /\b(?:BUFFALO|BUFALLO)\s+WINGS\b/iu.test(name)) return "";
  const details = getMenuVariantDetails({ item_name: name });
  // Platter portions have a named flavor and HALF suffix, without a pizza
  // diameter or the Solo/Double/Group serving used by Buffalo Wings.
  return details.portion === "half" && details.sizeValue === null && !details.sizeKind
    && !getMenuVariantDetails({ item_name: details.baseName }).sizeKind
    && details.baseName === match[1] ? details.baseName : "";
}

function getPairDetails(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return null;
  const [first, second] = parts;
  if (!first || !second || first._isPizzaCombination || second._isPizzaCombination
    || !isSamePizzaCombination(first, second) || !hasCode(first) || !hasCode(second)
    || tidy(first.code) === tidy(second.code)
    || !hasNumericValue(first.price) || !hasNumericValue(second.price)) return null;

  // Keep both controlled quantity inputs editable while temporarily empty.
  const bothBlank = first.quantity === "" && second.quantity === "";
  if (!bothBlank && (!hasNumericValue(first.quantity) || !hasNumericValue(second.quantity)
    || Number(first.quantity) !== Number(second.quantity))) return null;

  const instruction = pizzaCombinationKey(first);
  const isPlatter = instruction.startsWith("2-flavor chicken wings platter: ");
  const firstCategory = categoryKey(first);
  const secondCategory = categoryKey(second);
  // Reopened rows omit categories; new quantities copied from them do too.
  // Their matching instructions and HALF names still identify a valid pair.
  const hasCorrectCategory = (category) => isPlatter
    ? category === platterCategory : /\bPIZZA\b/u.test(category);
  if ((firstCategory && !hasCorrectCategory(firstCategory))
    || (secondCategory && !hasCorrectCategory(secondCategory))
    || (firstCategory && secondCategory && firstCategory !== secondCategory)) return null;

  const firstDetails = isPlatter ? { baseName: getPlatterFlavor(first), sizeLabel: "Whole" }
    : getMenuVariantDetails({ item_name: first.name });
  const secondDetails = isPlatter ? { baseName: getPlatterFlavor(second) }
    : getMenuVariantDetails({ item_name: second.name });
  if (!isPlatter && (firstDetails.portion !== "half" || secondDetails.portion !== "half"
    || !(firstDetails.sizeValue > 0) || firstDetails.sizeValue !== secondDetails.sizeValue)) return null;
  if (!firstDetails.baseName || !secondDetails.baseName
    || firstDetails.baseName.toUpperCase() === secondDetails.baseName.toUpperCase()) return null;

  const [header, ...notes] = instruction.split("\n");
  const expectedHeader = isPlatter ? "2-flavor chicken wings platter: "
    : `2-flavor pizza ${firstDetails.sizeLabel}: `;
  const flavors = `${firstDetails.baseName} + ${secondDetails.baseName}`;
  const reverseFlavors = `${secondDetails.baseName} + ${firstDetails.baseName}`;
  const normalizedHeader = tidy(header).toUpperCase();
  const sameFlavorOrder = normalizedHeader === tidy(expectedHeader + flavors).toUpperCase();
  if (!sameFlavorOrder
    && normalizedHeader !== tidy(expectedHeader + reverseFlavors).toUpperCase()) return null;

  const price = Number(first.price) + Number(second.price);
  if (!Number.isFinite(price)) return null;
  return {
    name: `${sameFlavorOrder ? flavors : reverseFlavors} · ${firstDetails.sizeLabel}`,
    price,
    item_category: firstCategory || secondCategory || (isPlatter ? platterCategory : "PIZZA"),
    combinationLabel: isPlatter ? "Combine flavor · Whole platter" : "Combine flavor · Whole pizza",
    displayInstruction: notes.join("\n"),
  };
}

// Presentation only: every grouped row retains references to the two real HALF
// rows. Cart state, inventory quantities and save payloads must use those rows.
export function groupPizzaCombinationCartRows(items = []) {
  if (!Array.isArray(items)) return [];
  const pairs = new Map();
  for (const item of items) {
    const instruction = !item?._isPizzaCombination && pizzaCombinationKey(item);
    if (!instruction) continue;
    const key = JSON.stringify([instruction, Boolean(item.isLoadedFromDB)]);
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(item);
  }

  const replacements = new Map();
  const hiddenParts = new Set();
  for (const parts of pairs.values()) {
    const details = getPairDetails(parts);
    if (!details) continue;
    const [first, second] = parts;
    replacements.set(first, {
      ...first,
      ...details,
      _isPizzaCombination: true,
      combinationParts: parts,
      hasAdditionalEntry: Boolean(first.hasAdditionalEntry || second.hasAdditionalEntry),
    });
    hiddenParts.add(second);
  }
  return items.filter((item) => !hiddenParts.has(item))
    .map((item) => replacements.get(item) || item);
}

export function getPizzaCombinationSourceItem(item) {
  return item?._isPizzaCombination && getPairDetails(item.combinationParts)
    ? item.combinationParts[0]
    : item;
}
