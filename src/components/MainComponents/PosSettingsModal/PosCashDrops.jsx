"use client";

import React, { useState, useEffect } from "react";
import { 
  FiDollarSign, FiUser, FiClock, FiPlus, 
  FiCheckCircle, FiLoader, FiActivity, FiArrowDownCircle 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosCashDrops = ({ isDark, accent }) => {
  const [amount, setAmount] = useState("");
  const [remittedBy, setRemittedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saving | success

  // 1. FETCH DATA FROM LEDGER
  const fetchDrops = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost/api/pos_ledger_handler.php?action=get_ledger");
      const result = await res.json();
      if (result.status === "success") {
        // Filter lang ang Cash Drop categories na active
        const cashDrops = result.data.filter(item => item.category === "Cash Drop" && item.status === "active");
        setDrops(cashDrops);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrops(); }, []);

  // 2. COMPUTE TOTAL
  const totalDrops = drops.reduce((sum, item) => sum + parseFloat(item.amount), 0);

  // 3. HANDLE SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !remittedBy) return;

    setStatus("saving");
    try {
      const response = await fetch("http://localhost/api/pos_ledger_handler.php?action=add_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OUT",
          category: "Cash Drop",
          description: `Drop: ${remittedBy} ${remarks ? '(' + remarks + ')' : ''}`,
          amount: parseFloat(amount),
          recorded_by: "Admin"
        })
      });

      const resData = await response.json();
      if (resData.status === "success") {
        setStatus("success");
        setAmount(""); setRemittedBy(""); setRemarks("");
        fetchDrops(); // Refresh listahan
        setTimeout(() => setStatus("idle"), 2000);
      }
    } catch (err) {
      console.error("Save error:", err);
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-10">
      {/* HEADER WITH SUMMARY */}
      <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-5xl tracking-tighter uppercase lg:text-7xl poppins-black-italic">
            Cash <span style={{ color: accent }}>Drops</span>
          </h2>
          <div className="flex items-center gap-2 mt-2 opacity-40">
             <FiActivity size={14} />
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">CNC Remittance System</p>
          </div>
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className={`px-10 py-6 rounded-[35px] border-2 flex flex-col items-end ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}
        >
          <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Total Drops (Today)</span>
          <span className="text-4xl font-black tracking-tighter" style={{ color: accent }}>
            ₱{totalDrops.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        
        {/* ENTRY FORM */}
        <motion.div className="lg:col-span-4" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <form onSubmit={handleSubmit} className={`p-8 rounded-[45px] border-2 border-dashed ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-sm'}`}>
            <h3 className="text-[11px] font-black uppercase tracking-widest opacity-30 mb-8 italic flex items-center gap-2">
              <FiArrowDownCircle /> New Authorized Drop
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-2">Amount (PHP)</label>
                <div className="relative">
                  <FiDollarSign className="absolute -translate-y-1/2 left-5 top-1/2 opacity-20" />
                  <input 
                    type="number" step="0.01" required value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-14 pr-6 py-5 rounded-[25px] outline-none font-black text-xl transition-all ${isDark ? 'bg-white/5 border border-white/5 focus:bg-white/10' : 'bg-slate-50 border border-slate-100 focus:bg-white focus:shadow-lg'}`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-2">Remitted By</label>
                <div className="relative">
                  <FiUser className="absolute -translate-y-1/2 left-5 top-1/2 opacity-20" />
                  <input 
                    type="text" required value={remittedBy}
                    onChange={(e) => setRemittedBy(e.target.value)}
                    placeholder="Cashier Name"
                    className={`w-full pl-14 pr-6 py-5 rounded-[25px] outline-none font-bold text-sm transition-all ${isDark ? 'bg-white/5 border border-white/5 focus:bg-white/10' : 'bg-slate-50 border border-slate-100 focus:bg-white focus:shadow-lg'}`}
                  />
                </div>
              </div>

              <button 
                disabled={status !== "idle"}
                className="w-full py-6 rounded-[30px] text-white font-black uppercase tracking-[0.4em] text-[12px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: status === "success" ? "#10b981" : accent }}
              >
                {status === "saving" ? <FiLoader className="mx-auto text-xl animate-spin" /> : 
                 status === "success" ? <FiCheckCircle className="mx-auto text-xl" /> : "Authorize Drop"}
              </button>
            </div>
          </form>
        </motion.div>

        {/* AUDIT LOG TABLE */}
        <motion.div className="lg:col-span-8" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <div className={`rounded-[50px] border h-full overflow-hidden flex flex-col ${isDark ? 'bg-white/[0.01] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
            <div className="flex items-center justify-between p-10 border-b border-inherit bg-black/5">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-40 italic">Transaction Audit</span>
              <span className="px-4 py-1 rounded-full text-[9px] font-black bg-white/5 opacity-40 uppercase tracking-tighter">CNC-STA.MARIA</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[400px]">
              <table className="w-full text-left">
                <tbody className="divide-y divide-inherit">
                  {loading ? (
                    <tr><td className="p-20 text-center"><FiLoader className="mx-auto text-4xl animate-spin opacity-10" /></td></tr>
                  ) : drops.length === 0 ? (
                    <tr><td className="p-20 text-sm italic font-black tracking-widest text-center uppercase opacity-20">No Recent Drops</td></tr>
                  ) : (
                    drops.map((drop) => (
                      <tr key={drop.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-white'} transition-all group`}>
                        <td className="p-8">
                          <div className="flex items-center gap-4">
                             <div className="p-3 transition-opacity rounded-2xl bg-white/5 opacity-40 group-hover:opacity-100" style={{ color: accent }}><FiClock /></div>
                             <div>
                                <div className="text-[12px] font-black uppercase tracking-wider">{drop.entry_time}</div>
                                <div className="text-[10px] font-bold opacity-30 uppercase italic max-w-[250px] truncate">{drop.description}</div>
                             </div>
                          </div>
                        </td>
                        <td className="p-8 text-2xl font-black tracking-tighter text-right" style={{ color: accent }}>
                          ₱{parseFloat(drop.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default PosCashDrops;