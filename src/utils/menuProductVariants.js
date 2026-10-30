import { getChickenVariantDetails } from "./menuChickenCombination.js";

const tidy = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");

// Inch sizes require explicit units at the end of a name.
// A leading flavor number ("5 CHEESE") or a number without units stays intact.
const inchSuffix = /\s+(\d+(?:\.\d+)?)\s*(?:["“”″]|in(?:ch(?:es)?)?\.?)$/iu;
const ounceSuffix = /\s+(\d+(?:\.\d+)?)\s*oz\.?$/iu;
const scoopSuffix = /\s+SCOOP$/iu;
const portionSuffix = /\s+(HALF|WHOLE)$/iu;
// Wings use named servings, with an optional flavor after the size. Keep
// matching narrow so rice meals, platters, and unrelated names stay separate.
const wingsServing = /^(.+\bWINGS)\s+(SOLO|DOUBLE|GROUP)(?:\s+(SPICY))?$/iu;
const chickenServing = /^(GJ FRIED CHICKEN)\s+(SOLO|DOUBLE|GROUP)$/iu;
const servingSizes = {
  SOLO: { label: "Solo", order: 0 },
  DOUBLE: { label: "Double", order: 1 },
  GROUP: { label: "Group", order: 2 },
};
const shirtSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
// These catalog sizes have a trailing quote (e.g. SHIRT XL"). It is part
// of the source name, not an inch measurement. Keep this apparel-specific.
const pickleJoeShirt = /^(PICKLE JOE SHIRT)\s+(XS|S|M|L|XL|2XL|3XL)\s*["“”″]?$/iu;

export function getMenuVariantDetails(product) {
  const name = tidy(product?.item_name);
  const category = tidy(product?.item_category).replace(portionSuffix, "").trim().toUpperCase();
  const shirtMatch = tidy(product?.item_category).toUpperCase() === "OTHERS" && name.match(pickleJoeShirt);
  if (shirtMatch) {
    const sizeLabel = shirtMatch[2].toUpperCase();
    return {
      baseName: shirtMatch[1],
      familyKey: JSON.stringify([category, shirtMatch[1].toUpperCase(), "apparel"]),
      portion: "whole",
      sizeKind: "apparel",
      servingSize: null,
      flavorLabel: "",
      sizeLabel,
      sizeOrder: shirtSizes.indexOf(sizeLabel),
      sizeValue: null,
      hasVariant: true,
    };
  }
  const chickenDetails = getChickenVariantDetails(product);
  if (chickenDetails) {
    // New half SKUs use BUFFALO while the existing whole menu uses BUFALLO.
    // Canonicalize only their family identity; keep every source field intact.
    const baseName = name.replace(/\s+(SOLO|DOUBLE|GROUP)(?:\s+SPICY)?(?:\s+(HALF|WHOLE))?$/iu, "");
    const canonicalName = chickenDetails.kind === "wings" ? "BUFALLO WINGS" : "GJ FRIED CHICKEN";
    return {
      baseName,
      familyKey: JSON.stringify([canonicalName, canonicalName]),
      portion: chickenDetails.portion,
      sizeKind: "serving",
      servingSize: chickenDetails.servingSize,
      flavorLabel: chickenDetails.kind === "wings" ? (chickenDetails.flavorKey === "wings:spicy" ? "Spicy" : "Original") : "",
      sizeLabel: chickenDetails.sizeLabel,
      sizeOrder: servingSizes[chickenDetails.servingSize.toUpperCase()].order,
      sizeValue: null,
      hasVariant: true,
    };
  }
  let baseName = name;
  let sizeValue = null;
  let hasPortionSuffix = false;
  let portion = "whole";
  const wingsMatch = name.match(wingsServing);
  const servingMatch = wingsMatch || name.match(chickenServing);
  const servingSize = servingMatch?.[2].toUpperCase();
  if (servingMatch) baseName = servingMatch[1];
  // Gelato Scoop is a serving option for the same flavor as its ounce sizes.
  // Keep this category-specific so equipment and other products stay intact.
  const scoopMatch = category === "GELATO" && name.match(scoopSuffix);
  if (scoopMatch) baseName = name.slice(0, scoopMatch.index).trim();
  const ounceMatch = !servingMatch && name.match(ounceSuffix);
  const ounceValue = ounceMatch && Number.isFinite(Number(ounceMatch[1])) && Number(ounceMatch[1]) > 0
    ? Number(ounceMatch[1]) : null;
  if (ounceValue !== null) baseName = name.slice(0, ounceMatch.index).trim();

  // Accept either "5 CHEESE 12\" HALF" or "5 CHEESE HALF 12\"".
  // Strip at most one size and one portion so other name words stay meaningful.
  for (let index = 0; !servingMatch && !scoopMatch && ounceValue === null && index < 2; index += 1) {
    const portionMatch = !hasPortionSuffix && baseName.match(portionSuffix);
    if (portionMatch) {
      baseName = baseName.slice(0, portionMatch.index).trim();
      hasPortionSuffix = true;
      portion = portionMatch[1].toLowerCase();
      continue;
    }

    const sizeMatch = sizeValue === null && baseName.match(inchSuffix);
    if (sizeMatch && Number(sizeMatch[1]) > 0) {
      sizeValue = Number(sizeMatch[1]);
      baseName = baseName.slice(0, sizeMatch.index).trim();
      continue;
    }
    break;
  }

  return {
    baseName,
    familyKey: JSON.stringify([
      // Some menus put half portions in a separate "PIZZA HALF" category.
      // Treat that suffix as a portion marker while retaining original fields.
      category,
      baseName.toUpperCase(),
      // Ounce and Gelato Scoop servings share a family, distinct from inch
      // or unsized items. Existing inch/portion family keys stay stable.
      ...(ounceValue !== null || scoopMatch ? ["oz"] : []),
    ]),
    // Only a parsed portion tag is a combination ingredient. Names such as
    // HALF FRIED CHICKEN are ordinary products, not a Half variant option.
    portion,
    sizeKind: servingMatch ? "serving" : scoopMatch ? "scoop" : ounceValue !== null ? "oz" : sizeValue === null ? null : "inch",
    servingSize: servingSize?.toLowerCase() ?? null,
    flavorLabel: wingsMatch ? (wingsMatch[3] ? "Spicy" : "Original") : "",
    sizeLabel: servingMatch ? servingSizes[servingSize].label
      : scoopMatch ? "Scoop" : ounceValue !== null ? `${ounceValue} oz` : sizeValue === null ? "" : `${sizeValue}\"`,
    sizeOrder: servingMatch ? servingSizes[servingSize].order : scoopMatch ? 0 : ounceValue ?? sizeValue,
    sizeValue,
    // A search can return only a whole platter (whose name has no suffix).
    // Still open its options and load the matching Half product on demand.
    hasVariant: Boolean(servingMatch) || Boolean(scoopMatch) || hasPortionSuffix || sizeValue !== null || ounceValue !== null
      || (category === "CHICKEN WINGS PLATTER" && name !== ""),
  };
}

export function groupMenuProductVariants(products = []) {
  if (!Array.isArray(products)) return [];

  const families = new Map();
  const entries = products.map((product) => {
    // Subcategory folders and existing family cards are navigation entries,
    // even when their display name happens to end with a variant suffix.
    if (product?._isFolder || product?._isVariantGroup) return { product };

    const details = getMenuVariantDetails(product);
    let family = families.get(details.familyKey);
    if (!family) {
      family = { details, variants: [], hasVariant: false, hasServingSizes: false, hasFlavorOptions: false };
      families.set(details.familyKey, family);
    }
    family.variants.push(product);
    family.hasVariant ||= details.hasVariant;
    family.hasServingSizes ||= details.sizeKind === "serving";
    family.hasFlavorOptions ||= Boolean(details.flavorLabel);
    return { product, family };
  });

  const emitted = new Set();
  return entries.flatMap(({ product, family }) => {
    if (!family || !family.hasVariant) return [product];
    if (emitted.has(family)) return [];
    emitted.add(family);

    const prices = family.variants
      .map((variant) => variant?.selling_price)
      .filter((price) => price !== null && price !== undefined && String(price).trim() !== "")
      .map(Number)
      .filter(Number.isFinite);

    // This is a display card, never a sellable item. The modal must pass the
    // selected original variant, including its own product ID and price, to cart.
    return [{
      _isVariantGroup: true,
      familyKey: family.details.familyKey,
      sizeKind: family.hasServingSizes ? "serving" : family.details.sizeKind,
      hasFlavorOptions: family.hasFlavorOptions,
      item_name: family.details.baseName,
      item_category: product?.item_category ?? "",
      variants: family.variants,
      variantCount: family.variants.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
    }];
  });
}
