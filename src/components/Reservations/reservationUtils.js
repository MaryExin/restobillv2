// Shared helpers for the POS reservations feature.

export const RESERVATION_STATUSES = ["Booked", "Arrived", "Cancelled", "No Show"];
export const ACTIVE_RESERVATION_STATUSES = ["Booked", "Arrived"];

export const RESERVATION_STATUS_STYLES = {
  Booked: { color: "#b45309", background: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)" },
  Arrived: { color: "#047857", background: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.35)" },
  Cancelled: { color: "#64748b", background: "rgba(100,116,139,0.14)", border: "rgba(100,116,139,0.30)" },
  "No Show": { color: "#be123c", background: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.32)" },
};

export const reservationsEndpoint = (apiHost) =>
  `${apiHost || ""}${import.meta.env.VITE_POS_RESERVATIONS_ENDPOINT || "/api/pos_reservations.php"}`;

const pad = (value) => String(value).padStart(2, "0");

/** YYYY-MM-DD for a Date in the device's local timezone. */
export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const addDaysToKey = (dateKey, days) => {
  const date = parseDateKey(dateKey) || new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

/** "Thursday, November 12, 2026" */
export const formatDateLabel = (dateKey) => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey || "";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/** "Nov 12" */
export const formatShortDate = (dateKey) => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey || "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "19:30" -> "7:30 PM" */
export const formatTimeLabel = (timeValue) => {
  const [hours, minutes] = String(timeValue || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return timeValue || "";
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${pad(minutes)} ${suffix}`;
};

/** "Today" / "Tomorrow" / "" relative to todayKey. */
export const relativeDayLabel = (dateKey, todayKey) => {
  if (!dateKey || !todayKey) return "";
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDaysToKey(todayKey, 1)) return "Tomorrow";
  return "";
};

export const normalizeRoomName = (value) => String(value ?? "").trim().toLowerCase();

/** "2026-11-11 08:15:00" (a shift's Opening_DateTime) -> "2026-11-11". */
export const shiftBusinessDateKey = (openingDateTime) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(openingDateTime ?? "").trim());
  return match ? match[1] : "";
};

/**
 * Why a reservation cannot be turned into an order right now; "" when it can.
 * An order is recorded under the open day (the open shift's business date),
 * so the reservation must be for that same date: open that day's shift
 * first, or reschedule the reservation to the open day (Edit).
 */
export const reservationOrderBlockedReason = ({ shiftOpen, shiftDateKey, reservation }) => {
  if (!shiftOpen) return "Open a new day first to start the order.";
  const reservationDate = String(reservation?.reservation_date ?? "");
  if (shiftDateKey && reservationDate && reservationDate !== shiftDateKey) {
    const openDay = formatShortDate(shiftDateKey);
    const bookedDay = formatShortDate(reservationDate);
    return `The open day is ${openDay} but this reservation is for ${bookedDay}. Open the ${bookedDay} day first (close ${openDay}), or reschedule the reservation (Edit).`;
  }
  if (!reservation?.table_name) return "Assign a room first (Edit) to start the order.";
  return "";
};
