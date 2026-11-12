import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  FaHome,
  FaBoxOpen,
  FaFileAlt,
  FaCog,
  FaPowerOff,
  FaChartPie,
  FaChartBar,
  FaConciergeBell,
  FaFileInvoiceDollar,
  FaCashRegister,
  FaCalendarCheck,
  FaDoorOpen,
} from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

import OpenNewDay from "../PosCoreComponents/Actions/OpenNewDay";
import SwitchUser from "../PosCoreComponents/Actions/SwitchUser";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import lazyDialog from "../common/lazyDialog";

import Billing from "../../assets/Billing.jpg";

import PosQuickActionTile from "../MainComponents/Common/PosQuickActionTile";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useApiHost from "../../hooks/useApiHost";
import useBillingEnabled from "../../hooks/useBillingEnabled";
import useVersionLabel from "../../hooks/useVersionLabel";
import { useTheme } from "../../context/ThemeContext";
import useZustandLayoutMode from "../../context/useZustandLayoutMode";
import {
  hasAnyPosSettingsAccess,
  hasPosAnyReadingAccess,
  hasPosHomeActionAccess,
  hasPosRouteAccess,
} from "../../utils/posRoleAccess";
import {
  usePosDeveloperSession,
  usePosRoleAccessVersion,
} from "../../hooks/usePosRoleAccessConfig";
import { getConfiguredRoleLabel } from "../../utils/posRoleAccessConfig";
import { posAuthenticatedFetch } from "../../utils/posAuthenticatedFetch";

const PosReadingModal = lazyDialog(
  () => import("../MainComponents/PosReadingModal"),
  "open",
);
const PosReports = lazyDialog(
  () => import("../PosCoreComponents/PosReports"),
  "open",
);
const PosSettings = lazyDialog(() => import("../MainComponents/PosSettings"));

const POS_HOME_BG = "./richwell-home-bg.png";
const RICHWELL_CREST = "./richwell-icon.png";
const HEADER_HEIGHT = 88;
const FOOTER_HEIGHT = 150;
const ICON_CLASS = "text-[20px]";

const getInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "U";

const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(59,130,246,${alpha})`;

  let clean = String(hex).replace("#", "").trim();

  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (clean.length !== 6) {
    return `rgba(59,130,246,${alpha})`;
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const resolveThemeImageUrl = (value, apiHost) => {
  const cleanValue = typeof value === "string" ? value.trim() : "";
  if (!cleanValue) return "";

  if (
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://") ||
    cleanValue.startsWith("data:")
  ) {
    return cleanValue;
  }

  const base = typeof apiHost === "string" ? apiHost.replace(/\/$/, "") : "";
  if (!base) return cleanValue;

  if (cleanValue.startsWith("/uploads/")) {
    return `${base}${cleanValue}`;
  }

  if (cleanValue.startsWith("uploads/")) {
    return `${base}/${cleanValue}`;
  }

  return cleanValue;
};

const LayoutPos = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiHost = useApiHost();
  const { theme, isDark, themeSettings } = useTheme();
  const { layoutMode } = useZustandLayoutMode();
  const billingEnabled = useBillingEnabled();
  const versionLabel = useVersionLabel();

  const brandPrimary = isDark
    ? themeSettings?.Dark_Primary || "#2563eb"
    : themeSettings?.Light_Primary || "#38bdf8";

  const brandSecondary = isDark
    ? themeSettings?.Dark_Secondary || "#1d4ed8"
    : themeSettings?.Light_Secondary || "#0ea5e9";

  const appBackground = isDark
    ? themeSettings?.Dark_Background || "#0f172a"
    : themeSettings?.Light_Background || "#f8fafc";

  const appSurface = isDark
    ? themeSettings?.Dark_Surface || "#111827"
    : themeSettings?.Light_Surface || "#ffffff";

  const appText = isDark
    ? themeSettings?.Dark_Text || "#ffffff"
    : themeSettings?.Light_Text || "#0f172a";

  const dashboardBackgroundImage = useMemo(() => {
    const resolved = resolveThemeImageUrl(
      themeSettings?.Dashboard_Background_Url || "",
      apiHost,
    );
    return resolved || POS_HOME_BG;
  }, [themeSettings?.Dashboard_Background_Url, apiHost]);

  const { userId, roles, resetLoginCred } = useZustandLoginCred();
  const roleAccessVersion = usePosRoleAccessVersion();
  const developerMode = usePosDeveloperSession();

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
      const response = await posAuthenticatedFetch(
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
      subtitle: `${versionLabel} Offline`,
      branch: dateselection?.Unit_Name || "N/A",
      userName: developerMode
        ? localStorage.getItem("username") || "POS Developer"
        : dateselection?.userName || "Guest",
      userRole: developerMode
        ? "Developer"
        : getConfiguredRoleLabel(
            dateselection?.userRoleValue || dateselection?.userRole || "User",
          ),
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
  }, [dateselection, versionLabel, developerMode]);

  const isClosed = branchInfo.shiftStatus?.toLowerCase() !== "open";

  const canAccessProductList = useMemo(
    () => hasPosRouteAccess(roles, "/productlist", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessOpenNewDay = useMemo(
    () => hasPosHomeActionAccess(roles, "openNewDay", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessOrdering = useMemo(
    () => hasPosRouteAccess(roles, "/ordering", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessBilling = useMemo(
    () => hasPosRouteAccess(roles, "/printbilling", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessReservations = useMemo(
    () => hasPosRouteAccess(roles, "/reservations", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessRoomService = useMemo(
    () => hasPosRouteAccess(roles, "/room-service", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessPayment = useMemo(
    () => hasPosRouteAccess(roles, "/payments", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessPosReading = useMemo(
    () => hasPosAnyReadingAccess(roles, developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessPosReports = useMemo(
    () => hasPosHomeActionAccess(roles, "posReports", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canAccessSalesDashboard = useMemo(
    () => hasPosRouteAccess(roles, "/salesdashboard", developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canOpenSettings = useMemo(
    () => hasAnyPosSettingsAccess(roles, developerMode),
    [roles, roleAccessVersion, developerMode],
  );

  const handleClose = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false);
    localStorage.removeItem("posTerminalNumber");
    localStorage.clear();
    resetLoginCred();
    navigate("/");
  };

  const handleLogoutCancel = () => {
    setIsLogoutConfirmOpen(false);
  };

  const handleCardClick = (item) => {
    if (item.id === "salesdashboard" && !developerMode) {
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

  const isHomeRoute = location.pathname === "/poscorehomescreen";
  const closedHint = "Open a new day first";

  // Dock sections. Access checks and actions are unchanged; only grouping
  // and styling are new.
  const dockGroups = [
    {
      key: "shift",
      label: "Shift",
      items: [
        <PosQuickActionTile
          key="home"
          label="Home"
          icon={<FaHome className={ICON_CLASS} />}
          color="violet"
          active={isHomeRoute}
          onClick={() => navigate("/poscorehomescreen")}
        />,
        canAccessOpenNewDay ? <OpenNewDay key="opennewday" /> : null,
        <SwitchUser key="switchuser" />,
        canAccessPosReading ? (
          <PosQuickActionTile
            key="posreading"
            label="POS Reading"
            icon={<FaFileAlt className={ICON_CLASS} />}
            color="indigo"
            disabled={isClosed}
            hint={closedHint}
            onClick={() => setIsPosReadingOpen(true)}
          />
        ) : null,
      ],
    },
    {
      key: "service",
      label: "Service",
      items: [
        canAccessOrdering ? (
          <PosQuickActionTile
            key="ordering"
            label="New Transaction"
            icon={<FaConciergeBell className={ICON_CLASS} />}
            color="amber"
            variant="primary"
            disabled={isClosed}
            hint={closedHint}
            onClick={() => {
              if (isClosed) return;
              if (layoutMode === "Kiosk") {
                navigate("/ordering", { state: { kioskAutoOpen: true } });
              } else {
                navigate("/ordering");
              }
            }}
          />
        ) : null,
        canAccessBilling && layoutMode !== "Kiosk" && billingEnabled ? (
          <PosQuickActionTile
            key="folio"
            label="Bill / Folio"
            icon={<FaFileInvoiceDollar className={ICON_CLASS} />}
            color="rose"
            disabled={isClosed}
            hint={closedHint}
            onClick={() => !isClosed && navigate("/printbilling")}
          />
        ) : null,
        canAccessPayment ? (
          <PosQuickActionTile
            key="payment"
            label="Payment"
            icon={<FaCashRegister className={ICON_CLASS} />}
            color="green"
            disabled={isClosed}
            hint={closedHint}
            onClick={() => navigate("/payments")}
          />
        ) : null,
        // Reservations work any day (future bookings), so no shift lock.
        canAccessReservations ? (
          <PosQuickActionTile
            key="reservations"
            label="Reservations"
            icon={<FaCalendarCheck className={ICON_CLASS} />}
            color="violet"
            active={location.pathname === "/reservations"}
            onClick={() => navigate("/reservations")}
          />
        ) : null,
        // Room service orders are real orders, so the day must be open.
        canAccessRoomService ? (
          <PosQuickActionTile
            key="roomservice"
            label="Room Service"
            icon={<FaDoorOpen className={ICON_CLASS} />}
            color="cyan"
            disabled={isClosed}
            hint={closedHint}
            active={location.pathname === "/room-service"}
            onClick={() => !isClosed && navigate("/room-service")}
          />
        ) : null,
      ],
    },
    {
      key: "office",
      label: "Back Office",
      items: [
        canAccessProductList ? (
          <PosQuickActionTile
            key="productlist"
            label="Product List"
            icon={<FaBoxOpen className={ICON_CLASS} />}
            color="cyan"
            active={location.pathname === "/productlist"}
            onClick={() => navigate("/productlist")}
          />
        ) : null,
        // Richwell: "Products & Price Syncing" and "Sales Record Syncing"
        // tiles are hidden. Their routes (/pricesyncing,
        // /salesrecordssyncing) still exist in App.jsx.
        canAccessPosReports ? (
          <PosQuickActionTile
            key="posreports"
            label="POS Reports"
            icon={<FaChartBar className={ICON_CLASS} />}
            color="indigo"
            onClick={() => setIsReportsOpen(true)}
          />
        ) : null,
        ...menuOptions.map((item) =>
          item.id === "salesdashboard" && !canAccessSalesDashboard ? null : (
            <PosQuickActionTile
              key={item.id}
              label={item.title}
              icon={React.cloneElement(item.icon, { className: ICON_CLASS })}
              color="orange"
              onClick={() => handleCardClick(item)}
            />
          ),
        ),
        canOpenSettings ? (
          <PosQuickActionTile
            key="settings"
            label="Settings"
            icon={<FaCog className={ICON_CLASS} />}
            color="slate"
            onClick={() => setIsSettingsOpen(true)}
          />
        ) : null,
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter(Boolean) }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      className="relative h-screen w-full overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: isDark ? appBackground : "transparent",
        color: appText,
      }}
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
        terminalNumber={localStorage.getItem("posTerminalNumber")}
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
          backgroundImage: `url(${dashboardBackgroundImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Static brand lighting avoids continuous full-screen compositing while
          cashiers work in Settings, Reports, or other dashboard dialogs. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${hexToRgba(
            brandPrimary,
            0.18,
          )} 0%, ${hexToRgba(brandSecondary, 0.08)} 34%, transparent 68%)`,
        }}
      />

      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.52),rgba(2,6,23,0.62)_28%,rgba(2,6,23,0.74)_70%,rgba(2,6,23,0.84)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06)_26%,rgba(255,255,255,0.12)_70%,rgba(255,255,255,0.08)_100%)]"
        }`}
      />

      <>
        {showPasswordModal && (
          <div
            className={"ui-fade-in " + (`fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm ${
              isDark ? "bg-black/55" : "bg-slate-900/30"
            }`)}
          >
            <div
              className={"ui-scale-in " + (`w-full max-w-md rounded-[28px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.25)] ${
                isDark
                  ? "border-white/10 bg-slate-950"
                  : "border-white/70 bg-white"
              }`)}
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
                      ? "border-slate-800 bg-slate-900/60 text-white"
                      : "border-slate-300 bg-slate-50 text-slate-900"
                  }`}
                  style={{
                    boxShadow: `0 0 0 0 ${hexToRgba(brandPrimary, 0)}`,
                  }}
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
                    className="flex-1 rounded-2xl px-5 py-4 font-bold text-white transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${brandPrimary} 0%, ${brandSecondary} 100%)`,
                    }}
                  >
                    Enter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>

      <div className="relative z-10 h-screen w-full overflow-hidden">
        <header
          className="fixed left-0 right-0 top-0 z-40 px-3 pt-3 text-[#fff] sm:px-4"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/15 bg-[rgba(30,10,60,0.46)] px-3 py-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.30)] backdrop-blur-md sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={RICHWELL_CREST}
                alt=""
                className="h-10 w-10 shrink-0 drop-shadow sm:h-11 sm:w-11"
              />
              <div className="min-w-0">
                <div className="max-w-[46vw] truncate font-[Poppins-Bold] text-[15px] leading-tight sm:text-[17px] xl:max-w-[360px]">
                  {isLoading ? "Loading..." : branchInfo.branch}
                </div>
                <div className="max-w-[46vw] truncate font-[Poppins-Medium] text-[10px] text-[rgba(255,255,255,0.7)] sm:text-[11px] xl:max-w-[360px]">
                  {branchInfo.title} &middot; {branchInfo.subtitle}
                </div>
              </div>

              <div className="ml-2 hidden items-center gap-1.5 xl:flex">
                <span className="rounded-full bg-white/10 px-3 py-1 font-[Poppins-Medium] text-[11px] ring-1 ring-white/15">
                  Terminal {branchInfo.terminalNo}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-[Poppins-Medium] text-[11px] ring-1 ring-white/15">
                  Shift {branchInfo.shiftNo}
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-[Poppins-SemiBold] text-[11px] ring-1 ${
                    isClosed
                      ? "bg-amber-400/15 text-amber-200 ring-amber-300/40"
                      : "bg-emerald-400/15 text-emerald-200 ring-emerald-300/40"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isClosed ? "bg-amber-300" : "bg-emerald-300"
                    }`}
                  />
                  {branchInfo.shiftStatus}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <div className="max-w-[200px] truncate font-[Poppins-SemiBold] text-[13px] leading-tight">
                  {branchInfo.userName}
                </div>
                <div className="font-[Poppins-Medium] text-[11px] text-[#f8dc8b]">
                  {branchInfo.userRole}
                </div>
              </div>

              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 font-[Poppins-Bold] text-[14px] ring-1 ring-white/25 sm:h-11 sm:w-11">
                {getInitials(branchInfo.userName)}
              </div>

              <button
                type="button"
                onClick={handleClose}
                title="Logout"
                aria-label="Logout"
                className="grid h-10 w-10 place-items-center rounded-2xl text-[#fff] shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
                style={{
                  background: `linear-gradient(160deg, ${brandPrimary} 0%, ${brandSecondary} 100%)`,
                }}
              >
                <FaPowerOff className="text-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main
          className="h-full overflow-y-auto px-3 sm:px-4"
          style={{
            paddingTop: `${HEADER_HEIGHT + 12}px`,
            paddingBottom: `${FOOTER_HEIGHT + 18}px`,
          }}
        >
          {children}
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4">
          <nav
            aria-label="POS actions"
            className="no-scrollbar mx-auto flex w-fit max-w-full items-end gap-3 overflow-x-auto rounded-[26px] border border-white/15 bg-[rgba(30,10,60,0.46)] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.30)] backdrop-blur-md"
          >
            {dockGroups.map((group, index) => (
              <React.Fragment key={group.key}>
                {index > 0 && (
                  <div className="mx-1 h-[92px] w-px shrink-0 self-end bg-white/15" />
                )}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <div className="px-1 font-[Poppins-SemiBold] text-[10px] uppercase tracking-[0.2em] text-[rgba(255,255,255,0.6)]">
                    {group.label}
                  </div>
                  <div className="flex gap-2">{group.items}</div>
                </div>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default LayoutPos;
