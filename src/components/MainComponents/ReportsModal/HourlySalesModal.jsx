import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  FaClock, FaSyncAlt, FaTimes, FaFileExcel, 
  FaCalendarAlt, FaArrowRight, FaChevronDown,
  FaChevronLeft, FaChevronRight, FaTable, FaSearch, FaBox,
  FaMoon, FaSun
} from "react-icons/fa";
import * as XLSX from "xlsx";

// --- CUSTOM DROP-DOWN CALENDAR ---
const CustomCalendar = ({ selectedDate, onChange, isOpen, onClose, darkMode }) => {
  const [currentView, setCurrentView] = useState(new Date(selectedDate));
  const calendarRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentView.getFullYear(), currentView.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div ref={calendarRef} className={`absolute top-full left-0 mt-2 w-[300px] rounded-2xl border p-5 shadow-2xl z-[100005] animate-in fade-in zoom-in duration-150 ${
      darkMode ? "bg-[#050a18] border-white/10 shadow-black" : "bg-white border-slate-200 shadow-slate-200"
    }`}>
      <div className="flex items-center justify-between px-1 mb-4">
        <h4 className={`text-sm italic font-black ${darkMode ? "text-white" : "text-slate-800"}`}>
          {monthNames[currentView.getMonth()]} {currentView.getFullYear()}
        </h4>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1)); }} 
            className={`h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#3b82f6] hover:text-white transition-colors ${darkMode ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600"}`}>
            <FaChevronLeft size={10}/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1)); }} 
            className={`h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#3b82f6] hover:text-white transition-colors ${darkMode ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600"}`}>
            <FaChevronRight size={10}/>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2 text-center text-[8px] font-black text-slate-400 uppercase">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => <div key={i}></div>)}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = `${currentView.getFullYear()}-${String(currentView.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <button key={day} onClick={(e) => { e.stopPropagation(); onChange(dateString); onClose(); }}
              className={`h-8 w-full rounded-lg font-bold text-[10px] transition-all ${
                dateString === selectedDate 
                  ? 'bg-[#3b82f6] text-white' 
                  : darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const HourlySalesModal = ({ isOpen, onClose }) => {
  const [darkMode, setDarkMode] = useState(true); // Toggle logic
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyProductData, setHourlyProductData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [viewMode, setViewMode] = useState("general");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const hoursLabels = [
    "12AM", "1AM", "2AM", "3AM", "4AM", "5AM", "6AM", "7AM", "8AM", "9AM", "10AM", "11AM",
    "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM", "9PM", "10PM", "11PM"
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datefrom: dateFrom, dateto: dateTo, includeVoided: false }),
      });
      const result = await response.json();
      if (result) {
        setHourlyData(result.hourlySales || []);
        setHourlyProductData(result.hourlySalesPerProduct || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { if (isOpen) fetchData(); }, [isOpen, fetchData]);

  const categories = useMemo(() => {
    const cats = hourlyProductData.map(item => item.Category);
    return ["ALL", ...new Set(cats)];
  }, [hourlyProductData]);

  const filteredDisplayData = useMemo(() => {
    if (viewMode === "general") return hourlyData;
    return hourlyProductData.filter(item => {
      const matchesSearch = item["Product Name"].toLowerCase().includes(searchTerm.toLowerCase()) || item.Code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "ALL" || item.Category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [viewMode, hourlyData, hourlyProductData, searchTerm, selectedCategory]);

  const exportToExcel = () => {
    const rows = filteredDisplayData.map(item => {
      const baseInfo = viewMode === "general" 
        ? { "Date": item.Date, "Total Sales": item["Total Sales"] }
        : { "Code": item.Code, "Category": item.Category, "Product Name": item["Product Name"], "TOTAL QTY": item.TOTAL };
      const hoursFlat = hoursLabels.reduce((acc, label, i) => {
        acc[label] = item.hours[i] || 0;
        return acc;
      }, {});
      return { ...baseInfo, ...hoursFlat };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hourly Report");
    XLSX.writeFile(workbook, `Hourly_${viewMode === "general" ? "Sales" : "Products"}_${dateFrom}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-2 backdrop-blur-md ${darkMode ? "bg-[#020617]/95" : "bg-slate-200/90"}`}>
      <div className={`relative flex h-[98vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[2rem] border shadow-2xl transition-colors duration-300 ${
        darkMode ? "bg-[#020617] border-white/10" : "bg-white border-slate-200"
      }`}>
        
        {/* --- HEADER --- */}
        <div className={`flex items-center justify-between px-10 py-6 border-b shrink-0 ${darkMode ? "border-white/5" : "border-slate-100"}`}>
          <div className="flex items-center gap-6">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${darkMode ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "bg-[#3b82f6] text-white"}`}>
              {viewMode === "general" ? <FaClock size={24} /> : <FaBox size={24}/>}
            </div>
            <div>
              <h2 className={`text-4xl italic font-black leading-none tracking-tighter uppercase ${darkMode ? "text-white" : "text-slate-800"}`}>
                Hourly <span className="text-[#3b82f6]">{viewMode === "general" ? "Sales" : "Product Sales"}</span>
              </h2>
              <div className="mt-1 flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <span>CNC - STA MARIA</span> <FaArrowRight size={8}/> <span>{dateFrom} — {dateTo}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setDarkMode(!darkMode)} className={`h-12 w-12 rounded-xl border transition-all flex items-center justify-center ${darkMode ? "bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"}`}>
               {darkMode ? <FaSun size={18}/> : <FaMoon size={18}/>}
             </button>
             <button onClick={() => setViewMode(viewMode === "general" ? "product" : "general")} className={`h-12 px-6 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2 ${
               darkMode ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
             }`}>
               <FaTable className="text-[#3b82f6]"/> {viewMode === "general" ? "Product View" : "General View"}
             </button>
             <button onClick={exportToExcel} className="h-12 px-6 rounded-xl bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2">
               <FaFileExcel size={14}/> Export
             </button>
             <button onClick={onClose} className={`flex items-center justify-center w-12 h-12 transition-all border rounded-xl hover:bg-rose-600 hover:text-white ${darkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-600"}`}><FaTimes size={20}/></button>
          </div>
        </div>

        {/* --- TOOLBAR --- */}
        <div className={`px-10 py-4 flex justify-between items-center shrink-0 border-b gap-4 ${darkMode ? "bg-[#050a18]/50 border-white/5" : "bg-slate-50 border-slate-100"}`}>
          {viewMode === "product" ? (
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1 max-w-sm">
                <FaSearch className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" size={12}/>
                <input type="text" placeholder="Search product..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-10 pr-4 text-[11px] font-bold outline-none focus:border-[#3b82f6] transition-all ${
                    darkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                  }`} />
              </div>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className={`border rounded-xl px-4 text-[11px] font-black uppercase outline-none focus:border-[#3b82f6] ${
                  darkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                }`}>
                {categories.map(cat => <option key={cat} value={cat} className={darkMode ? "bg-[#050a18]" : "bg-white"}>{cat}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Hourly Sales Distribution</p>
          )}
          <div className="flex gap-3">
            <button onClick={fetchData} className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${darkMode ? "bg-[#0a0f1e] border-white/10 text-white" : "bg-white border-slate-200 text-slate-600"}`}><FaSyncAlt className={loading ? 'animate-spin' : ''} size={14}/></button>
            <button onClick={() => setShowFilter(true)} className="h-11 px-6 flex items-center gap-3 rounded-xl bg-[#3b82f6] text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-900/20"><FaCalendarAlt size={12}/> Filter Range</button>
          </div>
        </div>

        {/* --- TABLE CONTENT --- */}
        <div className="flex-1 px-10 py-4 overflow-hidden">
          <div className={`h-full overflow-auto rounded-2xl border relative custom-scrollbar shadow-inner ${darkMode ? "bg-[#050a18] border-white/5" : "bg-white border-slate-200"}`}>
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-[50]">
                <tr className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? "bg-[#0a0f1e] text-slate-500" : "bg-slate-100 text-slate-500"}`}>
                  <th className={`p-4 sticky left-0 z-[60] border-b min-w-[180px] ${darkMode ? "bg-[#0a0f1e] border-white/10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]" : "bg-slate-100 border-slate-200 shadow-[4px_0_10px_rgba(0,0,0,0.05)]"}`}>
                    {viewMode === "general" ? "Date" : "Product Details"}
                  </th>
                  <th className={`p-4 border-b text-center min-w-[120px] ${darkMode ? "text-white bg-[#3b82f6]/20 border-white/10" : "text-[#3b82f6] bg-[#3b82f6]/5 border-slate-200"}`}>
                    {viewMode === "general" ? "Total Sales" : "Total Qty"}
                  </th>
                  {hoursLabels.map((h, i) => (
                    <th key={i} className={`p-4 border-b min-w-[100px] text-center border-l ${darkMode ? "border-white/5" : "border-slate-100"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`font-bold divide-y ${darkMode ? "divide-white/5" : "divide-slate-100"}`}>
                {filteredDisplayData.length > 0 ? filteredDisplayData.map((item, idx) => (
                  <tr key={idx} className={`transition-colors text-[12px] ${darkMode ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}`}>
                    <td className={`p-4 sticky left-0 z-[40] border-r italic font-black truncate max-w-[220px] ${
                      darkMode ? "bg-[#050a18] border-white/5 text-[#3b82f6] shadow-[4px_0_10px_rgba(0,0,0,0.3)]" : "bg-white border-slate-100 text-[#3b82f6] shadow-[4px_0_10px_rgba(0,0,0,0.02)]"
                    }`}>
                      {viewMode === "general" ? item.Date : (
                        <div className="flex flex-col">
                          <span className={`text-[11px] truncate ${darkMode ? "text-white" : "text-slate-800"}`}>{item["Product Name"]}</span>
                          <span className="text-slate-500 text-[9px] not-italic font-medium">{item.Category} • {item.Code.slice(0,8)}</span>
                        </div>
                      )}
                    </td>
                    <td className={`p-4 font-black text-sm italic text-center border-r ${darkMode ? "text-white bg-white/[0.01] border-white/5" : "text-slate-800 bg-slate-50/30 border-slate-100"}`}>
                      {viewMode === "general" ? `₱${parseFloat(item["Total Sales"] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}` : parseFloat(item.TOTAL || 0).toLocaleString()}
                    </td>
                    {item.hours.map((val, hrIdx) => (
                      <td key={hrIdx} className={`p-4 text-center border-l text-[11px] ${darkMode ? "border-white/5" : "border-slate-100"} ${val > 0 ? (darkMode ? (viewMode === 'general' ? 'text-emerald-400' : 'text-slate-200') : (viewMode === 'general' ? 'text-emerald-600' : 'text-slate-800')) : 'text-slate-300'}`}>
                        {val > 0 ? (viewMode === "general" ? `₱${Math.round(val).toLocaleString()}` : val.toLocaleString()) : '—'}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={26} className="p-20 text-center text-slate-400 font-black uppercase tracking-[0.5em] italic">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className={`flex items-center justify-between px-10 py-6 border-t shrink-0 ${darkMode ? "bg-black/40 border-white/5" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex gap-10">
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rows Found</p><p className={`text-2xl italic font-black ${darkMode ? "text-white" : "text-slate-800"}`}>{filteredDisplayData.length}</p></div>
            <div className={`h-8 w-[1px] self-center ${darkMode ? "bg-white/5" : "bg-slate-200"}`}></div>
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Store</p><p className="text-2xl font-black text-[#3b82f6] italic uppercase">STA MARIA</p></div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">← Scroll side to view all hours →</p>
        </div>

        {/* --- SIDEBAR FILTER --- */}
        {showFilter && (
          <div className={`absolute inset-y-0 right-0 w-[400px] border-l z-[100001] p-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ${
            darkMode ? "bg-[#0a0f1e] border-white/10" : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center justify-between mb-12 shrink-0">
              <h3 className={`text-3xl italic font-black tracking-tighter uppercase ${darkMode ? "text-white" : "text-slate-800"}`}>Report <span className="text-[#3b82f6]">Config</span></h3>
              <button onClick={() => setShowFilter(false)} className={`flex items-center justify-center w-10 h-10 rounded-xl ${darkMode ? "bg-white/5 text-slate-500 hover:text-white" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}><FaTimes size={18}/></button>
            </div>
            <div className="flex-1 space-y-8">
              {[{label: "Date From", val: dateFrom, setter: setDateFrom, open: openStartCal, setOpen: setOpenStartCal}, {label: "Date To", val: dateTo, setter: setDateTo, open: openEndCal, setOpen: setOpenEndCal}].map((cal, i) => (
                <div key={i} className="relative">
                  <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-3 block ml-1">{cal.label}</label>
                  <button onClick={() => { cal.setOpen(!cal.open); i === 0 ? setOpenEndCal(false) : setOpenStartCal(false); }} 
                    className={`w-full p-5 rounded-2xl border text-left flex items-center justify-between hover:border-[#3b82f6] group transition-all ${darkMode ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"}`}>
                    <span className={`text-xl font-black italic group-hover:text-[#3b82f6] ${darkMode ? "text-white" : "text-slate-800"}`}>{cal.val}</span>
                    <FaChevronDown className="text-slate-400" size={12}/>
                  </button>
                  <CustomCalendar selectedDate={cal.val} onChange={cal.setter} isOpen={cal.open} onClose={() => cal.setOpen(false)} darkMode={darkMode} />
                </div>
              ))}
            </div>
            <button onClick={() => { fetchData(); setShowFilter(false); }} className={`w-full py-7 font-black rounded-2xl shadow-2xl transition-all uppercase tracking-widest text-[10px] mt-8 italic ${
              darkMode ? "bg-white text-[#020617] hover:bg-[#3b82f6] hover:text-white" : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
            }`}>Generate Report</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  );
};

export default HourlySalesModal;