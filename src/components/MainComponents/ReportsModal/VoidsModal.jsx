import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaTimes, FaSearch, FaTrashAlt, FaCalendarAlt, FaPrint, FaFileExcel } from "react-icons/fa";
import { useTheme } from "../../../context/ThemeContext";
import * as XLSX from 'xlsx';
import useApiHost from "../../../hooks/useApiHost";

const VoidsModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const darkMode = theme === "dark";
  const apiHost = useApiHost();
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({});

  // Load print setting and business info
  useEffect(() => {
    if (!apiHost) return;
    fetch(`${apiHost}/api/pos_print_settings.php`)
      .then(r => r.json())
      .then(json => { if (json?.success) setPrintEnabled(Boolean(json.data?.print_void_enabled)); })
      .catch(() => {});

    // Try electron API first, fall back to static JSON
    if (window.electronAPI?.readBusinessInfo) {
      window.electronAPI.readBusinessInfo()
        .then(info => { if (info) setBusinessInfo(info); })
        .catch(() => {});
    } else {
      fetch("/businessInfo.json").then(r => r.json()).then(setBusinessInfo).catch(() => {});
    }
  }, [apiHost]);

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

  const companyName = businessInfo?.companyName || "";
  const storeName   = businessInfo?.storeName   || "";
  const address     = businessInfo?.address     || "";
  const tin         = businessInfo?.tin         || "";
  const minNo       = businessInfo?.machineNumber || "";

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${darkMode ? "bg-black/70" : "bg-slate-900/40"}`}>

      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0 !important; }
          body { margin: 0 !important; padding: 0 !important; width: 80mm; background-color: white; }
          body * { visibility: hidden; }
          #void-print-area, #void-print-area * {
            visibility: visible;
            color: black !important;
            font-family: Arial, Helvetica, sans-serif;
          }
          #void-print-area {
            position: absolute; left: 0; top: 0;
            width: 78mm; padding: 4mm 2mm; margin: 0;
          }
          .vp-header { text-align: center; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1pt solid black; }
          .vp-company  { font-size: 13px; font-weight: 900; }
          .vp-store    { font-size: 11px; font-weight: 700; }
          .vp-address  { font-size: 9px; }
          .vp-title    { text-align: center; font-size: 12px; font-weight: 900; margin: 6px 0 4px; }
          .vp-period   { text-align: center; font-size: 9px; margin-bottom: 6px; }
          .vp-col-head { display: flex; font-size: 9px; font-weight: 900; border-bottom: 1pt solid black; padding-bottom: 3px; margin-bottom: 3px; }
          .vp-row      { border-bottom: 1pt dashed black; padding: 4px 0; }
          .vp-main     { display: flex; font-size: 9px; }
          .vp-remarks  { font-size: 8px; margin-top: 2px; padding-left: 4px; border-left: 2pt solid black; word-wrap: break-word; }
          .vp-total    { font-size: 10px; font-weight: 900; margin-top: 6px; text-align: right; }
          .no-print    { display: none !important; }
          .screen-table { display: none !important; }
        }
      `}</style>

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
            {/* Search */}
            <div className={`flex items-center rounded-xl px-3 py-2 border gap-2 ${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"}`}>
              <FaSearch className={darkMode ? "text-slate-500 text-xs" : "text-slate-400 text-xs"} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`bg-transparent text-xs outline-none w-36 ${darkMode ? "text-white" : "text-slate-800"}`}
              />
            </div>

            {/* Date pickers */}
            <div className={`flex items-center rounded-xl px-4 py-2.5 gap-3 border ${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"}`}>
              <FaCalendarAlt className={darkMode ? "text-slate-500" : "text-slate-400"} />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
              <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className={`bg-transparent text-xs outline-none font-mono ${darkMode ? "text-white [color-scheme:dark]" : "text-slate-800"}`} />
            </div>

            <button onClick={fetchData} className={`p-3 rounded-xl ${darkMode ? "bg-slate-700/50 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>

            <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-3 font-bold text-white transition-all shadow-lg bg-emerald-600 hover:bg-emerald-700 rounded-xl active:scale-95">
              <FaFileExcel size={16} /> <span className="text-xs uppercase">Excel</span>
            </button>

            {/* Print button: only show when enabled in settings */}
            {printEnabled && (
              <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-3 font-bold text-white transition-all bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl active:scale-95">
                <FaPrint size={16} /> <span className="text-xs uppercase">Print</span>
              </button>
            )}

            <button onClick={onClose} className="p-4 text-white transition-all rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95">
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Screen table */}
        <div className="flex-1 p-6 overflow-auto">
          <table className="w-full text-left border-separate table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                <th className="p-4 border-b">Void Date</th>
                <th className="p-4 border-b">Invoice No</th>
                <th className="p-4 border-b">Cashier</th>
                <th className="p-4 border-b">Total Due</th>
                <th className="p-4 border-b">Void #</th>
                <th className="p-4 border-b">Remarks</th>
              </tr>
            </thead>
            <tbody className={`text-xs ${darkMode ? "text-slate-300" : "text-slate-800"}`}>
              {filteredData.length > 0 ? filteredData.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-mono">{row.report_date}</td>
                  <td className="p-4">{row.invoice_no}</td>
                  <td className="p-4 uppercase">{row.cashier}</td>
                  <td className="p-4">₱{Number(row.TotalAmountDue).toLocaleString()}</td>
                  <td className="p-4">{row.auth_id}</td>
                  <td className="p-4 italic opacity-60">{row.remarks || "---"}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="p-20 text-center italic opacity-50">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 80mm print area — billing-style layout, no footer */}
      <div id="void-print-area" style={{ display: "none" }}>
        <div className="vp-header">
          {companyName && <div className="vp-company">{companyName}</div>}
          {storeName   && <div className="vp-store">{storeName}</div>}
          {address     && <div className="vp-address">{address}</div>}
          {tin         && <div className="vp-address">VAT REG TIN: {tin}</div>}
          {minNo       && <div className="vp-address">MIN: {minNo}</div>}
        </div>

        <div className="vp-title">VOID REPORT</div>
        <div className="vp-period">PERIOD: {dateFrom} — {dateTo}</div>

        <div className="vp-col-head">
          <span style={{ width: "50%" }}>DATE</span>
          <span style={{ width: "50%" }}>CASHIER</span>
        </div>

        {filteredData.map((row, i) => (
          <div key={i} className="vp-row">
            <div className="vp-main">
              <span style={{ width: "50%" }}>{row.report_date}</span>
              <span style={{ width: "50%" }}>{row.cashier}</span>
            </div>
            <div className="vp-remarks">VOID #: {row.auth_id || "-"} | INV#: {row.invoice_no || "-"}</div>
            <div className="vp-remarks">AMT: ₱{Number(row.TotalAmountDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="vp-remarks">RMKS: {row.remarks || "NO REMARKS"}</div>
          </div>
        ))}

        <div className="vp-total">TOTAL RECORDS: {filteredData.length}</div>
      </div>
    </div>
  );
};

export default VoidsModal;
