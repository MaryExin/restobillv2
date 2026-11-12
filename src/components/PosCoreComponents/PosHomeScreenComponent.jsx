"use client";

import React, { useEffect, useMemo, useState } from "react";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import "../../fonts/font-style.css";
import useApiHost from "../../hooks/useApiHost";
import useVersionLabel from "../../hooks/useVersionLabel";
import { getConfiguredRoleLabel } from "../../utils/posRoleAccessConfig";
import { posAuthenticatedFetch } from "../../utils/posAuthenticatedFetch";
import { usePosDeveloperSession } from "../../hooks/usePosRoleAccessConfig";
import {
  FaCalendarAlt,
  FaCalendarCheck,
  FaUser,
  FaUserCheck,
} from "react-icons/fa";

const PosHomeScreenComponent = () => {
  const { userId } = useZustandLoginCred();
  const apiHost = useApiHost();
  const versionLabel = useVersionLabel();
  const developerMode = usePosDeveloperSession();

  const [dateselection, setDateSelection] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // Live clock for the greeting card (minute precision is enough).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchShiftData = async () => {
      if (!userId) return;

      try {
        const response = await posAuthenticatedFetch(
          `${apiHost}/api/get_shift_details.php?user_id=${userId}`,
        );

        const result = await response.json();

        if (result.userName) {
          localStorage.setItem("Cashier", result.userName);
        }

        setDateSelection(result);
      } catch (error) {
        console.error("Error fetching POS data:", error);
      }
    };

    fetchShiftData();

    // expose refresh function globally
    window.refreshShiftPanel = fetchShiftData;
  }, [userId, apiHost]);

  const formatDisplayDate = (dateValue) => {
    if (
      !dateValue ||
      dateValue === "0000-00-00 00:00:00" ||
      dateValue === "0000-00-00" ||
      dateValue === "N/A"
    ) {
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
    // Standardize status to handle case sensitivity
    const status = dateselection?.Shift_Status || "Closed";

    return {
      title: "Point of Sales",
      subtitle: `${versionLabel} Offline`,
      branch: dateselection?.Unit_Name || "N/A",
      userName: dateselection?.userName || "Guest",
      userRole: getConfiguredRoleLabel(
        dateselection?.userRoleValue || dateselection?.userRole || "User",
      ),
      shiftStatus: status, // This will be "Open" or "Closed"
      terminalNo: dateselection?.terminal_number || "1",
      shiftNo: dateselection?.Shift_ID || "N/A",
      openingDate: dateselection?.Opening_DateTime
        ? formatDisplayDate(dateselection.Opening_DateTime)
        : "N/A",
      openedBy: dateselection?.opened_by_name || "N/A",
      closedDate:
        dateselection?.Closing_DateTime &&
        dateselection.Closing_DateTime !== "0000-00-00 00:00:00"
          ? formatDisplayDate(dateselection.Closing_DateTime)
          : "N/A",
      closedBy: dateselection?.closed_by_name || "N/A",
    };
  }, [dateselection, versionLabel]);

  const isOpen = branchInfo.shiftStatus.toLowerCase() === "open";
  const displayName = developerMode
    ? localStorage.getItem("username") || "POS Developer"
    : branchInfo.userName;

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const timeParts = now
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .split(" ");
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const glass =
    "border border-white/15 bg-[rgba(30,10,60,0.46)] shadow-[0_18px_44px_rgba(0,0,0,0.30)] backdrop-blur-md";

  const shiftRows = [
    { icon: FaCalendarAlt, label: "Opened", value: branchInfo.openingDate },
    { icon: FaUser, label: "Opened by", value: branchInfo.openedBy },
    { icon: FaCalendarCheck, label: "Closed", value: branchInfo.closedDate },
    { icon: FaUserCheck, label: "Closed by", value: branchInfo.closedBy },
  ];

  return (
    <div className="flex flex-col gap-4 text-[#fff] lg:flex-row lg:items-start lg:justify-between">
      {/* Greeting + live clock */}
      <section className={`w-full rounded-[26px] p-5 sm:p-6 lg:max-w-[340px] ${glass}`}>
        <div className="font-[Poppins-Medium] text-[11px] uppercase tracking-[0.2em] text-[#f8dc8b]">
          {greeting}
        </div>
        <div className="mt-1 truncate font-[Poppins-Bold] text-[20px] sm:text-[22px]">
          {displayName}
        </div>
        <div className="mt-5 font-[Poppins-Bold] text-[46px] leading-none tracking-tight tabular-nums sm:text-[54px]">
          {timeParts[0]}
          <span className="ml-2 text-[18px] text-[rgba(255,255,255,0.7)] sm:text-[20px]">
            {timeParts[1]}
          </span>
        </div>
        <div className="mt-2 font-[Poppins-Medium] text-[13px] text-[rgba(255,255,255,0.75)] sm:text-[14px]">
          {dateLabel}
        </div>
      </section>

      {/* Current shift */}
      <section className={`w-full rounded-[26px] p-5 sm:p-6 lg:max-w-[370px] ${glass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-[Poppins-Medium] text-[11px] uppercase tracking-[0.2em] text-[rgba(255,255,255,0.6)]">
              Current Shift
            </div>
            <div className="mt-1 truncate font-[Poppins-Bold] text-[24px] leading-tight sm:text-[26px]">
              {isOpen ? `Shift #${branchInfo.shiftNo}` : "No open shift"}
            </div>
            <div className="font-[Poppins-Medium] text-[13px] text-[rgba(255,255,255,0.65)]">
              Terminal {branchInfo.terminalNo}
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 font-[Poppins-SemiBold] text-[12px] ring-1 ${
              isOpen
                ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/40"
                : "bg-amber-400/15 text-amber-200 ring-amber-300/40"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isOpen ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            {branchInfo.shiftStatus}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {shiftRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f8dc8b]">
                <Icon className="text-[14px]" />
              </span>
              <div className="min-w-0">
                <div className="font-[Poppins-Medium] text-[10.5px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.55)]">
                  {label}
                </div>
                <div className="truncate font-[Poppins-SemiBold] text-[14px]">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-5 rounded-2xl px-4 py-3 font-[Poppins-Medium] text-[12.5px] leading-snug ring-1 ${
            isOpen
              ? "bg-emerald-400/10 text-emerald-100 ring-emerald-300/30"
              : "bg-amber-400/10 text-amber-100 ring-amber-300/30"
          }`}
        >
          {isOpen ? (
            <>
              Shift is open. Tap{" "}
              <span className="font-[Poppins-SemiBold] text-[#f8dc8b]">
                New Transaction
              </span>{" "}
              to take orders.
            </>
          ) : (
            <>
              Tap{" "}
              <span className="font-[Poppins-SemiBold] text-amber-200">
                Open New Day
              </span>{" "}
              to start taking orders.
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default PosHomeScreenComponent;
