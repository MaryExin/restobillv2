import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaFileExcel,
  FaPrint,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaUserFriends,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { useTheme } from "../../../context/ThemeContext";
import useApiHost from "../../../hooks/useApiHost";
import useReportDateAccess from "../../../hooks/useReportDateAccess";
import { getCurrentUserRole } from "../../../utils/getCurrentUserRole";
import { posAuthenticatedFetch } from "../../../utils/posAuthenticatedFetch";

const number = (value) => Number(value || 0).toLocaleString();

const CustomCalendar = ({
  selectedDate,
  onChange,
  isOpen,
  onClose,
  isDark,
}) => {
  const [currentView, setCurrentView] = useState(new Date(selectedDate));
  const calendarRef = useRef(null);

  useEffect(() => {
    setCurrentView(new Date(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(
    currentView.getFullYear(),
    currentView.getMonth(),
    1,
  ).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handlePickDay = (day) => {
    const localDate = new Date(currentView.getFullYear(), currentView.getMonth(), day);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const date = String(localDate.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${date}`);
    onClose();
  };

  return (
    <div
      ref={calendarRef}
      className={`absolute left-0 top-full z-[100005] mt-2 w-[320px] rounded-2xl border p-5 shadow-2xl ${
        isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between px-1 mb-4">
        <h4 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          {monthNames[currentView.getMonth()]} {currentView.getFullYear()}
        </h4>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1));
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isDark ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FaChevronLeft size={10} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1, 1));
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isDark ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      </div>
      <div className={`mb-2 grid grid-cols-7 text-center text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (<div key={d}>{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => (<div key={i} />))}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = `${currentView.getFullYear()}-${String(currentView.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <button
              key={day}
              onClick={(e) => { e.stopPropagation(); handlePickDay(day); }}
              className={`h-9 w-full rounded-lg text-sm font-medium transition ${
                dateString === selectedDate ? "bg-blue-600 text-white" : isDark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CustomerHeadCountModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const apiHost = useApiHost();
  const { isDateLocked, lockedDate, isShiftDateLoading } = useReportDateAccess();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({});

  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("Active");
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  // Admin/Cashier: report date is locked to the currently open shift.
  useEffect(() => {
    if (isDateLocked && lockedDate) {
      setDateFrom(lockedDate);
      setDateTo(lockedDate);
    }
  }, [isDateLocked, lockedDate]);

  useEffect(() => {
    if (window.electronAPI?.readBusinessInfo) {
      window.electronAPI
        .readBusinessInfo()
        .then((info) => { if (info) setBusinessInfo(info); })
        .catch(() => {});
    } else {
      fetch("/businessInfo.json")
        .then((r) => r.json())
        .then(setBusinessInfo)
        .catch(() => {});
    }
  }, [apiHost]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await posAuthenticatedFetch(`http://localhost/api/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportKey: "customerHeadCount",
          datefrom: dateFrom,
          dateto: dateTo,
          includeVoided: status === "All" || status === "Voided",
          voidOnly: status === "Voided",
          role: getCurrentUserRole(),
        }),
      });
      const result = await response.json();
      setRows(result?.customerHeadCount || []);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    if (isOpen && (!isDateLocked || !isShiftDateLoading)) fetchData();
  }, [isOpen, fetchData, isDateLocked, isShiftDateLoading]);

  const filtered = rows.filter((item) =>
    item.Date?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totals = filtered.reduce(
    (acc, item) => {
      acc.transactions += Number(item["Transactions"] || 0);
      acc.headCount += Number(item["Head Count"] || 0);
      return acc;
    },
    { transactions: 0, headCount: 0 },
  );

  const handlePrint = () => { window.print(); };

  const handleExportExcel = () => {
    const exportRows = filtered.map((item) => ({
      Date: item.Date || "",
      Transactions: item["Transactions"] || 0,
      "Head Count": item["Head Count"] || 0,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Head Count");
    XLSX.writeFile(workbook, `Customer_Head_Count_${dateFrom}_to_${dateTo}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-3 backdrop-blur-md ${isDark ? "bg-slate-950/90" : "bg-slate-900/35"}`}>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0 !important; }
          body { margin: 0 !important; padding: 0 !important; width: 80mm; background-color: white; }
          body * { visibility: hidden; }
          #chc-print-area, #chc-print-area * {
            visibility: visible;
            color: black !important;
            font-family: Arial, Helvetica, sans-serif;
          }
          #chc-print-area {
            position: absolute; left: 0; top: 0;
            width: 78mm; padding: 4mm 2mm; margin: 0;
          }
          .chc-header  { text-align: center; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1pt solid black; }
          .chc-company { font-size: 13px; font-weight: 900; }
          .chc-store   { font-size: 11px; font-weight: 700; }
          .chc-address { font-size: 9px; }
          .chc-title   { text-align: center; font-size: 12px; font-weight: 900; margin: 6px 0 4px; }
          .chc-period  { text-align: center; font-size: 9px; margin-bottom: 6px; }
          .chc-col-head { display: flex; font-size: 9px; font-weight: 900; border-bottom: 1pt solid black; padding-bottom: 3px; margin-bottom: 3px; }
          .chc-row     { display: flex; font-size: 9px; border-bottom: 1pt dashed black; padding: 4px 0; }
          .chc-total   { font-size: 10px; font-weight: 900; margin-top: 6px; text-align: right; }
          .no-print    { display: none !important; }
        }
      `}</style>
      <div className={`relative flex h-[97vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_90px_rgba(15,23,42,0.18)] ${isDark ? "border-white/10 bg-[#020617]" : "border-slate-200 bg-[#f8fafc]"}`}>

        {/* Header Section */}
        <div className={`shrink-0 border-b px-8 py-6 ${isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`text-sm font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}>Reports Dashboard</div>
              <h2 className={`mt-1 text-3xl font-bold sm:text-4xl ${isDark ? "text-white" : "text-slate-900"}`}>Customer Head Count</h2>

              <div className="flex gap-4 mt-4">
                 <div className={`px-4 py-2 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Transactions</p>
                    <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{number(totals.transactions)}</p>
                 </div>
                 <div className={`px-4 py-2 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`}>
                    <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold">Total Head Count</p>
                    <p className="text-lg font-bold text-indigo-500">{number(totals.headCount)}</p>
                 </div>
              </div>
            </div>

            <div className="flex gap-3 no-print">
              <button onClick={handleExportExcel} className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"}`}>
                <FaFileExcel size={14} /> Export Excel
              </button>
              <button onClick={handlePrint} className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${isDark ? "border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-600 hover:text-white" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white"}`}>
                <FaPrint size={14} /> Print
              </button>
              <button onClick={onClose} className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${isDark ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-rose-500 hover:text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-rose-500 hover:text-white"}`}>
                <FaTimes size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className={`flex shrink-0 items-center gap-4 px-8 py-4 ${isDark ? "bg-[#050a18]/40" : "bg-slate-100/70"}`}>
          <div className="relative flex-1">
            <FaSearch className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"}`} size={14} />
            <input type="text" placeholder="Search by date..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm font-medium outline-none transition ${isDark ? "border-white/10 bg-[#0a0f1e] text-white placeholder:text-slate-500 focus:border-blue-500/50" : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-blue-500"}`} />
          </div>
          <button onClick={fetchData} className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${isDark ? "border-white/10 bg-[#0a0f1e] text-white hover:bg-white/10" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            <FaSyncAlt className={loading ? "animate-spin" : ""} size={15} />
          </button>
          <button onClick={() => setShowFilter(true)} className="flex items-center h-12 gap-2 px-5 text-sm font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700">
            <FaFilter size={13} /> Filters
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 px-8 py-5 overflow-hidden">
          <div className={`relative h-full overflow-auto rounded-[28px] border custom-scrollbar ${isDark ? "border-white/10 bg-[#050a18]" : "border-slate-200 bg-white"}`}>
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-[50]">
                <tr className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-[#0a0f1e] text-slate-500" : "bg-slate-50 text-slate-400"}`}>
                  <th className={`sticky left-0 top-0 z-[60] border-b p-4 ${isDark ? "border-white/10 bg-[#0a0f1e]" : "border-slate-200 bg-slate-50"}`}>Date</th>
                  <th className="p-4 border-b border-slate-200/10">Transactions</th>
                  <th className="p-4 text-right border-b border-slate-200/10">Head Count</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/5 text-slate-300" : "divide-slate-100 text-slate-700"}`}>
                {filtered.length > 0 ? (
                  filtered.map((item, idx) => (
                    <tr key={idx} className={`text-sm transition ${isDark ? "hover:bg-blue-500/5" : "hover:bg-blue-50"}`}>
                      <td className={`sticky left-0 z-[40] border-r p-4 font-bold ${isDark ? "border-white/5 bg-[#050a18] text-blue-400" : "border-slate-100 bg-white text-blue-600"}`}>
                        {item.Date}
                      </td>
                      <td className="p-4">{number(item["Transactions"])}</td>
                      <td className="p-4 text-right text-base font-bold text-indigo-500">
                        {number(item["Head Count"])}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className={`p-10 text-center text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      No customer head count data found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer with Grand Total */}
        <div className={`flex shrink-0 items-center justify-between border-t px-8 py-5 ${isDark ? "border-white/10 bg-black/20" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-8">
            <div>
              <p className={`text-xs font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>Reporting Days</p>
              <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{filtered.length}</p>
            </div>
            <div className={`h-10 w-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            <div>
              <p className={`text-xs font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>Sync Status</p>
              <p className="text-2xl font-bold text-emerald-500">Live</p>
            </div>
          </div>
          <div className="px-8 py-4 text-right bg-indigo-600 shadow-xl rounded-2xl">
            <span className="text-xs font-bold tracking-widest uppercase text-white/70 flex items-center gap-2 justify-end">
              <FaUserFriends size={12} /> Grand Total Head Count
            </span>
            <h3 className="text-4xl font-black text-white">{number(totals.headCount)}</h3>
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilter && (
          <div className={`absolute inset-y-0 right-0 z-[100001] flex w-[420px] flex-col border-l p-8 shadow-2xl animate-in slide-in-from-right duration-300 ${isDark ? "border-white/10 bg-[#0a0f1e]" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h3 className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Filters</h3>
              <button onClick={() => setShowFilter(false)} className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${isDark ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-rose-500"}`}>
                <FaTimes size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-6">
              {!isDateLocked && (
                <>
                  <div className="relative">
                    <label className={`mb-2 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>Date From</label>
                    <button onClick={() => { setOpenStartCal(!openStartCal); setOpenEndCal(false); }} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${isDark ? "border-white/10 bg-white/[0.03] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <span className="font-medium">{dateFrom}</span>
                      <FaChevronDown className="text-slate-400" size={12} />
                    </button>
                    <CustomCalendar selectedDate={dateFrom} onChange={setDateFrom} isOpen={openStartCal} onClose={() => setOpenStartCal(false)} isDark={isDark} />
                  </div>
                  <div className="relative">
                    <label className={`mb-2 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>Date To</label>
                    <button onClick={() => { setOpenEndCal(!openEndCal); setOpenStartCal(false); }} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${isDark ? "border-white/10 bg-white/[0.03] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <span className="font-medium">{dateTo}</span>
                      <FaChevronDown className="text-slate-400" size={12} />
                    </button>
                    <CustomCalendar selectedDate={dateTo} onChange={setDateTo} isOpen={openEndCal} onClose={() => setOpenEndCal(false)} isDark={isDark} />
                  </div>
                </>
              )}
              <div>
                <label className={`mb-3 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>Transaction Status</label>
                <div className={`grid grid-cols-1 gap-2 rounded-2xl p-1 ${isDark ? "bg-black/20" : "bg-slate-100"}`}>
                  {["Active", "Voided", "All"].map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={`h-11 rounded-xl text-sm font-medium transition ${status === s ? "bg-blue-600 text-white shadow-lg" : isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "bg-white text-slate-600 hover:text-blue-600"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => { fetchData(); setShowFilter(false); }} className="mt-8 rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98]">
              Apply Search Criteria
            </button>
          </div>
        )}
      </div>

      {/* 80mm print area — receipt-style summary, hidden on screen */}
      <div id="chc-print-area" style={{ display: "none" }}>
        <div className="chc-header">
          {businessInfo?.companyName && <div className="chc-company">{businessInfo.companyName}</div>}
          {businessInfo?.storeName && <div className="chc-store">{businessInfo.storeName}</div>}
          {businessInfo?.address && <div className="chc-address">{businessInfo.address}</div>}
          {businessInfo?.tin && <div className="chc-address">VAT REG TIN: {businessInfo.tin}</div>}
        </div>

        <div className="chc-title">CUSTOMER HEAD COUNT REPORT</div>
        <div className="chc-period">PERIOD: {dateFrom} — {dateTo}</div>

        <div className="chc-col-head">
          <span style={{ width: "50%" }}>DATE</span>
          <span style={{ width: "25%", textAlign: "right" }}>TXNS</span>
          <span style={{ width: "25%", textAlign: "right" }}>HEAD CT</span>
        </div>

        {filtered.map((item, i) => (
          <div key={i} className="chc-row">
            <span style={{ width: "50%" }}>{item.Date}</span>
            <span style={{ width: "25%", textAlign: "right" }}>{number(item["Transactions"])}</span>
            <span style={{ width: "25%", textAlign: "right" }}>{number(item["Head Count"])}</span>
          </div>
        ))}

        <div className="chc-total">TOTAL TRANSACTIONS: {number(totals.transactions)}</div>
        <div className="chc-total">TOTAL HEAD COUNT: {number(totals.headCount)}</div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.2)"}; background-clip: content-box; }
      `}</style>
    </div>
  );
};

export default CustomerHeadCountModal;
