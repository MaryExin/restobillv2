"use client";

import React, { useState, useEffect } from "react";
import { 
  FiPlus, FiShoppingBag, FiX, FiTrash2, FiActivity, FiArrowDownLeft, FiAlertCircle, FiDownload, FiPrinter 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosExpenses = ({ isDark, accent = "#3b82f6", branchInfo }) => {
  const [ledgerData, setLedgerData] = useState([]);
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [voidModal, setVoidModal] = useState({ isOpen: false, id: null, reason: "" });
  const [exportModal, setExportModal] = useState({ isOpen: false, date: new Date().toISOString().split('T')[0] });
  
  const [expenseForm, setExpenseForm] = useState({ category: "Supplies", description: "", amount: "" });
  const [pettyForm, setPettyForm] = useState({ description: "", amount: "" });

  const theme = {
    card: isDark ? "bg-white/5 border-white/10 shadow-2xl backdrop-blur-md" : "bg-white border-slate-100 shadow-sm",
    input: isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-slate-900",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    modalBg: isDark ? "bg-[#0f172a] border-white/10 shadow-2xl" : "bg-white border-slate-200 shadow-xl",
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch("http://localhost/api/pos_ledger_api.php?action=get_ledger");
      const result = await res.json();
      if (result.status === "success") setLedgerData(Array.isArray(result.data) ? result.data : []);
    } catch (e) { setLedgerData([]); }
  };

  useEffect(() => { fetchLedger(); }, []);

  const handleAction = async (type, form, setForm, isModal = false) => {
    if (!form.description || !form.amount || form.amount <= 0) return;
    
    const payload = {
      type,
      category: form.category || "General",
      description: form.description,
      amount: Math.abs(parseFloat(form.amount)), 
      recorded_by: branchInfo ? branchInfo.firstName : "Admin"
    };

    try {
      const res = await fetch("http://localhost/api/pos_ledger_api.php?action=add_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if ((await res.json()).status === "success") {
        fetchLedger();
        setForm({ category: "Supplies", description: "", amount: "" });
        if (isModal) setIsPettyModalOpen(false);
      }
    } catch (e) { console.error(e); }
  };

  const executeVoid = async () => {
    if (!voidModal.reason) return;
    try {
      await fetch("http://localhost/api/pos_ledger_api.php?action=void_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: voidModal.id, void_reason: voidModal.reason })
      });
      fetchLedger();
      setVoidModal({ isOpen: false, id: null, reason: "" });
    } catch (e) { console.error(e); }
  };

  const activeEntries = ledgerData.filter((i) => i.status === 'active');
  const totalIn = activeEntries.filter((i) => i.entry_type === 'IN').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalOut = activeEntries.filter((i) => i.entry_type === 'OUT').reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  const sortedLedger = [...ledgerData].sort((a, b) => {
    if (a.entry_type === b.entry_type) {
      return new Date(b.entry_time) - new Date(a.entry_time); 
    }
    return a.entry_type === 'IN' ? -1 : 1; 
  });

  return (
    <div className="w-full max-w-6xl p-4 mx-auto space-y-10">
      
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-emerald-500 bg-emerald-500/10 w-fit px-4 py-1.5 rounded-full border border-emerald-500/20">
            <FiActivity size={14} className="animate-pulse" />
            <span className="font-black text-[9px] uppercase tracking-[0.2em]">Live Shift Ledger</span>
          </div>
          <h2 className={`text-5xl font-black uppercase tracking-tighter leading-none ${theme.textPrimary}`}>
            Expense <span style={{ color: accent }}>Manager</span>
          </h2>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => setExportModal({ isOpen: true, date: new Date().toISOString().split('T')[0] })}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all active:scale-95"
            style={{ backgroundColor: accent }}
          >
            <FiDownload size={14} /> Export & Reports
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className={`p-8 rounded-[40px] border ${theme.card}`}>
          <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Petty Cash In</span>
              <button onClick={() => setIsPettyModalOpen(true)} className="p-3 text-white transition-transform shadow-lg rounded-2xl hover:scale-110 active:scale-90" style={{backgroundColor: accent}}><FiPlus/></button>
          </div>
          <h4 className={`text-4xl font-black tracking-tighter ${theme.textPrimary}`}>₱{totalIn.toLocaleString()}</h4>
        </div>
        <div className={`p-8 rounded-[40px] border ${theme.card}`}>
          <span className="block text-[10px] font-black uppercase mb-6 opacity-40 text-red-500 tracking-widest">Total Expenses</span>
          <h4 className="text-4xl font-black tracking-tighter text-red-500">₱{totalOut.toLocaleString()}</h4>
        </div>
        <div className={`p-8 rounded-[40px] border ${theme.card}`} style={{borderColor: accent + "40"}}>
          <span className="block text-[10px] font-black uppercase mb-6 opacity-40 tracking-widest" style={{color: accent}}>Rem. Cash</span>
          <h4 className="text-4xl font-black tracking-tighter" style={{color: accent}}>₱{(totalIn - totalOut).toLocaleString()}</h4>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className={`lg:col-span-4 p-8 rounded-[45px] border h-fit ${theme.card}`}>
          <h4 className="font-black text-[10px] uppercase tracking-[0.3em] mb-8 opacity-40">Log Entry</h4>
          <div className="space-y-4">
            <select value={expenseForm.category} onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})} className={`w-full p-5 rounded-[25px] border text-[11px] font-black uppercase outline-none transition-all ${theme.input}`}>
              <option value="Supplies">🛒 Supplies</option>
              <option value="Staff Meals">🍱 Staff Meals</option>
              <option value="Utilities">⚡ Utilities</option>
              <option value="Maintenance">🛠️ Maintenance</option>
            </select>
            <input type="text" placeholder="DESCRIPTION" value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} className={`w-full p-5 rounded-[25px] border text-[11px] font-black uppercase outline-none transition-all ${theme.input}`} />
            <input type="number" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} className={`w-full p-6 rounded-[25px] border text-3xl font-black text-center outline-none transition-all ${theme.input}`} />
            <button onClick={() => handleAction('OUT', expenseForm, setExpenseForm)} className="w-full py-6 rounded-[30px] text-white font-black text-[11px] uppercase tracking-[0.4em] shadow-xl hover:brightness-110 transition-all active:scale-95" style={{backgroundColor: accent}}>Commit Record</button>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {sortedLedger.length === 0 ? (
            <div className={`py-20 text-center opacity-20 font-black text-[10px] uppercase tracking-[0.5em] ${theme.textPrimary}`}>Waiting for shift logs...</div>
          ) : (
            sortedLedger.map((item, index) => {
              const showInHeader = item.entry_type === 'IN' && index === 0;
              const showOutHeader = item.entry_type === 'OUT' && (index === 0 || sortedLedger[index-1].entry_type === 'IN');

              return (
                <React.Fragment key={item.id}>
                  {showInHeader && <div className="pl-4 pb-2 text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em]">Cash Inflow</div>}
                  {showOutHeader && <div className="pl-4 py-4 text-[10px] font-black uppercase text-red-500 tracking-[0.3em] border-t border-white/5 mt-4">Expense Logs</div>}
                  
                  <div className={`p-6 rounded-[35px] border flex justify-between items-center group transition-all ${item.status === 'inactive' ? 'opacity-30 grayscale' : theme.card}`}>
                    <div className="flex items-center gap-5">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white ${item.entry_type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          {item.entry_type === 'IN' ? <FiArrowDownLeft/> : <FiShoppingBag/>}
                        </div>
                        <div>
                          <h6 className={`text-[12px] font-black uppercase tracking-tight ${theme.textPrimary} ${item.status === 'inactive' ? 'line-through opacity-50' : ''}`}>{item.description}</h6>
                          <p className={`text-[9px] font-bold opacity-40 uppercase tracking-tighter ${theme.textPrimary}`}>{item.entry_time} • {item.recorded_by} {item.status === 'inactive' && `• VOID: ${item.void_reason}`}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className={`text-xl font-black ${item.status === 'inactive' ? 'text-gray-400' : item.entry_type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                          ₱{parseFloat(item.amount).toLocaleString()}
                        </span>
                        {item.status === 'active' && (
                          <button onClick={() => setVoidModal({isOpen: true, id: item.id, reason: ""})} className="p-3 text-red-500 transition-all opacity-0 bg-red-500/10 rounded-2xl group-hover:opacity-100 hover:bg-red-500 hover:text-white active:scale-90"><FiTrash2/></button>
                        )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* MODALS SECTION */}
      <AnimatePresence>
        {exportModal.isOpen && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`w-full max-w-sm p-10 rounded-[50px] border ${theme.modalBg}`}>
              <div className="flex items-center justify-between mb-8">
                <h5 className={`font-black uppercase text-[12px] tracking-widest ${theme.textPrimary}`}>Report Archive</h5>
                <button onClick={() => setExportModal({ ...exportModal, isOpen: false })} className={`hover:rotate-90 transition-transform ${theme.textPrimary}`}><FiX size={20}/></button>
              </div>
              <p className={`text-[10px] font-black uppercase opacity-40 mb-2 tracking-[0.2em] ${theme.textPrimary}`}>Select Target Date</p>
              <input type="date" value={exportModal.date} onChange={(e) => setExportModal({ ...exportModal, date: e.target.value })} className={`w-full p-6 rounded-[30px] border text-xl font-black text-center outline-none mb-8 transition-all ${theme.input}`} />
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    window.open(`http://localhost/api/pos_ledger_api.php?action=export_ledger&date=${exportModal.date}`, '_blank');
                    setExportModal({ ...exportModal, isOpen: false });
                  }}
                  className="w-full py-6 rounded-[35px] text-white font-black uppercase tracking-[0.4em] shadow-xl hover:brightness-110 transition-all active:scale-95" 
                  style={{ backgroundColor: accent }}
                >
                  Download CSV
                </button>
                <button 
                  onClick={() => {
                    window.open(`http://localhost/api/pos_ledger_api.php?action=print_ledger&date=${exportModal.date}`, '_blank');
                    setExportModal({ ...exportModal, isOpen: false });
                  }}
                  className="w-full py-6 rounded-[35px] text-white font-black uppercase tracking-[0.4em] shadow-xl hover:brightness-110 transition-all active:scale-95 opacity-80 hover:opacity-100 flex items-center justify-center gap-2" 
                  style={{ backgroundColor: accent }}
                >
                  <FiPrinter size={16} /> Print Thermal
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {voidModal.isOpen && (
          <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`w-full max-w-md p-10 rounded-[50px] border ${theme.modalBg}`}>
              <div className="flex items-center justify-between mb-8">
                <h5 className="font-black uppercase text-red-500 text-[12px] tracking-widest">Authorization Required</h5>
                <button onClick={() => setVoidModal({ isOpen: false, id: null, reason: "" })} className={theme.textPrimary}><FiX size={20}/></button>
              </div>
              <textarea value={voidModal.reason} onChange={(e) => setVoidModal({ ...voidModal, reason: e.target.value })} className={`w-full p-5 rounded-[25px] border outline-none text-[11px] h-32 font-black uppercase resize-none mb-6 transition-all ${theme.input}`} placeholder="REASON FOR VOIDING..." />
              <button onClick={executeVoid} className="w-full py-6 rounded-[30px] bg-red-500 text-white font-black uppercase tracking-[0.4em] shadow-2xl transition-all hover:brightness-110 active:scale-95">Confirm Void</button>
            </motion.div>
          </div>
        )}

        {isPettyModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-full max-w-sm p-10 rounded-[50px] border ${theme.modalBg}`}>
              <div className="flex items-center justify-between mb-10">
                <h5 className={`font-black uppercase text-[12px] tracking-widest ${theme.textPrimary}`}>Cash Injection</h5>
                <button onClick={() => setIsPettyModalOpen(false)} className={theme.textPrimary}><FiX size={20}/></button>
              </div>
              <div className="space-y-4 text-center">
                <input type="text" placeholder="ENTRY LABEL" value={pettyForm.description} onChange={(e) => setPettyForm({ ...pettyForm, description: e.target.value })} className={`w-full p-5 rounded-[25px] border text-[11px] font-black uppercase outline-none transition-all ${theme.input}`} />
                <input type="number" placeholder="0.00" value={pettyForm.amount} onChange={(e) => setPettyForm({ ...pettyForm, amount: e.target.value })} className={`w-full p-8 rounded-[35px] border text-4xl font-black text-center outline-none transition-all ${theme.input}`} />
                <button onClick={() => handleAction('IN', pettyForm, setPettyForm, true)} className="w-full py-7 rounded-[35px] text-white font-black uppercase tracking-[0.4em] shadow-xl hover:brightness-110 transition-all active:scale-95" style={{ backgroundColor: accent }}>Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosExpenses;