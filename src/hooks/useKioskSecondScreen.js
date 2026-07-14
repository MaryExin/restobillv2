import { useEffect } from "react";
import useZustandLayoutMode from "../context/useZustandLayoutMode";

/**
 * Manages the customer-facing second monitor window in Kiosk Mode.
 * - Opens a dedicated BrowserWindow on the secondary display when Kiosk Mode is active.
 * - Closes it automatically when switching back to Restaurant mode.
 * - No-ops gracefully in browser / non-Electron environments.
 */
export function useKioskSecondScreen() {
  const { layoutMode } = useZustandLayoutMode();

  useEffect(() => {
    if (!window.kioskAPI) return;

    if (layoutMode !== "Kiosk") {
      window.kioskAPI.closeSecondScreen().catch(() => {});
      return;
    }

    window.kioskAPI
      .getScreens()
      .then(({ hasSecondary }) => {
        if (hasSecondary) {
          window.kioskAPI.openSecondScreen().catch(console.error);
        }
      })
      .catch(console.error);
  }, [layoutMode]);
}
