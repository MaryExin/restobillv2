// Suggested per-product options (e.g. BANGSILOG -> Milkfish / Rice / Egg).
// The cashier's picks are written into the order line's special instruction
// as "Group: choice | Group: choice" so printing, saving and the kitchen
// ticket need no changes. Only choices that differ from the group's default
// are written (the default is the standard way to serve).

export const GROUP_SEPARATOR = " | ";
export const VALUE_SEPARATOR = ", ";

export const productOptionsEndpoint = (apiHost) =>
  `${apiHost || ""}${import.meta.env.VITE_POS_PRODUCT_OPTIONS_ENDPOINT || "/api/pos_product_options.php"}`;

const tidy = (value) => String(value ?? "").trim();
const categoryKey = (value) => tidy(value).toUpperCase();

export function normalizeOptionGroups(raw) {
  if (!Array.isArray(raw)) return [];
  const groups = [];
  raw.forEach((group) => {
    const name = tidy(group?.group_name);
    const options = Array.isArray(group?.options)
      ? Array.from(new Set(group.options.map(tidy).filter(Boolean)))
      : [];
    if (!name || options.length === 0) return;
    const selectType = tidy(group?.select_type).toLowerCase() === "multi" ? "multi" : "single";
    const defaultOption = tidy(group?.default_option);
    groups.push({
      group_name: name,
      select_type: selectType,
      options,
      default_option: selectType === "single" && options.includes(defaultOption) ? defaultOption : "",
    });
  });
  return groups;
}

/** { [group_name]: "choice" } for single groups, { [group_name]: [] } for multi. */
export function defaultOptionSelections(groups) {
  const selections = {};
  (groups || []).forEach((group) => {
    selections[group.group_name] = group.select_type === "multi" ? [] : group.default_option || "";
  });
  return selections;
}

/** "Milkfish (bangus): Crispy | Egg: Scrambled" — default choices are left out. */
export function optionSummaryLine(groups, selections) {
  const parts = [];
  (groups || []).forEach((group) => {
    const picked = selections?.[group.group_name];
    if (group.select_type === "multi") {
      const values = (Array.isArray(picked) ? picked : []).filter((value) => group.options.includes(value));
      if (values.length) parts.push(`${group.group_name}: ${values.join(VALUE_SEPARATOR)}`);
      return;
    }
    const value = tidy(picked);
    if (value && value !== group.default_option && group.options.includes(value)) {
      parts.push(`${group.group_name}: ${value}`);
    }
  });
  return parts.join(GROUP_SEPARATOR);
}

export function composeOptionInstruction(groups, selections, freeText) {
  return [optionSummaryLine(groups, selections), tidy(freeText)].filter(Boolean).join("\n");
}

/**
 * Splits a saved instruction back into chip selections and free text.
 * Lines made only of "Known group: value" segments become selections;
 * anything else stays as free text.
 */
export function parseOptionInstruction(groups, instruction) {
  const selections = defaultOptionSelections(groups);
  const byName = new Map((groups || []).map((group) => [group.group_name.toLowerCase(), group]));
  const freeLines = [];

  String(instruction ?? "")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (byName.size === 0) {
        freeLines.push(trimmed);
        return;
      }
      const segments = trimmed.split(GROUP_SEPARATOR);
      const parsed = [];
      const allKnown = segments.every((segment) => {
        const index = segment.indexOf(": ");
        if (index < 1) return false;
        const group = byName.get(segment.slice(0, index).trim().toLowerCase());
        if (!group) return false;
        parsed.push([group, segment.slice(index + 2).trim()]);
        return true;
      });
      if (!allKnown) {
        freeLines.push(trimmed);
        return;
      }
      parsed.forEach(([group, value]) => {
        if (group.select_type === "multi") {
          selections[group.group_name] = value
            .split(VALUE_SEPARATOR)
            .map(tidy)
            .filter((item) => group.options.includes(item));
        } else if (group.options.includes(value)) {
          selections[group.group_name] = value;
        }
      });
    });

  return { selections, freeText: freeLines.join("\n") };
}

/**
 * Maps from the GET-all response: a product's own groups (byProduct) and the
 * category defaults (byCategory, keyed by upper-cased category name).
 */
export function buildOptionMaps(data) {
  const byProduct = {};
  const byCategory = {};
  const options = data?.options && typeof data.options === "object" ? data.options : {};
  Object.entries(options).forEach(([productId, groups]) => {
    const normalized = normalizeOptionGroups(groups);
    if (normalized.length) byProduct[String(productId)] = normalized;
  });
  const categories = data?.category_options && typeof data.category_options === "object" ? data.category_options : {};
  Object.entries(categories).forEach(([category, groups]) => {
    const normalized = normalizeOptionGroups(groups);
    if (normalized.length) byCategory[categoryKey(category)] = normalized;
  });
  return { byProduct, byCategory };
}

/** A product's own groups, else its category's defaults, else []. */
export function resolveOptionGroups(maps, productId, itemCategory) {
  if (!maps) return [];
  return (
    maps.byProduct?.[String(productId ?? "")] ||
    maps.byCategory?.[categoryKey(itemCategory)] ||
    []
  );
}
