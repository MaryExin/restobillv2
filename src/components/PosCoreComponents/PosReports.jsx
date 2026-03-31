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
import ReprintModal from "../MainComponents/ReportsModal/ReprintModal";

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
    className={`group relative flex min-h-[140px] flex-col items-center justify-center gap-4 rounded-[24px] border p-6 text-center transition-all duration-300 ${
      disabled
        ? isDark
          ? "cursor-not-allowed border-slate-800 bg-slate-900/70 opacity-60"
          : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
        : isDark
        ? "border-white/10 bg-white/[0.04] hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.08] hover:shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
        : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-300 hover:bg-slate-50 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]"
    }`}
  >
    <div
      className={`text-[30px] transition-transform duration-300 ${
        disabled
          ? isDark
            ? "text-slate-600"
            : "text-slate-400"
          : `${color} group-hover:scale-110`
      }`}
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

// Idinagdag ang terminalNumber, categoryCode, unitCode sa props
const PosReports = ({ open, onClose, terminalNumber, categoryCode, unitCode }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeModal, setActiveModal] = useState(null);

  if (!open) return null;

  const reportItems = [
    {
      label: "Dashboard",
      icon: FaChartLine,
      color: "text-blue-500",
      action: () => setActiveModal("dashboard"),
    },
    {
      label: "Daily Sales",
      icon: FaCalendarDay,
      color: "text-violet-500",
      action: () => setActiveModal("daily"),
    },
    {
      label: "Hourly Sales",
      icon: FaClock,
      color: "text-amber-500",
      action: () => setActiveModal("hourly"),
    },
    {
      label: "Transactions",
      icon: FaHistory,
      color: "text-sky-500",
      action: () => setActiveModal("transactions"),
    },
    {
      label: "Sales Per Item",
      icon: FaBoxOpen,
      color: "text-orange-500",
      action: () => setActiveModal("perProduct"),
    },
    {
      label: "BIR E-Sales",
      icon: FaFileInvoice,
      color: "text-cyan-500",
      action: () => setActiveModal("birESales"),
    },
    {
      label: "Z-Reading",
      icon: FaPrint,
      color: "text-yellow-500",
      action: () => setActiveModal("reprint"),
    },
    {
      label: "Customers",
      icon: FaUsers,
      color: "text-indigo-500",
      action: () => setActiveModal("customers"),
    },
    {
      label: "Refunds",
      icon: FaUndo,
      color: "text-orange-600",
      action: () => setActiveModal("refunds"),
    },
    {
      label: "Voids",
      icon: FaTrashAlt,
      color: "text-rose-500",
      action: () => setActiveModal("voids"),
    },
    {
      label: "Logs",
      icon: FaListUl,
      color: "text-slate-500",
      action: () => setActiveModal("logs"),
    },
    {
      label: "Sync Data",
      icon: FaSyncAlt,
      color: "text-blue-400",
      comingSoon: true,
    },
    {
      label: "XML",
      icon: FaCode,
      color: "text-emerald-500",
      action: () => setActiveModal("xml"),
    },
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
          className={`relative flex w-full max-w-[980px] flex-col overflow-hidden rounded-[30px] border shadow-2xl ${
            isDark
              ? "border-white/10 bg-[#0f172a]"
              : "border-slate-200 bg-[#f8fafc]"
          }`}
        >
          <div
            className={`border-b px-6 py-6 sm:px-8 ${
              isDark
                ? "border-white/10 bg-white/[0.03]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`text-sm font-semibold ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
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
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-rose-500 hover:text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-rose-500 hover:text-white"
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
      <BirESalesModal
        isOpen={activeModal === "birESales"}
        onClose={() => setActiveModal(null)}
      />
      <RefundsModal
        isOpen={activeModal === "refunds"}
        onClose={() => setActiveModal(null)}
      />
      <VoidsModal
        isOpen={activeModal === "voids"}
        onClose={() => setActiveModal(null)}
      />
      <CustomersModal
        isOpen={activeModal === "customers"}
        onClose={() => setActiveModal(null)}
      />
      <LogsModal
        isOpen={activeModal === "logs"}
        onClose={() => setActiveModal(null)}
      />
      <ModalXml
        isOpen={activeModal === "xml"}
        onClose={() => setActiveModal(null)}
      />
      
      {/* Ipinasa ang mga IDs para sa ReprintModal fetching */}
      <ReprintModal
        isOpen={activeModal === "reprint"}
        onClose={() => setActiveModal(null)}
        terminalNumber={terminalNumber}
        categoryCode={categoryCode}
        unitCode={unitCode}
      />
    </>,
    document.body
  );
};

export default PosReports;