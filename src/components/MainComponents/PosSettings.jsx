"use client";

import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import {
  FiX,
  FiLayers,
  FiUsers,
  FiShield,
  FiUser,
  FiTrendingUp,
  FiCreditCard,
  FiMail,
  FiMenu,
  FiDatabase,
  FiPercent,
  FiChevronRight,
  FiPrinter,
  FiImage,
  FiTag,
  FiMonitor,
  FiLock,
  FiSlash,
  FiGrid,
  FiAward,
  FiList,
  FiFileText,
} from "react-icons/fi";

import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { hasPosSettingsAccess } from "../../utils/posRoleAccess";
import {
  usePosDeveloperSession,
  usePosRoleAccessVersion,
} from "../../hooks/usePosRoleAccessConfig";

// Load only the selected settings tab.
const PosMyAccount = lazy(() => import("./PosSettingsModal/PosMyAccount"));
const PosAppearance = lazy(() => import("./PosSettingsModal/PosAppearance"));
const PosUserAccounts = lazy(() => import("./PosSettingsModal/PosUserAccounts"));
const PosUserRoles = lazy(() => import("./PosSettingsModal/PosUserRoles"));
const PosSystemLogs = lazy(() => import("./PosSettingsModal/PosSystemLogs"));
const PosExpenses = lazy(() => import("./PosSettingsModal/PosExpenses"));
const PosReportingModal = lazy(() => import("./PosSettingsModal/PosReportingModal"));
const PosDataSecurity = lazy(() => import("./PosSettingsModal/PosDataSecurity"));
const PosDiscountCeiling = lazy(() => import("./PosSettingsModal/PosDiscountCeiling"));
const PosDiscountMode = lazy(() => import("./PosSettingsModal/PosDiscountMode"));
const PosServiceCharge = lazy(() => import("./PosSettingsModal/PosServiceCharge"));
const PosCustomerInfo = lazy(() => import("./PosSettingsModal/PosCustomerInfo"));
const PrinterSettings = lazy(() => import("./PosSettingsModal/PrinterSettings"));
const PosPrintSettings = lazy(() => import("./PosSettingsModal/PosPrintSettings"));
const PosModeOfPayment = lazy(() => import("./PosSettingsModal/PosModeOfPayment"));
const PosPictureSettings = lazy(() => import("./PosSettingsModal/PosPictureSettings"));
const PosProductSubcategories = lazy(() => import("./PosSettingsModal/PosProductSubcategories"));
const PosPricingDashboard = lazy(() => import("./PosSettingsModal/PosPricingDashboard"));
const PosLayoutMode = lazy(() => import("./PosSettingsModal/PosLayoutMode"));
const PosSecondScreen = lazy(() => import("./PosSettingsModal/PosSecondScreen"));
const PosTableLayout = lazy(() => import("./PosSettingsModal/PosTableLayout"));
const PosLoyaltyConfig = lazy(() => import("./PosSettingsModal/PosLoyaltyConfig"));
const PosSalesTypeOrder = lazy(() => import("./PosSettingsModal/PosSalesTypeOrder"));
const PosReportMirrorSettings = lazy(() => import("./PosSettingsModal/PosReportMirrorSettings"));
const PosTutorialGuide = lazy(() => import("./PosSettingsModal/PosTutorialGuide"));

const MASTER_PASS    = "LESI_POSPASS@2023";
const PROTECTED_TABS = new Set(["Mode of Payment", "Discount Mode", "Layout Mode"]);
// LightemAdmin is a trusted POS account -- skip the password gate on
// protected settings tabs entirely for this user.
const UNGATED_USERNAME = "lightemadmin";
const ALL_NAV_ITEMS = [
  { id: "Report Database", icon: FiDatabase },
  { id: "My Account", icon: FiUser },
  { id: "User Accounts", icon: FiUsers },
  { id: "User Roles", icon: FiShield },
  { id: "Registry Sales", icon: FiTrendingUp },
  { id: "Expenses & Petty", icon: FiCreditCard },
  { id: "Mode of Payment", icon: FiCreditCard },
  { id: "Service Charge", icon: FiPercent },
  { id: "Discount Ceiling", icon: FiPercent },
  { id: "Discount Mode", icon: FiPercent },
  { id: "Customer Info", icon: FiUsers },
  { id: "Room Layout", icon: FiGrid },
  { id: "Sales Type Order", icon: FiList },
  { id: "Loyalty Configuration", icon: FiAward },
  { id: "Email Reports", icon: FiMail },
  { id: "Data & Security", icon: FiDatabase },
  { id: "Appearance", icon: FiLayers },
  { id: "Printer Settings", icon: FiPrinter },
  { id: "Print Options", icon: FiPrinter },
  { id: "Picture Settings", icon: FiImage },
  { id: "Product Subcategories", icon: FiLayers },
  { id: "Pricing Engine", icon: FiTag },
  { id: "Layout Mode", icon: FiMonitor },
  { id: "Second Screen", icon: FiMonitor },
  { id: "Tutorial Guide", icon: FiFileText },
];
const ADAPTIVE_PALETTE = [
  { name: "Crimson", light: "#ef4444", dark: "#fca5a5" },
  { name: "Ocean", light: "#2563eb", dark: "#93c5fd" },
  { name: "Forest", light: "#16a34a", dark: "#86efac" },
  { name: "Grape", light: "#9333ea", dark: "#d8b4fe" },
  { name: "Amber", light: "#d97706", dark: "#fcd34d" },
];

// Keep the component identity stable while a form or theme updates. Defining
// this inside Settings replaced every navigation button on each render.
const NavChip = ({ nav, activeTab, isDark, accentColor, onNavigate, mobile = false }) => {
  const Icon = nav.icon;
  const isActive = activeTab === nav.id && !nav.route;
  return (
    <button
      onClick={() => onNavigate(nav)}
      className={`group flex items-center gap-3 rounded-2xl border transition-colors duration-150 ${
        mobile ? "w-full px-4 py-4" : "px-4 py-3 whitespace-nowrap"
      } ${
        isActive
          ? "text-white shadow-[0_0_20px_rgba(0,0,0,0.12)]"
          : isDark
            ? "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
            : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
      }`}
      style={isActive ? {
        backgroundColor: accentColor,
        borderColor: accentColor,
        color: isDark ? "#0f172a" : "#ffffff",
      } : undefined}
    >
      <Icon size={16} />
      <span className="text-[11px] font-black tracking-[0.16em] uppercase">{nav.id}</span>
      {mobile && (
        <FiChevronRight
          className={`ml-auto ${isActive ? "" : isDark ? "text-slate-500" : "text-slate-400"}`}
          size={16}
        />
      )}
    </button>
  );
};

const PosSettings = ({ isOpen, onClose, branchInfo, initialTab = null }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const roles = useZustandLoginCred((state) => state.roles);
  const roleAccessVersion = usePosRoleAccessVersion();
  const developerMode = usePosDeveloperSession();
  const navItems = useMemo(
    () =>
      ALL_NAV_ITEMS.filter(
        (nav) =>
          (nav.id !== "User Roles" || developerMode) &&
          hasPosSettingsAccess(roles, nav.id, developerMode),
      ),
    [roles, roleAccessVersion, developerMode],
  );
  const isDark = theme === "dark";

  const [selectedColorObj, setSelectedColorObj] = useState(ADAPTIVE_PALETTE[1]);
  const [activeTab, setActiveTab] = useState("My Account");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deniedTab, setDeniedTab] = useState(null);

  // ── Password gate for protected tabs ──────────────────────────────────────
  const [pendingTab, setPendingTab]   = useState(null);
  const [gateOpen, setGateOpen]       = useState(false);
  const [gatePass, setGatePass]       = useState("");
  const [gateError, setGateError]     = useState(false); // true = wrong password → Oops

  useEffect(() => {
    if (isOpen) {
      const preferredTab =
        initialTab && navItems.some((nav) => nav.id === initialTab && !nav.route)
          ? initialTab
          : null;
      const firstContentTab = navItems.find((nav) => !nav.route) || navItems[0];
      setActiveTab(
        preferredTab ||
          ((current) =>
            navItems.some((nav) => nav.id === current && !nav.route)
              ? current
              : firstContentTab?.id || ""),
      );
      setIsMobileMenuOpen(false);
      setDeniedTab(null);
    }
  }, [isOpen, navItems, initialTab]);

  const accentColor = "var(--branch-primary)";

  const getContrastText = () => (isDark ? "#0f172a" : "#ffffff");

  if (!isOpen) return null;

  const isUngatedUser =
    developerMode ||
    String(localStorage.getItem("username") || "").trim().toLowerCase() ===
      UNGATED_USERNAME;

  const canAccessTab = (tabId) =>
    hasPosSettingsAccess(roles, tabId, developerMode);

  const handleNavClick = (nav) => {
    if (nav.route) {
      onClose?.();
      setIsMobileMenuOpen(false);
      navigate(nav.route);
      return;
    }

    if (!canAccessTab(nav.id)) {
      setDeniedTab(nav.id);
      setActiveTab(nav.id);
      setIsMobileMenuOpen(false);
      return;
    }

    setDeniedTab(null);

    if (PROTECTED_TABS.has(nav.id) && !isUngatedUser) {
      setPendingTab(nav.id);
      setGatePass("");
      setGateError(false);
      setGateOpen(true);
      setIsMobileMenuOpen(false);
      return;
    }

    setActiveTab(nav.id);
    setIsMobileMenuOpen(false);
  };

  const handleGateSubmit = () => {
    if (gatePass === MASTER_PASS) {
      setGateOpen(false);
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else {
      setGateError(true);
    }
  };

  const renderActiveContent = () => {
    if (deniedTab === activeTab) {
      return (
        <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
          <div className="flex items-center justify-center w-20 h-20 bg-blue-50 rounded-[1.5rem]">
            <FiSlash size={44} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Oops!</h2>
          <p className="max-w-sm text-sm leading-relaxed text-slate-600">
            You don't have access to{" "}
            <code className="font-bold text-slate-800">
              /{activeTab?.toLowerCase().replace(/\s+/g, "")}
            </code>
            .
          </p>
          <button
            onClick={() => {
              setDeniedTab(null);
              setActiveTab("My Account");
            }}
            className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition"
          >
            Take Me Home
          </button>
        </div>
      );
    }

    if (activeTab === "My Account") {
      return (
        <PosMyAccount
          isDark={isDark}
          accent={accentColor}
          branchInfo={branchInfo}
        />
      );
    }

    if (activeTab === "Report Database") {
      return <PosReportMirrorSettings isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "User Accounts") {
      return (
        <PosUserAccounts
          isDark={isDark}
          accent={accentColor}
          getContrastText={getContrastText}
        />
      );
    }

    if (activeTab === "User Roles") {
      if (!developerMode) return null;
      return (
        <PosUserRoles
          isDark={isDark}
          accent={accentColor}
          getContrastText={getContrastText}
        />
      );
    }

    if (activeTab === "Registry Sales") {
      return <PosSystemLogs isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Expenses & Petty") {
      return (
        <PosExpenses
          isDark={isDark}
          accent={accentColor}
          getContrastText={getContrastText}
        />
      );
    }

    if (activeTab === "Discount Ceiling") {
      return <PosDiscountCeiling isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Discount Mode") {
      return <PosDiscountMode isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Service Charge") {
      return <PosServiceCharge isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Customer Info") {
      return <PosCustomerInfo isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Room Layout") {
      return (
        <PosTableLayout
          isDark={isDark}
          accent={accentColor}
          branchInfo={branchInfo}
        />
      );
    }

    if (activeTab === "Sales Type Order") {
      return <PosSalesTypeOrder isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Loyalty Configuration") {
      return <PosLoyaltyConfig isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Email Reports") {
      return <PosReportingModal isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Data & Security") {
      return (
        <PosDataSecurity
          isDark={isDark}
          accent={accentColor}
          getContrastText={getContrastText}
        />
      );
    }

    if (activeTab === "Appearance") {
      return (
        <PosAppearance
          isDark={isDark}
          setTheme={setTheme}
          accentColor={accentColor}
          selectedColorObj={selectedColorObj}
          setSelectedColorObj={setSelectedColorObj}
          adaptivePalette={ADAPTIVE_PALETTE}
          getContrastText={getContrastText}
        />
      );
    }

    if (activeTab === "Printer Settings") {
      return (
        <PrinterSettings
          isDark={isDark}
          accent={accentColor}
        />
      );
    }

    if (activeTab === "Print Options") {
      return (
        <PosPrintSettings
          isDark={isDark}
          accent={accentColor}
        />
      );
    }

    if (activeTab === "Mode of Payment") {
      return <PosModeOfPayment isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Picture Settings") {
      return <PosPictureSettings isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Product Subcategories") {
      return <PosProductSubcategories isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Pricing Engine") {
      return <PosPricingDashboard isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Layout Mode") {
      return <PosLayoutMode isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Second Screen") {
      return <PosSecondScreen isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Tutorial Guide") {
      return <PosTutorialGuide isDark={isDark} accent={accentColor} />;
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-center w-full h-full p-0 sm:p-6">
        <div
          className={`relative w-full h-full sm:h-[95vh] sm:max-w-[1450px] overflow-hidden sm:rounded-[36px] border ${
            isDark
              ? "bg-[#020617] border-white/10 text-slate-200"
              : "bg-slate-50 border-slate-200 text-slate-900"
          } shadow-2xl`}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: accentColor, opacity: isDark ? 0.03 : 0.025 }}
          />

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-5 border-b sm:px-8 sm:py-6 border-white/5">
              <div>
                <div
                  className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] uppercase"
                  style={{ color: accentColor }}
                >
                  <FiLayers size={14} />
                  Settings Center
                </div>

                <h1
                  className={`mt-2 text-3xl sm:text-4xl font-black tracking-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {activeTab}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p
                    className={`text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Manage account, users, reports, backups, and appearance.
                  </p>

                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{
                      color: accentColor,
                      borderColor: isDark
                        ? "color-mix(in srgb, var(--branch-primary) 28%, transparent)"
                        : "color-mix(in srgb, var(--branch-primary) 18%, #e2e8f0)",
                      backgroundColor: isDark
                        ? "color-mix(in srgb, var(--branch-primary) 12%, transparent)"
                        : "color-mix(in srgb, var(--branch-primary) 8%, white)",
                    }}
                  >
                    Global Theme
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className={`lg:hidden p-3 rounded-2xl transition-all ${
                    isDark
                      ? "bg-slate-900/60 border border-slate-800 text-slate-300"
                      : "bg-white border border-slate-200 text-slate-600 shadow-sm"
                  }`}
                >
                  <FiMenu size={20} />
                </button>

                <button
                  onClick={onClose}
                  className={`p-3 rounded-2xl transition-all ${
                    isDark
                      ? "bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40"
                      : "bg-white border border-slate-200 text-slate-600 hover:text-rose-500 hover:border-rose-300 shadow-sm"
                  }`}
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              <aside
                className={`hidden lg:flex lg:w-[310px] flex-col border-r ${
                  isDark
                    ? "border-white/5 bg-slate-950/30"
                    : "border-slate-200 bg-white/40"
                }`}
              >
                <div className="p-6">
                  <div
                    className={`rounded-3xl border p-5 ${
                      isDark
                        ? "bg-slate-900/50 border-slate-800"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black tracking-[0.22em] uppercase ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      Navigation
                    </p>

                    <h2
                      className={`mt-2 text-xl font-black ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      POS Settings
                    </h2>

                    <div
                      className="h-1 mt-3 rounded-full w-14"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                </div>

                <div className="flex-1 px-4 pb-6 overflow-y-auto no-scrollbar">
                  <div className="flex flex-col gap-3">
                    {navItems.map((nav) => (
                      <NavChip key={nav.id} nav={nav} activeTab={activeTab} isDark={isDark}
                        accentColor={accentColor} onNavigate={handleNavClick} />
                    ))}
                  </div>
                </div>
              </aside>

              <main className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 px-5 pt-4 pb-5 sm:px-8 sm:pb-8">
                  <div
                    className={`h-full rounded-[28px] border overflow-hidden ${
                      isDark
                        ? "bg-slate-900/35 border-white/5"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    <div
                      className={`px-6 py-5 border-b ${
                        isDark
                          ? "border-white/5 bg-slate-900/40"
                          : "border-slate-200 bg-slate-50/80"
                      }`}
                    >
                      <p
                        className={`text-[10px] font-black tracking-[0.25em] uppercase ${
                          isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        Active Module
                      </p>

                      <h2
                        className={`mt-1 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {activeTab}
                      </h2>
                    </div>

                    <div className="h-[calc(100%-88px)] overflow-y-auto no-scrollbar p-4 sm:p-6 lg:p-8">
                      <div className="max-w-[1100px] mx-auto">
                        {/* Switch tabs immediately; theme updates must preserve
                            the active form and its pending edits and requests. */}
                        <div key={activeTab}>
                          <Suspense
                            fallback={
                              <p role="status" className="py-8 font-[Poppins-Regular]">
                                Loading {activeTab}…
                              </p>
                            }
                          >
                            {renderActiveContent()}
                          </Suspense>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>

          <>
            {isMobileMenuOpen && (
              <>
                <div
                  className="ui-fade-in absolute inset-0 z-40 bg-black/60 lg:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />

                <div
                  className={`ui-slide-in-left absolute inset-y-0 left-0 z-50 w-[88%] max-w-[360px] lg:hidden border-r ${
                    isDark
                      ? "bg-[#020617] border-white/10"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                      <p
                        className="text-[10px] font-black tracking-[0.24em] uppercase"
                        style={{ color: accentColor }}
                      >
                        Settings Menu
                      </p>

                      <h2
                        className={`mt-1 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        Modules
                      </h2>
                    </div>

                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`p-3 rounded-2xl ${
                        isDark
                          ? "bg-slate-900 border border-slate-800 text-slate-300"
                          : "bg-white border border-slate-200 text-slate-600 shadow-sm"
                      }`}
                    >
                      <FiX size={18} />
                    </button>
                  </div>

                  <div className="p-4 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col gap-3">
                      {navItems.map((nav) => (
                        <NavChip key={nav.id} nav={nav} activeTab={activeTab} isDark={isDark}
                          accentColor={accentColor} onNavigate={handleNavClick} mobile />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        </div>
      </div>

      {/* ── Password Gate Modal ─────────────────────────────────────────────── */}
      {gateOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm mx-4 bg-white rounded-[2rem] p-8 shadow-2xl flex flex-col items-center gap-5">
            {gateError ? (
              /* ── Oops screen ── */
              <>
                <div className="w-20 h-20 rounded-[1.5rem] bg-blue-50 flex items-center justify-center">
                  <FiSlash size={44} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Oops!</h2>
                <p className="text-center text-slate-600 text-sm leading-relaxed">
                  You don't have access to{" "}
                  <code className="font-bold text-slate-800">
                    /{pendingTab?.toLowerCase().replace(/\s+/g, "")}
                  </code>
                  .
                </p>
                <button
                  onClick={() => {
                    setGateOpen(false);
                    setGateError(false);
                    setPendingTab(null);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition"
                >
                  Take Me Home
                </button>
                <p className="text-xs text-slate-400">Need help? Contact support.</p>
              </>
            ) : (
              /* ── Password form ── */
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <FiLock size={26} className="text-blue-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-black text-slate-900">Password Required</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter admin password to access <strong className="text-slate-700">{pendingTab}</strong>.
                  </p>
                </div>
                <input
                  type="password"
                  value={gatePass}
                  onChange={(e) => setGatePass(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGateSubmit()}
                  placeholder="Enter password"
                  autoFocus
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => { setGateOpen(false); setPendingTab(null); }}
                    className="py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGateSubmit}
                    className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition"
                  >
                    Unlock
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PosSettings;
