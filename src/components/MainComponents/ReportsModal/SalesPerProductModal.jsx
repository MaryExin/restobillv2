import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaPrint,
  FaFileExcel,
  FaBox,
  FaArrowRight,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaTrashAlt,
  FaExclamationCircle,
  FaChartLine,
  FaLayerGroup,
  FaDownload,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { useTheme } from "../../../context/ThemeContext";

// --- UTILS & FORMATTERS (PREMIUM PRECISION) ---
const peso = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value || 0);

// --- PREMIUM CUSTOM CALENDAR (DETAILED TRANSITIONS) ---
const CustomCalendar = ({
  selectedDate,
  onChange,
  isOpen,
  onClose,
  isDark,
}) => {
  const [currentView, setCurrentView] = useState(new Date(selectedDate || new Date()));
  const calendarRef = useRef(null);

  useEffect(() => {
    if (selectedDate) setCurrentView(new Date(selectedDate));
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
  const firstDayOfMonth = new Date(currentView.getFullYear(), currentView.getMonth(), 1).getDay();

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
      className={`absolute left-0 top-full z-[999999] mt-3 w-[340px] origin-top animate-in fade-in zoom-in duration-200 rounded-[24px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.3)] ${
        isDark ? "border-white/10 bg-[#0b1220] text-white" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-center justify-between px-1 mb-6">
        <h4 className="text-lg font-black tracking-tight">
          {monthNames[currentView.getMonth()]} {currentView.getFullYear()}
        </h4>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1)); }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            <FaChevronLeft size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1, 1)); }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            <FaChevronRight size={12} />
          </button>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} />)}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = `${currentView.getFullYear()}-${String(currentView.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = dateString === selectedDate;
          const isToday = new Date().toISOString().split("T")[0] === dateString;

          return (
            <button
              key={day}
              onClick={() => handlePickDay(day)}
              className={`group relative h-10 w-full rounded-xl text-sm font-bold transition-all ${
                isSelected
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : isDark
                  ? "hover:bg-white/10 text-slate-300"
                  : "hover:bg-blue-50 text-slate-700"
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute w-1 h-1 -translate-x-1/2 bg-blue-500 rounded-full bottom-1 left-1/2" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- MAIN SALES PER PRODUCT MODAL (PREMIUM BUILD) ---
const SalesPerProductModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  // Date Logic
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: "Gross Sales", direction: "desc" });

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      // Small artificial delay for premium feel transition
      const [response] = await Promise.all([
        fetch(`http://localhost/api/reports_dashboard.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datefrom: dateFrom, dateto: dateTo, includeVoided: false }),
        }),
        new Promise(resolve => setTimeout(resolve, 400))
      ]);
      const data = await response.json();
      setSalesData(data?.salesPerProduct || []);
    } catch (error) {
      console.error("Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen, fetchSales]);

  // Premium Sorting Handler
  const requestSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") direction = "asc";
    setSortConfig({ key, direction });
  };

  const filteredData = useMemo(() => {
    let data = [...salesData];
    if (searchTerm) {
      const kw = searchTerm.toLowerCase();
      data = data.filter(i => 
        String(i["Product Name"]).toLowerCase().includes(kw) || 
        String(i["Code"]).toLowerCase().includes(kw)
      );
    }
    data.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'number') {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === "asc" 
        ? String(aVal).localeCompare(String(bVal)) 
        : String(bVal).localeCompare(String(aVal));
    });
    return data;
  }, [salesData, searchTerm, sortConfig]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      acc.qty += parseFloat(curr["Total Qty Sold"] || 0);
      acc.amt += parseFloat(curr["Gross Sales"] || 0);
      return acc;
    }, { qty: 0, amt: 0 });
  }, [filteredData]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map(i => ({
      "Product Code": i.Code,
      "Item Description": i["Product Name"],
      "Category": i["Item Type"],
      "Quantity Sold": i["Total Qty Sold"],
      "Total Sales": i["Gross Sales"]
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Report_${dateFrom}_to_${dateTo}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-xl transition-all duration-500 ${
      isDark ? "bg-[#020617]/90" : "bg-slate-900/40"
    }`}>
      
      {/* --- PREMIUM THERMAL PRINT CSS (70mm BOLD) --- */}
      <style>{`
        @media screen { #thermal-receipt { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; }
          #thermal-receipt {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 4mm 2mm !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-weight: 900 !important; /* Premium Bold for Thermal */
            line-height: 1.2 !important;
          }
          .t-center { text-align: center; }
          .t-right { text-align: right; }
          .t-bold { font-weight: 900; }
          .t-divider { border-top: 2px dashed black; margin: 6px 0; }
          .t-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          .t-table th { border-bottom: 2px solid black; font-size: 11px; padding-bottom: 4px; }
          .t-table td { font-size: 10px; padding: 4px 0; vertical-align: top; }
          @page { size: 70mm auto; margin: 0; }
        }
      `}</style>

      {/* --- MAIN UI CONTAINER (THE 900+ LINE EXPERIENCE) --- */}
      <div className={`no-print relative flex h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[40px] border shadow-[0_40px_100px_rgba(0,0,0,0.5)] transition-all duration-700 animate-in fade-in zoom-in-95 ${
        isDark ? "border-white/10 bg-[#020817]" : "border-slate-200 bg-[#f8fafc]"
      }`}>
        
        {/* TOP NAVBAR / HEADER */}
        <div className={`relative shrink-0 border-b px-10 py-8 ${
          isDark ? "border-white/5 bg-white/[0.02]" : "border-slate-200 bg-white"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className={`relative flex h-20 w-20 items-center justify-center rounded-[28px] shadow-2xl transition-transform hover:rotate-12 ${
                isDark ? "bg-blue-600/20 text-blue-400" : "bg-blue-600 text-white"
              }`}>
                <FaBox size={32} />
                <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-4 ring-[#020817]">
                  {filteredData.length}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className={`text-4xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
                    Sales <span className="text-blue-500">Per Product</span>
                  </h2>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    Live Data
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className={`flex items-center gap-3 rounded-2xl border px-5 py-2.5 text-sm font-black transition-all ${
                    isDark ? "border-white/5 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <FaCalendarAlt className="text-blue-500" />
                    <span>{dateFrom}</span>
                    <FaArrowRight size={10} className="opacity-30" />
                    <span>{dateTo}</span>
                  </div>
                  <p className="text-xs font-bold tracking-tighter uppercase text-slate-500 opacity-60">Inventory & Sales Intelligence Report</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-black/20 p-1.5 rounded-[22px] border border-white/5">
                <button
                  onClick={() => window.print()}
                  className={`flex h-14 items-center gap-3 rounded-[18px] px-8 text-sm font-black transition-all hover:scale-[1.02] active:scale-95 ${
                    isDark ? "bg-white/5 text-white hover:bg-white/10" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  }`}
                >
                  <FaPrint className="text-blue-500" size={18} />
                  Print Report
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex h-14 items-center gap-3 rounded-[18px] px-8 text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-95 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 ml-2"
                >
                  <FaFileExcel size={18} />
                  Export Excel
                </button>
              </div>
              <button
                onClick={onClose}
                className={`group flex h-14 w-14 items-center justify-center rounded-[22px] border transition-all hover:bg-rose-500 ${
                  isDark ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                <FaTimes size={20} className="transition-transform duration-300 group-hover:rotate-90 group-hover:text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* SEARCH & INTERACTIVE FILTERS */}
        <div className={`shrink-0 border-b px-10 py-6 ${
          isDark ? "border-white/5 bg-[#07101f]/40" : "border-slate-200 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-6">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-6 pointer-events-none">
                <FaSearch className={`transition-colors duration-300 ${isDark ? "text-slate-600 group-focus-within:text-blue-500" : "text-slate-400 group-focus-within:text-blue-600"}`} size={18} />
              </div>
              <input
                type="text"
                placeholder="Search by Product Name, SKU, or Category..."
                className={`h-16 w-full rounded-[24px] border pl-16 pr-8 text-lg font-bold outline-none transition-all ${
                  isDark 
                  ? "border-white/5 bg-white/[0.03] text-white focus:border-blue-500/50 focus:bg-white/[0.06] placeholder:text-slate-600" 
                  : "border-slate-200 bg-white text-slate-800 shadow-sm focus:border-blue-500 placeholder:text-slate-400"
                }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute transition-colors -translate-y-1/2 right-6 top-1/2 text-slate-500 hover:text-rose-500">
                  <FaTimes />
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={fetchSales}
                className={`flex h-16 w-16 items-center justify-center rounded-[24px] border transition-all hover:scale-105 active:rotate-180 ${
                  isDark ? "border-white/5 bg-white/5 text-slate-300" : "border-slate-200 bg-white shadow-sm text-slate-600"
                }`}
              >
                <FaSyncAlt className={loading ? "animate-spin text-blue-500" : ""} size={20} />
              </button>
              <button
                onClick={() => setShowFilter(true)}
                className="group relative flex h-16 items-center gap-4 rounded-[24px] bg-blue-600 px-10 text-lg font-black text-white transition-all hover:bg-blue-700 hover:shadow-[0_15px_40px_rgba(37,99,235,0.4)] active:scale-95"
              >
                <FaFilter size={18} className="transition-transform group-hover:rotate-12" />
                Change Date Range
              </button>
            </div>
          </div>
        </div>

        {/* MAIN DATA GRID (PREMIUM TABLE) */}
        <div className="flex-1 px-10 py-6 overflow-hidden">
          <div className={`custom-scrollbar relative h-full overflow-auto rounded-[32px] border ${
            isDark ? "border-white/5 bg-[#050c18]" : "border-slate-200 bg-white shadow-xl"
          }`}>
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-50">
                <tr className={`${isDark ? "bg-[#0b1422]/95" : "bg-slate-50/95"} backdrop-blur-md`}>
                  <th onClick={() => requestSort('Code')} className="cursor-pointer border-b border-white/5 p-7 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-colors">Product Code</th>
                  <th onClick={() => requestSort('Product Name')} className="cursor-pointer border-b border-white/5 p-7 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-colors">Item Description</th>
                  <th className="border-b border-white/5 p-7 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Category</th>
                  <th onClick={() => requestSort('Total Qty Sold')} className="cursor-pointer border-b border-white/5 p-7 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-colors">Qty Sold</th>
                  <th onClick={() => requestSort('Gross Sales')} className="cursor-pointer border-b border-white/5 p-7 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-colors">Total Sales</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/[0.03] text-slate-300" : "divide-slate-100 text-slate-700"}`}>
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr 
                      key={idx}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`group transition-all duration-300 ${
                        isDark ? "hover:bg-blue-500/[0.04]" : "hover:bg-blue-50/50"
                      }`}
                    >
                      <td className="font-mono text-xs font-black p-7 text-slate-500">{item.Code}</td>
                      <td className="p-7">
                        <div className="flex flex-col">
                          <span className={`text-lg font-black transition-colors ${hoveredRow === idx ? "text-blue-500" : isDark ? "text-white" : "text-slate-900"}`}>
                            {item["Product Name"]}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter opacity-50">Stock ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="text-center p-7">
                        <span className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider ${
                          isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"
                        }`}>
                          <FaLayerGroup size={10} className="opacity-40" />
                          {item["Item Type"] || "General"}
                        </span>
                      </td>
                      <td className="text-center p-7">
                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-black tabular-nums">{Number(item["Total Qty Sold"]).toLocaleString()}</span>
                          <div className={`h-1 w-12 rounded-full mt-1 ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((item["Total Qty Sold"] / 100) * 100, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-right p-7">
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-black text-blue-500 tabular-nums">{peso(item["Gross Sales"])}</span>
                          <span className="text-[10px] font-bold text-slate-500 opacity-40 uppercase tracking-tighter">Gross Before Tax</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-40 text-center">
                      <div className="flex flex-col items-center gap-6 animate-pulse">
                        <div className={`flex h-24 w-24 items-center justify-center rounded-full ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                          <FaExclamationCircle size={40} className="text-slate-400" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-500">No Transactions Found</h3>
                          <p className="italic font-bold text-slate-400">Try adjusting your date filters or search terms.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PREMIUM FOOTER SUMMARY */}
        <div className={`relative shrink-0 border-t px-10 py-8 ${
          isDark ? "border-white/5 bg-black/40" : "border-slate-200 bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.03)]"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-16">
              <div className="group">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-blue-500 transition-colors">Summary Count</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-4xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>{filteredData.length}</span>
                  <span className="text-xs font-bold tracking-widest uppercase opacity-50 text-slate-500">Items</span>
                </div>
              </div>
              <div className={`h-16 w-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              <div className="group">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-blue-500 transition-colors">Accumulated Volume</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-4xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>{totals.qty.toLocaleString()}</span>
                  <span className="text-xs font-bold tracking-widest uppercase opacity-50 text-slate-500">Units Sold</span>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
              <div className="relative flex items-center gap-10 overflow-hidden rounded-[30px] bg-gradient-to-br from-blue-600 to-blue-800 px-12 py-7 text-white shadow-2xl">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200/70">Grand Total Revenue</span>
                  <h3 className="text-5xl font-black tracking-tighter tabular-nums">{peso(totals.amt)}</h3>
                </div>
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md">
                  <FaChartLine size={28} className="text-blue-200" />
                </div>
                {/* Abstract background icon */}
                <FaBox className="absolute w-32 h-32 -bottom-6 -right-6 text-white/5 rotate-12" />
              </div>
            </div>
          </div>
        </div>

        {/* PREMIUM FILTER DRAWER (RIGHT SIDE) */}
        {showFilter && (
          <div className="absolute inset-0 z-[100001] flex justify-end bg-[#020617]/40 backdrop-blur-sm transition-all duration-500" onClick={() => setShowFilter(false)}>
            <div 
              className={`h-full w-full max-w-[500px] border-l p-12 shadow-[-40px_0_100px_rgba(0,0,0,0.4)] animate-in slide-in-from-right duration-500 ${
                isDark ? "border-white/10 bg-[#0a1220]" : "border-slate-200 bg-white"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h3 className={`text-3xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>Report Parameters</h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">Configure your data retrieval period.</p>
                </div>
                <button onClick={() => setShowFilter(false)} className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all hover:bg-rose-500 hover:text-white ${isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                  <FaTimes size={20} />
                </button>
              </div>

              <div className="space-y-10">
                <div className="relative">
                  <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Start Date Selection</label>
                  <button 
                    onClick={() => { setOpenStartCal(!openStartCal); setOpenEndCal(false); }}
                    className={`flex h-20 w-full items-center justify-between rounded-[24px] border px-8 text-xl font-black transition-all ${
                      isDark ? "border-white/10 bg-white/5 text-white hover:border-blue-500/50" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-500"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <FaCalendarAlt className="text-blue-500" size={20} />
                      {dateFrom}
                    </div>
                    <FaChevronDown className={`transition-transform duration-300 ${openStartCal ? "rotate-180 text-blue-500" : "opacity-30"}`} />
                  </button>
                  <CustomCalendar selectedDate={dateFrom} onChange={setDateFrom} isOpen={openStartCal} onClose={() => setOpenStartCal(false)} isDark={isDark} />
                </div>

                <div className="relative">
                  <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">End Date Selection</label>
                  <button 
                    onClick={() => { setOpenEndCal(!openEndCal); setOpenStartCal(false); }}
                    className={`flex h-20 w-full items-center justify-between rounded-[24px] border px-8 text-xl font-black transition-all ${
                      isDark ? "border-white/10 bg-white/5 text-white hover:border-blue-500/50" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-500"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <FaCalendarAlt className="text-blue-500" size={20} />
                      {dateTo}
                    </div>
                    <FaChevronDown className={`transition-transform duration-300 ${openEndCal ? "rotate-180 text-blue-500" : "opacity-30"}`} />
                  </button>
                  <CustomCalendar selectedDate={dateTo} onChange={setDateTo} isOpen={openEndCal} onClose={() => setOpenEndCal(false)} isDark={isDark} />
                </div>

                <div className={`rounded-[30px] border p-8 ${isDark ? "border-white/5 bg-white/[0.02]" : "border-blue-100 bg-blue-50/50"}`}>
                  <div className="flex items-start gap-4">
                    <FaChartLine className="mt-1 text-blue-500" />
                    <p className={`text-xs font-bold leading-relaxed ${isDark ? "text-slate-400" : "text-blue-700"}`}>
                      Analytic Insight: Reporting data is fetched in real-time from the central database. Ensure selected range does not exceed fiscal limits.
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute flex gap-4 bottom-12 left-12 right-12">
                <button 
                  onClick={() => { setDateFrom(today); setDateTo(today); }}
                  className={`flex h-20 flex-1 items-center justify-center gap-3 rounded-[26px] font-black transition-all active:scale-95 ${
                    isDark ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <FaTrashAlt /> Reset
                </button>
                <button 
                  onClick={() => { fetchSales(); setShowFilter(false); }}
                  className="h-20 flex-[2] rounded-[26px] bg-blue-600 text-lg font-black text-white shadow-2xl shadow-blue-600/30 transition-all hover:bg-blue-700 active:scale-95"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- THERMAL RECEIPT 70mm (OFF-SCREEN UNTIL PRINT) --- */}
      <div id="thermal-receipt">
        <div className="t-center">
          <h2 className="t-bold" style={{ fontSize: "18px", margin: 0 }}>SALES REPORT</h2>
          <p style={{ fontSize: "12px", margin: "2px 0" }}>Per Product Item</p>
        </div>

        <div className="t-divider" />
        <div className="t-center" style={{ fontSize: "11px" }}>
          PERIOD: {dateFrom} - {dateTo}
        </div>
        <div className="t-divider" />

        <table className="t-table">
          <thead>
            <tr>
              <th align="left">ITEM</th>
              <th align="center">QTY</th>
              <th align="right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td style={{ width: "55%", textTransform: "uppercase" }}>{item["Product Name"]}</td>
                <td align="center">{parseFloat(item["Total Qty Sold"] || 0)}</td>
                <td align="right">{parseFloat(item["Gross Sales"] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="t-divider" />
        
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "2px 0" }}>
          <span className="t-bold">TOTAL QTY:</span>
          <span className="t-bold">{totals.qty.toLocaleString()}</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: "4px" }}>
          <span className="t-bold">GRAND TOTAL:</span>
          <span className="t-bold">₱{totals.amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="t-divider" />
        <div className="t-center" style={{ fontSize: "10px", marginTop: "15px" }}>
          <p style={{ margin: 0 }}>Printed: {new Date().toLocaleString()}</p>
          <p className="t-bold" style={{ marginTop: "8px" }}>*** END OF REPORT ***</p>
        </div>
      </div>

      {/* PREMIUM CUSTOM SCROLLBAR CSS */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}; 
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
          background: ${isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.5)"}; 
          background-clip: content-box;
        }
      `}</style>
    </div>
  );
};

export default SalesPerProductModal;