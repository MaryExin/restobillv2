"use client";
import React, { useState, useEffect } from "react";
import { FiPlus, FiShoppingBag, FiActivity, FiArrowDownLeft, FiX, FiLayers } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosExpenses = ({ isDark, accent = "#3b82f6" }) => {
  const [ledgerData, setLedgerData] = useState([]);
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "Supplies", description: "", amount: "" });
  const [pettyForm, setPettyForm] = useState({ description: "", amount: "" });

  const fetchLedger = async () => {
    try {
      const res = await fetch("http://localhost/api/pos_ledger_api.php?action=get_ledger");
      const result = await res.json();
      if (result.status === "success") setLedgerData(result.data || []);
    } catch (e) { console.error("Fetch error:", e); }
  };

  useEffect(() => { fetchLedger(); }, []);

  const handleAction = async (type, formObj, setFormObj, isModal = false) => {
    if (!formObj.description || !formObj.amount) return;

    // Kunin ang email base sa Screenshot logic (direct key)
    const userEmail = localStorage.getItem("email") || "Unknown";

    const payload = {
      type,
      category: formObj.category || "General",
      description: formObj.description,
      amount: parseFloat(formObj.amount),
      recorded_by: userEmail
    };

    try {
      const res = await fetch("http://localhost/api/pos_ledger_api.php?action=add_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if ((await res.json()).status === "success") {
        fetchLedger();
        setFormObj({ category: "Supplies", description: "", amount: "" });
        if (isModal) setIsPettyModalOpen(false);
      }
    } catch (e) { console.error("Save error:", e); }
  };

  const activeLogs = ledgerData.filter(i => i.status === 'active');
  const totalIn = activeLogs.filter(i => i.entry_type === 'IN').reduce((a, b) => a + parseFloat(b.amount), 0);
  const totalOut = activeLogs.filter(i => i.entry_type === 'OUT').reduce((a, b) => a + parseFloat(b.amount), 0);

  const theme = {
    card: isDark ? "bg-white/5 border-white/10 shadow-2xl backdrop-blur-md" : "bg-white border-slate-200 shadow-sm",
    input: isDark ? "bg-white/10 border-white/20 text-white placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-slate-900",
    text: isDark ? "text-white" : "text-slate-900"
  };

  return (
    <div className={`w-full max-w-6xl p-6 mx-auto space-y-8 ${theme.text}`}>
      
      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className={`p-8 rounded-[40px] border ${theme.card}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Petty Cash In</span>
            <button onClick={() => setIsPettyModalOpen(true)} className="p-2 text-white rounded-xl" style={{backgroundColor: accent}}><FiPlus/></button>
          </div>
          <h4 className="text-4xl font-black">₱{totalIn.toLocaleString()}</h4>
        </div>
        <div className={`p-8 rounded-[40px] border ${theme.card}`}>
          <span className="block text-[10px] font-black uppercase text-red-500 tracking-widest mb-4">Total Expenses</span>
          <h4 className="text-4xl font-black text-red-500">₱{totalOut.toLocaleString()}</h4>
        </div>
        <div className={`p-8 rounded-[40px] border ${theme.card}`}>
          <span className="block text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Remaining</span>
          <h4 className="text-4xl font-black" style={{color: accent}}>₱{(totalIn - totalOut).toLocaleString()}</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* EXPENSE FORM WITH DROPDOWN */}
        <div className={`lg:col-span-4 p-8 rounded-[40px] border h-fit ${theme.card}`}>
          <h5 className="font-black text-[10px] uppercase opacity-40 mb-6 tracking-widest flex items-center gap-2">
            <FiLayers size={12}/> New Expense
          </h5>
          <div className="space-y-4">
            {/* IBINALIK NA DROPDOWN CATEGORY */}
            <select 
              className={`w-full p-4 rounded-2xl border font-bold uppercase text-[11px] outline-none ${theme.input}`}
              value={expenseForm.category}
              onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
            >
              <option value="Supplies">🛒 Supplies</option>
              <option value="Staff Meals">🍱 Staff Meals</option>
              <option value="Utilities">⚡ Utilities</option>
              <option value="Maintenance">🛠️ Maintenance</option>
              <option value="Marketing">📢 Marketing</option>
              <option value="Others">📝 Others</option>
            </select>

            <input 
              type="text" 
              placeholder="DESCRIPTION" 
              className={`w-full p-4 rounded-2xl border font-bold uppercase text-[11px] outline-none ${theme.input}`} 
              value={expenseForm.description} 
              onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
            />
            
            <input 
              type="number" 
              placeholder="0.00" 
              className={`w-full p-6 rounded-2xl border text-3xl font-black text-center outline-none ${theme.input}`} 
              value={expenseForm.amount} 
              onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
            />
            
            <button 
              onClick={() => handleAction('OUT', expenseForm, setExpenseForm)} 
              className="w-full py-5 rounded-3xl text-white font-black uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95 shadow-lg" 
              style={{backgroundColor: accent}}
            >
              Commit Expense
            </button>
          </div>
        </div>

        {/* LOGS */}
        <div className="lg:col-span-8 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
          {ledgerData.map(item => (
            <div key={item.id} className={`p-5 rounded-[30px] border flex justify-between items-center group transition-all ${theme.card}`}>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white ${item.entry_type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  {item.entry_type === 'IN' ? <FiArrowDownLeft/> : <FiShoppingBag/>}
                </div>
                <div>
                  <div className="mb-1 text-xs font-black leading-tight uppercase">{item.description}</div>
                  <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">
                    {item.category} • {item.entry_time} • {item.display_name}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-black ${item.entry_type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                ₱{parseFloat(item.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PETTY CASH MODAL */}
      <AnimatePresence>
        {isPettyModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className={`w-full max-w-sm p-10 rounded-[50px] border ${isDark ? 'bg-slate-900 border-white/10 shadow-2xl' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-8">
                <h6 className="font-black uppercase tracking-widest text-[10px]">Petty Cash In</h6>
                <button onClick={() => setIsPettyModalOpen(false)} className="opacity-50 hover:opacity-100"><FiX size={20}/></button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="SOURCE / REMARKS" className={`w-full p-4 rounded-2xl border font-bold uppercase text-[11px] ${theme.input}`} value={pettyForm.description} onChange={e => setPettyForm({...pettyForm, description: e.target.value})} />
                <input type="number" placeholder="0.00" className={`w-full p-8 rounded-2xl border text-4xl font-black text-center outline-none ${theme.input}`} value={pettyForm.amount} onChange={e => setPettyForm({...pettyForm, amount: e.target.value})} />
                <button onClick={() => handleAction('IN', pettyForm, setPettyForm, true)} className="w-full py-6 font-black tracking-widest text-white uppercase rounded-3xl" style={{backgroundColor: accent}}>Add to Drawer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosExpenses;