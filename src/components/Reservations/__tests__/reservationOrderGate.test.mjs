import assert from "node:assert/strict";
import test from "node:test";
import { reservationOrderBlockedReason, shiftBusinessDateKey } from "../reservationUtils.js";

const booking = { reservation_date: "2026-11-11", table_name: "Room 101" };

test("shiftBusinessDateKey reads the shift's business date from Opening_DateTime", () => {
  assert.equal(shiftBusinessDateKey("2026-11-11 08:15:00"), "2026-11-11");
  assert.equal(shiftBusinessDateKey(" 2026-11-09T22:00:00 "), "2026-11-09");
  assert.equal(shiftBusinessDateKey(""), "");
  assert.equal(shiftBusinessDateKey(null), "");
  assert.equal(shiftBusinessDateKey("11/11/2026"), "");
});

test("an order needs an open shift", () => {
  assert.equal(
    reservationOrderBlockedReason({ shiftOpen: false, shiftDateKey: "", reservation: booking }),
    "Open a new day first to start the order.",
  );
});

test("a reservation is only orderable on the open day, otherwise open that day or reschedule", () => {
  const reason = reservationOrderBlockedReason({ shiftOpen: true, shiftDateKey: "2026-11-09", reservation: booking });
  assert.match(reason, /open day is Nov 9/);
  assert.match(reason, /reservation is for Nov 11/);
  assert.match(reason, /reschedule/i);
  // The same day's shift may run past midnight: the date decides, not the clock.
  assert.equal(reservationOrderBlockedReason({ shiftOpen: true, shiftDateKey: "2026-11-11", reservation: booking }), "");
});

test("the room is checked after the day", () => {
  const noRoom = { reservation_date: "2026-11-11", table_name: "" };
  assert.equal(
    reservationOrderBlockedReason({ shiftOpen: true, shiftDateKey: "2026-11-11", reservation: noRoom }),
    "Assign a room first (Edit) to start the order.",
  );
  assert.match(
    reservationOrderBlockedReason({ shiftOpen: true, shiftDateKey: "2026-11-10", reservation: noRoom }),
    /open day is Nov 10/,
  );
});
