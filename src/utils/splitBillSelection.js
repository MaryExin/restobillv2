const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Detail IDs distinguish identical products with different instructions/prices.
export function getSplitBillSelection(items, quantities) {
  const selected = [];
  let movedSubtotal = 0;
  let remainingSubtotal = 0;
  let remainingQuantity = 0;
  let error = "";

  for (const item of items) {
    const id = String(item.ID);
    const available = Number(item.sales_quantity);
    const price = Number(item.selling_price);
    const isSelected = Object.prototype.hasOwnProperty.call(quantities, id);
    const raw = isSelected ? String(quantities[id]).trim() : "0";
    const quantity = Number(raw);
    if (!Number.isFinite(available) || available <= 0 || !Number.isFinite(price) || price < 0) {
      error = "Some order details cannot be split. Refresh the items and try again.";
      continue;
    }
    if (isSelected && (!/^\d+(?:\.\d{1,4})?$/.test(raw) || !Number.isFinite(quantity)
      || quantity <= 0 || quantity > available)) {
      error = "Enter a quantity above zero, up to the available amount, with at most 4 decimal places.";
      remainingSubtotal += available * price;
      remainingQuantity += Math.round(available * 10000);
      continue;
    }
    const left = (Math.round(available * 10000) - Math.round(quantity * 10000)) / 10000;
    // Match billing/backend totals: sum full-precision lines, then round once.
    movedSubtotal += quantity * price;
    remainingSubtotal += left * price;
    remainingQuantity += Math.round(left * 10000);
    if (isSelected) selected.push({ detail_id: item.ID, quantity });
  }

  if (!error && !selected.length) error = "Select at least one item to move to the new bill.";
  if (!error && remainingQuantity <= 0) error = "Keep at least one item or part of its quantity on the original bill.";
  return { items: selected, movedSubtotal: money(movedSubtotal), remainingSubtotal: money(remainingSubtotal), error };
}
