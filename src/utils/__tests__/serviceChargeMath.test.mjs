import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateServiceChargeBase,
  normalizeServiceChargeBasis,
  DEFAULT_SERVICE_CHARGE_BASIS,
  VAT_EXCLUSIVE_LESS_DISCOUNT,
} from "../serviceChargeMath.js";

const item = (selling_price, vatable = "Yes", sales_quantity = 1) => ({
  selling_price, vatable, sales_quantity,
});
const chargeAtFivePercent = (options) =>
  Math.round(calculateServiceChargeBase(options) * 5) / 100;

test("the receipt example gives 74.64 while the default retains 72.96", () => {
  const bill = {
    items: [175, 535, 350, 345, 355].map((price) => item(price)),
    grossTotal: 1760, totalDiscount: 78.57, totalVatExemption: 47.14,
  };
  assert.equal(chargeAtFivePercent(bill), 72.96);
  assert.equal(chargeAtFivePercent({ ...bill, basis: VAT_EXCLUSIVE_LESS_DISCOUNT }), 74.64);
});

test("missing, null, or unsupported settings keep the existing method", () => {
  for (const basis of [undefined, null, "", "unknown", DEFAULT_SERVICE_CHARGE_BASIS]) {
    assert.equal(normalizeServiceChargeBasis(basis), DEFAULT_SERVICE_CHARGE_BASIS);
    assert.equal(chargeAtFivePercent({ basis, grossTotal: 1760, totalDiscount: 100 }), 74.11);
  }
});

test("both methods agree on an undiscounted VAT-inclusive bill", () => {
  for (const basis of [DEFAULT_SERVICE_CHARGE_BASIS, VAT_EXCLUSIVE_LESS_DISCOUNT]) {
    assert.equal(chargeAtFivePercent({ basis, items: [item(1760)], grossTotal: 1760 }), 78.57);
  }
});

test("receipt method deducts the applied discount without a second VAT exemption", () => {
  const basis = VAT_EXCLUSIVE_LESS_DISCOUNT;
  assert.equal(chargeAtFivePercent({
    basis, items: [item(1760)], grossTotal: 1760, totalDiscount: 100,
  }), 73.57);
  assert.equal(chargeAtFivePercent({
    basis, items: [item(1120)], grossTotal: 1120,
    totalDiscount: 200, totalVatExemption: 120,
  }), 40);
});

test("non-VAT and nondiscountable items remain in the receipt charge base", () => {
  const basis = VAT_EXCLUSIVE_LESS_DISCOUNT;
  assert.equal(chargeAtFivePercent({
    basis, items: [item(1120), { ...item(100, "No"), isDiscountable: "No" }],
    grossTotal: 1220,
  }), 55);
  assert.equal(chargeAtFivePercent({ basis, items: [item(100, "No")], grossTotal: 100 }), 5);
});

test("fractional quantities are retained and the base is not rounded prematurely", () => {
  const base = calculateServiceChargeBase({
    basis: VAT_EXCLUSIVE_LESS_DISCOUNT,
    items: [item("3.25", "Yes", "0.5")],
  });
  assert.ok(Math.abs(base - 1.450892857142857) < 1e-12);
});

test("empty, invalid, and fully discounted amounts cannot create negative charges", () => {
  for (const basis of [DEFAULT_SERVICE_CHARGE_BASIS, VAT_EXCLUSIVE_LESS_DISCOUNT]) {
    assert.equal(chargeAtFivePercent({ basis }), 0);
    assert.equal(chargeAtFivePercent({
      basis, items: [item(100)], grossTotal: 100, totalDiscount: 200,
    }), 0);
    assert.equal(chargeAtFivePercent({
      basis, items: [null, item("invalid")], grossTotal: NaN,
      totalDiscount: null, totalVatExemption: Infinity,
    }), 0);
  }
});
