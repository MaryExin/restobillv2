import { useCallback, useEffect, useState } from "react";
import useZustandLayoutMode from "../context/useZustandLayoutMode";

/**
 * In Kiosk Mode, maximizes the main operator window via Electron IPC.
 * The second screen window is opened with fullscreen:true separately.
 * We do NOT use document.requestFullscreen on the main window.
 */
export function useKioskFullscreen() {
  const { layoutMode } = useZustandLayoutMode();
  const isKiosk = layoutMode === "Kiosk";
  const [needsGesture] = useState(false);

  const enterFullscreen = useCallback(async () => {
    if (window.kioskAPI?.setFullScreen) {
      await window.kioskAPI.setFullScreen(true).catch(() => {});
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (window.kioskAPI?.setFullScreen) {
      await window.kioskAPI.setFullScreen(false).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isKiosk) {
      exitFullscreen();
      return;
    }
    enterFullscreen();
  }, [isKiosk, enterFullscreen, exitFullscreen]);

  return { needsGesture, enterFullscreen };
}
