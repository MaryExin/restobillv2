import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarCheck,
  FaChair,
  FaConciergeBell,
  FaPhoneAlt,
  FaPlus,
  FaSearch,
  FaStickyNote,
  FaUsers,
  FaUtensils,
} from "react-icons/fa";
import "../../fonts/font-style.css";
import useApiHost from "../../hooks/useApiHost";
import useCustomQuery from "../../hooks/useCustomQuery";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { useExecuteToast } from "../../context/ToastContext";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { usePosDeveloperSession } from "../../hooks/usePosRoleAccessConfig";
import { hasPosRouteAccess } from "../../utils/posRoleAccess";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ReservationFormModal from "./ReservationFormModal";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_STYLES,
  formatDateLabel,
  formatShortDate,
  formatTimeLabel,
  localDateKey,
  relativeDayLabel,
  reservationsEndpoint,
  reservationOrderBlockedReason,
  shiftBusinessDateKey,
} from "./reservationUtils";

const VIEWS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "date", label: "Pick a date" },
];

const StatusPill = ({ status }) => {
  const tone = RESERVATION_STATUS_STYLES[status] || RESERVATION_STATUS_STYLES.Cancelled;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[Poppins-SemiBold] text-[11px]"
      style={{ color: tone.color, backgroundColor: tone.background, border: `1px solid ${tone.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.color }} />
      {status}
    </span>
  );
};

const ActionButton = ({ children, onClick, tone = "default", disabled, title }) => {
  const tones = {
    default: { color: "var(--app-text)", borderColor: "var(--app-border)", backgroundColor: "transparent" },
    primary: { color: "#fff", borderColor: "transparent", backgroundColor: "var(--app-accent)" },
    success: { color: "#047857", borderColor: "rgba(16,185,129,0.35)", backgroundColor: "rgba(16,185,129,0.10)" },
    danger: { color: "#be123c", borderColor: "rgba(244,63,94,0.32)", backgroundColor: "rgba(244,63,94,0.08)" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border px-3 py-1.5 font-[Poppins-SemiBold] text-[12px] transition hover:brightness-105 disabled:opacity-50"
      style={tones[tone]}
    >
      {children}
    </button>
  );
};

/** Shown once the API host is known (useCustomQuery has no "enabled" flag). */
const ReservationsBoard = ({ apiHost }) => {
  const navigate = useNavigate();
  const { executeToast } = useExecuteToast();

  const [view, setView] = useState("upcoming");
  const [pickedDate, setPickedDate] = useState(() => localDateKey());
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState({ open: false, reservation: null });
  const [confirmAction, setConfirmAction] = useState(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ include_rooms: "1", include_menu: "1" });
    if (view === "today") params.set("date", localDateKey());
    if (view === "date") params.set("date", pickedDate);
    if (view !== "upcoming" && statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [view, pickedDate, statusFilter]);

  const { data, isLoading, refetch } = useCustomQuery(
    `${reservationsEndpoint(apiHost)}?${queryString}`,
    `pos-reservations-${queryString}`,
  );

  const { mutate: changeStatus, isLoading: isChangingStatus } = useCustomSecuredMutation(
    reservationsEndpoint(apiHost),
  );

  // "Order" needs an open shift and access to New Transaction.
  const { userId, roles } = useZustandLoginCred();
  const developerMode = usePosDeveloperSession();
  const canOrder = useMemo(
    () => hasPosRouteAccess(roles, "/ordering", developerMode),
    [roles, developerMode],
  );
  const { data: shiftData } = useCustomQuery(
    `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(userId || "")}`,
    `pos-reservations-shift-${userId || ""}`,
  );
  const shiftOpen = String(shiftData?.Shift_Status || "").toLowerCase() === "open";
  // Orders are recorded under the open day (the shift's business date), so a
  // reservation can only be ordered on that date: open that day's shift
  // first, or reschedule the reservation to the open day.
  const shiftDateKey = shiftOpen ? shiftBusinessDateKey(shiftData?.Opening_DateTime) : "";

  const openOrdering = (row) =>
    navigate("/ordering", {
      state: {
        reservationOrder: {
          table: row.table_name,
          guestCount: row.guest_count,
          guestName: row.guest_name,
          contactNumber: row.contact_number || "",
          specialRequest: row.special_request || "",
          reservationId: row.id,
          preOrder:
            Array.isArray(row.pre_order_items) && row.pre_order_items.length
              ? { salesType: row.pre_order_sales_type, items: row.pre_order_items }
              : null,
        },
      },
    });

  // Ordering means the guest is here: mark Arrived first, then open the room.
  const startOrder = (row) => {
    const blockedReason = reservationOrderBlockedReason({ shiftOpen, shiftDateKey, reservation: row });
    if (blockedReason) {
      executeToast(blockedReason, 5000, "error");
      return;
    }
    if (row.status === "Arrived") {
      openOrdering(row);
      return;
    }
    changeStatus(
      { action: "status", id: row.id, status: "Arrived" },
      {
        onSuccess: (result) => {
          if (result?.success) {
            openOrdering(row);
          } else {
            executeToast(result?.message || "Could not mark the guest as arrived.", 4000, "error");
          }
        },
        onError: () => executeToast("Could not reach the POS server.", 4000, "error"),
      },
    );
  };

  const loadError = data && data.success === false ? data.message : "";
  const todayKey = data?.data?.today || localDateKey();
  const rooms = data?.data?.rooms || [];
  const salesTypes = data?.data?.sales_types || [];
  const scope = data?.data?.scope || null;
  const reservations = useMemo(
    () => (Array.isArray(data?.data?.reservations) ? data.data.reservations : []),
    [data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reservations;
    return reservations.filter((row) =>
      [row.guest_name, row.contact_number, row.table_name, row.special_request]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [reservations, search]);

  const groups = useMemo(() => {
    const byDate = new Map();
    filtered.forEach((row) => {
      if (!byDate.has(row.reservation_date)) byDate.set(row.reservation_date, []);
      byDate.get(row.reservation_date).push(row);
    });
    return Array.from(byDate.entries());
  }, [filtered]);

  const totalGuests = filtered
    .filter((row) => row.status === "Booked" || row.status === "Arrived")
    .reduce((sum, row) => sum + Number(row.guest_count || 0), 0);

  const runStatusChange = (reservation, status) => {
    changeStatus(
      { action: "status", id: reservation.id, status },
      {
        onSuccess: (result) => {
          if (result?.success) {
            executeToast(`${reservation.guest_name}: ${status}.`, 3000, "success");
            refetch();
          } else {
            executeToast(result?.message || "Could not update the reservation.", 4000, "error");
          }
        },
        onError: () => executeToast("Could not reach the POS server.", 4000, "error"),
      },
    );
  };

  const askStatusChange = (reservation, status) => {
    if (status === "Cancelled" || status === "No Show") {
      setConfirmAction({ reservation, status });
      return;
    }
    runStatusChange(reservation, status);
  };

  const emptyMessage =
    view === "upcoming"
      ? "No upcoming reservations yet."
      : `No reservations on ${formatDateLabel(view === "today" ? todayKey : pickedDate)}.`;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Top bar */}
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/poscorehomescreen")}
          className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-[Poppins-SemiBold] text-[13px] transition hover:opacity-85"
          style={{ borderColor: "var(--app-border)", color: "var(--app-text)", backgroundColor: "var(--app-surface)" }}
        >
          <FaArrowLeft className="text-[12px]" /> Home
        </button>
        <button
          type="button"
          onClick={() => setFormState({ open: true, reservation: null })}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-[Poppins-SemiBold] text-[14px] text-[#fff] shadow-lg transition hover:brightness-110"
          style={{ backgroundColor: "var(--app-accent)", boxShadow: "0 12px 26px var(--app-accent-glow)" }}
        >
          <FaPlus className="text-[12px]" /> New reservation
        </button>
      </nav>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="flex items-center gap-2 font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "var(--app-accent)" }}
          >
            <FaCalendarCheck /> Front desk
          </p>
          <h1 className="mt-1 font-[Poppins-Bold] text-[32px] leading-tight sm:text-[40px]">
            Reservations
          </h1>
          <p className="font-[Poppins-Regular] text-[14px]" style={{ color: "var(--app-muted-text)" }}>
            {filtered.length} reservation{filtered.length === 1 ? "" : "s"} · {totalGuests} guest
            {totalGuests === 1 ? "" : "s"} expected
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <FaSearch
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px]"
            style={{ color: "var(--app-muted-text)" }}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guest, number or room"
            aria-label="Search reservations"
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 font-[Poppins-Regular] text-[14px] outline-none"
            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-surface)", color: "var(--app-text)" }}
          />
        </div>
      </header>

      {/* Filters */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border p-2"
        style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-surface)" }}
      >
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Reservation view">
          {VIEWS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className="rounded-xl px-4 py-2 font-[Poppins-SemiBold] text-[13px] transition"
                style={
                  active
                    ? { backgroundColor: "var(--app-accent)", color: "#fff" }
                    : { color: "var(--app-muted-text)" }
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {view === "date" && (
          <input
            type="date"
            value={pickedDate}
            onChange={(event) => setPickedDate(event.target.value || localDateKey())}
            aria-label="Reservation date"
            className="rounded-xl border px-3 py-2 font-[Poppins-Regular] text-[13px] outline-none"
            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
          />
        )}

        {view !== "upcoming" ? (
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Status filter"
            className="rounded-xl border px-3 py-2 font-[Poppins-Regular] text-[13px] outline-none"
            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
          >
            <option value="">All statuses</option>
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : (
          <span className="px-2 font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
            Booked guests from today onward
          </span>
        )}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mb-6 rounded-2xl px-4 py-3 font-[Poppins-Medium] text-[14px]"
          style={{ color: "#be123c", backgroundColor: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.30)" }}
        >
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="py-16 text-center font-[Poppins-Medium]" style={{ color: "var(--app-muted-text)" }}>
          Loading reservations…
        </p>
      ) : groups.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed px-6 py-16 text-center"
          style={{ borderColor: "var(--app-border)" }}
        >
          <FaCalendarCheck className="mx-auto text-[34px]" style={{ color: "var(--app-muted-text)" }} />
          <p className="mt-3 font-[Poppins-SemiBold] text-[16px]">{emptyMessage}</p>
          <p className="mt-1 font-[Poppins-Regular] text-[13px]" style={{ color: "var(--app-muted-text)" }}>
            Tap “New reservation” to book a guest for any date.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([dateKey, rows]) => {
            const relative = relativeDayLabel(dateKey, todayKey);
            return (
              <section key={dateKey} aria-label={formatDateLabel(dateKey)}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-[Poppins-Bold] text-[16px]">{formatDateLabel(dateKey)}</h2>
                  {relative ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 font-[Poppins-SemiBold] text-[11px]"
                      style={{ backgroundColor: "var(--app-accent)", color: "#fff" }}
                    >
                      {relative}
                    </span>
                  ) : null}
                  <span className="font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
                    {rows.length} booking{rows.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid gap-3">
                  {rows.map((row) => {
                    const active = row.status === "Booked" || row.status === "Arrived";
                    // Shown for today's bookings and for the open day's (a shift that
                    // runs past midnight still serves its own date).
                    const showOrder =
                      active &&
                      canOrder &&
                      (row.reservation_date === todayKey ||
                        (shiftDateKey !== "" && row.reservation_date === shiftDateKey));
                    const orderBlockedReason = reservationOrderBlockedReason({
                      shiftOpen,
                      shiftDateKey,
                      reservation: row,
                    });
                    return (
                      <article
                        key={row.id}
                        className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-surface)",
                          opacity: active ? 1 : 0.7,
                        }}
                      >
                        <div
                          className="rounded-xl px-3 py-2 text-center"
                          style={{ backgroundColor: "var(--app-bg)" }}
                        >
                          <div className="font-[Poppins-Bold] text-[18px] leading-tight">
                            {formatTimeLabel(row.reservation_time)}
                          </div>
                          <div className="font-[Poppins-Medium] text-[11px]" style={{ color: "var(--app-muted-text)" }}>
                            {formatShortDate(row.reservation_date)}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-[Poppins-SemiBold] text-[16px]">{row.guest_name}</h3>
                            <StatusPill status={row.status} />
                          </div>
                          <div
                            className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-[Poppins-Regular] text-[13px]"
                            style={{ color: "var(--app-muted-text)" }}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <FaPhoneAlt className="text-[11px]" /> {row.contact_number}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <FaUsers className="text-[12px]" /> {row.guest_count} guest
                              {Number(row.guest_count) === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <FaChair className="text-[12px]" /> {row.table_name || "No room assigned yet"}
                            </span>
                          </div>
                          {row.special_request ? (
                            <p
                              className="mt-2 flex items-start gap-1.5 font-[Poppins-Regular] text-[13px]"
                              style={{ color: "var(--app-text)" }}
                            >
                              <FaStickyNote className="mt-0.5 shrink-0 text-[11px]" style={{ color: "var(--app-accent)" }} />
                              <span className="line-clamp-2">{row.special_request}</span>
                            </p>
                          ) : null}
                          {Array.isArray(row.pre_order_items) && row.pre_order_items.length ? (
                            <p
                              className="mt-2 flex items-start gap-1.5 font-[Poppins-Regular] text-[13px]"
                              style={{ color: "var(--app-text)" }}
                            >
                              <FaUtensils className="mt-0.5 shrink-0 text-[11px]" style={{ color: "var(--app-accent)" }} />
                              <span className="line-clamp-2">
                                <span className="font-[Poppins-SemiBold]">
                                  Pre-order ({row.pre_order_sales_type}):
                                </span>{" "}
                                {row.pre_order_items
                                  .map(
                                    (item) =>
                                      `${item.quantity}× ${item.item_name}${
                                        item.item_instruction ? ` (${String(item.item_instruction).replace(/\n+/g, "; ")})` : ""
                                      }`,
                                  )
                                  .join(", ")}
                              </span>
                            </p>
                          ) : null}
                          {showOrder && orderBlockedReason ? (
                            <p
                              className="mt-2 font-[Poppins-Medium] text-[12px]"
                              style={{ color: "#b45309" }}
                            >
                              {orderBlockedReason}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {showOrder ? (
                            <ActionButton
                              tone="primary"
                              disabled={Boolean(orderBlockedReason) || isChangingStatus}
                              title={orderBlockedReason || (Array.isArray(row.pre_order_items) && row.pre_order_items.length ? "Mark as arrived and open the order with the pre-ordered items" : "Mark as arrived and open the order")}
                              onClick={() => startOrder(row)}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <FaConciergeBell className="text-[11px]" /> Order
                              </span>
                            </ActionButton>
                          ) : null}
                          {active ? (
                            <ActionButton onClick={() => setFormState({ open: true, reservation: row })}>
                              Edit
                            </ActionButton>
                          ) : null}
                          {row.status === "Booked" ? (
                            <ActionButton
                              tone="success"
                              disabled={isChangingStatus}
                              onClick={() => askStatusChange(row, "Arrived")}
                            >
                              Arrived
                            </ActionButton>
                          ) : null}
                          {row.status === "Booked" ? (
                            <ActionButton disabled={isChangingStatus} onClick={() => askStatusChange(row, "No Show")}>
                              No show
                            </ActionButton>
                          ) : null}
                          {active ? (
                            <ActionButton
                              tone="danger"
                              disabled={isChangingStatus}
                              onClick={() => askStatusChange(row, "Cancelled")}
                            >
                              Cancel
                            </ActionButton>
                          ) : (
                            <ActionButton disabled={isChangingStatus} onClick={() => askStatusChange(row, "Booked")}>
                              Rebook
                            </ActionButton>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ReservationFormModal
        open={formState.open}
        reservation={formState.reservation}
        onClose={() => setFormState({ open: false, reservation: null })}
        onSaved={(result, form) => {
          executeToast(
            `${result?.message || "Reservation saved."} ${form.guest_name.trim()} · ${formatDateLabel(form.reservation_date)}`,
            3500,
            "success",
          );
          refetch();
        }}
        apiHost={apiHost}
        rooms={rooms}
        salesTypes={salesTypes}
        scope={scope}
        todayKey={todayKey}
      />

      {confirmAction ? (
        <ModalYesNoReusable
          header={confirmAction.status === "Cancelled" ? "Cancel reservation?" : "Mark as no show?"}
          message={`${confirmAction.reservation.guest_name} · ${formatDateLabel(
            confirmAction.reservation.reservation_date,
          )} at ${formatTimeLabel(confirmAction.reservation.reservation_time)}`}
          setYesNoModalOpen={() => setConfirmAction(null)}
          triggerYesNoEvent={() => {
            runStatusChange(confirmAction.reservation, confirmAction.status);
            setConfirmAction(null);
          }}
          yesLabel={confirmAction.status === "Cancelled" ? "Cancel reservation" : "Mark no show"}
          noLabel="Keep"
        />
      ) : null}
    </div>
  );
};

const ReservationsComponent = () => {
  const apiHost = useApiHost();

  return (
    <div
      className="min-h-screen p-4 font-[Poppins-Regular] sm:p-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
    >
      {apiHost ? (
        <ReservationsBoard apiHost={apiHost} />
      ) : (
        <p className="py-16 text-center font-[Poppins-Medium]" style={{ color: "var(--app-muted-text)" }}>
          Connecting to the POS server…
        </p>
      )}
    </div>
  );
};

export default ReservationsComponent;
