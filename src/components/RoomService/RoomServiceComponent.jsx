import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaConciergeBell, FaDoorOpen, FaPaperPlane, FaSyncAlt } from "react-icons/fa";
import "../../fonts/font-style.css";
import useApiHost from "../../hooks/useApiHost";
import useCustomQuery from "../../hooks/useCustomQuery";
import useRoomReservations from "../../hooks/useRoomReservations";
import { useExecuteToast } from "../../context/ToastContext";
import PreOrderPicker from "../Reservations/PreOrderPicker";
import { localDateKey, reservationsEndpoint } from "../Reservations/reservationUtils";
import {
  EMPTY_ROOM_SERVICE_FORM,
  ROOM_SERVICE_SALES_TYPE,
  defaultDeliveryTime,
  isCashMode,
  isRoomServiceOrder,
  modeNeedsReference,
  openRoomOrderState,
  peso,
  roomServiceOrderState,
  roomServiceRequestLine,
  validateRoomServiceForm,
} from "./roomServiceUtils";

const fieldClass =
  "w-full rounded-xl border px-3.5 py-2.5 font-[Poppins-Regular] text-[14px] outline-none";
const fieldStyle = (invalid) => ({
  borderColor: invalid ? "#f43f5e" : "var(--app-border)",
  backgroundColor: "var(--app-surface)",
  color: "var(--app-text)",
});

const Label = ({ htmlFor, children, hint }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 block font-[Poppins-SemiBold] text-[12px] uppercase tracking-[0.12em]"
    style={{ color: "var(--app-muted-text)" }}
  >
    {children}
    {hint ? (
      <span className="ml-1 font-[Poppins-Regular] normal-case tracking-normal">({hint})</span>
    ) : null}
  </label>
);

const FieldError = ({ message }) =>
  message ? (
    <p className="mt-1 font-[Poppins-Medium] text-[12px]" style={{ color: "#be123c" }}>
      {message}
    </p>
  ) : null;

const Card = ({ children, className = "" }) => (
  <section
    className={`rounded-2xl border p-5 ${className}`}
    style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-surface)" }}
  >
    {children}
  </section>
);

/** Shown once the API host is known (useCustomQuery has no "enabled" flag). */
const RoomServiceBoard = ({ apiHost }) => {
  const navigate = useNavigate();
  const { executeToast } = useExecuteToast();
  const todayKey = localDateKey();

  // Rooms by floor, business-unit scope and the sales types come from the
  // reservations API (same data the reservation form uses).
  const { data: setup, isLoading: setupLoading } = useCustomQuery(
    `${reservationsEndpoint(apiHost)}?date=${todayKey}&include_rooms=1&include_menu=1`,
    "pos-room-service-setup",
  );
  const rooms = Array.isArray(setup?.data?.rooms) ? setup.data.rooms : [];
  const scope = setup?.data?.scope || null;
  const roomServiceTypes = useMemo(
    () =>
      (Array.isArray(setup?.data?.sales_types) ? setup.data.sales_types : []).filter(
        (type) => String(type.sales_type || "").trim().toUpperCase() === ROOM_SERVICE_SALES_TYPE,
      ),
    [setup],
  );
  const { getRoomReservation } = useRoomReservations(apiHost);

  const [modes, setModes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_ROOM_SERVICE_FORM,
    deliveryTime: defaultDeliveryTime(),
  }));
  const [showErrors, setShowErrors] = useState(false);

  // Modes of payment from Settings > Mode of Payment (enabled ones only).
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiHost}/api/pos_payment_read_mode_of_payment.php`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        const list = (Array.isArray(result?.modes) ? result.modes : [])
          .filter((mode) => String(mode.MOP_On_Off ?? "1") !== "0")
          .map((mode) => ({
            mop: String(mode.mop || "").trim(),
            reference_On_Off: Number(mode.reference_On_Off ?? 0),
          }))
          .filter((mode) => mode.mop);
        setModes(list);
        setForm((prev) => (prev.paymentMode || !list.length ? prev : { ...prev, paymentMode: list[0].mop }));
      })
      .catch(() => {
        if (!cancelled) setModes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  // Today's room-service orders that are not paid yet.
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/pos_payment_read_pending.php`);
      const result = await response.json();
      const rows = Array.isArray(result?.transactions) ? result.transactions : [];
      setOrders(
        rows.filter(
          (row) => isRoomServiceOrder(row) && String(row.transaction_date || "") === todayKey,
        ),
      );
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [apiHost, todayKey]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 60000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const update = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // The guest name follows today's reservation for the room (still editable).
  const onRoomChange = (event) => {
    const room = event.target.value;
    setForm((prev) => {
      const reservation = getRoomReservation(room);
      return {
        ...prev,
        room,
        guestName: prev.guestName || String(reservation?.guest_name || ""),
      };
    });
  };

  // Online, card and gift-certificate modes need the reference number here
  // (same rule as the payment screen); switching to a mode without one
  // drops the reference.
  const needsReference = modeNeedsReference(modes, form.paymentMode);
  const onPaymentModeChange = (event) => {
    const paymentMode = event.target.value;
    setForm((prev) => ({
      ...prev,
      paymentMode,
      paymentReference: modeNeedsReference(modes, paymentMode) ? prev.paymentReference : "",
      paymentAmount: isCashMode(paymentMode) ? prev.paymentAmount : "",
    }));
  };
  const itemsTotal = form.preOrder.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
  const cashReceived = Number(form.paymentAmount);
  const errors = useMemo(() => validateRoomServiceForm(form, modes), [form, modes]);
  const visibleErrors = showErrors ? errors : {};
  const requestPreview = roomServiceRequestLine(form);

  const submit = () => {
    setShowErrors(true);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      executeToast(firstError, 3500, "error");
      return;
    }
    navigate("/ordering", { state: roomServiceOrderState(form) });
  };

  const openOrder = (row) => navigate("/ordering", { state: openRoomOrderState(row) });

  return (
    <div className="mx-auto w-full max-w-6xl">
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
          onClick={loadOrders}
          className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-[Poppins-SemiBold] text-[13px] transition hover:opacity-85"
          style={{ borderColor: "var(--app-border)", color: "var(--app-text)", backgroundColor: "var(--app-surface)" }}
        >
          <FaSyncAlt className={`text-[12px] ${ordersLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </nav>

      <header className="mb-6">
        <p
          className="flex items-center gap-2 font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.2em]"
          style={{ color: "var(--app-accent)" }}
        >
          <FaDoorOpen /> Front desk
        </p>
        <h1 className="mt-1 font-[Poppins-Bold] text-[32px] leading-tight sm:text-[40px]">Room Service</h1>
        <p className="font-[Poppins-Regular] text-[14px]" style={{ color: "var(--app-muted-text)" }}>
          Take a phone-in order for a room: it opens on the ordering screen with the guest and items
          filled in, then prints to the kitchen like any order.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-[Poppins-SemiBold] text-[16px]">
            <FaConciergeBell style={{ color: "var(--app-accent)" }} /> New room service order
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rs-room">Room number</Label>
              <select
                id="rs-room"
                value={form.room}
                onChange={onRoomChange}
                className={fieldClass}
                style={fieldStyle(visibleErrors.room)}
              >
                <option value="">{setupLoading ? "Loading rooms…" : "Select a room"}</option>
                {rooms.map((group) => (
                  <optgroup key={group.floor} label={group.floor}>
                    {group.rooms.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <FieldError message={visibleErrors.room} />
            </div>

            <div>
              <Label htmlFor="rs-guest">Guest name</Label>
              <input
                id="rs-guest"
                type="text"
                maxLength={150}
                value={form.guestName}
                onChange={update("guestName")}
                placeholder="e.g. Juan Dela Cruz"
                className={fieldClass}
                style={fieldStyle(visibleErrors.guestName)}
              />
              <FieldError message={visibleErrors.guestName} />
            </div>

            <div>
              <Label htmlFor="rs-time">Delivery time</Label>
              <div className="flex gap-2">
                <input
                  id="rs-time"
                  type="time"
                  value={form.deliveryTime}
                  onChange={update("deliveryTime")}
                  className={fieldClass}
                  style={fieldStyle(visibleErrors.deliveryTime)}
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, deliveryTime: defaultDeliveryTime(new Date(), 15) }))}
                  className="shrink-0 rounded-xl border px-3 font-[Poppins-SemiBold] text-[12px]"
                  style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
                  title="15 minutes from now"
                >
                  ASAP
                </button>
              </div>
              <FieldError message={visibleErrors.deliveryTime} />
            </div>

            <div>
              <Label htmlFor="rs-mode">Mode of payment</Label>
              <select
                id="rs-mode"
                value={form.paymentMode}
                onChange={onPaymentModeChange}
                className={fieldClass}
                style={fieldStyle(visibleErrors.paymentMode)}
              >
                <option value="">Select</option>
                {modes.map((mode) => (
                  <option key={mode.mop} value={mode.mop}>
                    {mode.mop}
                  </option>
                ))}
              </select>
              <FieldError message={visibleErrors.paymentMode} />
            </div>

            {isCashMode(form.paymentMode) ? (
              <div className="sm:col-span-2">
                <Label htmlFor="rs-cash" hint="optional">
                  Cash received
                </Label>
                <input
                  id="rs-cash"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.paymentAmount}
                  onChange={update("paymentAmount")}
                  placeholder="Leave blank if the guest pays on delivery"
                  className={fieldClass}
                  style={fieldStyle(visibleErrors.paymentAmount)}
                />
                {cashReceived > 0 && itemsTotal > 0 ? (
                  <p className="mt-1 font-[Poppins-Medium] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
                    Items {peso(itemsTotal)} ·{" "}
                    {cashReceived >= itemsTotal
                      ? `change ${peso(cashReceived - itemsTotal)}`
                      : `short by ${peso(itemsTotal - cashReceived)}`}{" "}
                    (estimate; the payment screen computes the final change)
                  </p>
                ) : null}
                <FieldError message={visibleErrors.paymentAmount} />
              </div>
            ) : null}

            {needsReference ? (
              <div className="sm:col-span-2">
                <Label htmlFor="rs-reference">Payment reference number</Label>
                <input
                  id="rs-reference"
                  type="text"
                  maxLength={100}
                  value={form.paymentReference}
                  onChange={update("paymentReference")}
                  placeholder={`${form.paymentMode} reference / transaction no.`}
                  className={fieldClass}
                  style={fieldStyle(visibleErrors.paymentReference)}
                />
                <FieldError message={visibleErrors.paymentReference} />
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <Label htmlFor="rs-note" hint="optional">
                Note for the kitchen / delivery
              </Label>
              <input
                id="rs-note"
                type="text"
                maxLength={200}
                value={form.note}
                onChange={update("note")}
                placeholder="e.g. no onions, knock softly, bring extra cutlery"
                className={fieldClass}
                style={fieldStyle(false)}
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Items</Label>
              <PreOrderPicker
                apiHost={apiHost}
                scope={scope}
                salesTypes={roomServiceTypes}
                suggestedSalesType={ROOM_SERVICE_SALES_TYPE}
                startExpanded
                value={form.preOrder}
                onChange={(next) =>
                  setForm((prev) => ({
                    ...prev,
                    preOrder: { salesType: ROOM_SERVICE_SALES_TYPE, items: next?.items || [] },
                  }))
                }
              />
              <FieldError message={visibleErrors.items} />
            </div>
          </div>

          <p
            className="mt-4 rounded-xl px-3.5 py-2.5 font-[Poppins-Regular] text-[13px]"
            style={{ backgroundColor: "var(--app-surface-soft)", color: "var(--app-muted-text)" }}
          >
            Printed on the ticket and bill: <span style={{ color: "var(--app-text)" }}>{requestPreview}</span>
          </p>

          <button
            type="button"
            onClick={submit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-[Poppins-SemiBold] text-[15px] text-[#fff] shadow-lg transition hover:brightness-110"
            style={{ backgroundColor: "var(--app-accent)", boxShadow: "0 12px 26px var(--app-accent-glow)" }}
          >
            <FaPaperPlane className="text-[13px]" /> Continue to order
          </button>
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center justify-between font-[Poppins-SemiBold] text-[16px]">
            <span>Today&apos;s room service</span>
            <span className="font-[Poppins-Regular] text-[13px]" style={{ color: "var(--app-muted-text)" }}>
              {orders.length} open order{orders.length === 1 ? "" : "s"}
            </span>
          </h2>

          {orders.length === 0 ? (
            <p className="font-[Poppins-Regular] text-[14px]" style={{ color: "var(--app-muted-text)" }}>
              {ordersLoading ? "Loading…" : "No open room service orders today."}
            </p>
          ) : (
            <ul className="grid gap-3">
              {orders.map((row) => (
                <li
                  key={row.transaction_id}
                  className="flex items-start gap-3 overflow-hidden rounded-xl border px-4 py-3"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[Poppins-SemiBold] text-[15px]">
                      {row.table_number}
                      {row.guest_name ? (
                        <span className="font-[Poppins-Regular]" style={{ color: "var(--app-muted-text)" }}>
                          {" "}· {row.guest_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
                      {row.transaction_time} · {row.order_status || "Pending"}
                      {Number(row.TotalAmountDue) > 0 ? ` · ${peso(row.TotalAmountDue)}` : ""}
                    </p>
                    {row.guest_request ? (
                      <p
                        className="mt-1 break-words font-[Poppins-Regular] text-[12px] leading-snug"
                        style={{ color: "var(--app-muted-text)" }}
                      >
                        {row.guest_request}
                        {Number(row.guest_payment_amount) > 0 ? ` · Cash received ${peso(row.guest_payment_amount)}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrder(row)}
                    className="shrink-0 rounded-lg border px-3 py-1.5 font-[Poppins-SemiBold] text-[12px]"
                    style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

const RoomServiceComponent = () => {
  const apiHost = useApiHost();
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6" style={{ color: "var(--app-text)" }}>
      {apiHost ? (
        <RoomServiceBoard apiHost={apiHost} />
      ) : (
        <p className="font-[Poppins-Regular] text-[14px]" style={{ color: "var(--app-muted-text)" }}>
          Connecting to the POS server…
        </p>
      )}
    </div>
  );
};

export default RoomServiceComponent;
