// Optional guest details on an order: name, contact number, special request.
// Asked when an order is started (walk-ins) or copied from the reservation,
// saved on the transaction (guest_name / guest_contact / guest_request) and
// printed on the kitchen ticket, bill/folio and receipt.

const tidy = (value) => String(value ?? "").trim();

// paymentMode / paymentReference: the mode of payment (and reference number
// for online, card or gift-certificate payments) taken with a room-service
// order; the payment screen starts with them.
export const EMPTY_GUEST = { name: "", contact: "", request: "", paymentMode: "", paymentReference: "", paymentAmount: "" };

/** Accepts {name, contact, request} or a transaction row with guest_* keys. */
export function normalizeGuestInfo(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY_GUEST };
  return {
    name: tidy(raw.name ?? raw.guest_name).slice(0, 150),
    contact: tidy(raw.contact ?? raw.guest_contact).slice(0, 30),
    request: tidy(raw.request ?? raw.guest_request).slice(0, 500),
    paymentMode: tidy(raw.paymentMode ?? raw.guest_payment_mode).slice(0, 60),
    paymentReference: tidy(raw.paymentReference ?? raw.guest_payment_reference).slice(0, 100),
    // Cash received at the front desk (room service), so the change shows at payment.
    paymentAmount: tidy(raw.paymentAmount ?? raw.guest_payment_amount).slice(0, 20),
  };
}

export const hasGuestInfo = (guest) => Boolean(guest && (guest.name || guest.contact || guest.request));

/** "Juan Dela Cruz · 0917 123 4567 — window seat" for order headers. */
export function guestHeaderLine(guest) {
  const info = normalizeGuestInfo(guest);
  const who = [info.name, info.contact].filter(Boolean).join(" · ");
  return [who, info.request].filter(Boolean).join(" — ");
}

/** "Deliver at 7:30 PM" taken from a room-service order's request line, or "". */
export function deliveryNoteFromRequest(request) {
  const match = /deliver(?:y)?\s+(?:at|by)\s+([^\u00b7|\n]+)/i.exec(String(request ?? ""));
  return match ? `Deliver at ${match[1].trim()}` : "";
}

export const isRoomServiceOrderType = (orderType) =>
  String(orderType ?? "").trim().toUpperCase() === "ROOM SERVICE";

/**
 * Detail shown on an occupied room card when its order is a room-service
 * delivery: "Room service · Deliver at 7:30 PM" (plus the guest's first name
 * when withGuest is set). "" for every other order.
 */
export function roomServiceCardNote(table, withGuest = false) {
  const request = tidy(table?.guest_request);
  if (!isRoomServiceOrderType(table?.order_type) && !/^room service\b/i.test(request)) return "";
  const parts = ["Room service"];
  const when = deliveryNoteFromRequest(table?.guest_request);
  if (when) parts.push(when);
  const firstName = withGuest ? tidy(table?.guest_name).split(/\s+/)[0] : "";
  if (firstName) parts.push(firstName);
  return parts.join(" · ");
}
