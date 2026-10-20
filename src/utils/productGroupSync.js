const owns = (row, key) => Boolean(row && Object.prototype.hasOwnProperty.call(row, key));
const flag = (value) => [true, 1, "1", "true"].includes(value);
const text = (value) => String(value ?? "").trim();

export const productGroupSyncFields = (row) => ({
  ...(owns(row, "product_group") ? {
  product_group: row.product_group,
  group_size: row.group_size || "",
  group_variant: row.group_variant || "",
  ...(owns(row, "group_sizes") ? { group_sizes: row.group_sizes } : {}),
  ...(row.group_price_error ? { group_price_error: row.group_price_error } : {}),
} : {}),
  ...(owns(row, "group_alias") ? { group_alias: row.group_alias } : {}),
});

const comparableSizes = (sizes) => (sizes || []).map((size) => ({
  size_id: text(size.size_id), size_name: text(size.size_name), enabled: flag(size.enabled), recipe_configured: flag(size.recipe_configured),
  prices: (size.prices || []).map((p) => ({ pricing_category: text(p.pricing_category), srp: Number(p.srp), cost_per_uom: Number(p.cost_per_uom) })).sort((a,b) => a.pricing_category.localeCompare(b.pricing_category)),
  components: (size.components || []).map((c) => ({ component_code: text(c.component_code), component_class: text(c.component_class), qty: Number(c.qty), description: text(c.description), uom: text(c.uom), uomval: Number(c.uomval), category: text(c.category), cost_per_uom: Number(c.cost_per_uom) })).sort((a,b) => `${a.component_class}|${a.component_code}`.localeCompare(`${b.component_class}|${b.component_code}`)),
}));

const comparable = (row) => ({
  enabled: flag(row?.product_group?.enabled),
  name: text(row?.product_group?.name),
  size: text(row?.group_size),
  sizes: owns(row, "group_sizes") ? comparableSizes(row.group_sizes) : null,
  variant: text(row?.group_variant),
  allow_half: flag(row?.product_group?.allow_half),
  allow_half_and_half: flag(row?.product_group?.allow_half_and_half),
});

const comparableAlias = (row) => row?.group_alias ? { canonical_build_code: text(row.group_alias.canonical_build_code), size_id: text(row.group_alias.size_id), enabled: flag(row.group_alias.enabled) } : null;

export const hasProductGroupChange = (online, offline) =>
  (owns(online, "product_group") && JSON.stringify(comparable(online)) !== JSON.stringify(comparable(offline))) ||
  (owns(online, "group_alias") && JSON.stringify(comparableAlias(online)) !== JSON.stringify(comparableAlias(offline)));

export const productGroupSyncDescription = (row) => {
  if (row?.group_alias?.enabled) return `Mapped to ${row.group_alias.canonical_build_code}${row.group_alias.size_id ? ` / ${row.group_alias.size_id}` : ""}`;
  if (!owns(row, "product_group")) return owns(row, "group_alias") ? "Mapping off" : "Not supplied";
  const config = comparable(row);
  if (!config.name) return "Off";
  return `${config.enabled ? "On" : "Off"} · ${[config.name, config.sizes ? config.sizes.map((s) => s.size_name).join(", ") : config.size, config.variant].filter(Boolean).join(" / ")}` +
    `${config.allow_half ? " · Half allowed" : ""}${config.allow_half_and_half ? " · Two variants allowed" : ""}`;
};

export const productSyncAction = (diff, localPricing) => !localPricing ? "new_product"
  : diff.price_changed || diff.cost_changed ? "price_change"
    : diff.group_changed ? "group_change" : "no_price_change";
