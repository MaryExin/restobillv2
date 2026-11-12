import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDeliveryTime,
  isCashMode,
  isRoomServiceOrder,
  modeNeedsReference,
  openRoomOrderState,
  roomServiceOrderState,
  roomServiceRequestLine,
  validateRoomServiceForm,
} from "../roomServiceUtils.js";

const items = [{ product_id: "BD-1", item_name: "CLUB SANDWICH", quantity: 2, price: 180 }];
const form = { room: "Room 203", guestName: "Maria Santos", deliveryTime: "19:30", paymentMode: "Cash", note: "knock softly", preOrder: { salesType: "ROOM SERVICE", items } };

test("default delivery time is the lead time from now, rounded up to 5 minutes", () => {
  assert.equal(defaultDeliveryTime(new Date(2026, 10, 12, 18, 2), 30), "18:35");
  assert.equal(defaultDeliveryTime(new Date(2026, 10, 12, 23, 50), 15), "00:05");
});

test("the request line carries delivery time, payment mode and the note", () => {
  assert.equal(roomServiceRequestLine(form), "Room service · Deliver at 7:30 PM · Payment: Cash · knock softly");
  assert.equal(roomServiceRequestLine({ deliveryTime: "", paymentMode: "", note: "" }), "Room service");
});

const modes = [{ mop: "Cash", reference_On_Off: 0 }, { mop: "GCash", reference_On_Off: 1 }];

test("online payment modes need a reference number; it is carried on the request line", () => {
  assert.equal(modeNeedsReference(modes, "GCash"), true);
  assert.equal(modeNeedsReference(modes, "cash"), false);
  const online = { ...form, paymentMode: "GCash", paymentReference: "" };
  assert.equal(validateRoomServiceForm(online, modes).paymentReference, "Enter the payment reference number.");
  const withRef = { ...online, paymentReference: "GC-123456" };
  assert.deepEqual(validateRoomServiceForm(withRef, modes), {});
  assert.match(roomServiceRequestLine(withRef), /Payment: GCash \(Ref GC-123456\)/);
  const state = roomServiceOrderState(withRef).reservationOrder;
  assert.deepEqual([state.paymentMode, state.paymentReference], ["GCash", "GC-123456"]);
});

test("cash received is optional, must be positive, and only travels with cash", () => {
  assert.equal(isCashMode("Cash"), true);
  assert.equal(isCashMode("GCash"), false);
  assert.deepEqual(validateRoomServiceForm({ ...form, paymentAmount: "" }), {});
  assert.equal(validateRoomServiceForm({ ...form, paymentAmount: "0" }).paymentAmount, "Cash received must be an amount greater than zero.");
  assert.equal(roomServiceOrderState({ ...form, paymentAmount: "1000" }).reservationOrder.paymentAmount, "1000");
  assert.equal(roomServiceOrderState({ ...form, paymentMode: "GCash", paymentReference: "X1", paymentAmount: "1000" }).reservationOrder.paymentAmount, "");
});

test("validation needs room, guest, time, payment mode and at least one item", () => {
  assert.deepEqual(validateRoomServiceForm(form), {});
  const errors = validateRoomServiceForm({ ...form, room: "", guestName: "M", deliveryTime: "", paymentMode: "", preOrder: { items: [] } });
  assert.deepEqual(Object.keys(errors).sort(), ["deliveryTime", "guestName", "items", "paymentMode", "room"]);
});

test("the hand-off state matches what the ordering screen expects", () => {
  const state = roomServiceOrderState(form).reservationOrder;
  assert.equal(state.table, "Room 203");
  assert.equal(state.guestName, "Maria Santos");
  assert.equal(state.guestCount, 1);
  assert.deepEqual(state.preOrder, { salesType: "ROOM SERVICE", items });
  assert.match(state.specialRequest, /Deliver at 7:30 PM/);
  assert.equal(roomServiceOrderState({ ...form, preOrder: { items: [] } }).reservationOrder.preOrder, null);
});

test("existing orders re-open on their room with the saved guest details", () => {
  const row = { table_number: "Room 203", customer_head_count: "2", guest_name: "Maria", guest_contact: "0917", guest_request: "Room service", order_type: "ROOM SERVICE" };
  assert.equal(isRoomServiceOrder(row), true);
  assert.equal(isRoomServiceOrder({ order_type: "DINE IN" }), false);
  const state = openRoomOrderState(row).reservationOrder;
  assert.deepEqual([state.table, state.guestCount, state.guestName, state.contactNumber, state.preOrder], ["Room 203", 2, "Maria", "0917", null]);
});
