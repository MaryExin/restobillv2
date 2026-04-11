import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaCalendarAlt,
  FaFileExcel,
  FaArrowRight,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { useTheme } from "../../../context/ThemeContext";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const DailySalesModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("Active");
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datefrom: dateFrom,
          dateto: dateTo,
          includeVoided: status === "All" || status === "Voided",
          voidOnly: status === "Voided",
        }),
      });
      const result = await response.json();
      setSalesData(result?.dailySales || []);
    } catch (err) {
      console.error(err);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen, fetchSales]);

  const filtered = salesData.filter((item) =>
    item.Date?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // --- Computed Totals for Summary ---
  const totals = filtered.reduce((acc, item) => {
    acc.gross += parseFloat(item["Gross Sales"] || 0);
    acc.net += parseFloat(item["Net Sales"] || 0);
    acc.vat += parseFloat(item["VAT Amount"] || 0);
    acc.disc += (
      parseFloat(item["SRC Disc."] || 0) +
      parseFloat(item["PWD Disc."] || 0) +
      parseFloat(item["NAAC Disc."] || 0) +
      parseFloat(item["Solo Parent Disc."] || 0) +
      parseFloat(item["Other Disc."] || 0)
    );
    return acc;
  }, { gross: 0, net: 0, vat: 0, disc: 0 });

  const handleExportExcel = () => {
    const rows = filtered.map((item) => ({
      Date: item.Date || "",
      "Gross Sales": item["Gross Sales"] || 0,
      "SRC Disc.": item["SRC Disc."] || 0,
      "PWD Disc.": item["PWD Disc."] || 0,
      "NAAC Disc.": item["NAAC Disc."] || 0,
      "Solo Parent Disc.": item["Solo Parent Disc."] || 0,
      "Other Disc.": item["Other Disc."] || 0,
      "Cash Payment": item["Cash Payment"] || 0,
      "Cheque Payment": item["Cheque Payment"] || 0,
      "Card Payment": item["Card Payment"] || 0,
      "GCash Payment": item["GCash Payment"] || 0,
      "Maya Payment": item["Maya Payment"] || 0,
      "Other Payment": item["Other Payment"] || 0,
      "VATable Sales": item["VATable Sales"] || 0,
      "VAT Amount": item["VAT Amount"] || 0,
      "VAT Exempt Sales": item["VAT Exempt Sales"] || 0,
      "VAT Exemption": item["VAT Exemption"] || 0,
      "Net Sales": item["Net Sales"] || 0,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Sales");
    XLSX.writeFile(workbook, `Daily_Sales_${dateFrom}_to_${dateTo}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-3 backdrop-blur-md ${isDark ? "bg-slate-950/90" : "bg-slate-900/35"}`}>
      <div className={`relative flex h-[97vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_90px_rgba(15,23,42,0.18)] ${isDark ? "border-white/10 bg-[#020617]" : "border-slate-200 bg-[#f8fafc]"}`}>
        
        {/* Header Section */}
        <div className={`shrink-0 border-b px-8 py-6 ${isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`text-sm font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}>Reports Dashboard</div>
              <h2 className={`mt-1 text-3xl font-bold sm:text-4xl ${isDark ? "text-white" : "text-slate-900"}`}>Daily Sales</h2>
              
              <div className="flex gap-4 mt-4">
                 <div className={`px-4 py-2 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Gross</p>
                    <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{peso(totals.gross)}</p>
                 </div>
                 <div className={`px-4 py-2 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`}>
                    <p className="text-[10px] uppercase tracking-wider text-rose-500 font-bold">Total Discounts</p>
                    <p className="text-lg font-bold text-rose-500">-{peso(totals.disc)}</p>
                 </div>
                 <div className={`px-4 py-2 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`}>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">VAT Collected</p>
                    <p className="text-lg font-bold text-emerald-500">{peso(totals.vat)}</p>
                 </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleExportExcel} className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"}`}>
                <FaFileExcel size={14} /> Export Excel
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
          <button onClick={fetchSales} className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${isDark ? "border-white/10 bg-[#0a0f1e] text-white hover:bg-white/10" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            <FaSyncAlt className={loading ? "animate-spin" : ""} size={15} />
          </button>
          <button onClick={() => setShowFilter(true)} className="flex items-center h-12 gap-2 px-5 text-sm font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700">
            <FaFilter size={13} /> Filters
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 px-8 py-5 overflow-hidden">
          <div className={`relative h-full overflow-auto rounded-[28px] border custom-scrollbar ${isDark ? "border-white/10 bg-[#050a18]" : "border-slate-200 bg-white"}`}>
            <table className="min-w-[3000px] w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-[50]">
                <tr className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-[#0a0f1e] text-slate-500" : "bg-slate-50 text-slate-400"}`}>
                  <th className={`sticky left-0 top-0 z-[60] border-b p-4 ${isDark ? "border-white/10 bg-[#0a0f1e]" : "border-slate-200 bg-slate-50"}`}>Date</th>
                  <th className="p-4 border-b border-slate-200/10">Gross Sales</th>
                  <th className="p-4 border-b border-slate-200/10 text-rose-400">SRC Disc.</th>
                  <th className="p-4 border-b border-slate-200/10 text-rose-400">PWD Disc.</th>
                  <th className="p-4 border-b border-slate-200/10 text-rose-400">NAAC Disc.</th>
                  <th className="p-4 border-b border-slate-200/10 text-rose-400">Solo Parent</th>
                  <th className="p-4 border-b border-slate-200/10 text-rose-400">Other Disc.</th>
                  <th className="p-4 border-b border-slate-200/10">Cash Payment</th>
                  <th className="p-4 border-b border-slate-200/10">Cheque Payment</th>
                  <th className="p-4 border-b border-slate-200/10">Card Payment</th>
                  <th className="p-4 border-b border-slate-200/10">GCash Payment</th>
                  <th className="p-4 border-b border-slate-200/10">Maya Payment</th>
                  <th className="p-4 border-b border-slate-200/10">Other Payment</th>
                  <th className="p-4 border-b border-slate-200/10">VATable Sales</th>
                  <th className="p-4 border-b border-slate-200/10">VAT Amount</th>
                  <th className="p-4 border-b border-slate-200/10">VAT Exempt Sales</th>
                  <th className="p-4 text-orange-400 border-b border-slate-200/10">Exemption</th>
                  <th className={`sticky right-0 top-0 z-[60] border-b p-4 text-right ${isDark ? "border-white/10 bg-[#0a0f1e]" : "border-slate-200 bg-slate-50"}`}>Net Sales</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/5 text-slate-300" : "divide-slate-100 text-slate-700"}`}>
                {filtered.length > 0 ? (
                  filtered.map((item, idx) => (
                    <tr key={idx} className={`text-sm transition ${isDark ? "hover:bg-blue-500/5" : "hover:bg-blue-50"}`}>
                      <td className={`sticky left-0 z-[40] border-r p-4 font-bold ${isDark ? "border-white/5 bg-[#050a18] text-blue-400" : "border-slate-100 bg-white text-blue-600"}`}>
                        {item.Date}
                      </td>
                      <td className="p-4">{peso(item["Gross Sales"])}</td>
                      <td className="p-4 text-rose-500">-{Number(item["SRC Disc."] || 0).toFixed(2)}</td>
                      <td className="p-4 text-rose-500">-{Number(item["PWD Disc."] || 0).toFixed(2)}</td>
                      <td className="p-4 text-rose-500">-{Number(item["NAAC Disc."] || 0).toFixed(2)}</td>
                      <td className="p-4 text-rose-500">-{Number(item["Solo Parent Disc."] || 0).toFixed(2)}</td>
                      <td className="p-4 text-slate-500">-{Number(item["Other Disc."] || 0).toFixed(2)}</td>
                      <td className="p-4">{peso(item["Cash Payment"])}</td>
                      <td className="p-4">{peso(item["Cheque Payment"])}</td>
                      <td className="p-4">{peso(item["Card Payment"])}</td>
                      <td className="p-4 font-medium text-blue-400">{peso(item["GCash Payment"])}</td>
                      <td className="p-4 font-medium text-emerald-400">{peso(item["Maya Payment"])}</td>
                      <td className="p-4">{peso(item["Other Payment"])}</td>
                      <td className="p-4">{peso(item["VATable Sales"])}</td>
                      <td className="p-4 text-emerald-500">{peso(item["VAT Amount"])}</td>
                      <td className="p-4">{peso(item["VAT Exempt Sales"])}</td>
                      <td className="p-4 text-orange-500">{peso(item["VAT Exemption"])}</td>
                      <td className={`sticky right-0 z-[40] border-l p-4 text-right text-base font-bold ${isDark ? "border-white/5 bg-[#050a18] text-white" : "border-slate-100 bg-white text-slate-900"}`}>
                        {peso(item["Net Sales"])}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={18} className={`p-10 text-center text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      No sales data found for the selected period.
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
          <div className="px-8 py-4 text-right bg-blue-600 shadow-xl rounded-2xl">
            <span className="text-xs font-bold tracking-widest uppercase text-white/70">Grand Total Net Revenue</span>
            <h3 className="text-4xl font-black text-white">{peso(totals.net)}</h3>
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
              <div>
                <label className={`mb-3 block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>Transaction Status</label>
                <div className={`grid grid-cols-1 gap-2 rounded-2xl p-1 ${isDark ? "bg-black/20" : "bg-slate-100"}`}>
                  {["Active", "Voided", "All"].map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={`h-11 rounded-xl text-sm font-medium transition ${status === s ? "bg-blue-600 text-white shadow-lg" : isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "bg-white text-slate-600 hover:text-blue-600"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => { fetchSales(); setShowFilter(false); }} className="mt-8 rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98]">
              Apply Search Criteria
            </button>
          </div>
        )}
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

export default DailySalesModal;