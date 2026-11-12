import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaMinus, FaPlus, FaTimes } from "react-icons/fa";
import "../../fonts/font-style.css";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import PreOrderPicker from "./PreOrderPicker";
import {
  formatDateLabel,
  localDateKey,
  relativeDayLabel,
  reservationsEndpoint,
} from "./reservationUtils";

const PAST_GRACE_MINUTES = 30;

const pad = (value) => String(value).padStart(2, "0");

/** Next half hour from now, e.g. 14:12 -> "14:30". */
const nextHalfHour = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const emptyForm = (todayKey) => ({
  guest_name: "",
  contact_number: "",
  guest_count: "2",
  reservation_date: todayKey,
  reservation_time: nextHalfHour(),
  table_name: "",
  special_request: "",
  pre_order: { salesType: "", items: [] },
});

const validate = (form, todayKey, original) => {
  const errors = {};
  const name = form.guest_name.trim();
  if (name.length < 2) errors.guest_name = "Enter the guest's full name.";

  const contact = form.contact_number.trim();
  if (!/^[0-9+()\-\s]{7,20}$/.test(contact) || contact.replace(/\D/g, "").length < 7) {
    errors.contact_number = "Enter a valid contact number (at least 7 digits).";
  }

  const guests = Number(form.guest_count);
  if (!Number.isInteger(guests) || guests < 1 || guests > 500) {
    errors.guest_count = "Number of guests must be 1 to 500.";
  }

  const scheduleChanged =
    !original ||
    original.reservation_date !== form.reservation_date ||
    original.reservation_time !== form.reservation_time;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.reservation_date)) {
    errors.reservation_date = "Select the reservation date.";
  } else if (scheduleChanged && form.reservation_date < todayKey) {
    errors.reservation_date = "The date is already in the past.";
  }

  if (!/^\d{2}:\d{2}$/.test(form.reservation_time)) {
    errors.reservation_time = "Select the reservation time.";
  } else if (scheduleChanged && form.reservation_date === todayKey) {
    const [hours, minutes] = form.reservation_time.split(":").map(Number);
    const when = new Date();
    when.setHours(hours, minutes, 0, 0);
    if (when.getTime() < Date.now() - PAST_GRACE_MINUTES * 60 * 1000) {
      errors.reservation_time = "This time has already passed today.";
    }
  }

  if (form.special_request.length > 1000) {
    errors.special_request = "Keep the special request under 1000 characters.";
  }

  if (form.pre_order.items.length > 0 && !form.pre_order.salesType) {
    errors.pre_order = "Select the service type for the pre-order.";
  }
  return errors;
};

const fieldClass =
  "w-full rounded-xl border px-3.5 py-2.5 font-[Poppins-Regular] text-[14px] outline-none transition focus:ring-2";

const Label = ({ htmlFor, children, hint }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 flex items-baseline justify-between gap-2 font-[Poppins-SemiBold] text-[12px] uppercase tracking-[0.08em]"
    style={{ color: "var(--app-muted-text)" }}
  >
    <span>{children}</span>
    {hint ? (
      <span className="font-[Poppins-Regular] normal-case tracking-normal">{hint}</span>
    ) : null}
  </label>
);

const FieldError = ({ message }) =>
  message ? (
    <p className="mt-1 font-[Poppins-Medium] text-[12px]" style={{ color: "#e11d48" }}>
      {message}
    </p>
  ) : null;

const ReservationFormModal = ({
  open,
  onClose,
  onSaved,
  apiHost,
  rooms = [],
  salesTypes = [],
  scope = null,
  todayKey,
  reservation = null,
}) => {
  const today = todayKey || localDateKey();
  const isEdit = Boolean(reservation?.id);
  const original = useMemo(
    () =>
      isEdit
        ? {
            reservation_date: reservation.reservation_date,
            reservation_time: reservation.reservation_time,
          }
        : null,
    [isEdit, reservation],
  );

  const [form, setForm] = useState(() => emptyForm(today));
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");
  const firstFieldRef = useRef(null);

  const { mutate: saveReservation, isLoading: isSaving } = useCustomSecuredMutation(
    reservationsEndpoint(apiHost),
  );

  useEffect(() => {
    if (!open) return;
    setForm(
      isEdit
        ? {
            guest_name: reservation.guest_name || "",
            contact_number: reservation.contact_number || "",
            guest_count: String(reservation.guest_count || 1),
            reservation_date: reservation.reservation_date || today,
            reservation_time: reservation.reservation_time || nextHalfHour(),
            table_name: reservation.table_name || "",
            special_request: reservation.special_request || "",
            pre_order: {
              salesType: reservation.pre_order_sales_type || "",
              items: Array.isArray(reservation.pre_order_items)
                ? reservation.pre_order_items.map((item) => ({
                    product_id: String(item.product_id),
                    item_name: item.item_name,
                    quantity: Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                  }))
                : [],
            },
          }
        : emptyForm(today),
    );
    setTouched(false);
    setServerError("");
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [open, isEdit, reservation, today]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isSaving, onClose]);

  const errors = useMemo(() => validate(form, today, original), [form, today, original]);

  // Pre-order service type follows the room's floor: Bar 01 -> BAR,
  // Floor 1 rooms -> ROOM SERVICE, otherwise DINE IN.
  const suggestedSalesType = useMemo(() => {
    const names = salesTypes.map((type) => String(type.sales_type || ""));
    const find = (name) => names.find((item) => item.toUpperCase() === name.toUpperCase());
    const floor = rooms.find((group) => group.rooms.includes(form.table_name))?.floor || "";
    return (
      (floor && find(floor)) ||
      (/^floor\b/i.test(floor) && find("ROOM SERVICE")) ||
      find("DINE IN") ||
      names[0] ||
      ""
    );
  }, [salesTypes, rooms, form.table_name]);
  const showErrors = touched ? errors : {};

  if (!open) return null;

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setServerError("");
  };

  const stepGuests = (delta) => {
    setForm((prev) => {
      const next = Math.min(500, Math.max(1, (Number(prev.guest_count) || 0) + delta));
      return { ...prev, guest_count: String(next) };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) return;

    saveReservation(
      {
        action: isEdit ? "update" : "create",
        id: isEdit ? reservation.id : undefined,
        guest_name: form.guest_name.trim(),
        contact_number: form.contact_number.trim(),
        guest_count: Number(form.guest_count),
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        table_name: form.table_name,
        special_request: form.special_request.trim(),
        pre_order_sales_type: form.pre_order.items.length ? form.pre_order.salesType : "",
        pre_order_items: form.pre_order.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      },
      {
        onSuccess: (result) => {
          if (result?.success) {
            onSaved?.(result, form);
            onClose();
          } else {
            setServerError(result?.message || "Could not save the reservation.");
          }
        },
        onError: () =>
          setServerError("Could not reach the POS server. Check the connection and try again."),
      },
    );
  };

  const dayLabel = relativeDayLabel(form.reservation_date, today);
  const effectHint = /^\d{4}-\d{2}-\d{2}$/.test(form.reservation_date)
    ? `${form.table_name || "The room"} will show as reserved on ${formatDateLabel(form.reservation_date)}${dayLabel ? ` (${dayLabel.toLowerCase()})` : ""}.`
    : "";

  const inputStyle = (key) => ({
    backgroundColor: "var(--app-bg)",
    color: "var(--app-text)",
    borderColor: showErrors[key] ? "#e11d48" : "var(--app-border)",
    "--tw-ring-color": "var(--app-accent-glow)",
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-form-title"
        onSubmit={handleSubmit}
        noValidate
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[26px] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:rounded-[26px]"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
          color: "var(--app-text)",
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <p
              className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--app-accent)" }}
            >
              {isEdit ? "Edit reservation" : "New reservation"}
            </p>
            <h2 id="reservation-form-title" className="mt-0.5 font-[Poppins-Bold] text-[20px]">
              {isEdit ? reservation.guest_name : "Reserve a room or table"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:opacity-80"
            style={{ backgroundColor: "var(--app-bg)", color: "var(--app-muted-text)" }}
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="sm:col-span-2">
            <Label htmlFor="res-guest-name">Guest full name</Label>
            <input
              id="res-guest-name"
              ref={firstFieldRef}
              type="text"
              autoComplete="off"
              maxLength={150}
              value={form.guest_name}
              onChange={update("guest_name")}
              placeholder="e.g. Juan Dela Cruz"
              className={fieldClass}
              style={inputStyle("guest_name")}
            />
            <FieldError message={showErrors.guest_name} />
          </div>

          <div>
            <Label htmlFor="res-contact">Contact number</Label>
            <input
              id="res-contact"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={20}
              value={form.contact_number}
              onChange={update("contact_number")}
              placeholder="0917 123 4567"
              className={fieldClass}
              style={inputStyle("contact_number")}
            />
            <FieldError message={showErrors.contact_number} />
          </div>

          <div>
            <Label htmlFor="res-guests">Number of guests</Label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => stepGuests(-1)}
                aria-label="Fewer guests"
                className="grid w-11 shrink-0 place-items-center rounded-xl border"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
              >
                <FaMinus className="text-[12px]" />
              </button>
              <input
                id="res-guests"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={form.guest_count}
                onChange={update("guest_count")}
                className={`${fieldClass} text-center`}
                style={inputStyle("guest_count")}
              />
              <button
                type="button"
                onClick={() => stepGuests(1)}
                aria-label="More guests"
                className="grid w-11 shrink-0 place-items-center rounded-xl border"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
              >
                <FaPlus className="text-[12px]" />
              </button>
            </div>
            <FieldError message={showErrors.guest_count} />
          </div>

          <div>
            <Label htmlFor="res-date" hint={dayLabel}>
              Reservation date
            </Label>
            <input
              id="res-date"
              type="date"
              min={today}
              value={form.reservation_date}
              onChange={update("reservation_date")}
              className={fieldClass}
              style={inputStyle("reservation_date")}
            />
            <FieldError message={showErrors.reservation_date} />
          </div>

          <div>
            <Label htmlFor="res-time">Reservation time</Label>
            <input
              id="res-time"
              type="time"
              step={900}
              value={form.reservation_time}
              onChange={update("reservation_time")}
              className={fieldClass}
              style={inputStyle("reservation_time")}
            />
            <FieldError message={showErrors.reservation_time} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="res-room">Table / room assignment</Label>
            <select
              id="res-room"
              value={form.table_name}
              onChange={update("table_name")}
              className={fieldClass}
              style={inputStyle("table_name")}
            >
              <option value="">Assign later (no room yet)</option>
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
            {effectHint ? (
              <p
                className="mt-1.5 flex items-center gap-1.5 font-[Poppins-Medium] text-[12px]"
                style={{ color: "var(--app-muted-text)" }}
              >
                <FaCalendarAlt className="shrink-0" />
                {effectHint}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="res-request" hint={`${form.special_request.length}/1000`}>
              Special request
            </Label>
            <textarea
              id="res-request"
              rows={3}
              maxLength={1000}
              value={form.special_request}
              onChange={update("special_request")}
              placeholder="Birthday setup, high chair, allergies, window seat…"
              className={`${fieldClass} resize-none`}
              style={inputStyle("special_request")}
            />
            <FieldError message={showErrors.special_request} />
          </div>

          <div className="sm:col-span-2">
            <Label hint="optional">Pre-order</Label>
            <PreOrderPicker
              key={open ? reservation?.id || "new" : "closed"}
              apiHost={apiHost}
              scope={scope}
              salesTypes={salesTypes}
              suggestedSalesType={suggestedSalesType}
              value={form.pre_order}
              onChange={(next) => {
                setForm((prev) => ({ ...prev, pre_order: next }));
                setServerError("");
              }}
            />
            <FieldError message={showErrors.pre_order} />
          </div>
        </div>

        {serverError ? (
          <div
            role="alert"
            className="mx-5 mb-1 rounded-xl px-4 py-3 font-[Poppins-Medium] text-[13px] sm:mx-6"
            style={{
              color: "#be123c",
              backgroundColor: "rgba(244,63,94,0.10)",
              border: "1px solid rgba(244,63,94,0.30)",
            }}
          >
            {serverError}
          </div>
        ) : null}

        <div
          className="flex gap-3 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--app-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-xl border px-4 py-3 font-[Poppins-SemiBold] text-[14px] transition hover:opacity-85"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-[2] rounded-xl px-4 py-3 font-[Poppins-SemiBold] text-[14px] text-[#fff] shadow-lg transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Save reservation"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReservationFormModal;
