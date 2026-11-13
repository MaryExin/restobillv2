import assert from "node:assert/strict";
import test from "node:test";
import { refreshQrGuestMenu, requestQrGuest } from "../useQrGuestApi.js";

test("preflight verifies a newly accepted first batch before asking to continue its occupied table", async () => {
  const calls = [];
  const draft = { order_type: "DINE IN", table_number: "Table 01", history: [{ order_type: "DINE IN", table_number: "Table 01", items: [], receipt: { order_id: "first", tracking_token: "proof", status: "pending" } }] };
  const request = async (action, options) => {
    calls.push({ action, params: options.params });
    if (action === "status") return { order_id: "first", status: "accepted", transaction_id: "100", transaction_state: "open" };
    return { products: [], order_types: ["DINE IN"], tables: [{ table_name: "Table 01", available: false, can_continue: true }], continuation: { order_id: "first", transaction_state: "open", can_continue: true } };
  };
  const fresh = await refreshQrGuestMenu(draft, { refreshPending: true, request });
  assert.deepEqual(calls, [
    { action: "status", params: { order_id: "first", tracking_token: "proof" } },
    { action: "menu", params: { order_type: "DINE IN", continuation_order_id: "first", continuation_tracking_token: "proof" } },
  ]);
  assert.equal(fresh.history[0].receipt.status, "accepted");
  assert.equal(fresh.history[0].receipt.tracking_token, "proof");
});

test("pending order alone supplies no continuation capability for occupied tables", async () => {
  const draft = { order_type: "DINE IN", table_number: "Table 01", history: [{ order_type: "DINE IN", table_number: "Table 01", items: [], receipt: { order_id: "first", tracking_token: "proof", status: "pending" } }] };
  const request = async (action, options) => {
    if (action === "status") return { order_id: "first", status: "pending" };
    assert.deepEqual(options.params, { order_type: "DINE IN" });
    return { products: [], order_types: ["DINE IN"], tables: [{ table_name: "Table 01", available: false, can_continue: false }] };
  };
  const fresh = await refreshQrGuestMenu(draft, { refreshPending: true, request });
  assert.equal(fresh.data.tables[0].can_continue, false);
});

test("safe pre-create conflicts retain their machine code without treating idempotency conflicts as safe", async (context) => {
  context.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 409, json: async () => ({ success: false, code: "TABLE_UNAVAILABLE", message: "Table is occupied." }) }));
  await assert.rejects(requestQrGuest("submit", { body: { request_id: "one" } }), (error) => error.status === 409 && error.code === "TABLE_UNAVAILABLE");
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ success: false, message: "Different request payload." }) });
  await assert.rejects(requestQrGuest("submit", { body: { request_id: "one" } }), (error) => error.status === 409 && error.code === undefined);
});
