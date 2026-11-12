// Room Service: a front-desk quick order — room number, guest name, delivery
// time, mode of payment and the items. It hands the order to the ordering
// screen (the same hand-off the Reservations "Order" button uses), so the
// kitchen ticket, bill / folio and customer registry work like any order.
import { formatTimeLabel } from "../Reservations/reservationUtils.js";

export const ROOM_SERVICE_SALES_TYPE = "ROOM SERVICE";

export const EMPTY_ROOM_SERVICE_FORM = {
  room: "",
  guestName: "",
  deliveryTime: "",
  paymentMode: "",
  paymentReference: "",
  paymentAmount: "",
  note: "",
  preOrder: { salesType: ROOM_SERVICE_SALES_TYPE, items: [] },
};

const pad = (value) => String(value).padStart(2, "0");

/** "HH:MM" leadMinutes from now, rounded up to the next 5 minutes. */
export const defaultDeliveryTime = (date = new Date(), leadMinutes = 30) => {
  const target = new Date(date.getTime() + leadMinutes * 60000);
  target.setMinutes(Math.ceil(target.getMinutes() / 5) * 5, 0, 0);
  return `${pad(target.getHours())}:${pad(target.getMinutes())}`;
};

/** Cash is the only mode where the amount received is typed at the front desk. */
export const isCashMode = (paymentMode) => String(paymentMode || "").trim().toLowerCase() === "cash";

/** True when the mode of payment needs a reference number (Settings > Mode of Payment > Reference). */
export const modeNeedsReference = (modes, paymentMode) => {
  const wanted = String(paymentMode || "").trim().toLowerCase();
  const entry = (Array.isArray(modes) ? modes : []).find(
    (mode) => String(mode?.mop || "").trim().toLowerCase() === wanted,
  );
  return Number(entry?.reference_On_Off ?? 0) === 1;
};

/** Saved as the order's special request; printed on the kitchen ticket and bill. */
export const roomServiceRequestLine = ({ deliveryTime, paymentMode, paymentReference, note } = {}) => {
  const parts = ["Room service"];
  if (deliveryTime) parts.push(`Deliver at ${formatTimeLabel(deliveryTime)}`);
  const mode = String(paymentMode || "").trim();
  const reference = String(paymentReference || "").trim();
  if (mode) parts.push(reference ? `Payment: ${mode} (Ref ${reference})` : `Payment: ${mode}`);
  const extra = String(note || "").trim();
  if (extra) parts.push(extra);
  return parts.join(" · ").slice(0, 500);
};

export const validateRoomServiceForm = (form, modes = []) => {
  const errors = {};
  if (modeNeedsReference(modes, form?.paymentMode) && !String(form?.paymentReference || "").trim()) {
    errors.paymentReference = "Enter the payment reference number.";
  }
  const amountText = String(form?.paymentAmount ?? "").trim();
  if (amountText !== "" && !(Number(amountText) > 0)) {
    errors.paymentAmount = "Cash received must be an amount greater than zero.";
  }
  if (!String(form?.room || "").trim()) errors.room = "Select the room.";
  if (String(form?.guestName || "").trim().length < 2) errors.guestName = "Enter the guest's name.";
  if (!/^\d{2}:\d{2}$/.test(String(form?.deliveryTime || ""))) errors.deliveryTime = "Select the delivery time.";
  if (!String(form?.paymentMode || "").trim()) errors.paymentMode = "Select the mode of payment.";
  if (!Array.isArray(form?.preOrder?.items) || form.preOrder.items.length === 0) errors.items = "Add at least one item.";
  return errors;
};

export const isRoomServiceOrder = (row) =>
  String(row?.order_type || "").trim().toUpperCase() === ROOM_SERVICE_SALES_TYPE;

/** Router state for /ordering: opens the room with the guest and items filled in. */
export const roomServiceOrderState = (form) => ({
  reservationOrder: {
    table: String(form?.room || "").trim(),
    guestCount: 1,
    guestName: String(form?.guestName || "").trim(),
    contactNumber: "",
    specialRequest: roomServiceRequestLine(form),
    paymentMode: String(form?.paymentMode || "").trim(),
    paymentReference: String(form?.paymentReference || "").trim(),
    paymentAmount:
      isCashMode(form?.paymentMode) && Number(form?.paymentAmount) > 0
        ? String(Math.round(Number(form.paymentAmount) * 100) / 100)
        : "",
    reservationId: null,
    preOrder: Array.isArray(form?.preOrder?.items) && form.preOrder.items.length
      ? { salesType: ROOM_SERVICE_SALES_TYPE, items: form.preOrder.items }
      : null,
  },
});

/** Router state that re-opens an existing room-service order on its room. */
export const openRoomOrderState = (row) => ({
  reservationOrder: {
    table: String(row?.table_number || "").trim(),
    guestCount: Math.max(1, Number(row?.customer_head_count) || 1),
    guestName: String(row?.guest_name || ""),
    contactNumber: String(row?.guest_contact || ""),
    specialRequest: String(row?.guest_request || ""),
    reservationId: null,
    preOrder: null,
  },
});

export const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
