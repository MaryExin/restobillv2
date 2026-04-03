"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaBoxOpen,
  FaReceipt,
  FaFileAlt,
  FaCog,
  FaUserCircle,
  FaPowerOff,
  FaMoneyBill,
  FaChartPie,
  FaCloudUploadAlt,
} from "react-icons/fa";
import { HiOutlineStatusOnline } from "react-icons/hi";
import { IoMdClose } from "react-icons/io";

import OpenNewDay from "../PosCoreComponents/Actions/OpenNewDay";
import SwitchUser from "../PosCoreComponents/Actions/SwitchUser";
import PosReadingModal from "../MainComponents/PosReadingModal";
import PosReports from "../PosCoreComponents/PosReports";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import PosSettings from "../MainComponents/PosSettings";

import Billing from "../../assets/Billing.jpg";

import { useTheme } from "../../context/ThemeContext";
import PosQuickActionTile from "../MainComponents/Common/PosQuickActionTile";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useApiHost from "../../hooks/useApiHost";

const POS_HOME_BG = "./pos-home-bg.png";
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 118;

const LayoutPos = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiHost = useApiHost();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { userId } = useZustandLoginCred();

  const [dateselection, setDateSelection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPosReadingOpen, setIsPosReadingOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    if (location.state?.openSettings) {
      setIsSettingsOpen(true);

      navigate(location.pathname, {
        replace: true,
        state: {},
      });
    }
  }, [location, navigate]);

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
    ) {
      return;
    }
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
        onClick={() => navigate("/pricesyncing")}
      />

      <PosQuickActionTile
        label="Sales Record Syncing"
        icon={<FaCloudUploadAlt className="text-[28px] sm:text-[30px]" />}
        color="violet"
        onClick={() => navigate("/salesrecordssyncing")}
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
      className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${
        isDark ? "bg-[#0f172a]" : "bg-transparent"
      }`}
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

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          opacity: [0.55, 0.8, 0.55],
          scale: [1, 1.06, 1],
        }}
        transition={{
          duration: 4.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(circle at center, rgba(160,190,255,0.38) 0%, rgba(110,150,255,0.24) 12%, rgba(55,110,230,0.12) 24%, rgba(8,24,64,0.02) 42%, rgba(0,0,0,0) 58%)",
          filter: "blur(16px)",
          transformOrigin: "center center",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          opacity: [0.2, 0.35, 0.2],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(circle at center, rgba(138,170,255,0.30) 0%, rgba(83,124,255,0.16) 18%, rgba(44,83,190,0.08) 34%, rgba(0,0,0,0) 60%)",
          filter: "blur(36px)",
          transformOrigin: "center center",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          rotate: [0, 360],
          opacity: [0.1, 0.18, 0.1],
        }}
        transition={{
          rotate: {
            duration: 28,
            repeat: Infinity,
            ease: "linear",
          },
          opacity: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        style={{
          background: `
            conic-gradient(
              from 0deg at center,
              rgba(255,255,255,0) 0deg,
              rgba(135,170,255,0.00) 18deg,
              rgba(135,170,255,0.16) 34deg,
              rgba(255,255,255,0.00) 54deg,
              rgba(255,255,255,0.00) 78deg,
              rgba(135,170,255,0.10) 96deg,
              rgba(255,255,255,0.00) 118deg,
              rgba(255,255,255,0.00) 156deg,
              rgba(135,170,255,0.14) 174deg,
              rgba(255,255,255,0.00) 198deg,
              rgba(255,255,255,0.00) 236deg,
              rgba(135,170,255,0.12) 258deg,
              rgba(255,255,255,0.00) 278deg,
              rgba(255,255,255,0.00) 316deg,
              rgba(135,170,255,0.10) 336deg,
              rgba(255,255,255,0.00) 360deg
            )
          `,
          mixBlendMode: "screen",
          filter: "blur(22px)",
          transformOrigin: "center center",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          rotate: [360, 0],
          opacity: [0.06, 0.12, 0.06],
          scale: [1, 1.03, 1],
        }}
        transition={{
          rotate: {
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          },
          opacity: {
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          },
          scale: {
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        style={{
          background: `
            conic-gradient(
              from 90deg at center,
              rgba(255,255,255,0) 0deg,
              rgba(255,210,120,0.00) 35deg,
              rgba(255,210,120,0.08) 52deg,
              rgba(255,255,255,0.00) 70deg,
              rgba(255,255,255,0.00) 120deg,
              rgba(255,210,120,0.07) 145deg,
              rgba(255,255,255,0.00) 168deg,
              rgba(255,255,255,0.00) 220deg,
              rgba(255,210,120,0.06) 242deg,
              rgba(255,255,255,0.00) 268deg,
              rgba(255,255,255,0.00) 315deg,
              rgba(255,210,120,0.07) 335deg,
              rgba(255,255,255,0.00) 360deg
            )
          `,
          mixBlendMode: "screen",
          filter: "blur(32px)",
          transformOrigin: "center center",
        }}
      />

      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.52),rgba(2,6,23,0.62)_28%,rgba(2,6,23,0.74)_70%,rgba(2,6,23,0.84)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06)_26%,rgba(255,255,255,0.12)_70%,rgba(255,255,255,0.08)_100%)]"
        }`}
      />

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className={`fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm ${
              isDark ? "bg-black/55" : "bg-slate-900/30"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className={`w-full max-w-md rounded-[28px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.25)] ${
                isDark
                  ? "border-white/10 bg-slate-950"
                  : "border-white/70 bg-white"
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2
                    className={`text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Sales Dashboard
                  </h2>
                  <p
                    className={`mt-1 text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Enter password to continue.
                  </p>
                </div>

                <button
                  onClick={handleClosePasswordModal}
                  className={`grid h-10 w-10 place-items-center rounded-full transition-all ${
                    isDark
                      ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
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
                  className={`w-full rounded-2xl border px-5 py-4 outline-none transition-all ${
                    isDark
                      ? "border-slate-800 bg-slate-900/60 text-white focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-500/10"
                      : "border-slate-300 bg-slate-50 text-slate-900 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                  }`}
                />

                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClosePasswordModal}
                    className={`flex-1 rounded-2xl px-5 py-4 font-semibold transition-all ${
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handlePasswordSubmit}
                    className="flex-1 rounded-2xl bg-gradient-to-b from-cyan-500 to-sky-600 px-5 py-4 font-bold text-white transition-all hover:brightness-110"
                  >
                    Enter
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 h-screen w-full overflow-hidden">
        <header
          className="pos-header-fixed fixed left-0 right-0 top-0 z-40 px-3 py-2 text-white sm:px-4"
          style={{
            height: `${HEADER_HEIGHT}px`,
            background: "transparent",
            borderColor: "transparent",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[18px] leading-none font-black sm:text-[20px]">
                {branchInfo.title}
              </div>

              <div className="mt-1 text-[10px] font-medium sm:text-[12px]">
                {branchInfo.subtitle}
              </div>

              <div className="mt-2 flex items-center gap-2">
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
                <div className="text-[14px] font-black">
                  {branchInfo.userName}
                </div>
                <div className="text-[12px] font-medium">
                  {branchInfo.userRole}
                </div>
              </div>

              <div
                className={`grid h-11 w-11 place-items-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:h-12 sm:w-12 ${
                  isDark
                    ? "border-white/10 bg-white/10"
                    : "border-white/75 bg-white/20"
                }`}
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

          <div className="absolute left-0 right-0 -bottom-6 flex items-center justify-between px-4">
            <div className="flex gap-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              <span>Terminal: {branchInfo.terminalNo}</span>
              <span>Shift: {branchInfo.shiftNo}</span>
              <span
                className={
                  branchInfo.shiftStatus === "Open"
                    ? "text-green-400"
                    : "text-orange-400"
                }
              >
                Status: {branchInfo.shiftStatus}
              </span>
            </div>
          </div>
        </header>

        <main
          className="h-full overflow-y-auto px-3 sm:px-4"
          style={{
            paddingTop: `${HEADER_HEIGHT + 28}px`,
            paddingBottom: `${FOOTER_HEIGHT + 18}px`,
          }}
        >
          {children}
        </main>

        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 sm:px-4 sm:pb-4"
          style={{
            background: "transparent",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex flex-wrap gap-2 sm:gap-2.5">{quickActions}</div>
        </div>

        <div className="fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`grid h-12 w-12 place-items-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-transform hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${
              isDark
                ? "border-white/10 bg-slate-900/85"
                : "border-white/75 bg-white/88"
            }`}
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
