import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaTimes, FaSearch, FaHistory, FaCalendarAlt, FaPrint, FaFileExcel } from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext"; 
import * as XLSX from 'xlsx'; // Siguraduhing installed: npm install xlsx

const RefundsModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme(); 
  const darkMode = theme === "dark";

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
        body: JSON.stringify({ type: 'refunds', dateFrom, dateTo }),
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

  const handlePrint = () => { window.print(); };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Refund Transactions");
    XLSX.writeFile(wb, `Refund_Report_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const filteredData = data.filter(item => 
    Object.values(item).some(val => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${darkMode ? "bg-black/70" : "bg-slate-900/40"}`}>
      
      {/* 70mm Thermal Print Styles */}
      <style>
        {`
          @media print {
            @page { size: 70mm auto; margin: 0 !important; }
            body { margin: 0 !important; padding: 0 !important; width: 70mm; background-color: white; }
            body * { visibility: hidden; }
            #print-area-refund, #print-area-refund * { 
              visibility: visible; 
              color: black !important; 
              font-family: 'Courier New', monospace; 
              font-weight: 900 !important; 
            }
            #print-area-refund { 
              position: absolute; left: 0; top: 0; width: 68mm; padding: 2mm 1mm; margin: 0; 
            }
            .print-header { text-align: center; border-bottom: 2pt solid black; margin-bottom: 8px; padding-bottom: 5px; }
            .print-row { border-bottom: 1pt dashed black; padding: 5px 0; width: 100%; }
            .print-main-info { display: flex; width: 100%; font-size: 10px; }
            .print-remarks { 
              display: block; width: 100%; font-size: 9px; margin-top: 3px; 
              padding-left: 5px; border-left: 2pt solid black; word-wrap: break-word; 
            }
            .no-print { display: none !important; }
            .screen-table { display: none !important; }
          }
        `}
      </style>

      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-3xl shadow-2xl ${darkMode ? "bg-[#111827] border border-white/10" : "bg-white border border-slate-200"}`}>
        
        {/* Header Section */}
        <div className={`px-8 py-5 flex items-center justify-between shrink-0 shadow-lg relative z-20 no-print ${darkMode ? "bg-[#1f2937]" : "bg-cyan-50"}`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${darkMode ? "bg-cyan-900/50 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}>
                <FaHistory size={22} />
            </div>
            <div className="flex flex-col">
                <h2 className={`text-3xl tracking-tighter uppercase font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>Refund Transactions</h2>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>System Logs</p>
            </div>
            <div className="relative ml-4">
              <FaSearch className={`absolute left-4 top-1/2 -translate-y-1/2 text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border rounded-full py-2.5 pl-11 pr-6 text-xs outline-none w-64 transition-all ${darkMode ? "bg-[#0f172a] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"}`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center rounded-xl px-4 py-2.5 gap-3 border ${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"}`}>
              <FaCalendarAlt className={darkMode ? "text-slate-500" : "text-slate-400"} />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
            </div>

            <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-4 font-bold text-white shadow-lg bg-emerald-600 hover:bg-emerald-700 rounded-xl active:scale-95">
              <FaFileExcel size={18} /> <span className="text-xs uppercase">Excel</span>
            </button>

            <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-4 font-bold text-white bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl active:scale-95">
              <FaPrint size={18} /> <span className="text-xs uppercase">Print 70mm</span>
            </button>

            <button onClick={fetchData} className="p-4 rounded-xl bg-slate-500/10 text-slate-500"><FaSyncAlt className={loading ? "animate-spin" : ""} /></button>
            <button onClick={onClose} className="p-4 text-white rounded-xl bg-rose-500"><FaTimes /></button>
          </div>
        </div>

        <div id="print-area-refund" className="flex-1 p-6 overflow-auto scrollbar-thin">
          
          {/* PRINT ONLY CONTENT */}
          <div className="hidden print:block print-header">
            <h3>REFUND REPORT</h3>
            <p>{dateFrom} to {dateTo}</p>
          </div>

          <div className="hidden print:block">
            <div className="flex font-black text-[9px] mb-1 border-b-2 border-black pb-1">
                <span style={{width: '35%'}}>DATE</span>
                <span style={{width: '35%'}}>CASHIER</span>
                <span style={{width: '30%'}}>AUTH</span>
            </div>
            {filteredData.map((row, i) => (
              <div key={i} className="print-row">
                <div className="print-main-info">
                  <span style={{width: '35%'}}>{row.report_date}</span>
                  <span style={{width: '35%'}}>{row.cashier}</span>
                  <span style={{width: '30%'}}>{row.auth_id}</span>
                </div>
                <div className="print-remarks">
                  RMKS: {row.remarks || "NO REMARKS"}
                </div>
              </div>
            ))}
          </div>

          {/* SCREEN VIEW TABLE */}
          <table className="w-full text-left border-separate table-fixed screen-table no-print">
            <thead className="sticky top-0 z-10">
              <tr className={`text-[10px] uppercase font-bold tracking-widest ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                <th className="w-1/5 p-5 border-b">Refund Date</th>
                <th className="w-1/6 p-5 border-b">Invoice No</th>
                <th className="w-1/6 p-5 text-center border-b">Cashier</th>
                <th className="w-1/6 p-5 border-b">Total Due</th>
                <th className="w-1/6 p-5 text-center border-b">Auth ID</th>
                <th className="w-1/4 p-5 border-b">Remarks</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-xs ${darkMode ? "divide-white/5 text-slate-300" : "divide-slate-100 text-slate-800"}`}>
              {filteredData.length > 0 ? filteredData.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-cyan-500/5">
                  <td className="p-5 font-mono">{row.report_date}</td>
                  <td className="p-5">{row.invoice_no}</td>
                  <td className="p-5 text-center uppercase">{row.cashier}</td>
                  <td className="p-5 font-bold">₱{Number(row.TotalAmountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-5 text-center">{row.auth_id}</td>
                  <td className="p-5 italic opacity-70">{row.remarks || "No remarks"}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="p-20 italic text-center opacity-50">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RefundsModal;