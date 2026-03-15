"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  FaHome,
  FaBoxOpen,
  FaReceipt,
  FaClipboardList,
  FaHistory,
  FaFileAlt,
  FaUserCircle,
} from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { HiOutlineStatusOnline } from "react-icons/hi";
import { useNavigate } from "react-router-dom";

// Components
import PosQuickActionTile from "../PosCoreComponents/Common/PosQuickActionTile";
import OpenNewDay from "../PosCoreComponents/Actions/OpenNewDay";
import SwitchUser from "../PosCoreComponents/Actions/SwitchUser";
import PosReading from "../PosCoreComponents/Actions/PosReading";
import PosReports from "../PosCoreComponents/PosReports";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";

// Hooks & Context
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useApiHost from "../../hooks/useApiHost";

const POS_HOME_BG = "/pos-home-bg.png";
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 118;

const LayoutPos = ({ children }) => {
  const navigate = useNavigate();
  const apiHost = useApiHost();

  const { userId } = useZustandLoginCred();

  const [dateselection, setDateSelection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPosReadingOpen, setIsPosReadingOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // 🔹 FETCH SHIFT DETAILS
  useEffect(() => {
    const fetchShiftData = async () => {
      if (!userId) return;

      setIsLoading(true);

      try {
        const response = await fetch(
          `${apiHost}/api/get_shift_details.php?user_id=${userId}`
        );

        const result = await response.json();

        setDateSelection(result);
      } catch (error) {
        console.error("Error fetching shift details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShiftData();
  }, [userId, apiHost]);

  // 🔹 BRANCH INFO
  const branchInfo = useMemo(() => {
    return {
      title: "Point of Sales",
      subtitle: "Restaurant (Version: 1.0.1-1) Offline",
      branch: dateselection?.Unit_Name || "N/A",
      userName: dateselection?.userName || "Guest",
      userRole: dateselection?.userRole || "User",
      shiftStatus: dateselection?.Shift_Status || "Closed",
      terminalNo: "1",
      shiftNo: dateselection?.Shift_ID || "0",
      openingDate: dateselection?.Opening_DateTime || "N/A",
      openedBy: dateselection?.opened_by_name || "N/A",
      closedDate: dateselection?.Closing_DateTime || "N/A",
      closedBy: dateselection?.closed_by_name || "N/A",
    };
  }, [dateselection]);

  const isClosed = branchInfo.shiftStatus !== "Open";

  const COLORS = {
    brandSecondary: "var(--color-brandSecondary, #169b43)",
  };

  // 🔹 LOGOUT BUTTON CLICK
  const handleClose = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false);

    localStorage.removeItem("posTerminalNumber");

    navigate("/");
  };

  const handleLogoutCancel = () => {
    setIsLogoutConfirmOpen(false);
  };

  const quickActions = (
    <>
      <PosQuickActionTile
        label="Home"
        icon={<FaHome className="text-[28px] sm:text-[30px]" />}
        color="green"
        onClick={() => navigate("/poscorehomescreen")}
      />

      <PosQuickActionTile
        label="Product List"
        icon={<FaBoxOpen className="text-[28px] sm:text-[30px]" />}
        color="violet"
        onClick={() => {}}
      />

      <OpenNewDay />

      <PosQuickActionTile
        label="New Transaction"
        icon={<FaReceipt className="text-[28px] sm:text-[30px]" />}
        color="orange"
        disabled={isClosed}
        onClick={() => !isClosed && navigate("/posNewTransaction")}
      />

      <PosQuickActionTile
        label="Orders"
        icon={<FaClipboardList className="text-[28px] sm:text-[30px]" />}
        color="orange"
        onClick={() => {}}
      />

      <PosQuickActionTile
        label="Trans. Records"
        icon={<FaHistory className="text-[28px] sm:text-[30px]" />}
        color="orange"
        disabled={isClosed}
        onClick={() => !isClosed && navigate("/posTransactionRecord")}
      />

      <SwitchUser disabled={isClosed} />

      <PosQuickActionTile
        label="POS Reading"
        icon={<FaFileAlt className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        disabled={isClosed}
        onClick={() => !isClosed && setIsPosReadingOpen(true)}
      />

      <PosQuickActionTile
        label="Reports"
        icon={<FaFileAlt className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        onClick={() => setIsReportsOpen(true)}
      />
    </>
  );

  return (
    <div className="theme-page relative h-screen w-full overflow-hidden bg-[#dfe4ef]">

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutConfirmOpen && (
        <ModalYesNoReusable
          header="Logout Confirmation"
          message="Are you sure you want to exit POS?"
          setYesNoModalOpen={setIsLogoutConfirmOpen}
          triggerYesNoEvent={handleLogoutConfirm}
          triggerNoEvent={handleLogoutCancel}
          yesLabel="Logout"
          noLabel="Cancel"
        />
      )}

      {/* MODALS */}
      <PosReading
        isOpen={isPosReadingOpen}
        onClose={() => setIsPosReadingOpen(false)}
        onXReadingSubmit={() => setIsPosReadingOpen(false)}
        onZReadingSubmit={() => setIsPosReadingOpen(false)}
      />

      <PosReports open={isReportsOpen} onClose={() => setIsReportsOpen(false)} />

      {/* BACKGROUND */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${POS_HOME_BG})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="relative z-10 w-full h-screen overflow-hidden">

        {/* HEADER */}
        <header
          className="fixed top-0 left-0 right-0 z-40 px-3 py-2 border-b sm:px-4"
          style={{
            height: `${HEADER_HEIGHT}px`,
            background:
              "linear-gradient(180deg, rgba(102,213,215,0.96) 0%, rgba(125,217,222,0.92) 100%)",
            borderColor: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">
              <div className="text-[18px] font-black text-slate-800 sm:text-[20px]">
                {branchInfo.title}
              </div>

              <div className="mt-1 text-[10px] font-medium text-slate-600 sm:text-[12px]">
                {branchInfo.subtitle}
              </div>

              <div className="flex items-center gap-2 mt-2 text-slate-800">
                <HiOutlineStatusOnline
                  className="text-[17px]"
                  style={{ color: COLORS.brandSecondary }}
                />

                <div className="text-[16px] font-black sm:text-[18px]">
                  {branchInfo.branch}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3">

              <div className="hidden pr-1 text-right sm:block">
                <div className="text-[14px] font-black text-slate-800">
                  {branchInfo.userName}
                </div>

                <div className="text-[12px] font-medium text-slate-700">
                  {branchInfo.userRole}
                </div>
              </div>

              <div className="grid h-11 w-11 place-items-center rounded-full border border-white/75 bg-white/90 shadow-lg sm:h-12 sm:w-12">
                <FaUserCircle className="text-[30px] text-blue-500 sm:text-[34px]" />
              </div>

              <button
                onClick={handleClose}
                className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg sm:h-12 sm:w-12 transition-transform active:scale-90"
                style={{
                  background: "linear-gradient(180deg, #ff6825 0%, #ef4b17 100%)",
                }}
              >
                <FiX className="text-[22px]" />
              </button>
            </div>
          </div>

          <div className="absolute left-0 right-0 flex items-center justify-between px-4 -bottom-6">
            <div className="flex gap-4 px-3 py-1 bg-white/40 backdrop-blur-md rounded-full text-[10px] font-bold text-slate-700 border border-white/50">
              <span>Terminal: {branchInfo.terminalNo}</span>
              <span>Shift: {branchInfo.shiftNo}</span>
              <span
                className={
                  branchInfo.shiftStatus === "Open"
                    ? "text-green-700"
                    : "text-orange-600"
                }
              >
                Status: {branchInfo.shiftStatus}
              </span>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main
          className="h-full px-3 overflow-y-auto sm:px-4"
          style={{
            paddingTop: `${HEADER_HEIGHT + 28}px`,
            paddingBottom: `${FOOTER_HEIGHT + 16}px`,
          }}
        >
          {children}
        </main>

        {/* FOOTER */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-2 pb-3 sm:px-4 sm:pb-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(223,228,239,0.1) 0%, rgba(223,228,239,0.98) 100%)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex flex-wrap gap-2 sm:gap-2.5">{quickActions}</div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPos;