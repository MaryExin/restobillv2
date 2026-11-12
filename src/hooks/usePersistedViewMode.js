import { useCallback, useState } from "react";

/**
 * A screen's grid/list choice that stays "locked in" on this terminal: the
 * last view picked is saved in localStorage and comes back the next time
 * the screen opens (New Transaction and Bill / Folio Center).
 */
export function readPersistedViewMode(storageKey, allowedModes, fallback) {
  try {
    const stored = localStorage.getItem(storageKey);
    return allowedModes.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export default function usePersistedViewMode(storageKey, allowedModes, fallback) {
  const [viewMode, setViewModeState] = useState(() =>
    readPersistedViewMode(storageKey, allowedModes, fallback),
  );
  const setViewMode = useCallback(
    (mode) => {
      if (!allowedModes.includes(mode)) return;
      setViewModeState(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        /* storage unavailable: the choice lasts for this screen only */
      }
    },
    [storageKey, allowedModes],
  );
  return [viewMode, setViewMode];
}
