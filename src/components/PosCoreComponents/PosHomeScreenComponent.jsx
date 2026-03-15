"use client";

import React, { useEffect, useMemo, useState } from "react";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { colorSchemes } from "../../constants/ColorSchemes";
import "../../fonts/font-style.css";
import useApiHost from "../../hooks/useApiHost";
const PosHomeScreenComponent = () => {
  const { userId } = useZustandLoginCred();
  
  // Update 'your_project_name' to match your htdocs folder
   const apiHost = useApiHost();

  const [dateselection, setDateSelection] = useState(null);
  const [userSelectedTheme, setUserSelectedTheme] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data using the same pattern as your Login component
  useEffect(() => {
    const fetchShiftData = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        // 1. Fetch Shift Details
        const response = await fetch(`${apiHost}/api/get_shift_details.php?user_id=${userId}`);
        const result = await response.json();
        setDateSelection(result);

        // 2. Fetch Theme (Simulating the endpoint in your login style)
        // Adjust the theme endpoint path if different
        const themeResponse = await fetch(`${apiHost}/api/read_selected_theme.php?user_id=${userId}`);
        const themeResult = await themeResponse.json();
        setUserSelectedTheme(themeResult);
        
      } catch (error) {
        console.error("Error fetching POS data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShiftData();
  }, [userId, apiHost]);

  const formatDisplayDate = (dateValue) => {
    if (!dateValue || dateValue === "0000-00-00 00:00:00" || dateValue === "0000-00-00") {
      return "N/A";
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const branchInfo = useMemo(() => {
    return {
      title: "Point of Sales",
      subtitle: "Restaurant (Version: 1.0.1-1) Offline",
      branch: dateselection?.Unit_Name,
      userName: "",
      userRole: "Manager",
      shiftStatus: dateselection?.Shift_Status || "Closed",
      terminalNo: "1",
      shiftNo: dateselection?.Shift_ID || "N/A",
      openingDate: dateselection?.Opening_DateTime
        ? formatDisplayDate(dateselection.Opening_DateTime)
        : "N/A",
      openedBy: dateselection?.opened_by_name || "N/A",
      closedDate: dateselection?.Closing_DateTime
        ? formatDisplayDate(dateselection.Closing_DateTime)
        : "N/A",
      closedBy: dateselection?.closed_by_name || "N/A",
    };
  }, [dateselection]);

  // Theme apply logic
  useEffect(() => {
    const applyPalette = (palette) => {
      if (!palette?.colors) return;
      const root = document.documentElement;
      Object.entries(palette.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
    };

    if (userSelectedTheme && userSelectedTheme.length > 0) {
      const themeSelected = userSelectedTheme.filter((item) => item.userid === userId);
      if (themeSelected.length > 0) {
        const palette = colorSchemes.find((c) => c.name === themeSelected[0].theme);
        applyPalette(palette || colorSchemes[0]);
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
            <div
              className={`text-[24px] font-black leading-none sm:text-[32px] ${
                branchInfo.shiftStatus === "Open" ? "text-green-600" : "text-orange-500"
              }`}
            >
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