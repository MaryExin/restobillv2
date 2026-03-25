"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaBoxOpen,
  FaReceipt,
  FaClipboardList,
  FaHistory,
  FaFileAlt,
  FaCog,
  FaUserCircle,
  FaUtensils,
  FaWallet,
  FaChartPie,
  FaPowerOff,
  FaMoneyBill,
} from "react-icons/fa";
import { HiOutlineStatusOnline } from "react-icons/hi";
import { IoMdClose } from "react-icons/io";

import OpenNewDay from "../PosCoreComponents/Actions/OpenNewDay";
import SwitchUser from "../PosCoreComponents/Actions/SwitchUser";
import PosReadingModal from "../MainComponents/PosReadingModal";
import PosReports from "../PosCoreComponents/PosReports";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import PosSettings from "../MainComponents/PosSettings"; // Added import

import Ordering from "../../assets/Ordering.jpg";
import Billing from "../../assets/Billing.jpg";

import { useTheme } from "../../context/ThemeContext";
import PosQuickActionTile from "../MainComponents/Common/PosQuickActionTile";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useApiHost from "../../hooks/useApiHost";

const POS_HOME_BG = ".//pos-home-bg.png";
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 118;

const LayoutPos = ({ children }) => {
  const navigate = useNavigate();
  const apiHost = useApiHost();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { userId } = useZustandLoginCred();

  const [dateselection, setDateSelection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPosReadingOpen, setIsPosReadingOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Added state

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [dashboardPassword, setDashboardPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const fetchShiftData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiHost}/api/get_shift_details.php?user_id=${userId}`,
      );
      const result = await response.json();
      console.log("LayoutPos shift refresh:", result);
      setDateSelection(result);
    } catch (error) {
      console.error("Error fetching shift details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, apiHost]);

  useEffect(() => {
    fetchShiftData();
    window.refreshLayoutShift = fetchShiftData;
    return () => {
      if (window.refreshLayoutShift === fetchShiftData) {
        delete window.refreshLayoutShift;
      }
    };
  }, [fetchShiftData]);

  const branchInfo = useMemo(() => {
    return {
      title: "Point of Sales",
      subtitle: "Restaurant (Version: 1.0.1-1) Offline",
      branch: dateselection?.Unit_Name || "N/A",
      userName: dateselection?.userName || "Guest",
      userRole: dateselection?.userRole || "User",
      shiftStatus: dateselection?.Shift_Status || "Closed",
      terminalNo: localStorage.getItem("posTerminalNumber") || "1",
      shiftNo: dateselection?.Shift_ID || "0",
      openingDate: dateselection?.Opening_DateTime || "N/A",
      openedBy: dateselection?.opened_by_name || "N/A",
      closedDate: dateselection?.Closing_DateTime || "N/A",
      closedBy: dateselection?.closed_by_name || "N/A",
      categoryCode:
        dateselection?.Category_Code ||
        localStorage.getItem("posBusinessCategoryCode") ||
        "",
      unitCode:
        dateselection?.Unit_Code ||
        localStorage.getItem("posBusinessUnitCode") ||
        "",
      corpName:
        dateselection?.Corp_Name ||
        localStorage.getItem("posCorpName") ||
        "N/A",
    };
  }, [dateselection]);

  const isClosed = branchInfo.shiftStatus?.toLowerCase() !== "open";
  const COLORS = { brandSecondary: "var(--color-brandSecondary, #169b43)" };

  const handleClose = () => {
    setIsLogoutConfirmOpen(true);
  };
  const handleLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false);
    localStorage.removeItem("posTerminalNumber");
    localStorage.clear();
    navigate("/");
  };
  const handleLogoutCancel = () => {
    setIsLogoutConfirmOpen(false);
  };

  const handleCardClick = (item) => {
    if (item.id === "salesdashboard") {
      setShowPasswordModal(true);
      setDashboardPassword("");
      setPasswordError("");
      return;
    }
    if (
      (item.id === "ordering" ||
        item.id === "billing" ||
        item.id === "transactionrecords") &&
      isClosed
    )
      return;
    navigate(item.path);
  };

  const handlePasswordSubmit = () => {
    if (dashboardPassword === "1234") {
      setShowPasswordModal(false);
      setDashboardPassword("");
      setPasswordError("");
      navigate("/salesdashboard");
      return;
    }
    setPasswordError("Incorrect password.");
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setDashboardPassword("");
    setPasswordError("");
  };

  const menuOptions = useMemo(
    () => [
      {
        id: "salesdashboard",
        title: "Sales Dashboard",
        description: "View summary, sales performance, and business insights.",
        image: Billing,
        path: "/salesdashboard",
        icon: <FaChartPie className="text-[26px]" />,
        badge: "Restricted",
      },
    ],
    [],
  );

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
        onClick={() => navigate("/productlist")}
      />

      <PosQuickActionTile
        label="Products & Price Syncing"
        icon={<FaMoneyBill className="text-[28px] sm:text-[30px]" />}
        color="violet"
        onClick={() => navigate("/pricesyncing")} // Dapat pareho ito sa path sa App.js
      />

      <OpenNewDay />

      <PosQuickActionTile
        label="New Transaction"
        icon={<FaReceipt className="text-[28px] sm:text-[30px]" />}
        color="orange"
        disabled={isClosed}
        onClick={() => !isClosed && navigate("/ordering")}
      />
      <PosQuickActionTile
        label="Billing"
        icon={<FaReceipt className="text-[28px] sm:text-[30px]" />}
        color="violet"
        disabled={isClosed}
        onClick={() => !isClosed && navigate("/printbilling")}
      />

      <PosQuickActionTile
        label="Payment"
        icon={<FaReceipt className="text-[28px] sm:text-[30px]" />}
        color="green"
        onClick={() => navigate("/payments")}
        disabled={isClosed}
      />

      {/* <PosQuickActionTile
        label="Trans. Records"
        icon={<FaHistory className="text-[28px] sm:text-[30px]" />}
        color="orange"
        disabled={isClosed}
        onClick={() => !isClosed && navigate("/transactionrecords")}
      /> */}

      <SwitchUser />
      <PosQuickActionTile
        label="POS Reading"
        icon={<FaFileAlt className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        disabled={isClosed}
        onClick={() => setIsPosReadingOpen(true)}
      />
      <PosQuickActionTile
        label="POS Reports"
        icon={<FaChartPie className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        onClick={() => setIsReportsOpen(true)}
      />

      {menuOptions.map((item) => {
        const disabled =
          item.id !== "salesdashboard" &&
          (item.id === "ordering" ||
            item.id === "billing" ||
            item.id === "transactionrecords")
            ? isClosed
            : false;
        return (
          <PosQuickActionTile
            key={item.id}
            label={item.title}
            icon={React.cloneElement(item.icon, {
              className: "text-[28px] sm:text-[30px]",
            })}
            color={
              disabled
                ? "slate"
                : item.id === "ordering"
                  ? "orange"
                  : item.id === "billing"
                    ? "violet"
                    : item.id === "salesdashboard"
                      ? "indigo"
                      : item.id === "transactionrecords"
                        ? "green"
                        : item.id === "payment"
                          ? "blue"
                          : "slate"
            }
            disabled={disabled}
            onClick={() => !disabled && handleCardClick(item)}
          />
        );
      })}
    </>
  );

  return (
    <div
      className={`theme-page relative h-screen w-full overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#0f172a]" : "bg-[#dfe4ef]"}`}
    >
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
      <PosReadingModal
        open={isPosReadingOpen}
        onClose={() => setIsPosReadingOpen(false)}
        onZReadingPrinted={fetchShiftData}
        selectedCashier="All Cashiers"
        categoryCode={branchInfo.categoryCode}
        unitCode={branchInfo.unitCode}
        terminalNumber={branchInfo.terminalNo}
        corpName={branchInfo.corpName}
        shiftingDate={dateselection?.Opening_DateTime?.split(" ")[0]}
        xEndpoint="/api/generate_x_reading_pdf.php"
        zEndpoint="/api/generate_z_reading_data.php"
      />
      <PosReports
        open={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
      />

      {/* Settings Modal Hook */}
      <PosSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        branchInfo={branchInfo}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${POS_HOME_BG})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className={`absolute inset-0 ${isDark ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.78),rgba(2,6,23,0.82)_28%,rgba(2,6,23,0.88)_70%,rgba(2,6,23,0.92)_100%)]" : "bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08)_26%,rgba(255,255,255,0.18)_70%,rgba(255,255,255,0.12)_100%)]"}`}
      />

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className={`fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm ${isDark ? "bg-black/55" : "bg-slate-900/30"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className={`w-full max-w-md rounded-[28px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.25)] ${isDark ? "border-white/10 bg-slate-950" : "border-white/70 bg-white"}`}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2
                    className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Sales Dashboard
                  </h2>
                  <p
                    className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Enter password to continue.
                  </p>
                </div>
                <button
                  onClick={handleClosePasswordModal}
                  className={`grid h-10 w-10 place-items-center rounded-full transition-all ${isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
                >
                  <IoMdClose size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="password"
                  value={dashboardPassword}
                  onChange={(e) => {
                    setDashboardPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePasswordSubmit();
                  }}
                  placeholder="Enter password"
                  className={`w-full rounded-2xl border px-5 py-4 outline-none transition-all ${isDark ? "border-slate-800 bg-slate-900/60 text-white focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-500/10" : "border-slate-300 bg-slate-50 text-slate-900 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"}`}
                />
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClosePasswordModal}
                    className={`flex-1 rounded-2xl px-5 py-4 font-semibold transition-all ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordSubmit}
                    className="flex-1 px-5 py-4 font-bold text-white transition-all rounded-2xl bg-gradient-to-b from-cyan-500 to-sky-600 hover:brightness-110"
                  >
                    Enter
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full h-screen overflow-hidden">
        <header
          className="fixed top-0 left-0 right-0 z-40 px-3 py-2 border-b sm:px-4"
          style={{
            height: `${HEADER_HEIGHT}px`,
            background: isDark
              ? "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.92) 100%)"
              : "linear-gradient(180deg, rgba(102,213,215,0.96) 0%, rgba(125,217,222,0.92) 100%)",
            borderColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.75)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`text-[18px] leading-none font-black sm:text-[20px] ${isDark ? "text-white" : "text-slate-800"}`}
              >
                {branchInfo.title}
              </div>
              <div
                className={`mt-1 text-[10px] font-medium sm:text-[12px] ${isDark ? "text-slate-300" : "text-slate-600"}`}
              >
                {branchInfo.subtitle}
              </div>
              <div
                className={`mt-2 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}
              >
                <HiOutlineStatusOnline
                  className="text-[17px]"
                  style={{ color: COLORS.brandSecondary }}
                />
                <div className="text-[16px] font-black tracking-tight sm:text-[18px]">
                  {isLoading ? "Loading..." : branchInfo.branch}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="hidden pr-1 text-right sm:block">
                <div
                  className={`text-[14px] font-black ${isDark ? "text-white" : "text-slate-800"}`}
                >
                  {branchInfo.userName}
                </div>
                <div
                  className={`text-[12px] font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
                >
                  {branchInfo.userRole}
                </div>
              </div>
              <div
                className={`grid h-11 w-11 place-items-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:h-12 sm:w-12 ${isDark ? "border-white/10 bg-white/10" : "border-white/75 bg-white/90"}`}
              >
                <FaUserCircle className="text-[30px] text-blue-500 sm:text-[34px]" />
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] sm:h-12 sm:w-12"
                style={{
                  background:
                    "linear-gradient(180deg, #ff6825 0%, #ef4b17 100%)",
                }}
              >
                <FaPowerOff className="text-[22px]" />
              </button>
            </div>
          </div>
          <div className="absolute left-0 right-0 flex items-center justify-between px-4 -bottom-6">
            <div
              className={`flex gap-4 rounded-full border px-3 py-1 text-[10px] font-bold backdrop-blur-md ${isDark ? "border-white/10 bg-white/10 text-slate-200" : "border-white/50 bg-white/40 text-slate-700"}`}
            >
              <span>Terminal: {branchInfo.terminalNo}</span>
              <span>Shift: {branchInfo.shiftNo}</span>
              <span
                className={
                  branchInfo.shiftStatus === "Open"
                    ? "text-green-600"
                    : "text-orange-500"
                }
              >
                Status: {branchInfo.shiftStatus}
              </span>
            </div>
          </div>
        </header>

        <main
          className="h-full px-3 overflow-y-auto sm:px-4"
          style={{
            paddingTop: `${HEADER_HEIGHT + 28}px`,
            paddingBottom: `${FOOTER_HEIGHT + 18}px`,
          }}
        >
          {children}
        </main>

        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-2 pb-3 sm:px-4 sm:pb-4"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(15,23,42,0.08) 0%, rgba(15,23,42,0.92) 20%, rgba(15,23,42,0.98) 100%)"
              : "linear-gradient(180deg, rgba(223,228,239,0.10) 0%, rgba(223,228,239,0.92) 20%, rgba(223,228,239,0.98) 100%)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex flex-wrap gap-2 sm:gap-2.5">{quickActions}</div>
        </div>

        {/* GEAR ICON */}
        <div className="fixed z-50 bottom-3 right-3 sm:bottom-4 sm:right-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`grid h-12 w-12 place-items-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-transform hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${isDark ? "border-white/10 bg-slate-900/85" : "border-white/75 bg-white/88"}`}
          >
            <FaCog
              className="text-[24px] sm:text-[26px]"
              style={{ color: COLORS.brandSecondary }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutPos;
