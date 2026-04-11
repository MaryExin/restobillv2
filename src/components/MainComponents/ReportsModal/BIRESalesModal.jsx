import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaTimes, FaSearch, FaFileExcel, FaFilePdf, FaDownload } from "react-icons/fa"; // Added FaDownload
import { useTheme } from "../../../context/ThemeContext";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const BirESalesModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const darkMode = theme === "dark";
  const [activeTab, setActiveTab] = useState("E1");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const fontStyle = { 
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: "normal",
    fontStyle: "normal"
  };

  const tabs = [
    { id: "E1", label: "E1 - Overall" },
    { id: "E2", label: "E2 - Senior Citizen" },
    { id: "E3", label: "E3 - PWD" },
    { id: "E4", label: "E4 - NAAC" },
    { id: "E5", label: "E5 - Solo Parent" },
  ];

  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/bir_esales.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: activeTab, dateFrom, dateTo }),
      });
      const result = await response.json();
      setData(Array.isArray(result[activeTab]) ? result[activeTab] : []);
    } catch (err) {
      console.error("Fetch Error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, isOpen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- NEW EXPORT ALL LOGIC ---
  const exportAllToExcel = async () => {
    setLoading(true);
    const wb = XLSX.utils.book_new();

    try {
      for (const tab of tabs) {
        const response = await fetch(`http://localhost/api/bir_esales.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: tab.id, dateFrom, dateTo }),
        });
        const result = await response.json();
        const sheetData = Array.isArray(result[tab.id]) ? result[tab.id] : [];
        
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, tab.id);
      }

      XLSX.writeFile(wb, `Overall_ESales_Report_${dateFrom}_to_${dateTo}.xlsx`);
    } catch (err) {
      console.error("Export All Error:", err);
      alert("Failed to export all data.");
    } finally {
      setLoading(false);
    }
  };
  // ----------------------------

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `ESales_Report_${activeTab}_${dateFrom}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    doc.setFont("helvetica", "normal");
    doc.text(`BIR Sales Summary Report (${activeTab})`, 40, 30);
    doc.setFontSize(10);
    doc.text(`Coverage: ${dateFrom} to ${dateTo}`, 40, 50);

    const headers = activeTab === "E1" 
      ? [["Date", "Beg OR", "End OR", "Gross Sales", "VAT Amount", "Net Sales", "Z-Count"]]
      : [["Date", "Name", "Trans No", "OR No", "Sales Inc", "Discount", "Net Sales"]];

    const body = data.map(row => activeTab === "E1" 
      ? [row.transaction_date, row.Beg_OR, row.End_OR, row.Gross_Sales, row.VAT_Amount, row.Net_Sales, row.Z_Counter]
      : [row.transaction_date, row.customer_name, row.trans_no, row.or_no, row.sales_inc_vat, row.discount_20, row.net_sales]
    );

    doc.autoTable({
      startY: 70,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { font: "helvetica", fontSize: 8, fontStyle: 'normal' },
      headStyles: { fillColor: darkMode ? [30, 41, 59] : [241, 245, 249], textColor: darkMode ? [255, 255, 255] : [51, 65, 85], fontStyle: 'normal' }
    });
    doc.save(`ESales_Report_${activeTab}.pdf`);
  };

  const filteredData = data.filter(item => 
    Object.values(item).some(val => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderHeaders = () => {
    const headerClass = `p-2 border-b font-normal transition-colors ${darkMode ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"}`;
    
    if (activeTab === "E1") {
      return (
        <>
          <th className={`sticky left-0 z-50 transition-colors ${darkMode ? "bg-slate-900" : "bg-slate-100"} ${headerClass}`}>Date</th>
          <th className={headerClass}>Beginning O.R.</th>
          <th className={headerClass}>Ending O.R.</th>
          <th className={`${headerClass} text-right`}>Grand Accum. Sales Ending Balance</th>
          <th className={`${headerClass} text-right`}>Grand Accum. Beg. Balance</th>
          <th className={`${headerClass} text-right`}>Gross Sales for the Day</th>
          <th className={`${headerClass} text-right`}>VATable Sales</th>
          <th className={`${headerClass} text-right`}>VAT Amount</th>
          <th className={`${headerClass} text-right`}>VAT-Exempt Sales</th>
          <th className={`${headerClass} text-right`}>VAT Exemption</th>
          <th className={`${headerClass} text-right`}>Zero-Rated Sales</th>
          <th className={`${headerClass} text-right text-orange-500`}>SC Discount</th>
          <th className={`${headerClass} text-right text-orange-500`}>PWD Disc</th>
          <th className={`${headerClass} text-right text-orange-500`}>NAAC Disc</th>
          <th className={`${headerClass} text-right text-orange-500`}>Solo Parent Disc</th>
          <th className={headerClass}>Others</th>
          <th className={headerClass}>Returns</th>
          <th className={`${headerClass} text-red-500 text-right`}>Voids</th>
          <th className={`${headerClass} text-orange-600 text-right`}>Total Deductions</th>
          <th className={`${headerClass} text-right`}>Adjustment_SC</th>
          <th className={`${headerClass} text-right`}>Adjustment_PWD</th>
          <th className={`${headerClass} text-right`}>Adjustment_Others</th>
          <th className={`${headerClass} text-right`}>Adjustments_VAT on Returns</th>
          <th className={headerClass}>Others</th>
          <th className={`${headerClass} text-right`}>Total VAT Adjustment</th>
          <th className={`${headerClass} text-right text-cyan-500`}>VAT Payable</th>
          <th className={`${headerClass} text-right text-green-600`}>Net Sales</th>
          <th className={`${headerClass} text-right`}>Sales Overrun / Overflow</th>
          <th className={`${headerClass} text-right text-green-600`}>Total Income</th>
          <th className={`${headerClass} text-center`}>Reset Counter</th>
          <th className={`${headerClass} text-blue-500 text-center`}>Z-Counter</th>
          <th className={headerClass}>Remarks</th>
        </>
      );
    }
    return (
      <>
        <th className={headerClass}>Date</th>
        <th className={headerClass}>Name</th>
        <th className={headerClass}>ID No.</th>
        <th className={headerClass}>Trans. No.</th>
        <th className={headerClass}>O.R. No.</th>
        <th className={`${headerClass} text-right`}>Sales (Inc)</th>
        <th className={`${headerClass} text-right`}>VAT</th>
        <th className={`${headerClass} text-right`}>Exempt</th>
        <th className={`${headerClass} text-right`}>Disc 20%</th>
        <th className={`${headerClass} text-right`}>Net Sales</th>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${darkMode ? "bg-black/70" : "bg-slate-900/40"}`}>
      <div className={`relative flex h-[92vh] w-full max-w-[98%] flex-col overflow-hidden rounded-[1.5rem] shadow-2xl transition-colors duration-300 ${darkMode ? "bg-[#111827] border border-white/10" : "bg-white border border-slate-200"}`} style={fontStyle}>
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] px-8 py-4 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-medium tracking-tight text-white uppercase">ESales Report</h2>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-[10px]" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-full py-1.5 pl-8 pr-4 text-[11px] text-white outline-none w-64 placeholder:text-white/40 font-normal" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pr-4 mr-4 border-r border-white/20">
               {/* EXPORT ALL BUTTON */}
               <button 
                  onClick={exportAllToExcel} 
                  disabled={loading}
                  title="Export All (E1-E5)"
                  className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-white bg-blue-500/80 hover:bg-blue-600 rounded-full transition-all active:scale-95 shadow-md uppercase">
                  <FaDownload size={12} />
                  Export All
               </button>

               <button onClick={exportToExcel} className="p-2.5 text-white bg-green-600/60 hover:bg-green-600 rounded-full transition-all active:scale-95 shadow-md" title="Export Current Tab to Excel">
                  <FaFileExcel size={14} />
               </button>
               <button onClick={exportToPDF} className="p-2.5 text-white bg-red-600/60 hover:bg-red-600 rounded-full transition-all active:scale-95 shadow-md" title="Export Current Tab to PDF">
                  <FaFilePdf size={14} />
               </button>
            </div>
            <div className="flex items-center bg-white/20 rounded-full px-4 py-1.5 gap-2 border border-white/30">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-white text-[11px] outline-none font-normal [color-scheme:dark]" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-white text-[11px] outline-none font-normal [color-scheme:dark]" />
            </div>
            <button onClick={fetchData} className="p-2 text-white transition-colors rounded-full hover:bg-white/10"><FaSyncAlt size={16} className={loading ? "animate-spin" : ""} /></button>
            <button onClick={onClose} className="p-2 text-white transition-colors bg-red-500 rounded-lg hover:bg-red-600"><FaTimes size={18} /></button>
          </div>
        </div>

        {/* Tabs and Table remain the same as your original code... */}
        <div className={`flex border-b shrink-0 overflow-x-auto transition-colors ${darkMode ? "bg-slate-800 border-white/5" : "bg-slate-50 border-slate-200"}`}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-3.5 text-[11px] font-normal uppercase transition-all whitespace-nowrap tracking-wider ${activeTab === tab.id ? "bg-blue-600 text-white shadow-[inset_0_-3px_0_white]" : `${darkMode ? "text-slate-400" : "text-slate-500"} hover:bg-blue-500/10 hover:text-blue-500`}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`flex-1 p-4 overflow-hidden ${darkMode ? "bg-slate-950/20" : "bg-slate-50/50"}`}>
          <div className={`h-full overflow-auto rounded-xl border transition-colors shadow-sm ${darkMode ? "bg-[#0b1120] border-white/5" : "bg-white border-slate-200"}`}>
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-[60]">
                <tr className={`text-[10px] font-normal uppercase tracking-wide transition-colors ${darkMode ? "bg-slate-900" : "bg-slate-100"}`}>
                  {renderHeaders()}
                </tr>
              </thead>
              <tbody className={`divide-y text-[10px] font-normal transition-colors ${darkMode ? "divide-white/5" : "divide-slate-100"}`}>
                {loading ? (
                  <tr><td colSpan={32} className="p-20 text-center animate-pulse text-slate-400">Fetching Records...</td></tr>
                ) : filteredData.length > 0 ? filteredData.map((row, idx) => (
                  <tr key={idx} className={`transition-colors ${darkMode ? "text-slate-300 hover:bg-white/5" : "text-slate-600 hover:bg-blue-50/50"}`}>
                    {activeTab === "E1" ? (
                        <>
                          <td className={`sticky left-0 p-2 border-r font-medium transition-colors z-[40] ${darkMode ? "bg-slate-900 border-white/10 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}>{row?.transaction_date}</td>
                          <td className="p-2">{row?.Beg_OR}</td>
                          <td className="p-2">{row?.End_OR}</td>
                          <td className="p-2 text-right tabular-nums">{Number(row?.Grand_Accum_End || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">{Number(row?.Grand_Accum_Beg || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">{Number(row?.Gross_Sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">{Number(row?.VATable_Sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">{Number(row?.VAT_Amount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-yellow-600 tabular-nums">{Number(row?.VAT_Exempt_Sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-yellow-600 tabular-nums">{Number(row?.VAT_Exemption || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right text-orange-500 tabular-nums">{Number(row?.SC_Discount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-orange-500 tabular-nums">{Number(row?.PWD_Disc || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-orange-500 tabular-nums">{Number(row?.NAAC_Disc || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-orange-500 tabular-nums">{Number(row?.Solo_Parent_Disc || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2">{row?.Others}</td>
                          <td className="p-2">0.00</td>
                          <td className="p-2 text-right text-red-500 tabular-nums">{Number(row?.Voids || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-orange-600 tabular-nums">{Number(row?.Total_Deductions || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2">0.00</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right tabular-nums text-cyan-500">{Number(row?.VAT_Payable || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right text-green-600 tabular-nums">{Number(row?.Net_Sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right tabular-nums">0.00</td>
                          <td className="p-2 text-right text-green-600 tabular-nums">{Number(row?.Total_Income || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-2 text-center">0</td>
                          <td className="p-2 text-center text-blue-500 tabular-nums">{row?.Z_Counter}</td>
                          <td className={`p-2 text-[9px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>{row?.Remarks}</td>
                        </>
                    ) : (
                        <>
                          <td className="p-3">{row?.transaction_date}</td>
                          <td className={`p-3 uppercase font-medium ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{row?.customer_name}</td>
                          <td className="p-3">{row?.id_no}</td>
                          <td className="p-3">{row?.trans_no}</td>
                          <td className="p-3 text-blue-500">{row?.or_no}</td>
                          <td className="p-3 text-right tabular-nums">{Number(row?.sales_inc_vat || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-3 text-right tabular-nums">{Number(row?.vat_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-3 text-right tabular-nums">{Number(row?.vat_exempt_sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-3 text-right tabular-nums text-rose-500">{Number(row?.discount_20 || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="p-3 text-right tabular-nums text-cyan-600">{Number(row?.net_sales || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        </>
                    )}
                  </tr>
                )) : (
                  <tr><td colSpan={32} className="p-24 tracking-widest text-center uppercase text-slate-500">No Records Found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BirESalesModal;