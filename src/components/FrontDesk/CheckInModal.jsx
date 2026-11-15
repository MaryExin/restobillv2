/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import useRoomReservations from "../../hooks/useRoomReservations";
import { posAuthenticatedFetch } from "../../utils/posAuthenticatedFetch";
import { reservationsEndpoint } from "../Reservations/reservationUtils";
import { frontDeskPost, todayKey } from "./frontDeskUtils";
import { Button, ErrorBox, Label, Modal, fieldClass, fieldStyle } from "./FrontDeskUi";

/** Check a guest in, or edit / move an in-house guest (stay given). */
const CheckInModal = ({ apiHost, rooms, inHouse, stay, presetRoom, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({
    room_name: stay?.room_name || presetRoom || "",
    guest_name: stay?.guest_name || "",
    guest_contact: stay?.guest_contact || "",
    guest_count: String(stay?.guest_count || 1),
    expected_check_out: stay?.expected_check_out || "",
    room_rate: stay?.room_rate ? String(stay.room_rate) : "",
    notes: stay?.notes || "",
  }));
  // Today's reservation for the room fills in the guest on a new check-in.
  const { getRoomReservation } = useRoomReservations(stay ? "" : apiHost);
  const reservation = !stay && form.room_name ? getRoomReservation(form.room_name) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const occupiedBy = useMemo(() => {
    const map = {};
    (inHouse || []).forEach((row) => {
      if (!stay || row.id !== stay.id) map[row.room_name] = row.guest_name;
    });
    return map;
  }, [inHouse, stay]);

  const set = (key) => (event) => {
    setError("");
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const applyReservation = () => {
    if (!reservation) return;
    setForm((prev) => ({
      ...prev,
      guest_name: reservation.guest_name || prev.guest_name,
      guest_contact: reservation.contact_number || prev.guest_contact,
      guest_count: String(reservation.guest_count || prev.guest_count),
      notes: prev.notes || String(reservation.special_request || "").slice(0, 500),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.room_name) return setError("Select the room.");
    if (form.guest_name.trim().length < 2) return setError("Enter the guest's name.");
    setBusy(true);
    setError("");
    try {
      const { message } = await frontDeskPost(apiHost, {
        action: stay ? "update_stay" : "check_in",
        id: stay?.id,
        ...form,
        guest_count: Number(form.guest_count) || 1,
      });
      // Mark the room's reservation as Arrived (best effort).
      if (reservation && reservation.status === "Booked" && reservation.guest_name === form.guest_name.trim()) {
        posAuthenticatedFetch(reservationsEndpoint(apiHost), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", id: reservation.id, status: "Arrived" }),
        }).catch(() => {});
      }
      onSaved(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={stay ? `Edit ${stay.folio_no}` : "Check In Guest"}
      subtitle={stay ? "Change the guest details or move the guest to another room." : "Opens a folio so outlet bills can be charged to the room."}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? <FaSpinner className="animate-spin" /> : null}
            {stay ? "Save" : "Check In"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fd-room">Room</Label>
          <select id="fd-room" value={form.room_name} onChange={set("room_name")} className={fieldClass} style={fieldStyle(false)}>
            <option value="">Select a room</option>
            {rooms.map((group) => (
              <optgroup key={group.floor} label={group.floor}>
                {group.rooms.map((room) => (
                  <option key={room} value={room} disabled={Boolean(occupiedBy[room])}>
                    {room}
                    {occupiedBy[room] ? ` — ${occupiedBy[room]}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {reservation ? (
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--app-accent)" }}>
            <span className="font-[Poppins-Medium] text-[13px]">
              Reserved today: {reservation.guest_name}
              {reservation.contact_number ? ` · ${reservation.contact_number}` : ""} ({reservation.status})
            </span>
            <button type="button" onClick={applyReservation} className="font-[Poppins-SemiBold] text-[12px] underline" style={{ color: "var(--app-accent)" }}>
              Use this guest
            </button>
          </div>
        ) : null}
        <div>
          <Label htmlFor="fd-guest">Guest name</Label>
          <input id="fd-guest" autoFocus maxLength={150} value={form.guest_name} onChange={set("guest_name")} placeholder="e.g. Juan Dela Cruz" className={fieldClass} style={fieldStyle(false)} />
        </div>
        <div>
          <Label htmlFor="fd-contact" hint="optional">Contact number</Label>
          <input id="fd-contact" maxLength={30} value={form.guest_contact} onChange={set("guest_contact")} className={fieldClass} style={fieldStyle(false)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fd-count">Guests</Label>
            <input id="fd-count" type="number" min="1" max="50" value={form.guest_count} onChange={set("guest_count")} className={fieldClass} style={fieldStyle(false)} />
          </div>
          <div>
            <Label htmlFor="fd-out" hint="optional">Check-out</Label>
            <input id="fd-out" type="date" min={todayKey()} value={form.expected_check_out} onChange={set("expected_check_out")} className={fieldClass} style={fieldStyle(false)} />
          </div>
        </div>
        <div>
          <Label htmlFor="fd-rate" hint="per night, VAT incl.">Room rate</Label>
          <input id="fd-rate" type="number" min="0" step="0.01" inputMode="decimal" value={form.room_rate} onChange={set("room_rate")} placeholder="Blank = no room charge" className={fieldClass} style={fieldStyle(false)} />
        </div>
        <div>
          <Label htmlFor="fd-notes" hint="optional">Notes</Label>
          <input id="fd-notes" maxLength={500} value={form.notes} onChange={set("notes")} placeholder="e.g. company booking, late check-out" className={fieldClass} style={fieldStyle(false)} />
        </div>
        <div className="sm:col-span-2">
          <ErrorBox message={error} />
        </div>
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Modal>
  );
};

export default CheckInModal;
