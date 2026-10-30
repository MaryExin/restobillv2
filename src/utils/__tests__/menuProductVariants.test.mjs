import assert from "node:assert/strict";
import test from "node:test";
import { getMenuVariantDetails, groupMenuProductVariants } from "../menuProductVariants.js";

const product = (item_name, selling_price = 100, item_category = "PIZZA") => ({
  product_id: `ID-${item_name}`,
  item_name,
  selling_price,
  item_category,
});

test("menu families combine six cheese sizes and portions but keep Aloha and flavor numbers separate", () => {
  const variants = [
    product('5 CHEESE 12"', 700),
    product('5 CHEESE 12" HALF', 475),
    product('5 CHEESE 16"', 950),
    product('5 CHEESE 16" HALF', 475),
    product('5 CHEESE 9"', 420),
    product('5 CHEESE 9" HALF', 335),
  ];
  const aloha = product('ALOHA 5 CHEESE 12"', 725);
  const six = product('6 CHEESE 12"', 800);
  const groups = groupMenuProductVariants([...variants, aloha, six]);

  assert.deepEqual(groups.map((group) => group.item_name), ["5 CHEESE", "ALOHA 5 CHEESE", "6 CHEESE"]);
  assert.equal(groups[0].variantCount, 6);
  assert.equal(groups[0].minPrice, 335);
  assert.equal(groups[0]._isVariantGroup, true);
  assert.equal("product_id" in groups[0], false);
  assert.deepEqual(groups[0].variants, variants);
  assert.equal(groups[0].variants[1], variants[1], "cart selections retain original product identity and price");
});

test("explicit inch suffix spellings normalize and portion can precede or follow size", () => {
  for (const suffix of ['12"', '12”', '12“', '12″', '12 IN', '12in.', '12 INCH', '12 INCHES']) {
    for (const ending of [`${suffix} HALF`, `HALF ${suffix}`]) {
      const details = getMenuVariantDetails(product(`5 CHEESE ${ending}`));
      assert.equal(details.baseName, "5 CHEESE", ending);
      assert.equal(details.portion, "half", ending);
      assert.equal(details.sizeValue, 12, ending);
      assert.equal(details.sizeLabel, '12"', ending);
      assert.equal(details.hasVariant, true, ending);
    }
  }
  const decimal = getMenuVariantDetails(product('5 CHEESE 9.5" WHOLE'));
  assert.equal(decimal.sizeValue, 9.5);
  assert.equal(decimal.portion, "whole");
  assert.equal(decimal.baseName, "5 CHEESE");
});

test("unmarked products keep their names and identity without fuzzy flavor merging", () => {
  const names = ["5 CHEESE", "6 CHEESE", "HALF FRIED CHICKEN", "HALFWAY HOUSE", "HALF", "WHOLE", '12" PIZZA', "PIZZA 12", "PEPSI 1.5 L"];
  const products = names.map((name) => product(name));
  assert.deepEqual(groupMenuProductVariants(products), products);
  products.forEach((item, index) => {
    const details = getMenuVariantDetails(item);
    assert.equal(details.baseName, names[index]);
    assert.equal(details.hasVariant, false);
    assert.equal(groupMenuProductVariants(products)[index], item);
  });
  assert.equal(getMenuVariantDetails(product("HALF FRIED CHICKEN")).portion, "whole");
  assert.equal(getMenuVariantDetails(product("HALFWAY HOUSE")).portion, "whole");
});

test("category and normalized base define families, including an unsuffixed whole product", () => {
  const whole = product("  5   Cheese  ", 700, " Pizza ");
  const half = product("5 CHEESE HALF", "350.50", "pizza");
  const anotherCategory = product('5 CHEESE 12"', 800, "SPECIALS");
  const groups = groupMenuProductVariants([whole, half, anotherCategory]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].item_name, "5 Cheese");
  assert.equal(groups[0].variantCount, 2);
  assert.equal(groups[0].minPrice, 350.5);
  assert.equal(groups[0].variants[0], whole);
  assert.notEqual(groups[0].familyKey, groups[1].familyKey);
});

test("families preserve menu order and input objects without manufacturing half prices", () => {
  const whole = Object.freeze(product('5 CHEESE 12"', 700));
  const tea = Object.freeze(product("Tea", 80, "DRINKS"));
  const half = Object.freeze(product('5 CHEESE 12" HALF', 475));
  const source = Object.freeze([whole, tea, half]);
  const groups = groupMenuProductVariants(source);
  assert.equal(groups.length, 2);
  assert.equal(groups[1], tea);
  assert.equal(groups[0].minPrice, 475);
  assert.equal(groups[0].variants[1].selling_price, 475);
  assert.equal(groups[0].variants[1].product_id, half.product_id);
  assert.equal(whole.item_name, '5 CHEESE 12"');
  assert.equal(source.length, 3);
});

test("portion categories share a family while original categories and unrelated departments stay intact", () => {
  const half = Object.freeze(product('5 CHEESE 12" HALF', 475, " PIZZA HALF "));
  const whole = Object.freeze(product('5 CHEESE 12"', 700, "PIZZA"));
  const explicitWhole = Object.freeze(product('5 CHEESE 9" WHOLE', 420, "pizza whole"));
  const drink = Object.freeze(product('5 CHEESE 12"', 100, "DRINKS"));
  const groups = groupMenuProductVariants([half, whole, explicitWhole, drink]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].variants, [half, whole, explicitWhole]);
  assert.equal(groups[0].variantCount, 3);
  assert.equal(groups[0].item_category, " PIZZA HALF ");
  assert.equal(groups[0].variants[1].item_category, "PIZZA");
  assert.equal(groups[0].variants[2].item_category, "pizza whole");
  assert.notEqual(groups[0].familyKey, groups[1].familyKey);
  assert.notEqual(getMenuVariantDetails(product('5 CHEESE 12"', 100, "HALF PIZZA")).familyKey, groups[0].familyKey);
});

test("null fields and invalid prices do not invent a cheaper selectable variant", () => {
  assert.deepEqual(groupMenuProductVariants(null), []);
  assert.deepEqual(groupMenuProductVariants([]), []);
  assert.equal(getMenuVariantDetails({ item_name: null, item_category: null }).hasVariant, false);
  const missing = product('5 CHEESE 9"', null);
  const invalid = product('5 CHEESE 12"', "unknown");
  const priced = product('5 CHEESE 16"', "950.00");
  assert.equal(groupMenuProductVariants([missing, invalid, priced])[0].minPrice, 950);
  assert.equal(groupMenuProductVariants([missing, invalid])[0].minPrice, 0);
  assert.equal(groupMenuProductVariants([priced, product('5 CHEESE 9" HALF', 0)])[0].minPrice, 0);
});

test("subcategory folders and existing family cards pass through unchanged", () => {
  const folder = Object.freeze({
    _isFolder: true,
    item_name: '5 CHEESE 12" HALF',
    item_category: "PIZZA",
    itemsInGroup: [product('5 CHEESE 12" HALF', 475)],
  });
  const originalGroup = groupMenuProductVariants([product('ALOHA 5 CHEESE 9"', 425)])[0];
  const single = product('5 CHEESE 12"', 700);
  const result = groupMenuProductVariants([folder, single, originalGroup]);
  assert.equal(result.length, 3);
  assert.equal(result[0], folder);
  assert.equal(result[1].variantCount, 1, "navigation cards are not selectable family variants");
  assert.equal(result[1].variants[0], single);
  assert.equal(result[2], originalGroup);
});

test("Buffalo Wings servings and spicy flavors form one family with original sellable variants", () => {
  const sizes = [["SOLO", 525], ["DOUBLE", 970], ["GROUP", 1410]];
  const wings = sizes.flatMap(([size, price]) => [
    Object.freeze(product(`BUFALLO WINGS ${size}`, price, "BUFALLO WINGS")),
    Object.freeze(product(`BUFALLO WINGS ${size} SPICY`, price, "BUFALLO WINGS")),
  ]);
  const [family] = groupMenuProductVariants(wings);
  assert.equal(family.item_name, "BUFALLO WINGS");
  assert.equal(family.sizeKind, "serving");
  assert.equal(family.hasFlavorOptions, true);
  assert.equal(family.variantCount, 6);
  assert.equal(family.minPrice, 525);
  assert.equal("product_id" in family, false);
  assert.deepEqual(family.variants, wings);
  wings.forEach((item, index) => {
    assert.equal(family.variants[index], item);
    const details = getMenuVariantDetails(item);
    assert.equal(details.familyKey, family.familyKey);
    assert.equal(details.sizeOrder, Math.floor(index / 2));
    assert.equal(details.servingSize, sizes[Math.floor(index / 2)][0].toLowerCase());
    assert.equal(details.flavorLabel, index % 2 ? "Spicy" : "Original");
    assert.equal(details.sizeValue, null, "serving sizes are not pizza inch sizes");
  });
});

test("named wing sizes support the existing spelling and normalized whitespace without merging unrelated dishes", () => {
  const spicy = getMenuVariantDetails(product("  Buffalo   Wings Double Spicy  ", 970, "WINGS"));
  assert.equal(spicy.baseName, "Buffalo Wings");
  assert.equal(spicy.sizeLabel, "Double");
  assert.equal(spicy.flavorLabel, "Spicy");
  assert.equal(spicy.hasVariant, true);

  const unrelated = ["RM BUFFALO WINGS", "CHICKEN WINGS PLATTER", "DOUBLE BURGER", "MEAL GROUP", "PIZZA SOLO", "BUFALLO WINGS GROUP SET"]
    .map((name) => product(name, 100, "MEALS"));
  assert.deepEqual(groupMenuProductVariants(unrelated), unrelated);
  const wings = product("BUFALLO WINGS SOLO", 525, "BUFALLO WINGS");
  const special = product("BUFALLO WINGS SOLO", 500, "SPECIALS");
  assert.equal(groupMenuProductVariants([wings, special]).length, 2);
});

test("GJ Fried Chicken groups Solo, Double, and Group without inventing flavors or changing sellable products", () => {
  const sizes = [["SOLO", 495], ["DOUBLE", 935], ["GROUP", 1360]];
  const chicken = sizes.map(([size, price]) =>
    Object.freeze(product(`GJ FRIED CHICKEN ${size}`, price, "GJ FRIED CHICKEN")));
  const [family] = groupMenuProductVariants(chicken);
  assert.equal(family.item_name, "GJ FRIED CHICKEN");
  assert.equal(family.variantCount, 3);
  assert.equal(family.minPrice, 495);
  assert.equal(family.sizeKind, "serving");
  assert.equal(family.hasFlavorOptions, false);
  assert.equal("product_id" in family, false);
  chicken.forEach((item, index) => {
    assert.equal(family.variants[index], item);
    const details = getMenuVariantDetails(item);
    assert.equal(details.familyKey, family.familyKey);
    assert.equal(details.servingSize, sizes[index][0].toLowerCase());
    assert.equal(details.sizeOrder, index);
    assert.equal(details.sizeValue, null);
    assert.equal(details.flavorLabel, "");
  });
  const normalized = getMenuVariantDetails(product("  gj   fried chicken double  ", 935, "GJ FRIED CHICKEN"));
  assert.equal(normalized.familyKey, family.familyKey);
  assert.equal(normalized.sizeLabel, "Double");
  const unrelated = ["RM GJ FRIED CHICKEN", "GJ FRIED CHICKEN GROUP SET", "DOUBLE BURGER"]
    .map((name) => product(name, 100, "GJ FRIED CHICKEN"));
  assert.deepEqual(groupMenuProductVariants(unrelated), unrelated);
  const special = product("GJ FRIED CHICKEN SOLO", 500, "SPECIALS");
  assert.equal(groupMenuProductVariants([...chicken, special]).length, 2);
});

test("platter Whole and Half products share flavor cards even when a search returns only Whole", () => {
  const names = ["5 ALARM", "BAKED PARMESAN", "HONEY GARLIC", "JALAPENO CHEDDAR", "JAMAICAN JERK"];
  const products = names.flatMap((name) => [
    product(name, name === "JAMAICAN JERK" ? 550 : 535, "CHICKEN WINGS PLATTER"),
    product(`${name} HALF`, name === "JAMAICAN JERK" ? 275 : 267.5, "CHICKEN WINGS PLATTER"),
  ]);
  const groups = groupMenuProductVariants(products);
  assert.deepEqual(groups.map((group) => group.item_name), names);
  groups.forEach((group, index) => {
    assert.deepEqual(group.variants, products.slice(index * 2, index * 2 + 2));
    const partial = groupMenuProductVariants([products[index * 2]])[0];
    assert.equal(partial._isVariantGroup, true);
    assert.equal(partial.familyKey, group.familyKey);
    assert.equal(partial.variants[0], products[index * 2]);
  });
  const unrelated = product("HONEY GARLIC", 100, "ADD ONS");
  assert.equal(groupMenuProductVariants([unrelated])[0], unrelated);
});

test("Gelato Scoop and ounce sizes share one flavor card and preserve prices and IDs", () => {
  const six = Object.freeze(product("GELATO AVOCADO 6OZ", 95, "GELATO"));
  const eight = Object.freeze(product("GELATO  AVOCADO 8OZ", 145, "GELATO"));
  const scoop = Object.freeze(product("GELATO AVOCADO SCOOP", 60, "GELATO"));
  const other = product("GELATO BROWN BUTTER PECAN 6OZ", 155, "GELATO");
  const groups = groupMenuProductVariants([eight, scoop, six, other]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].item_name, "GELATO AVOCADO");
  assert.equal(groups[0].sizeKind, "oz");
  assert.equal(groups[0].minPrice, 60);
  assert.equal(groups[0].variantCount, 3);
  assert.equal(groups[0].hasFlavorOptions, false);
  assert.equal(groups[0].variants[0], eight);
  assert.equal(groups[0].variants[1], scoop);
  assert.equal(groups[0].variants[2], six);
  assert.equal(groups[1].item_name, "GELATO BROWN BUTTER PECAN");
  assert.equal(getMenuVariantDetails(six).sizeLabel, "6 oz");
  assert.equal(getMenuVariantDetails(eight).sizeOrder, 8);
  assert.equal(getMenuVariantDetails(eight).sizeValue, null, "ounce amounts never become pizza inches");
  const scoopOnly = groupMenuProductVariants([scoop])[0];
  assert.equal(scoopOnly.familyKey, groups[0].familyKey, "a Scoop-only search can load its ounce siblings");
  assert.equal(scoopOnly.sizeKind, "scoop");
  assert.deepEqual(scoopOnly.variants, [scoop]);
  const scoopFirst = groupMenuProductVariants([scoop, eight, six])[0];
  assert.equal(scoopFirst.familyKey, groups[0].familyKey);
  assert.equal(scoopFirst.variantCount, 3);
});

test("Scoop serving suffix is case-insensitive and restricted to Gelato products", () => {
  const details = getMenuVariantDetails(product("  GELATO  AVOCADO   scoop  ", 60, " Gelato "));
  assert.equal(details.baseName, "GELATO AVOCADO");
  assert.equal(details.sizeKind, "scoop");
  assert.equal(details.sizeLabel, "Scoop");
  assert.equal(details.sizeOrder, 0);
  assert.equal(details.sizeValue, null);
  assert.equal(details.portion, "whole");
  const unrelated = [
    product("Ice Scooper", 100, "DINE & KITCHEN WARES"),
    product("ICE SCOOP", 100, "DINE & KITCHEN WARES"),
    product("GELATO SCOOP CAKE", 100, "GELATO"),
    product("GELATO AVOCADO SCOOP", 100, "INGREDIENTS"),
  ];
  assert.deepEqual(groupMenuProductVariants(unrelated), unrelated);
});

test("ounce suffixes support case, spacing, decimals and trailing periods without parsing internal text", () => {
  for (const suffix of ["8OZ", "8 OZ", "8oz", "8 oz.", "8.0 Oz"]) {
    const details = getMenuVariantDetails(product(`GELATO AVOCADO ${suffix}`, 145, "GELATO"));
    assert.equal(details.baseName, "GELATO AVOCADO");
    assert.equal(details.sizeKind, "oz");
    assert.equal(details.sizeLabel, "8 oz");
    assert.equal(details.sizeOrder, 8);
    assert.equal(details.hasVariant, true);
  }
  assert.equal(getMenuVariantDetails(product("TEA 2.5oz", 45, "DRINKS")).sizeOrder, 2.5);
  const unchanged = ["MOZZARELLA STICKS", "Whooz", "Hot Cups 8oz Pack 1x25", "TEA 0OZ", "TEA -8oz", "TEA 8", "TEA OZ", "8OZ", "TEA 16ozx"]
    .map((name) => product(name, 100, "DRINKS"));
  assert.deepEqual(groupMenuProductVariants(unchanged), unchanged);
});

test("ounce families never merge with inch, unsized, other categories, or another flavor", () => {
  const products = [
    product("AVOCADO 6OZ", 95, "GELATO"),
    product("AVOCADO 8OZ", 145, "GELATO"),
    product('AVOCADO 6"', 300, "GELATO"),
    product("AVOCADO", 50, "GELATO"),
    product("AVOCADO 6OZ", 100, "DRINKS"),
    product("CHOCOLATE AVOCADO 6OZ", 120, "GELATO"),
  ];
  const groups = groupMenuProductVariants(products);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].variants, products.slice(0, 2));
  // Preserve the existing inch/unsized family behavior, separate from ounces.
  assert.deepEqual(groups[1].variants, products.slice(2, 4));
  assert.equal(new Set(groups.filter((item) => item._isVariantGroup).map((item) => item.familyKey)).size, 4);
});

test("Pickle Joe shirts with quoted catalog sizes share one card without changing their sellable SKUs", () => {
  const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
  const shirts = sizes.map((size, index) => Object.freeze({
    ...product(`PICKLE JOE SHIRT ${size}\"`, index < 5 ? "700.00" : "750.00", "OTHERS"),
    product_id: `SHIRT-${size}`,
  }));
  const source = Object.freeze([shirts[6], shirts[2], shirts[0], shirts[5], shirts[4], shirts[1], shirts[3]]);
  const [family] = groupMenuProductVariants(source);
  assert.equal(groupMenuProductVariants(source).length, 1);
  assert.equal(family.item_name, "PICKLE JOE SHIRT");
  assert.equal(family.sizeKind, "apparel");
  assert.equal(family.variantCount, 7);
  assert.equal(family.minPrice, 700);
  assert.equal(family.hasFlavorOptions, false);
  assert.equal("product_id" in family, false, "the family is a display card, never an extra sellable SKU");
  source.forEach((item, index) => assert.equal(family.variants[index], item));
  shirts.forEach((item, index) => {
    const details = getMenuVariantDetails(item);
    assert.equal(details.familyKey, family.familyKey);
    assert.equal(details.sizeLabel, sizes[index]);
    assert.equal(details.sizeOrder, index);
    assert.equal(details.sizeValue, null, "the catalog's trailing quote does not make shirts inch sizes");
    assert.equal(details.portion, "whole");
    assert.equal(item.selling_price, index < 5 ? "700.00" : "750.00");
  });
  const [partial] = groupMenuProductVariants([shirts[5]]);
  assert.equal(partial._isVariantGroup, true, "a single search result must still open the complete size picker");
  assert.equal(partial.familyKey, family.familyKey);
  assert.equal(partial.variants[0], shirts[5]);
});

test("shirt sizes tolerate catalog case and quotes but do not combine unrelated merchandise", () => {
  const expected = getMenuVariantDetails(product('PICKLE JOE SHIRT XL"', 700, "OTHERS"));
  for (const suffix of ["XL", 'XL"', "XL“", "XL”", "XL″"]) {
    const details = getMenuVariantDetails(product(`  pickle  joe shirt  ${suffix.toLowerCase()}  `, 700, " Others "));
    assert.equal(details.familyKey, expected.familyKey, suffix);
    assert.equal(details.sizeLabel, "XL", suffix);
    assert.equal(details.sizeKind, "apparel", suffix);
  }
  const unrelated = [
    product("PICKLE JOE SHIRT", 700, "OTHERS"),
    product('PICKLE JOE SHIRT S"', 700, "UNIFORMS"),
    product('OTHER SHIRT S"', 700, "OTHERS"),
    product('PICKLE JOE SHIRT S" PACK', 700, "OTHERS"),
    product('PICKLE JOE SHIRT KIDS S"', 700, "OTHERS"),
    product("PICKLE JOE SHIRT ONE SIZE", 700, "OTHERS"),
    product("PICKLE JOE CAP", 300, "OTHERS"),
  ];
  assert.deepEqual(groupMenuProductVariants(unrelated), unrelated);
  const shirt = product('PICKLE JOE SHIRT M"', 700, "OTHERS");
  const groups = groupMenuProductVariants([shirt, ...unrelated]);
  assert.equal(groups.length, unrelated.length + 1);
  assert.deepEqual(groups[0].variants, [shirt]);
  unrelated.forEach((item, index) => assert.equal(groups[index + 1], item));
});
