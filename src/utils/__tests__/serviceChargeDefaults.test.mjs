import test from "node:test";
import assert from "node:assert/strict";
import { buildInitialServiceChargeToggles } from "../serviceChargeDefaults.js";

const dineIn = { ID: 1, particulars: "Service Charge", is_enabled: 1, auto_sales_types: ["DINE IN"] };
const takeaway = { ID: 2, particulars: "Packaging", is_enabled: 1, auto_sales_types: ["TAKE OUT", "GRAB"] };
const defaults = (transaction = {}, rows = [], charges = [dineIn, takeaway]) =>
  buildInitialServiceChargeToggles(charges, rows, transaction);

test("new bills enable only charges assigned to the current service type", () => {
  assert.deepEqual(defaults({ order_type: " Dine  In ", billing_no: "0", invoice_no: 0 }), { 1: true, 2: false });
  assert.deepEqual(defaults({ order_type: "take out" }), { 1: false, 2: true });
  assert.deepEqual(defaults({ order_type: "GRAB" }), { 1: false, 2: true });
  assert.deepEqual(defaults({ order_type: "DELIVERY" }), { 1: false, 2: false });
  assert.deepEqual(defaults(), { 1: false, 2: false });
});

test("unassigned, disabled and malformed mappings keep the manual default", () => {
  for (const charge of [
    { ...dineIn, auto_sales_types: undefined },
    { ...dineIn, auto_sales_types: null },
    { ...dineIn, auto_sales_types: [] },
    { ...dineIn, auto_sales_types: "DINE IN" },
    { ...dineIn, is_enabled: 0 },
    { ...dineIn, is_enabled: "0" },
  ]) assert.deepEqual(defaults({ order_type: "DINE IN" }, [], [charge]), { 1: false });
});

test("saved billing and invoice numbers preserve an OFF selection even with zero saved rows", () => {
  for (const document of [{ billing_no: "30001" }, { invoice_no: 40001 }, { billing_no: "SPLIT-BILL" }]) {
    assert.deepEqual(defaults({ order_type: "DINE IN", ...document }), { 1: false, 2: false });
  }
});

test("saved AUTO selections take priority over changed assignments and do not enable extra defaults", () => {
  const rows = [{ reference: "AUTO", particulars: " service charge " }];
  assert.deepEqual(defaults({ order_type: "TAKE OUT" }, rows), { 1: true, 2: false });
  assert.deepEqual(defaults({ order_type: "DINE IN" }, [{ reference: "MANUAL", particulars: "Private room" }]), { 1: true, 2: false });
  assert.deepEqual(defaults({ order_type: "DINE IN" }, [{ reference: "AUTO", particulars: "Corkage" }]), { 1: false, 2: false });
});
