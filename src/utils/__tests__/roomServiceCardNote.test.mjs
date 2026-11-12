import assert from "node:assert/strict";
import test from "node:test";
import { deliveryNoteFromRequest, isRoomServiceOrderType, roomServiceCardNote } from "../guestInfo.js";

test("the delivery time is read from the room-service request line", () => {
  assert.equal(deliveryNoteFromRequest("Room service · Deliver at 7:30 PM · Payment: Cash · knock softly"), "Deliver at 7:30 PM");
  assert.equal(deliveryNoteFromRequest("Deliver by 9:00 AM | extra towels"), "Deliver at 9:00 AM");
  assert.equal(deliveryNoteFromRequest("window seat"), "");
  assert.equal(deliveryNoteFromRequest(null), "");
});

test("only room-service orders get a card note", () => {
  assert.equal(isRoomServiceOrderType("room service"), true);
  assert.equal(isRoomServiceOrderType("DINE IN"), false);
  const table = { order_type: "ROOM SERVICE", guest_request: "Room service · Deliver at 7:30 PM · Payment: Cash", guest_name: "Maria Santos" };
  assert.equal(roomServiceCardNote(table), "Room service · Deliver at 7:30 PM");
  assert.equal(roomServiceCardNote(table, true), "Room service · Deliver at 7:30 PM · Maria");
  assert.equal(roomServiceCardNote({ order_type: "ROOM SERVICE", guest_request: "" }), "Room service");
  assert.equal(roomServiceCardNote({ order_type: "DINE IN", guest_request: "Deliver at 7:30 PM" }), "");
  // Saved under another sales type but requested as room service: still shown.
  assert.equal(roomServiceCardNote({ order_type: "DINE IN", guest_request: "Room service · Deliver at 11:55 AM · Payment: Cash" }), "Room service · Deliver at 11:55 AM");
  assert.equal(roomServiceCardNote(null), "");
});
