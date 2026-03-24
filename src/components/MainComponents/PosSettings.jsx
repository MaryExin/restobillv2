"use client";

import React, { useState } from "react";
import { 
  FiX, FiLayers, FiSettings, FiUsers, FiShield, 
  FiUser, FiTrendingUp, FiCreditCard, 
  FiMail, FiMenu, FiDatabase 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

// Import Components
import PosUserRolesSetUp from "./PosSettingsModal/PosUserRolesSetUp";
import PosMyAccount from "./PosSettingsModal/PosMyAccount";
import PosAppearance from "./PosSettingsModal/PosAppearance";
import PosUserAccounts from "./PosSettingsModal/PosUserAccounts";
import PosSystemLogs from "./PosSettingsModal/PosSystemLogs"; 
import PosExpenses from "./PosSettingsModal/PosExpenses";
import PosReportingModal from "./PosSettingsModal/PosReportingModal";
import PosBackupModal from "./PosSettingsModal/PosBackupModal"; 

const PosSettings = ({ isOpen, onClose, branchInfo }) => {
  const { theme, setTheme } = useTheme(); 
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState("Appearance");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adaptivePalette = [
    { name: "Crimson", light: "#ef4444", dark: "#fca5a5" },
    { name: "Ocean", light: "#1d4ed8", dark: "#93c5fd" },
    { name: "Forest", light: "#15803d", dark: "#86efac" },
    { name: "Grape", light: "#7e22ce", dark: "#d8b4fe" },
    { name: "Amber", light: "#b45309", dark: "#fcd34d" },
  ];

  const [selectedColorObj, setSelectedColorObj] = useState(adaptivePalette[0]);
  const accentColor = isDark ? selectedColorObj.dark : selectedColorObj.light;
  const getContrastText = () => isDark ? "#0f172a" : "#ffffff";

  if (!isOpen) return null;

  const navItems = [
    { id: "My Account", icon: <FiUser /> },
    { id: "User Roles", icon: <FiShield /> },
    { id: "User Accounts", icon: <FiUsers /> },
    { id: "Registry Sales", icon: <FiTrendingUp /> },
    { id: "Expenses & Petty", icon: <FiCreditCard /> },
    { id: "Email Reports", icon: <FiMail /> },
    { id: "Data & Security", icon: <FiDatabase /> }, 
    { id: "Appearance", icon: <FiLayers /> },
    { id: "General", icon: <FiSettings /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-6 bg-black/85 backdrop-blur-2xl">
      
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ 
          scale: 1, 
          opacity: 1,
          backgroundColor: isDark ? "#0f172a" : "#f8fafc",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)",
        }}
        className="relative w-full h-full sm:h-[92vh] sm:max-w-[1600px] flex flex-col lg:flex-row overflow-hidden sm:rounded-[50px] border-2 shadow-2xl transition-all duration-500"
      >
        
        {/* SIDEBAR */}
        <aside className={`hidden lg:flex flex-col w-[330px] p-12 border-r transition-colors duration-500 ${isDark ? "border-white/5 bg-slate-950/20" : "border-slate-200 bg-white"}`}>
          <div className="mb-14">
            {/* CNC ADMIN TITLE - STRAIGHT/NORMAL FONT */}
            <h2 className="text-3xl font-black leading-none tracking-tighter uppercase" style={{ color: accentColor }}>
              CNC - ADMIN
            </h2>
            <div className="w-12 h-1.5 mt-3 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>

          <nav className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar">
            {navItems.map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className="w-full flex items-center gap-5 p-5 rounded-[28px] transition-all group active:scale-95"
                style={{ 
                    backgroundColor: activeTab === nav.id ? accentColor : "transparent",
                    color: activeTab === nav.id ? getContrastText() : (isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.5)"),
                }}
              >
                <span className="text-xl shrink-0">
                  {nav.icon}
                </span>
                {/* NAV LABEL - STRAIGHT FONT */}
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                  {nav.id}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="relative flex flex-col flex-1 overflow-y-auto no-scrollbar">
          
          {/* HEADER AREA */}
          <div className={`sticky top-0 z-20 p-10 flex items-center justify-between border-b ${isDark ? "bg-slate-900/90 border-white/5" : "bg-white/90 border-slate-200"} backdrop-blur-md`}>
            <div>
               <h3 className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                System Module
               </h3>
               <h1 className={`text-2xl font-black uppercase tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                {activeTab}
               </h1>
            </div>
            
            <button 
              onClick={onClose}
              className={`p-4 rounded-3xl transition-all active:scale-90 shadow-sm ${
                  isDark ? 'bg-white/5 text-white border border-white/5 hover:bg-rose-500 hover:text-white' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-rose-500 hover:text-white'
              }`}
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="p-10 lg:p-20 w-full max-w-[1250px] mx-auto min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${isDark}`}
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
              >
                {/* --- RENDER CONTENT --- */}
                {activeTab === "General" && (
                  <div className="space-y-6">
                    <h1 className={`text-6xl lg:text-8xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
                      General <span style={{color: accentColor}}>Settings</span>
                    </h1>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.4em]">Global System Configuration</p>
                  </div>
                )}

                {/* logic for other tabs... */}
                {activeTab === "Email Reports" && <PosReportingModal isDark={isDark} accent={accentColor} />}
                {activeTab === "Data & Security" && <PosBackupModal isDark={isDark} accent={accentColor} />}
                {activeTab === "Appearance" && (
                  <PosAppearance 
                    isDark={isDark} setTheme={setTheme} accentColor={accentColor} 
                    selectedColorObj={selectedColorObj} setSelectedColorObj={setSelectedColorObj} 
                    adaptivePalette={adaptivePalette} getContrastText={getContrastText} 
                  />
                )}
                {activeTab === "User Accounts" && <PosUserAccounts isDark={isDark} accent={accentColor} getContrastText={getContrastText} />}
                {activeTab === "My Account" && <PosMyAccount isDark={isDark} accent={accentColor} branchInfo={branchInfo} />}
                {activeTab === "User Roles" && <PosUserRolesSetUp isDark={isDark} accent={accentColor} textColor={getContrastText()} />}
                {activeTab === "Registry Sales" && <PosSystemLogs isDark={isDark} accent={accentColor} />}
                {activeTab === "Expenses & Petty" && <PosExpenses isDark={isDark} accent={accentColor} getContrastText={getContrastText} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* MOBILE OVERLAY (Updated Font Styles too) */}
        <AnimatePresence>
          {isMobileMenuOpen && (
             <motion.div 
               initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
               className={`fixed inset-0 z-[115] p-10 flex flex-col ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
             >
               <div className="flex items-center justify-between mb-12">
                 <h2 className="text-2xl font-black tracking-tighter uppercase" style={{ color: accentColor }}>Menu</h2>
                 <button onClick={() => setIsMobileMenuOpen(false)} className="p-4 rounded-full bg-slate-500/10"><FiX size={24}/></button>
               </div>
               <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                 {navItems.map((nav) => (
                   <button
                     key={nav.id}
                     onClick={() => { setActiveTab(nav.id); setIsMobileMenuOpen(false); }}
                     className="w-full flex items-center gap-6 p-7 rounded-[35px] transition-all"
                     style={activeTab === nav.id ? { backgroundColor: accentColor, color: getContrastText() } : { border: '1px solid rgba(0,0,0,0.05)' }}
                   >
                     <span className="text-2xl">{nav.icon}</span>
                     <span className="text-sm font-black uppercase tracking-[0.2em]">{nav.id}</span>
                   </button>
                 ))}
               </div>
             </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default PosSettings;