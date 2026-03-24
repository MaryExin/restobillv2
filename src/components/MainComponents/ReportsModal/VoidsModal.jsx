import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaTimes, FaSearch, FaTrashAlt, FaCalendarAlt } from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext"; 

const VoidsModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme(); 
  const darkMode = theme === "dark";

  // Get current date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const response = await fetch("http://localhost/api/get_voids_refunds.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 'voids', dateFrom, dateTo }),
      });
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("Fetch failed:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, isOpen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = data.filter(item => 
    Object.values(item).some(val => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${darkMode ? "bg-black/70" : "bg-slate-900/40"}`}>
      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-3xl shadow-2xl ${darkMode ? "bg-[#111827] border border-white/10" : "bg-white border border-slate-200"}`}>
        
        <div className={`px-8 py-5 flex items-center justify-between shrink-0 shadow-lg relative z-20 ${darkMode ? "bg-gradient-to-r from-[#1f2937] to-[#111827]" : "bg-gradient-to-r from-rose-50 to-white"}`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${darkMode ? "bg-rose-950 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
                <FaTrashAlt size={22} />
            </div>
            <div className="flex flex-col">
                <h2 className={`text-3xl tracking-tighter uppercase ${darkMode ? "text-white" : "text-slate-950"}`}>Void Transactions</h2>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>List of voided receipts and unauthorized deletions.</p>
            </div>
            <div className="relative ml-4">
              <FaSearch className={`absolute left-4 top-1/2 -translate-y-1/2 text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
              <input 
                type="text" 
                placeholder="Search voids..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border rounded-full py-2.5 pl-11 pr-6 text-xs outline-none w-80 transition-all ${darkMode ? "bg-[#0f172a] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"}`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center rounded-xl px-4 py-2.5 gap-3 border ${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"}`}>
              <FaCalendarAlt className={darkMode ? "text-slate-500" : "text-slate-400"} />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
              <div className="h-4 w-[1px] bg-slate-300/30"></div>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
            </div>
            <button onClick={fetchData} className={`p-4 rounded-xl active:scale-95 ${darkMode ? "bg-[#1f2937] text-slate-300" : "bg-slate-100 text-slate-700"}`}>
              <FaSyncAlt size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className={`p-4 rounded-xl active:scale-95 ${darkMode ? "bg-[#1f2937] text-white" : "bg-rose-500 text-white"}`}>
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        <div className={`flex-1 p-6 overflow-auto scrollbar-thin ${darkMode ? "bg-slate-950/20 scrollbar-thumb-slate-700" : "bg-slate-50/50 scrollbar-thumb-slate-300"}`}>
          <table className="w-full text-left border-separate table-fixed border-spacing-0">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className={`text-[10px] uppercase font-normal tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                <th className={`p-5 border-b first:rounded-tl-2xl w-1/5 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Void Date</th>
                <th className={`p-5 border-b w-1/6 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Invoice No</th>
                <th className={`p-5 border-b text-center w-1/6 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Cashier</th>
                <th className={`p-5 border-b w-1/6 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Total Due</th>
                <th className={`p-5 border-b text-center w-1/6 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Auth ID</th>
                <th className={`p-5 border-b rounded-tr-2xl w-1/4 ${darkMode ? "bg-[#1e293b] border-white/10" : "bg-white border-slate-200"}`}>Void Remarks</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-xs font-normal ${darkMode ? "divide-white/5 text-slate-300" : "divide-slate-100 text-slate-800"}`}>
              {filteredData.length > 0 ? filteredData.map((row, i) => (
                <tr key={i} className={`hover: transition-colors ${darkMode ? "hover:bg-white/5" : "hover:bg-slate-100"}`}>
                  <td className="p-5 font-mono text-slate-400">{row.report_date}</td>
                  <td className="p-5">{row.invoice_no}</td>
                  <td className="p-5 tracking-tighter text-center uppercase text-slate-400">{row.cashier}</td>
                  <td className="p-5 text-lg tabular-nums">₱{Number(row.TotalAmountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-5 text-center text-slate-400 bg-white/5 tabular-nums">{row.auth_id}</td>
                  <td className="p-5 italic truncate text-slate-500">{row.remarks || "No remarks"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className={`p-32 text-center rounded-b-2xl ${darkMode ? "bg-[#0b1120]" : "bg-white"}`}>
                    <div className="flex flex-col items-center gap-6 text-slate-600">
                      <FaTrashAlt size={50} className="opacity-10" />
                      <p className="text-sm italic font-normal">{loading ? "Fetching void records..." : "No void records found for this period."}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VoidsModal;