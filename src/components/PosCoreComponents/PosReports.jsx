import React, { useState } from "react";
import { createPortal } from "react-dom";
import { 
  FaChartLine, FaCalendarDay, FaClock, FaHistory, 
  FaBoxOpen, FaFileInvoice, FaPrint, FaUsers, 
  FaUndo, FaTrashAlt, FaListUl, FaSyncAlt, FaTimes 
} from "react-icons/fa";

// --- THEME CONTEXT ---
import { useTheme } from "../../context/ThemeContext";

// --- IMPORT MODALS ---
import DashboardModal from "../MainComponents/ReportsModal/DashboardModal";
import DailySalesModal from "../MainComponents/ReportsModal/DailySalesModal"; 
import HourlySalesModal from "../MainComponents/ReportsModal/HourlySalesModal";
import SalesPerProductModal from "../MainComponents/ReportsModal/SalesPerProductModal"; 
import TransactionsModal from "../MainComponents/ReportsModal/TransactionsModal"; 

/**
 * Reusable Card for the Menu
 */
const MenuCard = ({ icon: Icon, label, onClick, color = "text-blue-500", disabled = false, isDark }) => (
  <button
    onClick={disabled ? null : onClick}
    disabled={disabled}
    className={`flex flex-col p-6 items-center justify-center gap-4 rounded-[28px] border transition-all relative
      ${disabled 
        ? (isDark ? "bg-slate-800 border-slate-700 opacity-40" : "bg-slate-100 border-slate-200 opacity-40") 
        : (isDark 
            ? "border-white/10 bg-white/5 shadow-sm hover:scale-[1.05] hover:shadow-2xl hover:bg-white/10 active:scale-95" 
            : "border-slate-200 bg-white shadow-sm hover:scale-[1.05] hover:shadow-xl hover:bg-slate-50 active:scale-95")
      } group`}
  >
    <div className={`text-[36px] md:text-[42px] transition-transform 
      ${disabled ? (isDark ? "text-slate-600" : "text-slate-400") : `${color} group-hover:rotate-6`}`}
    >
      <Icon />
    </div>
    <span className={`text-center text-[11px] font-black uppercase tracking-tight leading-none
      ${disabled 
        ? (isDark ? "text-slate-500" : "text-slate-400") 
        : (isDark ? "text-slate-300" : "text-[#2e4a7d]")}`}
    >
      {label}
    </span>
    {disabled && (
      <span className={`absolute top-2 right-2 text-[7px] font-bold px-2 py-0.5 rounded-full uppercase
        ${isDark ? "bg-slate-700 text-slate-500" : "bg-slate-200 text-slate-500"}`}>
        Soon
      </span>
    )}
  </button>
);

const PosReports = ({ open, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeModal, setActiveModal] = useState(null);

  if (!open) return null;

  const reportItems = [
    { label: "Dashboard", icon: FaChartLine, color: "text-blue-500", action: () => setActiveModal("dashboard") },
    { label: "Daily Sales", icon: FaCalendarDay, color: "text-purple-500", action: () => setActiveModal("daily") },
    { label: "Hourly Sales", icon: FaClock, color: "text-orange-500", action: () => setActiveModal("hourly") },
    { label: "Transactions", icon: FaHistory, color: "text-blue-400", action: () => setActiveModal("transactions") },
    { label: "Sales Per Item", icon: FaBoxOpen, color: "text-amber-500", action: () => setActiveModal("perProduct") }, 
    { label: "BIR E-Sales", icon: FaFileInvoice, color: "text-cyan-500", comingSoon: true },
    { label: "Z-Reading", icon: FaPrint, color: "text-orange-400", comingSoon: true },
    { label: "Customers", icon: FaUsers, color: "text-blue-600", comingSoon: true },
    { label: "Refunds", icon: FaUndo, color: "text-orange-600", comingSoon: true },
    { label: "Voids", icon: FaTrashAlt, color: "text-red-500", comingSoon: true },
    { label: "Logs", icon: FaListUl, color: "text-slate-500", comingSoon: true },
    { label: "Sync Data", icon: FaSyncAlt, color: "text-sky-500", comingSoon: true },
  ];

  return createPortal(
    <>
      {/* MAIN OVERLAY */}
      <div 
        className={`fixed inset-0 z-[99999] flex items-center justify-center backdrop-blur-md p-4 transition-colors
          ${isDark ? "bg-black/60" : "bg-slate-900/40"}`} 
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className={`relative flex w-full max-w-[950px] flex-col overflow-hidden rounded-[40px] border p-10 md:p-14 shadow-2xl transition-all
          ${isDark ? "bg-[#020617] border-white/10" : "bg-[#e9edf4] border-white"}`}>
          
          <div className="mb-12 text-center">
            <h2 className={`text-[38px] font-black tracking-tighter uppercase italic
              ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>
              Reports & <span className="text-blue-500">Analytics</span>
            </h2>
            <div className="w-20 h-1.5 mx-auto mt-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
            <p className={`mt-4 text-[11px] font-black uppercase tracking-[0.3em]
              ${isDark ? "text-slate-500" : "text-[#2e4a7d]/40"}`}>
              CNC - STA MARIA | Select report type
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            {reportItems.map((item, index) => (
              <MenuCard 
                key={index} 
                label={item.label} 
                icon={item.icon} 
                color={item.color} 
                disabled={item.comingSoon}
                onClick={item.action} 
                isDark={isDark}
              />
            ))}
          </div>

          <div className="flex justify-center mt-12">
            <button
              onClick={onClose}
              className={`flex flex-row px-12 py-5 items-center justify-center gap-4 rounded-[28px] border shadow-sm transition-all group
                ${isDark 
                  ? "border-white/10 bg-white/5 text-slate-300 hover:bg-rose-600 hover:text-white" 
                  : "border-slate-200 bg-white text-[#2e4a7d] hover:bg-rose-600 hover:text-white"}`}
            >
              <FaTimes className="text-[20px] group-hover:rotate-90 transition-transform" />
              <span className="text-center text-[13px] font-black uppercase tracking-widest">Close Menu</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS HANDLER --- */}
      <DashboardModal 
        isOpen={activeModal === "dashboard"} 
        onClose={() => setActiveModal(null)} 
      />

      <DailySalesModal 
        isOpen={activeModal === "daily"} 
        onClose={() => setActiveModal(null)} 
      />
      
      <HourlySalesModal 
        isOpen={activeModal === "hourly"} 
        onClose={() => setActiveModal(null)} 
      />
      
      <SalesPerProductModal 
        isOpen={activeModal === "perProduct"} 
        onClose={() => setActiveModal(null)} 
      />

      <TransactionsModal 
        isOpen={activeModal === "transactions"} 
        onClose={() => setActiveModal(null)} 
      />
    </> ,
    document.body
  );
};

export default PosReports;