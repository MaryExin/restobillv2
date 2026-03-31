import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaTimes, FaSearch, FaTrashAlt, FaCalendarAlt, FaPrint, FaFileExcel } from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext"; 
import * as XLSX from 'xlsx'; // Siguraduhing naka-install ito: npm install xlsx

const VoidsModal = ({ isOpen, onClose }) => {
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

  const handlePrint = () => { window.print(); };

  // EXPORT TO EXCEL FUNCTION
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Void Transactions");
    XLSX.writeFile(wb, `Void_Report_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const filteredData = data.filter(item => 
    Object.values(item).some(val => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${darkMode ? "bg-black/70" : "bg-slate-900/40"}`}>
      
      <style>
        {`
          @media print {
            @page { size: 70mm auto; margin: 0 !important; }
            body { margin: 0 !important; padding: 0 !important; width: 70mm; background-color: white; }
            body * { visibility: hidden; }
            #print-area, #print-area * { 
              visibility: visible; 
              color: black !important; 
              font-family: 'Courier New', monospace; 
              font-weight: 900 !important; 
            }
            #print-area { position: absolute; left: 0; top: 0; width: 68mm; padding: 2mm 1mm; margin: 0; }
            .print-header { text-align: center; border-bottom: 2pt solid black; margin-bottom: 8px; padding-bottom: 5px; }
            .print-row { border-bottom: 1pt dashed black; padding: 5px 0; width: 100%; }
            .print-main-info { display: flex; width: 100%; font-size: 10px; }
            .print-remarks { display: block; width: 100%; font-size: 9px; margin-top: 3px; padding-left: 5px; border-left: 2pt solid black; word-wrap: break-word; }
            .no-print { display: none !important; }
            .screen-table { display: none !important; }
          }
        `}
      </style>

      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-3xl shadow-2xl ${darkMode ? "bg-[#111827] border border-white/10" : "bg-white border border-slate-200"}`}>
        
        {/* Modal Header */}
        <div className={`px-8 py-5 flex items-center justify-between shrink-0 shadow-lg relative z-20 no-print ${darkMode ? "bg-[#1f2937]" : "bg-white"}`}>
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-full bg-rose-500/10 text-rose-500">
                <FaTrashAlt size={22} />
            </div>
            <div className="flex flex-col">
                <h2 className={`text-3xl tracking-tighter uppercase font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>Void Transactions</h2>
                <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>History Log</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* DATE PICKERS */}
            <div className={`flex items-center rounded-xl px-4 py-2.5 gap-3 border ${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"}`}>
              <FaCalendarAlt className={darkMode ? "text-slate-500" : "text-slate-400"} />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
            </div>

            {/* EXCEL BUTTON */}
            <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-4 font-bold text-white transition-all shadow-lg bg-emerald-600 hover:bg-emerald-700 rounded-xl active:scale-95">
              <FaFileExcel size={18} /> <span className="text-xs uppercase">Excel</span>
            </button>

            {/* PRINT BUTTON */}
            <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-4 font-bold text-white transition-all bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl active:scale-95">
              <FaPrint size={18} /> <span className="text-xs uppercase">Print</span>
            </button>

            <button onClick={onClose} className="p-4 text-white transition-all rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95"><FaTimes /></button>
          </div>
        </div>

        <div id="print-area" className="flex-1 p-6 overflow-auto">
          
          {/* PRINT ONLY CONTENT */}
          <div className="hidden print:block print-header">
            <h3>VOID REPORT</h3>
            <p>PERIOD: {dateFrom} - {dateTo}</p>
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
                <div className="print-remarks">RMKS: {row.remarks || "NO REMARKS"}</div>
              </div>
            ))}
          </div>

          {/* SCREEN VIEW TABLE */}
          <table className="w-full text-left border-separate table-fixed screen-table no-print">
            <thead className="sticky top-0 z-10">
              <tr className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <th className="p-4 border-b">Void Date</th>
                <th className="p-4 border-b">Invoice No</th>
                <th className="p-4 border-b">Cashier</th>
                <th className="p-4 border-b">Total Due</th>
                <th className="p-4 border-b">Auth ID</th>
                <th className="p-4 border-b">Remarks</th>
              </tr>
            </thead>
            <tbody className={`text-xs ${darkMode ? "text-slate-300" : "text-slate-800"}`}>
              {filteredData.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-mono">{row.report_date}</td>
                  <td className="p-4">{row.invoice_no}</td>
                  <td className="p-4 uppercase">{row.cashier}</td>
                  <td className="p-4">₱{Number(row.TotalAmountDue).toLocaleString()}</td>
                  <td className="p-4">{row.auth_id}</td>
                  <td className="p-4 italic opacity-60">{row.remarks || "---"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VoidsModal;