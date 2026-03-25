"use client";

import React, { useState, useEffect } from "react";
import { 
  FiX, FiLayers, FiSettings, FiUsers, FiShield, 
  FiUser, FiTrendingUp, FiCreditCard, 
  FiMail, FiMenu, FiDatabase 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

// Import Components
import PosUserRolesSetUp from "./PosSettingsModal/PosUserRolesSetUp";
import UserRoles from "./PosSettingsModal/UserRoles";
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
  
  // Default to My Account
  const [activeTab, setActiveTab] = useState("My Account");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-reset to My Account when opened
  useEffect(() => {
    if (isOpen) setActiveTab("My Account");
  }, [isOpen]);

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
    // { id: "General", icon: <FiSettings /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-black/80 backdrop-blur-xl">
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ 
          scale: 1, 
          opacity: 1,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)",
        }}
        // Inayos ang max-height at width para hindi magmukhang dambuhala sa malalaking screen
        className="relative w-full h-full sm:h-[min(850px,95vh)] sm:max-w-[1400px] flex flex-col lg:flex-row overflow-hidden sm:rounded-[40px] border shadow-2xl transition-all duration-300"
      >
        
        {/* SIDEBAR - Binawasan ang lapad at padding */}
        <aside className={`hidden lg:flex flex-col w-[280px] p-8 border-r transition-colors duration-500 ${isDark ? "border-white/5 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"}`}>
          <div className="mb-10">
            <h2 className="text-xl font-black leading-none tracking-tighter uppercase" style={{ color: accentColor }}>
              SETTINGS
            </h2>
            <div className="w-8 h-1 mt-2 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
            {navItems.map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className="flex items-center w-full gap-4 p-4 transition-all rounded-2xl group active:scale-95"
                style={{ 
                    backgroundColor: activeTab === nav.id ? accentColor : "transparent",
                    color: activeTab === nav.id ? getContrastText() : (isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.5)"),
                }}
              >
                <span className="text-lg shrink-0">
                  {nav.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                  {nav.id}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="relative flex flex-col flex-1 overflow-hidden bg-transparent">
          
          {/* HEADER AREA - Mas compact ang padding */}
          <div className={`sticky top-0 z-20 p-6 lg:px-10 flex items-center justify-between border-b ${isDark ? "bg-slate-900/40 border-white/5" : "bg-white/40 border-slate-100"} backdrop-blur-xl`}>
            <div>
               <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] opacity-50 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                System Module
               </h3>
               <h1 className={`text-xl font-black uppercase tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                {activeTab}
               </h1>
            </div>
            
            <button 
              onClick={onClose}
              className={`p-3 rounded-2xl transition-all active:scale-90 ${
                  isDark ? 'bg-white/5 text-white hover:bg-rose-500/20 hover:text-rose-500' : 'bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white'
              }`}
            >
              <FiX size={20} />
            </button>
          </div>

          {/* CONTENT AREA - Binawasan ang padding para hindi siksik */}
          <div className="flex-1 p-6 overflow-y-auto lg:p-12 no-scrollbar">
            <div className="max-w-[1000px] mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeTab}-${isDark}`}
                  initial={{ opacity: 0, y: 8 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "My Account" && <PosMyAccount isDark={isDark} accent={accentColor} branchInfo={branchInfo} />}
                  {activeTab === "User Role" && <UserRoles isDark={isDark} accent={accentColor} textColor={getContrastText()} />}
                  {activeTab === "User Accounts" && <PosUserAccounts isDark={isDark} accent={accentColor} getContrastText={getContrastText} />}
                  {activeTab === "Registry Sales" && <PosSystemLogs isDark={isDark} accent={accentColor} />}
                  {activeTab === "Expenses & Petty" && <PosExpenses isDark={isDark} accent={accentColor} getContrastText={getContrastText} />}
                  {activeTab === "Email Reports" && <PosReportingModal isDark={isDark} accent={accentColor} />}
                  {activeTab === "Data & Security" && <PosBackupModal isDark={isDark} accent={accentColor} />}
                  {activeTab === "Appearance" && (
                    <PosAppearance 
                      isDark={isDark} setTheme={setTheme} accentColor={accentColor} 
                      selectedColorObj={selectedColorObj} setSelectedColorObj={setSelectedColorObj} 
                      adaptivePalette={adaptivePalette} getContrastText={getContrastText} 
                    />
                  )}
                  {/* {activeTab === "General" && (
                    <div className="space-y-4">
                      <h1 className={`text-4xl lg:text-5xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
                        General <span style={{color: accentColor}}>Settings</span>
                      </h1>
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.4em]">Global System Configuration</p>
                    </div>
                  )} */}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* MOBILE MENU TOGGLE (Visible only on small screens) */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed z-50 p-4 rounded-full shadow-2xl lg:hidden bottom-6 right-6"
          style={{ backgroundColor: accentColor, color: getContrastText() }}
        >
          <FiMenu size={24} />
        </button>

        {/* MOBILE OVERLAY */}
        <AnimatePresence>
          {isMobileMenuOpen && (
             <motion.div 
               initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
               className={`fixed inset-0 z-[115] p-8 flex flex-col ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
             >
               <div className="flex items-center justify-between mb-8">
                 <h2 className="text-xl font-black tracking-tighter uppercase" style={{ color: accentColor }}>Menu</h2>
                 <button onClick={() => setIsMobileMenuOpen(false)} className="p-3 rounded-xl bg-slate-500/10"><FiX size={20}/></button>
               </div>
               <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                 {navItems.map((nav) => (
                   <button
                     key={nav.id}
                     onClick={() => { setActiveTab(nav.id); setIsMobileMenuOpen(false); }}
                     className="flex items-center w-full gap-5 p-5 transition-all rounded-2xl"
                     style={activeTab === nav.id ? { backgroundColor: accentColor, color: getContrastText() } : { border: '1px solid rgba(0,0,0,0.05)' }}
                   >
                     <span className="text-xl">{nav.icon}</span>
                     <span className="text-xs font-bold tracking-widest uppercase">{nav.id}</span>
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