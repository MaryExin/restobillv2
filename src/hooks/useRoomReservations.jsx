import { useCallback, useEffect, useState } from "react";
import { posAuthenticatedFetch } from "../utils/posAuthenticatedFetch";
import {
  localDateKey,
  normalizeRoomName,
  reservationsEndpoint,
} from "../components/Reservations/reservationUtils";

/**
 * Today's active reservations (Booked / Arrived) keyed by room name, so the
 * ordering screen can mark reserved rooms. A reservation only shows on its
 * own reservation date. Refreshes every minute (also picks up the new day).
 */
const useRoomReservations = (apiHost, refreshMs = 60000) => {
  const [byRoom, setByRoom] = useState({});

  useEffect(() => {
    if (!apiHost) return undefined;

    let cancelled = false;
    const load = async () => {
      try {
        const url = `${reservationsEndpoint(apiHost)}?date=${localDateKey()}&status=Booked,Arrived`;
        const response = await posAuthenticatedFetch(url);
        const result = await response.json();
        if (cancelled) return;

        const map = {};
        const rows = Array.isArray(result?.data?.reservations)
          ? result.data.reservations
          : [];
        rows.forEach((row) => {
          const key = normalizeRoomName(row.table_name);
          if (!key) return;
          if (!map[key]) map[key] = [];
          map[key].push(row);
        });
        setByRoom(map);
      } catch {
        if (!cancelled) setByRoom({});
      }
    };

    load();
    const timer = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apiHost, refreshMs]);

  // Accepts merged names like "Room 101 & Room 102". Prefers a guest who has
  // already arrived, otherwise the earliest booking of the day.
  const getRoomReservation = useCallback(
    (roomName) => {
      const names = String(roomName ?? "").split(" & ");
      for (const name of names) {
        const list = byRoom[normalizeRoomName(name)];
        if (list && list.length) {
          return list.find((row) => row.status === "Arrived") || list[0];
        }
      }
      return null;
    },
    [byRoom],
  );

  return { getRoomReservation };
};

export default useRoomReservations;
