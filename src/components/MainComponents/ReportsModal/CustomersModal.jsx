import React, { useState, useEffect, useCallback } from "react";
import { 
  FaSyncAlt, FaTimes, FaSearch, FaCalendarAlt, 
  FaUserCircle, FaFilePdf, FaFileCsv 
} from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext"; 
import jsPDF from "jspdf";
import "jspdf-autotable";

const CustomersModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme(); 
  const isDark = theme === "dark";
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ from: today, to: today });

  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const response = await fetch("http://localhost/api/get_logs.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "customers", 
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

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["Customer Name", "Phone", "Address", "Email", "Total Transactions"];
    const rows = filtered.map(row => [
      `"${row["Customer Name"] || ''}"`,
      `"${row["Phone"] || ''}"`,
      `"${row["Address"] || ''}"`,
      `"${row["Email"] || ''}"`,
      row["Total Transactions"] || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `customers_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    doc.text("Customer Registry Report", 14, 15);
    doc.setFontSize(8);
    doc.text(`Range: ${dateRange.from} to ${dateRange.to}`, 14, 20);
    
    const tableColumn = ["Customer Name", "Phone", "Address", "Email", "Trans."];
    const tableRows = filtered.map(item => [
      item["Customer Name"],
      item["Phone"],
      item["Address"],
      item["Email"],
      item["Total Transactions"]
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] }
    });
    doc.save(`customers_${today}.pdf`);
  };

  if (!isOpen) return null;

  const thClass = `px-5 py-4 border-b font-medium tracking-widest text-[9px] uppercase ${
    isDark ? "bg-[#0b1222] border-white/5 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
  } sticky top-0 z-20 text-left`;
  
  const inputClass = `text-[11px] outline-none bg-transparent ${isDark ? "text-white [color-scheme:dark]" : "text-slate-800"}`;
  const actionBtnClass = `p-3 rounded-lg transition-all ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${isDark ? "bg-black/80" : "bg-slate-900/40"}`}>
      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-xl shadow-2xl ${
        isDark ? "bg-[#0b1222] border border-white/5" : "bg-white"
      }`}>
        
        <div className={`px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b ${
          isDark ? "bg-[#0b1222] border-white/5" : "bg-white border-slate-200"
        }`}>
          <div className="flex items-center gap-4">
             <div className={`p-3 rounded-xl ${isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
               <FaUserCircle size={22} />
             </div>
             <div className="flex flex-col">
                <h2 className={`text-xl font-medium tracking-tight uppercase ${isDark ? "text-white" : "text-slate-800"}`}>Customer Registry</h2>
                <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mt-1">Database of registered clients</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${isDark ? 'bg-[#111827] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
               <FaSearch className="text-slate-500 text-[10px]" />
               <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputClass + " w-56 font-light"} />
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${isDark ? 'bg-[#111827] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
               <FaCalendarAlt className="text-slate-500 text-[10px]" />
               <input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className={inputClass} />
               <span className="text-slate-600 text-[9px] font-bold px-1">TO</span>
               <input type="date" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} className={inputClass} />
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

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Customer Name</th>
                <th className={thClass}>Phone Number</th>
                <th className={thClass}>Home/Office Address</th>
                <th className={thClass}>Email Address</th>
                <th className={`${thClass} text-center`}>Trans. Count</th>
              </tr>
            </thead>
            <tbody className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {filtered.map((row, i) => (
                <tr key={i} className={`hover:bg-white/[0.02] transition-colors border-b ${isDark ? 'border-white/[0.02]' : 'border-slate-100'}`}>
                  <td className="px-5 py-4 font-medium tracking-tight uppercase text-blue-400/80">{row["Customer Name"]}</td>
                  <td className="px-5 py-4 font-mono text-[10px] opacity-70">{row["Phone"]}</td>
                  <td className="px-5 py-4 font-light italic truncate max-w-[250px]">{row["Address"]}</td>
                  <td className="px-5 py-4 font-light opacity-80">{row["Email"]}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-3 py-1 rounded-md text-[10px] font-medium ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {row["Total Transactions"]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomersModal;