// Shared discount-line math for /printbilling (ModalDiscountTransaction.jsx)
// and /payments (TransactionPaymentModal.jsx). Both screens let a cashier add
// discount lines (Senior Citizen, PWD, NAAC, Solo Parent, or any custom type
// configured in Settings > Discount Mode > Discount Types) via the same
// "+ Add Discount" picker, each carrying its own percent and VAT-exempt flag
// from lkp_discount_type / tbl_pos_discount_type_sales_type.
//
// VAT-exemption note: for any VAT-exempt discount, vatExemption is always
// `proratedBase * 0.12` regardless of the discount's own percent -- this is
// the same relationship the old hardcoded Senior/PWD/NAAC (20%, vatEx =
// discount * 0.6) and Solo Parent (10%, vatEx = discount * 1.2) math reduced
// to; 0.6 = 0.12/0.2 and 1.2 = 0.12/0.1.

export const prorateDiscountBase = (discountBase, count, sharingMode, safeCustomerCount) => {
  const safeCount = Math.max(Number(count) || 0, 0);
  if (sharingMode === "solo") {
    return discountBase * safeCount;
  }
  return safeCustomerCount > 0 ? discountBase * (safeCount / safeCustomerCount) : 0;
};

// line: { calculation_type: "percentage"|"fixed", is_vat_exempt, percent, manualAmount }
export const computeDiscountLine = (line, proratedBase) => {
  const percent = Number(line?.percent || 0);
  const isVatExempt = !!line?.is_vat_exempt;

  if (line?.calculation_type === "fixed") {
    // Flat peso amount off, not tied to a qualified-customer proration.
    // None of today's fixed-type discount types are VAT-exempt.
    return {
      discountAmount: Math.max(Number(line?.manualAmount || 0), 0),
      vatExemption: 0,
    };
  }

  return {
    discountAmount: proratedBase * (percent / 100),
    vatExemption: isVatExempt ? proratedBase * 0.12 : 0,
  };
};

// Reuse a discount amount already saved (e.g. during Print Billing) when the
// qualified count for this line's label still matches what was stored,
// instead of recomputing from the live prorated base -- mirrors the
// per-type `useStoredSenior`/`useStoredPwd`/etc. checks that used to be
// hardcoded for just the 4 statutory types.
export const resolveDiscountLineAmount = ({
  label,
  qualifiedCount,
  line,
  proratedBase,
  storedCountsByLabel,
}) => {
  const percent = Number(line?.percent || 0);
  const isVatExempt = !!line?.is_vat_exempt;
  const stored = storedCountsByLabel?.[label];

  const canReuseStored =
    line?.calculation_type !== "fixed" &&
    stored &&
    Number(qualifiedCount) > 0 &&
    Number(stored.count) === Number(qualifiedCount) &&
    Number(stored.amount) > 0;

  if (canReuseStored) {
    const discountAmount = Number(stored.amount);
    const vatExemption =
      isVatExempt && percent > 0 ? discountAmount * (0.12 / (percent / 100)) : 0;
    return { discountAmount, vatExemption };
  }

  return computeDiscountLine(line, proratedBase);
};
