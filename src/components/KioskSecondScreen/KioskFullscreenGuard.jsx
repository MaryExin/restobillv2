import React from "react";
import { useKioskFullscreen } from "../../hooks/useKioskFullscreen";
import useZustandLayoutMode from "../../context/useZustandLayoutMode";

/**
 * Always mounted at the App root in Kiosk Mode.
 * - Manages fullscreen lifecycle via the hook.
 * - When the browser blocks the auto-request (gesture policy), renders a
 *   full-viewport transparent overlay so the very first user tap/click
 *   retries and enters fullscreen.
 */
const KioskFullscreenGuard = () => {
  const { layoutMode } = useZustandLayoutMode();
  const { needsGesture, enterFullscreen } = useKioskFullscreen();

  if (layoutMode !== "Kiosk" || !needsGesture) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center pb-10"
      onClick={enterFullscreen}
      onTouchStart={enterFullscreen}
      style={{ cursor: "default" }}
      aria-hidden="true"
    >
      {/* Subtle hint — visible but non-intrusive */}
      <div
        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white animate-pulse select-none"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.12)",
          letterSpacing: "0.08em",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          style={{ animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }}
        />
        TAP ANYWHERE TO ENTER FULL SCREEN
      </div>
    </div>
  );
};

export default KioskFullscreenGuard;
