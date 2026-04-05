import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  FaChartLine,
  FaCalendarDay,
  FaClock,
  FaHistory,
  FaBoxOpen,
  FaFileInvoice,
  FaPrint,
  FaUsers,
  FaUndo,
  FaTrashAlt,
  FaListUl,
  FaSyncAlt,
  FaTimes,
  FaCode,
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

// Modals
import DashboardModal from "../MainComponents/ReportsModal/DashboardModal";
import DailySalesModal from "../MainComponents/ReportsModal/DailySalesModal";
import HourlySalesModal from "../MainComponents/ReportsModal/HourlySalesModal";
import SalesPerProductModal from "../MainComponents/ReportsModal/SalesPerProductModal";
import TransactionsModal from "../MainComponents/ReportsModal/TransactionsModal";
import BirESalesModal from "../MainComponents/ReportsModal/BIRESalesModal";
import RefundsModal from "../MainComponents/ReportsModal/RefundsModal";
import VoidsModal from "../MainComponents/ReportsModal/VoidsModal";
import CustomersModal from "../MainComponents/ReportsModal/CustomersModal";
import LogsModal from "../MainComponents/ReportsModal/LogsModal";
import ModalXml from "../Modals/ModalXml";
import ZReadingView from "../MainComponents/ReportsModal/ZReadingView";

const MenuCard = ({
  icon: Icon,
  label,
  onClick,
  color = "text-blue-500",
  disabled = false,
  isDark,
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`group relative flex min-h-[140px] flex-col items-center justify-center gap-4 rounded-[24px] border-2 p-6 text-center transition-all duration-300 ${
      disabled
        ? isDark
          ? "cursor-not-allowed border-slate-800 bg-slate-900/70 opacity-60"
          : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
        : isDark
        ? "border-blue-500/30 bg-white/[0.04] hover:-translate-y-1 hover:border-blue-500 hover:bg-white/[0.08] hover:shadow-[0_18px_45px_rgba(59,130,246,0.2)]"
        : "border-blue-100 bg-white hover:-translate-y-1 hover:border-blue-500 hover:bg-slate-50 hover:shadow-[0_18px_40px_rgba(59,130,246,0.15)]"
    }`}
  >
    <div
      className={`text-[30px] transition-transform duration-300 ${
        disabled
          ? isDark
            ? "text-slate-600"
            : "text-slate-400"
          : "group-hover:scale-110"
      }`}
      style={{ color: !disabled ? color : undefined }}
    >
      <Icon />
    </div>

    <span
      className={`text-sm font-semibold leading-tight ${
        disabled
          ? isDark
            ? "text-slate-500"
            : "text-slate-400"
          : isDark
          ? "text-slate-200"
          : "text-slate-700"
      }`}
    >
      {label}
    </span>

    {disabled && (
      <span
        className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-medium ${
          isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"
        }`}
      >
        Soon
      </span>
    )}
  </button>
);

const PosReports = ({ open, onClose, terminalNumber, categoryCode, unitCode }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeModal, setActiveModal] = useState(null);
  const [zReadingData, setZReadingData] = useState(null);

  if (!open) return null;

  const handleZReadingClick = () => {
    setActiveModal("zreadingview");
    setZReadingData({
      parReportDate: new Date().toLocaleDateString(),
      parReportTime: new Date().toLocaleTimeString(),
      parZCounterNo: "000001",
      parBegOR: "000001",
      parEndOR: "000050",
      parGrossAmount: 1500.00,
      parDiscount: 150.00,
      parReturn: 0.00,
      parNetAmount: 1350.00,
      parVATableSales: 1205.36,
      parVATAmount: 144.64,
      parVATExemptSales: 0.00,
      parPreviousAccumSales: 10000.00,
      parPresentAccumSales: 11350.00
    });
  };

  const reportItems = [
    { label: "Dashboard", icon: FaChartLine, color: "#3b82f6", action: () => setActiveModal("dashboard") },
    { label: "Daily Sales", icon: FaCalendarDay, color: "#8b5cf6", action: () => setActiveModal("daily") },
    { label: "Hourly Sales", icon: FaClock, color: "#f59e0b", action: () => setActiveModal("hourly") },
    { label: "Transactions", icon: FaHistory, color: "#0ea5e9", action: () => setActiveModal("transactions") },
    { label: "Sales Per Item", icon: FaBoxOpen, color: "#f97316", action: () => setActiveModal("perProduct") },
    { label: "BIR E-Sales", icon: FaFileInvoice, color: "#06b6d4", action: () => setActiveModal("birESales") },
    { label: "Z-Reading", icon: FaPrint, color: "#eab308", action: handleZReadingClick },
    { label: "Customers", icon: FaUsers, color: "#6366f1", action: () => setActiveModal("customers") },
    { label: "Refunds", icon: FaUndo, color: "#ea580c", action: () => setActiveModal("refunds") },
    { label: "Voids", icon: FaTrashAlt, color: "#f43f5e", action: () => setActiveModal("voids") },
    { label: "Logs", icon: FaListUl, color: "#64748b", action: () => setActiveModal("logs") },
    { label: "Sync Data", icon: FaSyncAlt, color: "#60a5fa", comingSoon: true },
    { label: "XML", icon: FaCode, color: "#10b981", action: () => setActiveModal("xml") },
  ];

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm ${
          isDark ? "bg-black/65" : "bg-slate-900/40"
        }`}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className={`relative flex w-full max-w-[980px] flex-col overflow-hidden rounded-[30px] border-2 shadow-2xl ${
            isDark ? "bg-[#0f172a] border-blue-500/20" : "bg-[#f8fafc] border-blue-100"
          }`}
        >
          <div
            className={`border-b-2 px-6 py-6 sm:px-8 ${
              isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-blue-500">
                  Reports
                </div>

                <h2
                  className={`mt-1 text-3xl font-bold tracking-tight sm:text-4xl ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Reports & Analytics
                </h2>
              </div>

              <button
                onClick={onClose}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all active:scale-90 ${
                  isDark
                    ? "bg-white/[0.04] border-white/10 text-slate-300 hover:bg-rose-500 hover:border-rose-500 hover:text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white"
                }`}
              >
                <FaTimes size={16} />
              </button>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {reportItems.map((item, index) => (
                <MenuCard
                  key={index}
                  {...item}
                  onClick={item.action}
                  disabled={item.comingSoon}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <DashboardModal isOpen={activeModal === "dashboard"} onClose={() => setActiveModal(null)} />
      <DailySalesModal isOpen={activeModal === "daily"} onClose={() => setActiveModal(null)} />
      <HourlySalesModal isOpen={activeModal === "hourly"} onClose={() => setActiveModal(null)} />
      <SalesPerProductModal isOpen={activeModal === "perProduct"} onClose={() => setActiveModal(null)} />
      <TransactionsModal isOpen={activeModal === "transactions"} onClose={() => setActiveModal(null)} />
      <BirESalesModal isOpen={activeModal === "birESales"} onClose={() => setActiveModal(null)} />
      
      <ZReadingView 
        isOpen={activeModal === "zreadingview"} 
        onClose={() => {
          setActiveModal(null);
          setZReadingData(null);
        }} 
        reportData={zReadingData} 
      />

      <RefundsModal isOpen={activeModal === "refunds"} onClose={() => setActiveModal(null)} />
      <VoidsModal isOpen={activeModal === "voids"} onClose={() => setActiveModal(null)} />
      <CustomersModal isOpen={activeModal === "customers"} onClose={() => setActiveModal(null)} />
      <LogsModal isOpen={activeModal === "logs"} onClose={() => setActiveModal(null)} />
      <ModalXml isOpen={activeModal === "xml"} onClose={() => setActiveModal(null)} />
    </>,
    document.body
  );
};

export default PosReports;