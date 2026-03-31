"use client";

import React, { useState, useEffect } from "react";
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
  FiChevronRight,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";

// Import Components
import PosMyAccount from "./PosSettingsModal/PosMyAccount";
import PosAppearance from "./PosSettingsModal/PosAppearance";
import PosUserAccounts from "./PosSettingsModal/PosUserAccounts";
import PosSystemLogs from "./PosSettingsModal/PosSystemLogs";
import PosExpenses from "./PosSettingsModal/PosExpenses";
import PosReportingModal from "./PosSettingsModal/PosReportingModal";
import PosBackupModal from "./PosSettingsModal/PosBackupModal";

const PosSettings = ({ isOpen, onClose, branchInfo }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("My Account");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("My Account");
      setIsMobileMenuOpen(false);
    }
  }, [isOpen]);

  const adaptivePalette = [
    { name: "Crimson", light: "#ef4444", dark: "#fca5a5" },
    { name: "Ocean", light: "#2563eb", dark: "#93c5fd" },
    { name: "Forest", light: "#16a34a", dark: "#86efac" },
    { name: "Grape", light: "#9333ea", dark: "#d8b4fe" },
    { name: "Amber", light: "#d97706", dark: "#fcd34d" },
  ];

  const [selectedColorObj, setSelectedColorObj] = useState(adaptivePalette[1]);

  const accentColor = isDark ? selectedColorObj.dark : selectedColorObj.light;
  const getContrastText = () => (isDark ? "#0f172a" : "#ffffff");

  if (!isOpen) return null;

  const navItems = [
    { id: "My Account", icon: FiUser },
    { id: "User Accounts", icon: FiUsers, route: "/employeeinfo" },
    { id: "User Approval", icon: FiUsers, route: "/userqueu" },
    { id: "User Roles", icon: FiShield, route: "/userroles" },
    { id: "Registry Sales", icon: FiTrendingUp },
    { id: "Expenses & Petty", icon: FiCreditCard },
    { id: "Email Reports", icon: FiMail },
    { id: "Data & Security", icon: FiDatabase },
    { id: "Appearance", icon: FiLayers },
  ];

  const handleNavClick = (nav) => {
    if (nav.route) {
      onClose?.();
      setIsMobileMenuOpen(false);
      navigate(nav.route);
      return;
    }

    setActiveTab(nav.id);
    setIsMobileMenuOpen(false);
  };

  const ActiveContent = () => {
    if (activeTab === "My Account") {
      return (
        <PosMyAccount
          isDark={isDark}
          accent={accentColor}
          branchInfo={branchInfo}
        />
      );
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

    if (activeTab === "Email Reports") {
      return <PosReportingModal isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Data & Security") {
      return <PosBackupModal isDark={isDark} accent={accentColor} />;
    }

    if (activeTab === "Appearance") {
      return (
        <PosAppearance
          isDark={isDark}
          setTheme={setTheme}
          accentColor={accentColor}
          selectedColorObj={selectedColorObj}
          setSelectedColorObj={setSelectedColorObj}
          adaptivePalette={adaptivePalette}
          getContrastText={getContrastText}
        />
      );
    }

    return null;
  };

  const NavChip = ({ nav, mobile = false }) => {
    const Icon = nav.icon;
    const isActive = activeTab === nav.id && !nav.route;

    return (
      <button
        onClick={() => handleNavClick(nav)}
        className={`group flex items-center gap-3 rounded-2xl border transition-all duration-300 ${
          mobile ? "w-full px-4 py-4" : "px-4 py-3 whitespace-nowrap"
        } ${
          isActive
            ? "text-white shadow-[0_0_20px_rgba(37,99,235,0.22)]"
            : isDark
              ? "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 shadow-sm"
        }`}
        style={
          isActive
            ? {
                backgroundColor: accentColor,
                borderColor: accentColor,
                color: getContrastText(),
              }
            : {}
        }
      >
        <Icon size={16} />
        <span className="text-[11px] font-black tracking-[0.16em] uppercase">
          {nav.id}
        </span>

        {mobile && (
          <FiChevronRight
            className={`ml-auto ${
              isActive ? "" : isDark ? "text-slate-500" : "text-slate-400"
            }`}
            size={16}
          />
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xl"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-center w-full h-full p-0 sm:p-6">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className={`relative w-full h-full sm:h-[95vh] sm:max-w-[1450px] overflow-hidden sm:rounded-[36px] border ${
            isDark
              ? "bg-[#020617] border-white/10 text-slate-200"
              : "bg-slate-50 border-slate-200 text-slate-900"
          } shadow-2xl`}
        >
          {/* Ambient background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className={`absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${
                isDark ? "bg-blue-600/10" : "bg-blue-600/15"
              }`}
            />
            <div
              className={`absolute bottom-[-10%] left-[-10%] w-[35%] h-[35%] rounded-full blur-[120px] ${
                isDark ? "bg-cyan-500/10" : "bg-cyan-500/10"
              }`}
            />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-5 border-b sm:px-8 sm:py-6 border-white/5">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] uppercase text-blue-400">
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
                <p
                  className={`mt-1 text-sm ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Manage account, users, reports, backups, and appearance.
                </p>
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
              {/* Desktop sidebar */}
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
                      className="w-14 h-1 mt-3 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                </div>

                <div className="flex-1 px-4 pb-6 overflow-y-auto no-scrollbar">
                  <div className="flex flex-col gap-3">
                    {navItems.map((nav) => (
                      <NavChip key={nav.id} nav={nav} />
                    ))}
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <main className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 px-5 pb-5 pt-4 sm:px-8 sm:pb-8">
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
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={`${activeTab}-${isDark}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.22 }}
                          >
                            <ActiveContent />
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 bg-black/60 lg:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />

                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "tween", duration: 0.25 }}
                  className={`absolute inset-y-0 left-0 z-50 w-[88%] max-w-[360px] lg:hidden border-r ${
                    isDark
                      ? "bg-[#020617] border-white/10"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.24em] uppercase text-blue-400">
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
                        <NavChip key={nav.id} nav={nav} mobile />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default PosSettings;
