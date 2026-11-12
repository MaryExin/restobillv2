import React from "react";
import { FaCalendarCheck } from "react-icons/fa";
import "../../fonts/font-style.css";
import { RESERVATION_STATUS_STYLES, formatTimeLabel } from "./reservationUtils";

/** Small "Reserved · 7:30 PM · Juan" pill shown on a room on its reservation date. */
const ReservedRoomTag = ({ reservation, compact = false }) => {
  if (!reservation) return null;

  const arrived = reservation.status === "Arrived";
  const tone = RESERVATION_STATUS_STYLES[arrived ? "Arrived" : "Booked"];
  const firstName = String(reservation.guest_name || "").trim().split(/\s+/)[0];
  const time = formatTimeLabel(reservation.reservation_time);
  const guests = Number(reservation.guest_count || 0);

  return (
    <span
      title={`${arrived ? "Arrived" : "Reserved"}: ${reservation.guest_name} · ${time} · ${guests} guest${guests === 1 ? "" : "s"}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-[Poppins-SemiBold] text-[10px] uppercase tracking-[0.06em]"
      style={{
        color: tone.color,
        backgroundColor: tone.background,
        border: `1px solid ${tone.border}`,
      }}
    >
      <FaCalendarCheck className="shrink-0 text-[10px]" />
      <span className="truncate">
        {arrived ? "Arrived" : "Reserved"} · {time}
        {!compact && firstName ? ` · ${firstName}` : ""}
      </span>
    </span>
  );
};

export default ReservedRoomTag;
