import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { 
  FaChartLine, FaCalendarDay, FaClock, FaHistory, 
  FaBoxOpen, FaFileInvoice, FaPrint, FaUsers, 
  FaUndo, FaTrashAlt, FaListUl, FaSyncAlt 
} from "react-icons/fa";

const ReportCard = ({ icon: Icon, label, onClick, color = "text-blue-500" }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-white/50 bg-white p-5 shadow-sm transition-all hover:scale-[1.05] hover:shadow-md active:scale-95 group"
  >
    <div className={`text-[42px] transition-transform group-hover:rotate-3 ${color}`}>
      <Icon />
    </div>
    <span className="text-center text-[13px] font-extrabold leading-tight text-[#2e4a7d]">
      {label}
    </span>
  </button>
);

const PosReports = ({ open, onClose }) => {
  const navigate = useNavigate();
  if (!open) return null;

  const reportItems = [
    { label: "Dashboard", icon: FaChartLine, color: "text-[#4d8df7]", path: "/dashboard" },
    { label: "Daily Sales Report", icon: FaCalendarDay, color: "text-[#a855f7]", path: "/reports/daily" },
    { label: "Hourly Sales (Per Day)", icon: FaClock, color: "text-[#f97316]", path: "/reports/hourly-day" },
    { label: "Hourly Sales (Per Product)", icon: FaClock, color: "text-[#ef4444]", path: "/reports/hourly-product" },
    { label: "Transaction Records", icon: FaHistory, color: "text-[#3b82f6]", path: "/posTransactionRecord" },
    { label: "Sales Per Product", icon: FaBoxOpen, color: "text-[#eab308]", path: "/reports/sales-per-product" },
    { label: "BIR E-Sales Report", icon: FaFileInvoice, color: "text-[#06b6d4]", path: "/reports/bir-esales" },
    { label: "Reprint Z-Reading", icon: FaPrint, color: "text-[#f59e0b]", path: "/reports/reprint-z" },
    { label: "Customers Report", icon: FaUsers, color: "text-[#2563eb]", path: "/reports/customers" },
    { label: "Refunded Transactions", icon: FaUndo, color: "text-[#f59e0b]", path: "/reports/refunded" },
    { label: "Voided Transactions", icon: FaTrashAlt, color: "text-[#ef4444]", path: "/reports/voided" },
    { label: "Activity Logs", icon: FaListUl, color: "text-[#64748b]", path: "/reports/logs" },
    { label: "Sync Data", icon: FaSyncAlt, color: "text-[#0ea5e9]", path: "/sync" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative flex w-full max-w-[900px] flex-col overflow-hidden rounded-[24px] border border-white/50 bg-[#e9edf4] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="mb-10 text-center">
          <h2 className="text-[30px] font-bold text-[#2e4a7d] md:text-[36px]">Choose Report</h2>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {reportItems.map((item, index) => (
            <ReportCard key={index} label={item.label} icon={item.icon} color={item.color} onClick={() => { navigate(item.path); onClose(); }} />
          ))}
        </div>
        <div className="flex justify-center mt-12">
          <button type="button" onClick={onClose} className="h-[58px] min-w-[240px] rounded-full bg-gradient-to-r from-pink-300 to-cyan-300 px-8 text-[20px] font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-[0.98]">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PosReports;