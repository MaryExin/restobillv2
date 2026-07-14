"use client";

import React, { useState } from "react";
import { FiBriefcase, FiDatabase, FiShield } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import PosBusinessInfoManager from "./PosBusinessInfoManager";
import PosBackupModal from "./PosBackupModal";

const SUB_TABS = [
  {
    id: "business-profile",
    label: "Business Profile",
    icon: FiBriefcase,
    description: "Store identity, receipt headers, and BIR details",
  },
  {
    id: "backup-security",
    label: "Backup & Security",
    icon: FiShield,
    description: "Data backups, terminal config, and system reset",
  },
];

const PosDataSecurity = ({ isDark, accent, getContrastText }) => {
  const [activeSubTab, setActiveSubTab] = useState("business-profile");

  const contrast = getContrastText ? getContrastText() : "#fff";

  const cardBase = isDark
    ? "bg-slate-900/50 border-white/5"
    : "bg-white border-slate-200 shadow-sm";

  const textMuted = isDark ? "text-slate-500" : "text-slate-400";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSub = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div
        className={`flex items-center gap-5 rounded-3xl border p-6 ${cardBase}`}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg"
          style={{ backgroundColor: accent }}
        >
          <FiDatabase size={22} color={contrast} />
        </div>
        <div>
          <h2 className={`text-2xl font-black tracking-tight ${textPrimary}`}>
            Data &amp; Security
          </h2>
          <p className={`mt-0.5 text-sm ${textSub}`}>
            Manage business profile, backups, and system security settings.
          </p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div
        className={`flex gap-3 rounded-3xl border p-3 ${
          isDark
            ? "bg-slate-950/40 border-white/5"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`group flex flex-1 flex-col gap-1 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                isActive
                  ? "shadow-md"
                  : isDark
                    ? "bg-slate-900/40 border-slate-800 hover:border-slate-600"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: accent,
                      borderColor: accent,
                    }
                  : {}
              }
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={15}
                  style={isActive ? { color: contrast } : {}}
                  className={!isActive ? textMuted : ""}
                />
                <span
                  className="text-[11px] font-black tracking-[0.18em] uppercase"
                  style={isActive ? { color: contrast } : {}}
                >
                  {tab.label}
                </span>
              </div>
              <p
                className="text-[10px] font-semibold leading-tight"
                style={
                  isActive
                    ? { color: `color-mix(in srgb, ${contrast} 70%, transparent)` }
                    : {}
                }
              >
                {!isActive && (
                  <span className={textMuted}>{tab.description}</span>
                )}
                {isActive && tab.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {activeSubTab === "business-profile" && (
            <PosBusinessInfoManager
              isDark={isDark}
              accent={accent}
              getContrastText={getContrastText}
            />
          )}

          {activeSubTab === "backup-security" && (
            <PosBackupModal isDark={isDark} accent={accent} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PosDataSecurity;
