import React, { useState, useEffect, useCallback } from "react";
import { 
  FaSyncAlt, FaTimes, FaSearch, FaCalendarAlt, 
  FaHistory, FaFilePdf, FaFileCsv 
} from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext"; 
import jsPDF from "jspdf";
import "jspdf-autotable";

const LogsModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme(); 
  const isDark = theme === "dark";
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ from: today, to: today });

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const response = await fetch("http://localhost/api/get_logs.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "all", 
          dateFrom: dateRange.from, 
          dateTo: dateRange.to 
        }),
      });
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  }, [isOpen, dateRange]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const filtered = data.filter(item => 
    Object.values(item).some(val => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // --- EXPORT LOGIC ---
  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = Object.keys(filtered[0]);
    const rows = filtered.map(row => headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `system_logs_${today}.csv`);
    link.click();
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) return;
    const doc = new jsPDF('landscape');
    doc.text("System Activity Logs", 14, 15);
    const headers = Object.keys(filtered[0]);
    const rows = filtered.map(row => headers.map(h => row[h]));
    doc.autoTable({
      head: [headers.map(h => h.replace(/_/g, ' '))],
      body: rows,
      startY: 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`system_logs_${today}.pdf`);
  };

  if (!isOpen) return null;

  const thClass = `px-5 py-4 border-b font-black tracking-widest text-[9px] uppercase ${
    isDark ? "bg-[#0b1222] border-white/5 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
  } sticky top-0 z-20 text-left`;
  
  const actionBtnClass = `p-3 rounded-lg transition-all ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
  const inputClass = `text-[11px] font-bold outline-none bg-transparent ${isDark ? "text-white [color-scheme:dark]" : "text-slate-800"}`;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${isDark ? "bg-black/80" : "bg-slate-900/40"}`}>
      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-xl shadow-2xl ${
        isDark ? "bg-[#0b1222] border border-white/5" : "bg-white"
      }`}>
        
        {/* Header Section */}
        <div className={`px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b ${
          isDark ? "bg-[#0b1222] border-white/5" : "bg-white border-slate-200"
        }`}>
          <div className="flex flex-col">
            <h2 className={`text-xl font-black tracking-tight uppercase ${isDark ? "text-white" : "text-slate-800"}`}>System Activity Logs</h2>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mt-1">History of system events and administrative actions</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isDark ? 'bg-[#111827] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
               <FaSearch className="text-slate-500 text-[10px]" />
               <input 
                type="text" 
                placeholder="SEARCH LOGS..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`${inputClass} w-48 uppercase`} 
               />
            </div>

            {/* Date Range Picker (Naibalik) */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${isDark ? 'bg-[#111827] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
               <FaCalendarAlt className="text-blue-500 text-[10px]" />
               <input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className={inputClass} />
               <span className="text-slate-600 text-[9px] font-black px-1">TO</span>
               <input type="date" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} className={inputClass} />
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-1.5 ml-1">
              <button onClick={handleExportPDF} title="Export PDF" className={`${actionBtnClass} text-rose-400/80`}><FaFilePdf size={12} /></button>
              <button onClick={handleExportCSV} title="Export CSV" className={`${actionBtnClass} text-emerald-400/80`}><FaFileCsv size={12} /></button>
            </div>

            <div className="w-[1px] h-6 bg-slate-500/20 mx-1"></div>

            <button onClick={fetchData} className={actionBtnClass}>
              <FaSyncAlt size={12} className={loading ? "animate-spin" : ""} />
            </button>
            
            <button onClick={onClose} className="p-3 transition-all rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white">
              <FaTimes size={12} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr>
                {data.length > 0 && Object.keys(data[0]).map(key => (
                  <th key={key} className={thClass}>{key.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {filtered.map((row, i) => (
                <tr key={i} className={`hover:bg-white/[0.02] transition-colors border-b ${isDark ? 'border-white/[0.02]' : 'border-slate-100'}`}>
                  {Object.values(row).map((val, idx) => (
                    <td key={idx} className="px-5 py-4 border-b border-white/[0.02]">
                       {idx === 0 ? <span className="font-mono opacity-60 text-[10px]">{val}</span> : 
                        String(val).toUpperCase().includes("SUCCESS") ? <span className="font-bold text-emerald-500">{val}</span> :
                        String(val).toUpperCase().includes("ERROR") ? <span className="font-bold text-rose-500">{val}</span> : val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-40 opacity-20 text-slate-500 uppercase tracking-[0.4em] font-black">
              No activity logs found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-8 py-4 border-t flex justify-between items-center ${isDark ? "bg-[#0b1222] border-white/5" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">Entries: {filtered.length}</span>
            <div className="flex items-center gap-2 px-3 py-1 border rounded-full bg-blue-500/10 border-blue-500/20">
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Live System Logs</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;