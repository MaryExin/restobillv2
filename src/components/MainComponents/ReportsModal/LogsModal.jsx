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

  // --- FETCH DATA (Restored) ---
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

  const thClass = `px-5 py-4 border-b font-medium tracking-widest text-[9px] uppercase ${
    isDark ? "bg-[#0b1222] border-white/5 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
  } sticky top-0 z-20 text-left`;
  
  const actionBtnClass = `p-3 rounded-lg transition-all ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${isDark ? "bg-black/80" : "bg-slate-900/40"}`}>
      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-xl shadow-2xl ${
        isDark ? "bg-[#0b1222] border border-white/5" : "bg-white"
      }`}>
        
        <div className={`px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b ${
          isDark ? "bg-[#0b1222] border-white/5" : "bg-white border-slate-200"
        }`}>
          <div className="flex flex-col">
            <h2 className={`text-xl font-medium tracking-tight uppercase ${isDark ? "text-white" : "text-slate-800"}`}>System Activity Logs</h2>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mt-1">History of system events</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isDark ? 'bg-[#111827] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
               <FaSearch className="text-slate-500 text-[10px]" />
               <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`text-[11px] outline-none bg-transparent w-56 ${isDark ? "text-white" : "text-slate-800"}`} />
            </div>

            <div className="flex items-center gap-1.5 ml-2">
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

        <div className="flex-1 overflow-auto">
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
                <tr key={i} className="hover:bg-white/[0.02]">
                  {Object.values(row).map((val, idx) => (
                    <td key={idx} className="px-5 py-4 border-b border-white/[0.02]">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;