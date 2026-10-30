const normalizeName = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const hasDocumentNumber = (value) => {
  const number = String(value ?? "").trim();
  return number !== "" && Number(number) !== 0;
};

// Defaults apply only to a new bill. A saved bill with no charge rows means
// the cashier chose OFF, so reopening it must not enable the charge again.
export function buildInitialServiceChargeToggles(charges, savedCharges, transaction = {}) {
  const savedNames = new Set((Array.isArray(savedCharges) ? savedCharges : [])
    .filter((row) => normalizeName(row.reference) === "AUTO")
    .map((row) => normalizeName(row.particulars)));
  const hasSavedBill = hasDocumentNumber(transaction.billing_no)
    || hasDocumentNumber(transaction.invoice_no)
    || savedNames.size > 0;
  const orderType = normalizeName(transaction.order_type);

  return Object.fromEntries((Array.isArray(charges) ? charges : []).map((charge) => {
    const automaticallyEnabled = !hasSavedBill && orderType !== ""
      && Number(charge.is_enabled) === 1
      && Array.isArray(charge.auto_sales_types)
      && charge.auto_sales_types.some((type) => normalizeName(type) === orderType);
    return [Number(charge.ID), savedNames.has(normalizeName(charge.particulars)) || automaticallyEnabled];
  }));
}
