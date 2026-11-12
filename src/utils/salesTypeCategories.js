// Menu sections per sales type.
// new_transactions.php returns item_categories_by_sales_type:
//   { [sales_type_id]: ["APPETIZERS", "MAINS", ...] }
// listing only categories that have priced, active products in that sales type.

const normalize = (value) => String(value ?? "").trim().toUpperCase();

// Returns { [sales_type_id]: Set<CATEGORY> }, or null when the backend did not
// send the map (older API) so callers can fall back to showing every category.
export function buildCategoryMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = {};
  Object.entries(raw).forEach(([salesTypeId, categories]) => {
    if (Array.isArray(categories)) {
      map[String(salesTypeId)] = new Set(categories.map(normalize));
    }
  });
  return map;
}

export function filterCategoriesForSalesType(categories, categoryMap, salesTypeId) {
  const list = Array.isArray(categories) ? categories : [];
  if (!categoryMap || !salesTypeId) return list;
  const allowed = categoryMap[String(salesTypeId)];
  if (!allowed) return [];
  return list.filter((category) => allowed.has(normalize(category?.item_category)));
}

export function isCategoryInList(categories, name) {
  const target = normalize(name);
  return (Array.isArray(categories) ? categories : []).some(
    (category) => normalize(category?.item_category) === target,
  );
}
