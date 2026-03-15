import React, { useEffect } from "react";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useCustomQuery from "../../hooks/useCustomQuery";
import { colorSchemes } from "../../constants/ColorSchemes";

import "../../fonts/font-style.css";

const branchInfo = {
  title: "Point of Sales",
  subtitle: "Restaurant (Version: 1.0.1-1) Offline",
  branch: "CNC - STA MARIA",
  userName: "Supervisor Admin",
  userRole: "Manager",
  shiftStatus: "Closed",
  terminalNo: "1",
  shiftNo: "14",
  openingDate: "Feb 25, 2026 07:53 AM",
  openedBy: "Supervisor Admin",
  closedDate: "Feb 26, 2026 01:12 AM",
  closedBy: "Supervisor Admin",
};

const PosHomeScreenComponent = () => {
  const { userId } = useZustandLoginCred();

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
            <div className="text-[20px] font-black tracking-tight sm:text-[24px]">
              Recent Shift
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
