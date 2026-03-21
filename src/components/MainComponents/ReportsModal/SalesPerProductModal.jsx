import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FaSearch, FaSyncAlt, FaFilter, FaTimes,
  FaPrint, FaFileExcel, FaBox, FaArrowRight,
  FaChevronDown, FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import * as XLSX from "xlsx";

// --- CUSTOM DROP-DOWN CALENDAR ---
const CustomCalendar = ({ selectedDate, onChange, isOpen, onClose }) => {
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
    <div ref={calendarRef} className="absolute top-full left-0 mt-2 w-[300px] bg-[#050a18] rounded-2xl border border-white/10 p-5 shadow-2xl z-[100005] animate-in fade-in zoom-in duration-150">
      <div className="flex items-center justify-between px-1 mb-4 text-white monthNames">
        <h4 className="text-sm italic font-black">{monthNames[currentView.getMonth()]} {currentView.getFullYear()}</h4>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1)); }} className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[#3b82f6] transition-colors"><FaChevronLeft size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1)); }} className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[#3b82f6] transition-colors"><FaChevronRight size={10} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2 text-center text-[8px] font-black text-slate-500 uppercase">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => <div key={i}></div>)}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = new Date(currentView.getFullYear(), currentView.getMonth(), day, 12).toISOString().split('T')[0];
          return (
            <button key={day} onClick={(e) => { e.stopPropagation(); onChange(dateString); onClose(); }}
              className={`h-8 w-full rounded-lg font-bold text-[10px] transition-all ${dateString === selectedDate ? 'bg-[#3b82f6] text-white' : 'text-slate-400 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SalesPerProductModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datefrom: dateFrom, dateto: dateTo, includeVoided: false }),
      });
      const data = await response.json();
      setSalesData(data?.salesPerProduct || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { if (isOpen) fetchSales(); }, [isOpen, fetchSales]);

  const filteredData = useMemo(() => {
    return salesData.filter(item =>
      item["Product Name"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item["Code"]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [salesData, searchTerm]);

  const totalAmt = filteredData.reduce((sum, i) => sum + parseFloat(i["Gross Sales"] || 0), 0);
  const totalQty = filteredData.reduce((sum, i) => sum + parseFloat(i["Total Qty Sold"] || 0), 0);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      "Code": item.Code, "Product Name": item["Product Name"], "Qty Sold": item["Total Qty Sold"], "Total Amount": item["Gross Sales"]
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Per_Item");
    XLSX.writeFile(workbook, `Sales_Per_Item_${dateFrom}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#020617]/90 backdrop-blur-sm p-2 font-sans overflow-hidden">
      <style>{`
        @media screen { #thermal-receipt { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; }
          #thermal-receipt {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            box-sizing: border-box !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      {/* UI MODAL - BLUE THEME */}
      <div className="no-print relative flex h-[96vh] w-full max-w-[98%] flex-col overflow-hidden rounded-[2.5rem] bg-[#020617] border border-white/10 shadow-2xl">

        {/* HEADER */}
        <div className="flex items-center justify-between px-10 py-6 border-b shrink-0 border-white/5">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-2xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
              <FaBox size={22} />
            </div>
            <div>
              <h2 className="text-3xl italic font-black leading-none tracking-tighter text-white uppercase">Sales <span className="text-[#3b82f6]">Per Item</span></h2>
              <div className="mt-1 flex items-center gap-2 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                <span>CNC - STA MARIA</span> <FaArrowRight size={7} /> <span>{dateFrom} — {dateTo}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="h-11 px-5 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2">
              <FaPrint size={12} /> Print
            </button>
            <button onClick={exportToExcel} className="h-11 px-5 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2">
              <FaFileExcel size={12} /> Excel
            </button>
            <button onClick={onClose} className="flex items-center justify-center text-white transition-all border h-11 w-11 rounded-xl bg-white/5 hover:bg-rose-600 border-white/10"><FaTimes size={18} /></button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="px-10 py-3 flex gap-3 items-center shrink-0 bg-[#050a18]/40 border-b border-white/5">
          <div className="relative flex-1 group">
            <FaSearch className="absolute -translate-y-1/2 left-5 top-1/2 text-slate-600" size={14} />
            <input
              type="text"
              placeholder="Search items..."
              className="w-full text-sm font-bold text-white bg-transparent border-none outline-none h-11 placeholder:text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchSales} className="flex items-center justify-center transition-colors h-11 w-11 rounded-xl text-slate-500 hover:text-white"><FaSyncAlt className={loading ? 'animate-spin' : ''} size={14} /></button>
          <button onClick={() => setShowFilter(true)} className="h-11 px-6 flex items-center gap-2 rounded-xl bg-[#3b82f6] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:brightness-110 transition-all"><FaFilter size={12} /> Filter</button>
        </div>

        {/* DATA TABLE */}
        <div className="flex-1 px-10 py-4 overflow-hidden">
          <div className="h-full overflow-auto rounded-3xl bg-[#050a18] border border-white/5 relative custom-scrollbar shadow-inner">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-[50]">
                <tr className="bg-[#0a0f1e]/95 backdrop-blur-md text-slate-500 text-[9px] font-black uppercase tracking-widest">
                  <th className="p-5 border-b border-white/5">Code</th>
                  <th className="p-5 border-b border-white/5">Item Description</th>
                  <th className="p-5 text-center border-b border-white/5">Type</th>
                  <th className="p-5 text-center border-b border-white/5">Qty</th>
                  <th className="p-5 text-right border-b border-white/5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] font-bold text-slate-400">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors text-[13px]">
                    <td className="p-5 font-mono text-xs text-slate-600">{item.Code}</td>
                    <td className="p-5 uppercase text-slate-200">{item["Product Name"]}</td>
                    <td className="p-5 text-center text-[10px] uppercase opacity-40">{item["Item Type"]}</td>
                    <td className="p-5 text-lg italic font-black text-center text-white">{parseFloat(item["Total Qty Sold"]).toLocaleString()}</td>
                    <td className="p-5 text-right text-xl font-black text-[#3b82f6] italic tracking-tighter">
                      ₱{parseFloat(item["Gross Sales"]).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-10 py-6 border-t bg-black/30 border-white/5 shrink-0">
          <div className="flex gap-10">
            <div><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Items Sold</p><p className="text-2xl italic font-black leading-none text-white">{totalQty.toLocaleString()}</p></div>
            <div className="h-8 w-[1px] bg-white/5 self-center"></div>
            <div><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Branch</p><p className="text-2xl italic font-black leading-none text-white">STA MARIA</p></div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#3b82f6] mb-1">Grand Total Sales</p>
            <h3 className="text-5xl italic font-black leading-none tracking-tighter text-white">₱{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        {/* SIDEBAR FILTER */}
        {showFilter && (
          <div className="absolute inset-y-0 right-0 w-[380px] bg-[#0a0f1e] border-l border-white/10 z-[100001] p-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-10 shrink-0">
              <h3 className="text-2xl italic font-black tracking-tighter text-white uppercase">Report <span className="text-[#3b82f6]">Dates</span></h3>
              <button onClick={() => setShowFilter(false)} className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 text-slate-500 hover:text-white"><FaTimes size={18} /></button>
            </div>
            <div className="flex-1 space-y-6">
              <div className="relative">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Start Date</label>
                <button onClick={() => { setOpenStartCal(!openStartCal); setOpenEndCal(false); }} className="w-full h-16 rounded-2xl bg-white/[0.03] border border-white/10 px-6 text-left flex items-center justify-between group hover:border-[#3b82f6]/50 transition-all">
                  <span className="text-lg font-black text-white italic group-hover:text-[#3b82f6]">{dateFrom}</span>
                  <FaChevronDown className="text-slate-700" size={10} />
                </button>
                <CustomCalendar selectedDate={dateFrom} onChange={setDateFrom} isOpen={openStartCal} onClose={() => setOpenStartCal(false)} />
              </div>
              <div className="relative">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">End Date</label>
                <button onClick={() => { setOpenEndCal(!openEndCal); setOpenStartCal(false); }} className="w-full h-16 rounded-2xl bg-white/[0.03] border border-white/10 px-6 text-left flex items-center justify-between group hover:border-[#3b82f6]/50 transition-all">
                  <span className="text-lg font-black text-white italic group-hover:text-[#3b82f6]">{dateTo}</span>
                  <FaChevronDown className="text-slate-700" size={10} />
                </button>
                <CustomCalendar selectedDate={dateTo} onChange={setDateTo} isOpen={openEndCal} onClose={() => setOpenEndCal(false)} />
              </div>
            </div>
            <button onClick={() => { fetchSales(); setShowFilter(false); }} className="w-full py-6 bg-[#3b82f6] text-white font-black rounded-2xl shadow-xl hover:brightness-110 transition-all uppercase tracking-widest text-[10px] mt-6 italic">Update Report</button>
          </div>
        )}
      </div>

      {/* --- CENTERED THERMAL RECEIPT --- */}
      <div id="thermal-receipt">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '16px', margin: '0', fontWeight: 'bold' }}>CNC - STA MARIA</h2>
          <p style={{ fontSize: '10px', margin: '2px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Sales Per Item</p>
          <div style={{ fontSize: '9px', margin: '4px 0', borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '4px 0' }}>
            {dateFrom} TO {dateTo}
          </div>
        </div>

        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th align="left" style={{ paddingBottom: '4px', width: '60%' }}>ITEM</th>
              <th align="center" style={{ paddingBottom: '4px', width: '15%' }}>QTY</th>
              <th align="right" style={{ paddingBottom: '4px', width: '25%' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: '4px 0', fontSize: '9px', verticalAlign: 'top', textTransform: 'uppercase' }}>
                  {item["Product Name"]}
                </td>
                <td align="center" style={{ padding: '4px 0', verticalAlign: 'top' }}>{parseFloat(item["Total Qty Sold"])}</td>
                <td align="right" style={{ padding: '4px 0', verticalAlign: 'top', fontWeight: 'bold' }}>
                  {parseFloat(item["Gross Sales"]).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px solid black', marginTop: '8px', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
            <span>TOTAL QTY:</span>
            <span>{totalQty.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
            <span>GRAND TOTAL:</span>
            <span>₱{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '15px' }}>
            <p style={{ margin: '0' }}>Printed: {new Date().toLocaleString()}</p>
            <p style={{ marginTop: '8px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '5px' }}>*** END OF REPORT ***</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.3); }
      `}</style>
    </div>
  );
};

export default SalesPerProductModal;