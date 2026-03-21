import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  FaSearch, FaSyncAlt, FaFilter, FaTimes, 
  FaCalendarAlt, FaFileExcel, 
  FaChevronLeft, FaChevronRight, FaArrowRight, FaChevronDown 
} from "react-icons/fa";
import * as XLSX from 'xlsx';
// ✅ Import Theme
import { useTheme } from "../../../context/ThemeContext";

// --- CUSTOM DROPDOWN CALENDAR ---
const CustomCalendar = ({ selectedDate, onChange, isOpen, onClose, isDark }) => {
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
    <div ref={calendarRef} className={`absolute top-full left-0 mt-2 w-[320px] rounded-2xl border p-5 shadow-2xl z-[100005] animate-in fade-in zoom-in duration-150
      ${isDark ? "bg-[#050a18] border-white/10" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between px-1 mb-4">
        <h4 className={`text-lg italic font-black ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{monthNames[currentView.getMonth()]} {currentView.getFullYear()}</h4>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1)); }} 
            className={`h-8 w-8 flex items-center justify-center rounded-lg ${isDark ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white"}`}><FaChevronLeft size={10}/></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1)); }} 
            className={`h-8 w-8 flex items-center justify-center rounded-lg ${isDark ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white"}`}><FaChevronRight size={10}/></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2 text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => <div key={i}></div>)}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = new Date(currentView.getFullYear(), currentView.getMonth(), day + 1).toISOString().split('T')[0];
          return (
            <button key={day} onClick={(e) => { e.stopPropagation(); onChange(dateString); onClose(); }}
              className={`h-9 w-full rounded-lg font-bold text-xs transition-all ${dateString === selectedDate ? 'bg-[#3b82f6] text-white shadow-lg' : isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>
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
  
  const today = new Date().toISOString().split('T')[0];
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
        body: JSON.stringify({ datefrom: dateFrom, dateto: dateTo, includeVoided: status === "All" || status === "Voided", voidOnly: status === "Voided" }),
      });
      const result = await response.json();
      if (result && result.dailySales) setSalesData(result.dailySales);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [dateFrom, dateTo, status]);

  useEffect(() => { if (isOpen) fetchSales(); }, [isOpen, fetchSales]);

  const filtered = salesData.filter(i => i.Date?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalNet = filtered.reduce((sum, i) => sum + parseFloat(i["Net Sales"] || 0), 0);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center backdrop-blur-md p-2 transition-colors duration-300
      ${isDark ? "bg-[#020617]/95" : "bg-slate-500/40"}`}>
      
      <div className={`relative flex h-[98vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl transition-all duration-300
        ${isDark ? "bg-[#020617] border-white/10" : "bg-[#f8fafc] border-white"}`}>
        
        {/* --- HEADER --- */}
        <div className={`flex items-center justify-between px-10 py-6 border-b shrink-0 transition-all
          ${isDark ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-8">
            <h2 className={`text-4xl italic font-black tracking-tighter uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>
              Daily <span className="text-[#3b82f6]">Sales</span>
            </h2>
            <div className={`px-4 py-1.5 rounded-full border text-[11px] font-black uppercase flex items-center gap-3 italic
              ${isDark ? "bg-[#3b82f6]/10 border-[#3b82f6]/20 text-[#3b82f6]" : "bg-blue-50 border-blue-100 text-blue-600 shadow-sm"}`}>
              <FaCalendarAlt /> {dateFrom} <FaArrowRight size={8}/> {dateTo}
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.json_to_sheet(filtered), "Sales"), `Sales.xlsx`)} 
              className={`h-12 px-6 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest italic
                ${isDark ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-600 hover:text-white" : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white shadow-sm"}`}>
               Export Excel
             </button>
             <button onClick={onClose} 
              className={`flex items-center justify-center w-12 h-12 transition-all border rounded-xl 
                ${isDark ? "bg-white/5 text-white hover:bg-rose-600 border-white/10" : "bg-white text-slate-400 hover:text-rose-600 border-slate-200 shadow-sm"}`}>
               <FaTimes size={20}/>
             </button>
          </div>
        </div>

        {/* --- TOOLBAR --- */}
        <div className={`px-10 py-3 flex gap-4 items-center shrink-0 transition-all
          ${isDark ? "bg-[#050a18]/50" : "bg-slate-100/50"}`}>
          <div className="relative flex-1 group">
            <FaSearch className="absolute -translate-y-1/2 left-5 top-1/2 text-slate-500" size={14}/>
            <input type="text" placeholder="Search date..." 
              className={`w-full h-12 py-2 pl-12 pr-6 rounded-xl border font-bold text-sm outline-none transition-all
                ${isDark ? "bg-[#0a0f1e] border-white/10 text-white focus:border-[#3b82f6]/50" : "bg-white border-slate-200 text-[#2e4a7d] shadow-inner focus:border-blue-500"}`} 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={fetchSales} 
            className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-all
              ${isDark ? "bg-[#0a0f1e] border-white/10 text-white hover:bg-white/5" : "bg-white border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50"}`}>
            <FaSyncAlt className={loading ? 'animate-spin' : ''} size={16}/>
          </button>
          <button onClick={() => setShowFilter(true)} className="h-12 px-8 flex items-center gap-3 rounded-xl bg-[#2563eb] text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all">
            <FaFilter size={14}/> Filters
          </button>
        </div>

        {/* --- DATA TABLE --- */}
        <div className="flex-1 px-10 py-4 overflow-hidden">
          <div className={`h-full overflow-auto rounded-3xl border relative custom-scrollbar transition-all
            ${isDark ? "bg-[#050a18] border-white/5" : "bg-white border-slate-200 shadow-inner"}`}>
            <table className="w-full text-left border-separate border-spacing-0 min-w-[1500px]">
              <thead className="sticky top-0 z-[50]">
                <tr className={`${isDark ? "bg-[#0a0f1e] text-slate-500" : "bg-slate-50 text-slate-400"} text-[9px] font-black uppercase tracking-widest`}>
                  <th className={`p-4 sticky top-0 left-0 z-[60] border-b transition-all ${isDark ? "bg-[#0a0f1e] border-white/10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]" : "bg-slate-50 border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"}`}>Date</th>
                  <th className={`p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>Gross</th>
                  <th className={`p-4 border-b text-rose-500/60 ${isDark ? "border-white/10" : "border-slate-200"}`}>SRC Disc</th>
                  <th className={`p-4 border-b text-rose-500/60 ${isDark ? "border-white/10" : "border-slate-200"}`}>PWD Disc</th>
                  <th className={`p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>Others</th>
                  <th className={`p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>Cash</th>
                  <th className={`p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>GCash</th>
                  <th className={`p-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>Maya</th>
                  <th className={`p-4 border-b text-[#3b82f6] ${isDark ? "border-white/10" : "border-slate-200"}`}>VAT</th>
                  <th className={`p-4 text-right border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>Net Sales</th>
                </tr>
              </thead>
              <tbody className={`font-bold divide-y transition-all ${isDark ? "divide-white/5 text-slate-400" : "divide-slate-100 text-slate-600"}`}>
                {filtered.map((item, idx) => (
                  <tr key={idx} className={`transition-colors text-[13px] ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-blue-50/50"}`}>
                    <td className={`p-4 sticky left-0 z-[40] italic border-r transition-all ${isDark ? "bg-[#050a18] text-[#3b82f6] border-white/5" : "bg-white text-blue-600 border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}>{item.Date}</td>
                    <td className={`p-4 ${isDark ? "text-slate-300" : "text-[#2e4a7d]"}`}>₱{parseFloat(item["Gross Sales"] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-4 text-rose-600">-{parseFloat(item["SRC Disc."] || 0).toFixed(2)}</td>
                    <td className="p-4 text-rose-600">-{parseFloat(item["PWD Disc."] || 0).toFixed(2)}</td>
                    <td className="p-4 text-slate-500">-{parseFloat(item["Other Disc."] || 0).toFixed(2)}</td>
                    <td className="p-4 text-xs italic text-slate-400">₱{parseFloat(item["Cash Payment"] || 0).toLocaleString()}</td>
                    <td className="p-4 text-xs italic text-slate-400">₱{parseFloat(item["GCash Payment"] || 0).toLocaleString()}</td>
                    <td className="p-4 text-xs italic text-slate-400">₱{parseFloat(item["Maya Payment"] || 0).toLocaleString()}</td>
                    <td className={`p-4 text-xs ${isDark ? "text-blue-500/30" : "text-blue-500/50"}`}>₱{parseFloat(item["VAT Amount"] || 0).toFixed(2)}</td>
                    <td className={`p-4 text-xl italic font-black tracking-tighter text-right ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>₱{parseFloat(item["Net Sales"] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className={`flex items-center justify-between px-10 py-6 border-t shrink-0 transition-all
          ${isDark ? "bg-black/40 border-white/5" : "bg-white border-slate-200 shadow-lg"}`}>
          <div className="flex gap-10">
            <div><p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-400"}`}>Entries</p><p className={`text-2xl italic font-black ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{filtered.length}</p></div>
            <div className={`h-8 w-[1px] self-center ${isDark ? "bg-white/5" : "bg-slate-200"}`}></div>
            <div><p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-400"}`}>Status</p><p className="text-2xl italic font-black uppercase text-emerald-500">Synced</p></div>
          </div>
          <div className="bg-[#2563eb] px-10 py-4 rounded-2xl shadow-xl text-right group transition-all hover:scale-105 active:scale-95">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Net Revenue</span>
            <h3 className="text-4xl italic font-black tracking-tighter text-white">₱{totalNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
        </div>

        {/* --- SIDEBAR (CONFIG) --- */}
        {showFilter && (
          <div className={`absolute inset-y-0 right-0 w-[420px] border-l z-[100001] p-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 transition-all
            ${isDark ? "bg-[#0a0f1e] border-white/10" : "bg-white border-slate-200"}`}>
            <div className="flex items-center justify-between mb-10 shrink-0">
              <h3 className={`text-3xl italic font-black uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>Config</h3>
              <button onClick={() => setShowFilter(false)} 
                className={`flex items-center justify-center w-10 h-10 rounded-xl ${isDark ? "bg-white/5 text-slate-500" : "bg-slate-100 text-slate-400 hover:text-rose-500"}`}>
                <FaTimes size={18}/>
              </button>
            </div>
            <div className="flex-1 space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-2 block">From</label>
                <button onClick={() => { setOpenStartCal(!openStartCal); setOpenEndCal(false); }} 
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all
                    ${isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200 shadow-inner"}`}>
                  <span className={`text-lg italic font-black ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{dateFrom}</span>
                  <FaChevronDown className="text-slate-500" size={12}/>
                </button>
                <CustomCalendar selectedDate={dateFrom} onChange={setDateFrom} isOpen={openStartCal} onClose={() => setOpenStartCal(false)} isDark={isDark} />
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-2 block">To</label>
                <button onClick={() => { setOpenEndCal(!openEndCal); setOpenStartCal(false); }} 
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all
                    ${isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200 shadow-inner"}`}>
                  <span className={`text-lg italic font-black ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{dateTo}</span>
                  <FaChevronDown className="text-slate-500" size={12}/>
                </button>
                <CustomCalendar selectedDate={dateTo} onChange={setDateTo} isOpen={openEndCal} onClose={() => setOpenEndCal(false)} isDark={isDark} />
              </div>
              <div className="pt-6 space-y-2">
                <label className={`text-[10px] font-black text-[#3b82f6] uppercase tracking-widest block text-center`}>Status</label>
                <div className={`grid grid-cols-1 gap-2 p-1 rounded-2xl ${isDark ? "bg-black/20" : "bg-slate-100"}`}>
                  {['Active', 'Voided', 'All'].map((s) => (
                    <button key={s} onClick={() => setStatus(s)} 
                      className={`w-full h-12 rounded-xl font-black uppercase text-[10px] border-2 transition-all 
                        ${status === s ? 'bg-[#2563eb] text-white border-transparent shadow-lg' : isDark ? 'bg-white/5 text-slate-600 border-transparent hover:bg-white/10' : 'bg-white text-slate-400 border-transparent hover:text-blue-600 shadow-sm'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => { fetchSales(); setShowFilter(false); }} 
              className={`w-full py-6 font-black rounded-2xl shadow-2xl transition-all uppercase tracking-widest text-[10px] mt-8 italic active:scale-95
                ${isDark ? "bg-white text-[#020617] hover:bg-[#3b82f6] hover:text-white" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30"}`}>
              Apply Configuration
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)"}; 
          border-radius: 10px; 
        }
      `}</style>
    </div>
  );
};

export default DailySalesModal;