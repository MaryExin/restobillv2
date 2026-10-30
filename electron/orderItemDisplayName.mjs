// Presentation only: retain original SKU names, IDs, prices and quantities in saved data.
const portionTag = /^(.+?)\s+HALF(?:\s+((\d+(?:\.\d+)?)\s*(?:["“”″]|in(?:ch(?:es)?)?\.?)))?$/iu;

export function getOrderItemDisplayName(item) {
  const name = String(
    typeof item === "string" ? item : item?.name ?? item?.item_name ?? "",
  ).trim().replace(/^CCL\b\s*/iu, "");
  const match = name.match(portionTag);
  if (!match || (match[3] !== undefined && !(Number(match[3]) > 0))) return name;
  const base = match[1].trim();
  const size = match[2] ? ` ${match[2]}` : "";
  return `${base}${size} (Combine flavor)`;
}
