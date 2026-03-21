import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  FaHistory, FaSearch, FaSyncAlt, FaTimes, 
  FaFileExcel, FaFilter, FaEye, FaArrowRight,
  FaChevronDown, FaChevronLeft, FaChevronRight,
  FaCheckCircle, FaBan, FaUndo, FaListUl, FaReceipt, FaBoxOpen
} from "react-icons/fa";
import * as XLSX from "xlsx";
// ✅ Import Theme
import { useTheme } from "../../../context/ThemeContext";

// --- 1. CUSTOM DROP-DOWN CALENDAR ---
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
    <div ref={calendarRef} className={`absolute top-full left-0 mt-2 w-[300px] rounded-2xl border p-5 shadow-2xl z-[100005] animate-in fade-in zoom-in duration-150
      ${isDark ? "bg-[#050a18] border-white/10" : "bg-white border-slate-200"}`}>
      <div className={`flex items-center justify-between px-1 mb-4 ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>
        <h4 className="text-sm italic font-black">{monthNames[currentView.getMonth()]} {currentView.getFullYear()}</h4>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1)); }} className={`h-7 w-7 flex items-center justify-center rounded-lg ${isDark ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white"}`}><FaChevronLeft size={10}/></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1)); }} className={`h-7 w-7 flex items-center justify-center rounded-lg ${isDark ? "bg-white/5 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white"}`}><FaChevronRight size={10}/></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2 text-center text-[8px] font-black text-slate-400 uppercase italic">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => <div key={i}></div>)}
        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map((_, i) => {
          const day = i + 1;
          const dateString = new Date(currentView.getFullYear(), currentView.getMonth(), day + 1).toISOString().split('T')[0];
          return (
            <button key={day} onClick={(e) => { e.stopPropagation(); onChange(dateString); onClose(); }}
              className={`h-8 w-full rounded-lg font-bold text-[10px] transition-all ${dateString === selectedDate ? 'bg-[#3b82f6] text-white shadow-md' : isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- 2. VIEW DETAILS MODAL ---
const DetailsModal = ({ transaction, isOpen, onClose, isDark }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setLoading(true);
      fetch(`http://localhost/api/get_transaction_items.php?id=${transaction.transaction_id}`)
        .then(res => res.json())
        .then(res => {
          if (res.success) setItems(res.data);
          else setItems([]);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, transaction]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[200000] flex items-center justify-center p-4 animate-in fade-in duration-200 ${isDark ? "bg-black/80 backdrop-blur-sm" : "bg-slate-900/40 backdrop-blur-sm"}`}>
      <div className={`w-full max-w-lg border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-all
        ${isDark ? "bg-[#0a0f1e] border-white/10" : "bg-white border-slate-200"}`}>
        
        <div className={`p-8 border-b flex justify-between items-center ${isDark ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100"}`}>
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${isDark ? "bg-blue-500/10 text-blue-500" : "bg-blue-100 text-blue-600"}`}><FaBoxOpen size={18}/></div>
            <div>
              <h3 className={`text-xl italic font-black leading-none tracking-tighter uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>Order <span className="text-blue-500">Items</span></h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ref: #{transaction.transaction_id}</p>
            </div>
          </div>
          <button onClick={onClose} className={`flex items-center justify-center w-10 h-10 transition-all rounded-xl ${isDark ? "bg-white/5 text-slate-500 hover:bg-rose-600 hover:text-white" : "bg-slate-200 text-slate-500 hover:bg-rose-600 hover:text-white shadow-sm"}`}><FaTimes/></button>
        </div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-20 text-xs italic font-black tracking-widest text-center uppercase text-slate-400 animate-pulse">Loading list...</div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isDark ? "bg-white/[0.02] border-white/5" : "bg-slate-50/50 border-slate-100"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-[11px] font-black italic border ${isDark ? "bg-white/5 text-blue-400 border-white/5" : "bg-white text-blue-600 border-slate-200 shadow-sm"}`}>{item.sales_quantity}x</div>
                    <div>
                      <p className={`text-sm italic font-black uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{item.item_name}</p>
                      <p className="text-[10px] text-slate-500 font-bold italic">₱{parseFloat(item.selling_price).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`text-sm italic font-black ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>₱{parseFloat(item.subtotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-xs italic font-black tracking-widest text-center uppercase text-slate-400">No items found in records</div>
          )}
        </div>

        <div className={`p-8 space-y-4 border-t transition-all ${isDark ? "bg-black/40 border-white/5" : "bg-slate-50 border-slate-100 shadow-inner"}`}>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest italic"><span>Gross</span><span className={`${isDark ? "text-slate-400" : "text-slate-600"}`}>₱{parseFloat(transaction.TotalSales).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="flex justify-between text-[9px] font-black uppercase text-rose-500 tracking-widest italic"><span>Less</span><span>-₱{parseFloat(transaction.Discount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className={`pt-2 flex justify-between text-[9px] font-black uppercase tracking-widest italic border-t ${isDark ? "text-slate-600 border-white/5" : "text-slate-400 border-slate-200"}`}><span>Mode</span><span className="text-blue-500">{transaction.payment_method}</span></div>
              </div>
              <div className="flex flex-col justify-end text-right">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 italic">Amount Paid</p>
                <h4 className={`text-4xl italic font-black leading-none tracking-tighter ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>₱{parseFloat(transaction.TotalAmountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</h4>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. MAIN TRANSACTIONS MODAL ---
const TransactionsModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewingTransaction, setViewingTransaction] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/read_transaction_records.php?dateFrom=${dateFrom}&dateTo=${dateTo}&search=${searchTerm}&recordStatus=${statusFilter}`);
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (error) { console.error("Fetch error:", error); } 
    finally { setLoading(false); }
  }, [dateFrom, dateTo, searchTerm, statusFilter]);

  useEffect(() => { if (isOpen) fetchData(); }, [isOpen, fetchData]);

  const totalCollected = useMemo(() => {
    return data.reduce((sum, item) => sum + parseFloat(item.TotalAmountDue || 0), 0);
  }, [data]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `CNC_Records_${dateFrom}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center backdrop-blur-md p-2 font-sans overflow-hidden transition-all duration-300
      ${isDark ? "bg-[#020617]/95" : "bg-slate-500/40"}`}>
      <div className={`relative flex h-[98vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl transition-all duration-300
        ${isDark ? "bg-[#020617] border-white/10" : "bg-[#f8fafc] border-white"}`}>
        
        {/* HEADER */}
        <div className={`flex items-center justify-between px-10 py-6 border-b shrink-0 transition-all ${isDark ? "border-white/5" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-6">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg ${isDark ? "bg-[#3b82f6]/10 text-[#3b82f6] shadow-blue-500/10" : "bg-blue-50 text-blue-600 shadow-blue-100"}`}><FaHistory size={22} /></div>
            <div>
              <h2 className={`text-3xl italic font-black leading-none tracking-tighter uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>Transaction <span className="text-[#3b82f6]">Records</span></h2>
              <p className="mt-1 text-[9px] font-black uppercase text-slate-500 tracking-widest italic">CNC - STA MARIA | System Data</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={exportExcel} className={`h-11 px-6 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2
               ${isDark ? "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm"}`}>
               <FaFileExcel size={14} className="text-emerald-500"/> Export
             </button>
             <button onClick={onClose} className={`flex items-center justify-center transition-all border h-11 w-11 rounded-xl ${isDark ? "bg-white/5 text-white hover:bg-rose-600 border-white/10" : "bg-white text-slate-400 hover:text-rose-600 border-slate-200 shadow-sm"}`}><FaTimes size={18}/></button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className={`px-10 py-3 flex gap-4 items-center shrink-0 border-b transition-all ${isDark ? "bg-[#050a18]/40 border-white/5" : "bg-slate-100 border-slate-200"}`}>
          <div className={`relative flex-1 group h-11 flex items-center rounded-xl px-5 border transition-all ${isDark ? "bg-transparent border-transparent" : "bg-white border-slate-200 shadow-inner"}`}>
            <FaSearch className={`mr-4 transition-colors ${isDark ? "text-slate-700 group-focus-within:text-blue-500" : "text-slate-400 group-focus-within:text-blue-600"}`} size={14}/>
            <input 
              type="text" placeholder="Search invoices, tables, or transaction IDs..." 
              className={`w-full text-sm font-bold bg-transparent border-none outline-none h-full ${isDark ? "text-white placeholder:text-slate-800" : "text-[#2e4a7d] placeholder:text-slate-300"}`}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
          </div>
          <button onClick={fetchData} className={`flex items-center justify-center transition-colors h-11 w-11 rounded-xl ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-blue-600 bg-white border border-slate-200 shadow-sm"}`}>
            <FaSyncAlt className={loading ? 'animate-spin' : ''} size={14}/>
          </button>
          <button onClick={() => setShowFilter(true)} className="h-11 px-8 flex items-center gap-2 rounded-xl bg-[#3b82f6] text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all">
            <FaFilter size={12}/> Filter Records
          </button>
        </div>

        {/* MAIN TABLE */}
        <div className="flex-1 px-10 py-4 overflow-hidden">
          <div className={`h-full overflow-auto rounded-3xl border relative custom-scrollbar transition-all ${isDark ? "bg-[#050a18] border-white/5" : "bg-white border-slate-200 shadow-inner"}`}>
            <table className="w-full text-left border-separate border-spacing-0 min-w-[1700px]">
              <thead className="sticky top-0 z-[50]">
                <tr className={`${isDark ? "bg-[#0a0f1e]/95 text-slate-500" : "bg-slate-50 text-slate-400"} backdrop-blur-md text-[9px] font-black uppercase tracking-widest italic`}>
                  <th className={`p-5 sticky left-0 z-[60] border-b ${isDark ? "bg-[#0a0f1e] border-white/5" : "bg-slate-50 border-slate-200"}`}>ID</th>
                  <th className={`p-5 border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Invoice / Slip</th>
                  <th className={`p-5 text-center border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Timestamp</th>
                  <th className={`p-5 border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Table</th>
                  <th className={`p-5 text-right border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Gross</th>
                  <th className={`p-5 text-right border-b text-rose-500 ${isDark ? "border-white/5" : "border-slate-200"}`}>Disc.</th>
                  <th className={`p-5 border-b text-right ${isDark ? "border-white/5 bg-white/[0.01]" : "border-slate-200 bg-blue-50/30"}`}>Net Due</th>
                  <th className={`p-5 text-center border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Method</th>
                  <th className={`p-5 text-center border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>Status</th>
                  <th className={`p-5 text-center border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>View</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-bold transition-all ${isDark ? "divide-white/[0.03] text-slate-400" : "divide-slate-100 text-slate-600"}`}>
                {data.map((row, idx) => (
                  <tr key={idx} className={`transition-colors text-[13px] ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-blue-50/50"}`}>
                    <td className={`p-5 sticky left-0 z-[40] border-r font-black transition-all ${isDark ? "bg-[#050a18] text-[#3b82f6] border-white/5" : "bg-white text-blue-600 border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"}`}>#{row.transaction_id}</td>
                    <td className="p-5">
                       <div className={`italic ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>INV: {row.invoice_no || '---'}</div>
                       <div className="text-[10px] text-slate-500 uppercase italic">Slip: {row.order_slip_no || '---'}</div>
                    </td>
                    <td className="p-5 text-center">
                       <div className={isDark ? "text-slate-300" : "text-slate-600"}>{row.transaction_date}</div>
                       <div className="text-[10px] text-slate-400 font-medium">{row.transaction_time}</div>
                    </td>
                    <td className={`p-5 italic uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}>{row.table_number || 'Take-out'}</td>
                    <td className={`p-5 italic text-right ${isDark ? "text-slate-500" : "text-slate-600"}`}>₱{parseFloat(row.TotalSales).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-5 italic font-black text-right text-rose-500/60">-{parseFloat(row.Discount).toLocaleString()}</td>
                    <td className={`p-5 text-right text-xl font-black italic tracking-tighter transition-all ${isDark ? "text-white bg-white/[0.01]" : "text-[#2e4a7d] bg-blue-50/30"}`}>
                      ₱{parseFloat(row.TotalAmountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="p-5 text-center">
                       <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase italic ${row.payment_method === 'Cash' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                         {row.payment_method}
                       </span>
                    </td>
                    <td className="p-5 text-center">
                       <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase italic shadow-sm ${
                         row.status === 'Paid' ? 'bg-emerald-600 text-white' : 
                         row.status.includes('Void') ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                       }`}>
                         {row.status}
                       </span>
                    </td>
                    <td className="p-5 text-center">
                      <button onClick={() => setViewingTransaction(row)} className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-inner mx-auto ${isDark ? "bg-white/5 text-blue-500 hover:bg-[#3b82f6] hover:text-white" : "bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white"}`}><FaEye size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER STATS */}
        <div className={`flex items-center justify-between px-10 py-6 border-t shrink-0 transition-all ${isDark ? "bg-black/40 border-white/5" : "bg-white border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]"}`}>
          <div className="flex gap-10">
            <div><p className={`text-[8px] font-black uppercase tracking-widest mb-1 italic ${isDark ? "text-slate-600" : "text-slate-400"}`}>Transactions</p><p className={`text-2xl italic font-black leading-none ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>{data.length}</p></div>
            <div className={`h-8 w-[1px] self-center ${isDark ? "bg-white/5" : "bg-slate-200"}`}></div>
            <div><p className={`text-[8px] font-black uppercase tracking-widest mb-1 italic ${isDark ? "text-slate-600" : "text-slate-400"}`}>Calculated Revenue</p><p className={`text-2xl italic font-black ${isDark ? "text-[#3b82f6]" : "text-blue-600"}`}>₱{totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className={`text-[10px] font-black uppercase tracking-[0.2em] italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>Archive Access Online</p>
          </div>
        </div>

        {/* SIDEBAR FILTER */}
        {showFilter && (
          <div className={`absolute inset-y-0 right-0 w-[400px] border-l z-[100001] p-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 transition-all
            ${isDark ? "bg-[#0a0f1e] border-white/10" : "bg-white border-slate-200"}`}>
            <div className="flex items-center justify-between mb-10 shrink-0">
              <h3 className={`text-2xl italic font-black tracking-tighter uppercase ${isDark ? "text-white" : "text-[#2e4a7d]"}`}>Advanced <span className="text-[#3b82f6]">Filter</span></h3>
              <button onClick={() => setShowFilter(false)} className={`flex items-center justify-center w-10 h-10 transition-colors rounded-xl ${isDark ? "bg-white/5 text-slate-500 hover:text-white" : "bg-slate-100 text-slate-400 hover:text-rose-600"}`}><FaTimes size={18}/></button>
            </div>
            
            <div className="flex-1 pr-2 space-y-10 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block ml-1 italic">Transaction Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{id:'All',icon:<FaListUl/>,label:'Show All'},{id:'Active',icon:<FaCheckCircle/>,label:'Paid Only'},{id:'Void',icon:<FaBan/>,label:'Voided Records'},{id:'Refund',icon:<FaUndo/>,label:'Refunds'}].map((s) => (
                    <button key={s.id} onClick={() => setStatusFilter(s.id)} className={`flex flex-col items-start p-4 rounded-2xl border transition-all ${statusFilter === s.id ? 'bg-[#3b82f6] border-[#3b82f6] text-white shadow-lg' : isDark ? 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                      <span className={`mb-2 text-lg ${statusFilter === s.id ? 'text-white' : 'text-[#3b82f6]'}`}>{s.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-tighter italic">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1 italic">From Date</label>
                  <button onClick={() => { setOpenStartCal(!openStartCal); setOpenEndCal(false); }} className={`w-full h-16 rounded-2xl border px-6 text-left flex items-center justify-between group transition-all shadow-inner ${isDark ? "bg-white/[0.03] border-white/10 hover:border-[#3b82f6]/50" : "bg-slate-50 border-slate-200 hover:border-blue-400"}`}>
                    <span className={`text-lg font-black italic transition-colors ${statusFilter === 'All' && !isDark ? 'text-[#2e4a7d]' : isDark ? 'text-white group-hover:text-[#3b82f6]' : 'text-[#2e4a7d] group-hover:text-blue-600'}`}>{dateFrom}</span>
                    <FaChevronDown className="text-slate-500" size={10}/>
                  </button>
                  <CustomCalendar selectedDate={dateFrom} onChange={setDateFrom} isOpen={openStartCal} onClose={() => setOpenStartCal(false)} isDark={isDark} />
                </div>
                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1 italic">To Date</label>
                  <button onClick={() => { setOpenEndCal(!openEndCal); setOpenStartCal(false); }} className={`w-full h-16 rounded-2xl border px-6 text-left flex items-center justify-between group transition-all shadow-inner ${isDark ? "bg-white/[0.03] border-white/10 hover:border-[#3b82f6]/50" : "bg-slate-50 border-slate-200 hover:border-blue-400"}`}>
                    <span className={`text-lg font-black italic transition-colors ${isDark ? "text-white group-hover:text-[#3b82f6]" : "text-[#2e4a7d] group-hover:text-blue-600"}`}>{dateTo}</span>
                    <FaChevronDown className="text-slate-500" size={10}/>
                  </button>
                  <CustomCalendar selectedDate={dateTo} onChange={setDateTo} isOpen={openEndCal} onClose={() => setOpenEndCal(false)} isDark={isDark} />
                </div>
              </div>
            </div>

            <button onClick={() => { fetchData(); setShowFilter(false); }} className={`w-full py-6 font-black rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest text-[11px] mt-8 italic ${isDark ? "bg-[#3b82f6] text-white shadow-blue-500/20" : "bg-blue-600 text-white shadow-blue-200"}`}>Apply Filters</button>
          </div>
        )}

        <DetailsModal 
          transaction={viewingTransaction} 
          isOpen={!!viewingTransaction} 
          onClose={() => setViewingTransaction(null)} 
          isDark={isDark}
        />
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: ${isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(0, 0, 0, 0.05)"}; 
          border-radius: 10px; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
          background: ${isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.5)"}; 
        }
      `}</style>
    </div>
  );
};

export default TransactionsModal;