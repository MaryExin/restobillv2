export const DEFAULT_SERVICE_CHARGE_BASIS = "net_after_deductions";
export const VAT_EXCLUSIVE_LESS_DISCOUNT = "vat_exclusive_less_discount";

export const normalizeServiceChargeBasis = (value) =>
  value === VAT_EXCLUSIVE_LESS_DISCOUNT
    ? VAT_EXCLUSIVE_LESS_DISCOUNT
    : DEFAULT_SERVICE_CHARGE_BASIS;

const finiteNumber = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export function calculateServiceChargeBase({
  basis,
  items = [],
  grossTotal = 0,
  totalDiscount = 0,
  totalVatExemption = 0,
}) {
  const discount = Math.max(finiteNumber(totalDiscount), 0);

  if (normalizeServiceChargeBasis(basis) === VAT_EXCLUSIVE_LESS_DISCOUNT) {
    // Remove VAT from each VAT-inclusive item before deducting discounts.
    // The VAT exemption is already excluded here; do not subtract it again.
    const vatExclusiveSubtotal = (Array.isArray(items) ? items : []).reduce(
      (sum, item) => {
        const lineTotal =
          finiteNumber(item?.sales_quantity) * finiteNumber(item?.selling_price);
        const isVatable = String(item?.vatable ?? "").trim().toLowerCase() === "yes";
        return sum + (isVatable ? lineTotal / 1.12 : lineTotal);
      },
      0,
    );
    return Math.max(vatExclusiveSubtotal - discount, 0);
  }

  // Preserve the existing computation for installations without the new setting.
  return Math.max(
    finiteNumber(grossTotal) - discount - Math.max(finiteNumber(totalVatExemption), 0),
    0,
  ) / 1.12;
}
