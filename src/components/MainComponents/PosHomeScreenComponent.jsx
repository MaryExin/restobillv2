import React, { useEffect } from "react";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useCustomQuery from "../../hooks/useCustomQuery";
import { colorSchemes } from "../../constants/ColorSchemes";
import useZustandLayoutMode from "../../context/useZustandLayoutMode";
import useVersionLabel from "../../hooks/useVersionLabel";

import "../../fonts/font-style.css";

const branchInfoBase = {
  title: "Point of Sales",
  branch: "CNC - STA MARIA",
  userName: "Supervisor Admin",
  userRole: "Manager",
  shiftStatus: "Closed",
  terminalNo: localStorage.getItem("posTerminalNumber") || "1",
  shiftNo: "14",
  openingDate: "Feb 25, 2026 07:53 AM",
  openedBy: "Supervisor Admin",
  closedDate: "Feb 26, 2026 01:12 AM",
  closedBy: "Supervisor Admin",
};

const PosHomeScreenComponent = () => {
  const { userId } = useZustandLoginCred();
  const { layoutMode } = useZustandLayoutMode();
  const versionLabel = useVersionLabel();
  const branchInfo = {
    ...branchInfoBase,
    subtitle: `${versionLabel} Offline`,
  };

  const { data: userSelectedTheme } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_SELECTED_THEME_ENDPOINT,
    "userthemes",
  );

  const applyPalette = (palette) => {
    if (!palette?.colors) return;
    const root = document.documentElement;

    Object.entries(palette.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  };

  useEffect(() => {
    if (userSelectedTheme && userSelectedTheme.length > 0) {
      const themeSelected = userSelectedTheme.filter(
        (items) => items.userid === userId,
      );

      if (themeSelected.length > 0) {
        const palette = colorSchemes.filter(
          (colors) => colors.name === themeSelected[0].theme,
        );
        applyPalette(palette[0]);
      } else {
        applyPalette(colorSchemes[0]);
      }
    } else {
      applyPalette(colorSchemes[0]);
    }
  }, [userSelectedTheme, userId]);

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[390px] rounded-[24px] p-[1px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:rounded-[28px]">
        <div
          className="rounded-[24px] px-4 py-4 text-white sm:rounded-[28px] sm:px-6 sm:py-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(111,63,220,0.92) 0%, rgba(110,105,243,0.86) 38%, rgba(92,168,255,0.82) 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[20px] font-black tracking-tight sm:text-[24px]">
                Recent Shift
              </div>
              {layoutMode === "Kiosk" && (
                <button
                  type="button"
                  title="Exit Fullscreen"
                  onClick={() => {
                    if (window.kioskAPI?.setFullScreen) {
                      window.kioskAPI.setFullScreen(false).catch(() => {});
                    } else if (document.fullscreenElement) {
                      document.exitFullscreen();
                    }
                  }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 transition"
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                </button>
              )}
            </div>
            <div className="text-[24px] font-black leading-none text-orange-500 sm:text-[32px]">
              {branchInfo.shiftStatus}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-[12px] sm:text-[14px]">
            {[
              ["Terminal#:", branchInfo.terminalNo],
              ["Shift #:", branchInfo.shiftNo],
              ["Opening Date:", branchInfo.openingDate],
              ["Opened By:", branchInfo.openedBy],
              ["Closed Date:", branchInfo.closedDate],
              ["Closed By:", branchInfo.closedBy],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 sm:grid-cols-[118px_minmax(0,1fr)]"
              >
                <div className="font-semibold text-white/90">{label}</div>
                <div className="font-medium text-white/85">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosHomeScreenComponent;
