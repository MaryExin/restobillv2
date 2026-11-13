import assert from "node:assert/strict";
import test from "node:test";
import { canUseQrTable, createQrRequestId, estimateQrTotals, getQrContinuationProof, mergeQrReceiptUpdates, prepareQrSubmission, qrReceiptsToRefresh, qrRunningTotal, readQrDraft, writeQrDraft } from "../qrOrderDraft.js";

const draft = { order_type: "DINE IN", table_number: "Table 01", customer_name: " Ana ", customer_head_count: "2", notes: " No rush ", items: [{ product_id: "BD-one", item_name: "Dish", selling_price: 1, quantity: 2, item_instruction: " Mild " }] };

test("LAN HTTP browser without randomUUID gets a cryptographic UUID v4", () => {
  const id = createQrRequestId({ getRandomValues: (bytes) => bytes.fill(255) });
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test("submission omits browser prices and uses verified API keys", () => {
  assert.deepEqual(prepareQrSubmission(draft, null, () => "id-1"), {
    request_id: "id-1", order_type: "DINE IN", table_number: "Table 01", customer_name: "Ana", customer_head_count: 2, notes: "No rush", items: [{ product_id: "BD-one", quantity: 2, item_instruction: "Mild" }],
  });
});

test("uncertain submissions retain exact request and id across storage/reload", () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) };
  const attempt = prepareQrSubmission(draft, null, () => "original-id");
  assert.equal(writeQrDraft(storage, "draft", { ...draft, attempt }), true);
  const restored = readQrDraft(storage, "draft");
  const retry = prepareQrSubmission({ ...draft, notes: "changed" }, restored.attempt, () => { throw new Error("must not regenerate"); });
  assert.deepEqual(retry, attempt);
});

test("take out never sends a leftover dine-in table", () => {
  assert.equal(prepareQrSubmission({ ...draft, order_type: "TAKE OUT" }, null, () => "id").table_number, "");
});

test("storage failure blocks persistence and malformed drafts recover safely", () => {
  assert.equal(writeQrDraft({ setItem() { throw new Error("denied"); } }, "draft", draft), false);
  assert.deepEqual(readQrDraft({ getItem: () => "bad json" }, "draft", "Table 02").items, []);
  assert.equal(readQrDraft({ getItem: () => null }, "draft", "Table 02").table_number, "Table 02");
});

test("service charge uses the POS VAT-exclusive basis and configured fixed charges", () => {
  const totals = estimateQrTotals(
    [{ product_id: "vat", quantity: 2 }, { product_id: "exempt", quantity: 1 }],
    [{ product_id: "vat", selling_price: 112, vatable: "Yes" }, { product_id: "exempt", selling_price: 100, vatable: "No" }],
    { enabled: true, basis: "vat_exclusive_less_discount", charges: [{ particulars: "Service", amount: 10, rate_type: "Percentage" }, { particulars: "Setup", amount: 5, rate_type: "Fixed" }] },
  );
  assert.equal(totals.subtotal, 324);
  assert.equal(totals.serviceAmount, 35);
  assert.equal(totals.total, 359);
});

test("legacy service charge basis matches POS and disabled/empty orders have no charges", () => {
  const config = { enabled: true, basis: "net_after_deductions", charges: [{ particulars: "Service", amount: 10, rate_type: "Percentage" }] };
  const products = [{ product_id: "a", selling_price: 112, vatable: "No" }];
  assert.equal(estimateQrTotals([{ product_id: "a", quantity: 1 }], products, config).total, 122);
  assert.equal(estimateQrTotals([{ product_id: "a", quantity: 1 }], products, { ...config, enabled: false }).total, 112);
  assert.equal(estimateQrTotals([], products, { ...config, charges: [{ amount: 5, rate_type: "Fixed" }] }).total, 0);
});

test("orders history and table/pax survive reload, unresolved attempt returns to review", () => {
  const receipt = { order_id: "order-1", tracking_token: "secret", status: "pending", total_amount: 100 };
  const saved = { ...draft, stage: "menu", history: [{ receipt, items: draft.items }], attempt: { request_id: "id" } };
  const restored = readQrDraft({ getItem: () => JSON.stringify(saved) }, "draft");
  assert.equal(restored.stage, "review");
  assert.equal(restored.history[0].receipt.order_id, "order-1");
  assert.equal(restored.table_number, "Table 01");
  assert.equal(restored.customer_head_count, "2");
});

test("subtotal rounds each priced line consistently with the PHP receipt", () => {
  const totals = estimateQrTotals([{ product_id: "a", quantity: 1 }, { product_id: "b", quantity: 1 }], [{ product_id: "a", selling_price: 10.004 }, { product_id: "b", selling_price: 10.004 }]);
  assert.equal(totals.subtotal, 20);
});

const historyOrder = (id, status, transaction_id = null, state = null, total_amount = 100) => ({
  order_type: "DINE IN", table_number: "Table 01", items: draft.items,
  receipt: { order_id: id, tracking_token: `token-${id}`, status, transaction_id, transaction_state: state, total_amount },
});

test("occupied tables require current server-granted continuation, not a saved table string", () => {
  const catalog = { tables: [{ table_name: "Table 01", available: false, occupied: true, can_continue: false }] };
  assert.equal(canUseQrTable(catalog, "DINE IN", "Table 01"), false);
  assert.equal(canUseQrTable({ tables: [{ table_name: "Table 01" }] }, "DINE IN", "Table 01"), false);
  assert.equal(canUseQrTable({ tables: [{ ...catalog.tables[0], can_continue: true }] }, "DINE IN", "Table 01"), true);
  assert.equal(canUseQrTable({ tables: [{ ...catalog.tables[0], available: true, occupied: false }] }, "DINE IN", "Table 01"), true);
  assert.equal(canUseQrTable(catalog, "TAKE OUT", ""), true);
});

test("only the latest accepted receipt for this table supplies continuation proof", () => {
  const history = [historyOrder("old", "accepted", 1, "paid"), historyOrder("new", "accepted", 2, "open"), historyOrder("pending", "pending")];
  const proof = getQrContinuationProof({ ...draft, history });
  assert.deepEqual(proof, { continuation_order_id: "new", continuation_tracking_token: "token-new" });
  assert.deepEqual(getQrContinuationProof({ ...draft, history, table_number: "Table 02" }), {});
  assert.deepEqual(getQrContinuationProof({ ...draft, history, order_type: "TAKE OUT" }), {});
  assert.deepEqual(getQrContinuationProof({ ...draft, history: [historyOrder("pending", "pending")] }), {});
  assert.equal(getQrContinuationProof({ ...draft, history: [history[0]] }).continuation_order_id, "old");
});

test("new submit carries receipt proof while retry keeps original proof after later acceptance", () => {
  const first = { ...draft, history: [historyOrder("first", "accepted", 10, "open")] };
  const attempt = prepareQrSubmission(first, null, () => "request");
  assert.equal(attempt.continuation_order_id, "first");
  const changed = { ...first, history: [...first.history, historyOrder("second", "accepted", 10, "open")] };
  assert.strictEqual(prepareQrSubmission(changed, attempt), attempt);
  assert.equal(prepareQrSubmission(changed, attempt).continuation_order_id, "first");
});

test("one paid receipt settles all batches on its shared bill and excludes old visit totals", () => {
  const history = [historyOrder("one", "accepted", 10, "open", 100), historyOrder("two", "accepted", 10, "open", 200), historyOrder("next", "pending", null, null, 50), historyOrder("no", "rejected", null, null, 99)];
  const updated = mergeQrReceiptUpdates(history, [{ order_id: "two", status: "accepted", transaction_id: 10, transaction_state: "paid", can_continue: false }]);
  assert.deepEqual(updated.slice(0, 2).map((order) => order.receipt.transaction_state), ["paid", "paid"]);
  assert.equal(updated[0].receipt.total_amount, 100);
  assert.equal(updated[1].receipt.total_amount, 200);
  assert.equal(qrRunningTotal(updated), 50);
});

test("fresh menu continuation state settles matching history; older responses cannot reopen it", () => {
  const history = [historyOrder("one", "accepted", "10", "open")];
  const paid = mergeQrReceiptUpdates(history, [], { order_id: "one", transaction_state: "paid", can_continue: false });
  const stale = mergeQrReceiptUpdates(paid, [{ order_id: "one", status: "accepted", transaction_state: "open", can_continue: true }]);
  assert.equal(stale[0].receipt.transaction_state, "paid");
  assert.equal(stale[0].receipt.can_continue, false);
  assert.equal(mergeQrReceiptUpdates(stale, [{ order_id: "one", status: "pending" }])[0].receipt.status, "accepted");
});

test("status refresh groups accepted batches per open bill and stops polling settled bills", () => {
  const history = [historyOrder("one", "accepted", 10, "open"), historyOrder("two", "accepted", 10, "open"), historyOrder("paid", "accepted", 11, "paid"), historyOrder("closed", "accepted", 12, "closed"), historyOrder("pending", "pending")];
  assert.deepEqual(qrReceiptsToRefresh(history).map((receipt) => receipt.order_id), ["two", "pending"]);
});
