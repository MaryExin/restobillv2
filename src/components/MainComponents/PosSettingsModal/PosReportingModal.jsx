"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  FiSend, FiCheckCircle, FiList, 
  FiTrendingUp, FiLoader, FiCalendar, FiMail
} from "react-icons/fi";
import { TbCurrencyPeso } from "react-icons/tb";
import { motion, AnimatePresence } from "framer-motion";

const Toggle = ({ isOn, onToggle, accent, isDark }) => (
  <div 
    onClick={(e) => { 
      e.stopPropagation(); 
      onToggle(); 
    }}
    className={`relative w-11 h-5 rounded-full cursor-pointer transition-all duration-300 ${
      isOn ? '' : (isDark ? 'bg-white/10' : 'bg-slate-200')
    }`}
    style={{ backgroundColor: isOn ? accent : undefined }}
  >
    <motion.div 
      animate={{ x: isOn ? 24 : 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
    />
  </div>
);

const PosReportingModal = ({ isDark, accent = "#2563eb" }) => {
  const [status, setStatus] = useState("idle"); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shiftStart, setShiftStart] = useState("");
  
  const [selectedReports, setSelectedReports] = useState({
    dailySales: true,
    salesPerItem: true,
    expensesPetty: true
  });

  useEffect(() => {
    fetch("http://localhost/api/pos_dispatch_sender.php")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setSelectedDate(data.reporting_date);
          setShiftStart(data.shift_opened);
        }
      }).catch(err => console.error("Fetch Error:", err));
  }, []);

  const reportOptions = [
    { id: 'dailySales', title: "Daily Sales Reports", desc: "Overall revenue summary", icon: <FiTrendingUp /> },
    { id: 'salesPerItem', title: "Sales Per Item", desc: "Individual SKU performance", icon: <FiList /> },
    { id: 'expensesPetty', title: "Expenses and Petty", desc: "Ledger cash out movements", icon: <TbCurrencyPeso /> },
  ];

  const isAllSelected = useMemo(() => 
    reportOptions.every(rpt => selectedReports[rpt.id]), 
    [selectedReports]
  );

  const handleSelectAll = () => {
    const nextVal = !isAllSelected;
    const newState = {};
    reportOptions.forEach(rpt => newState[rpt.id] = nextVal);
    setSelectedReports(newState);
  };

  const toggleReport = (id) => {
    setSelectedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTransmit = async () => {
    setStatus("sending");
    try {
      const response = await fetch("http://localhost/api/pos_dispatch_sender.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          shift_start: shiftStart, 
          selected_date: selectedDate,
          reports: selectedReports 
        })
      });
      const resData = await response.json();
      if (resData.status === "success") {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        alert("Dispatch Error: " + resData.message);
        setStatus("idle");
      }
    } catch (error) {
      console.error("Dispatch Error:", error);
      setStatus("idle");
    }
  };

  const selectedCount = Object.values(selectedReports).filter(Boolean).length;

  return (
    <div className={`flex h-[600px] w-full max-w-6xl overflow-hidden rounded-[40px] border shadow-2xl mx-auto transition-all duration-500 ${isDark ? 'bg-[#0f1115] border-white/5' : 'bg-white border-slate-100'}`}>
      
      <div className={`w-[350px] flex flex-col border-r transition-all ${isDark ? 'border-white/5 bg-black/20 text-white' : 'border-slate-100 bg-slate-50/50 text-slate-900'}`}>
        <div className="flex items-center justify-between p-6 border-b border-inherit">
          <div className="flex items-center gap-3">
             <Toggle isOn={isAllSelected} onToggle={handleSelectAll} accent={accent} isDark={isDark} />
             <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Toggle All</span>
          </div>
          <div className="px-3 py-1 rounded-lg text-[9px] font-black bg-blue-500/10 text-blue-500 uppercase tracking-widest">
            {selectedCount} Selected
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {reportOptions.map((rpt) => (
            <div 
              key={rpt.id} 
              onClick={() => toggleReport(rpt.id)}
              className={`group flex items-center gap-4 p-6 border-b border-inherit cursor-pointer transition-all ${
                isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-white'
              } ${selectedReports[rpt.id] ? (isDark ? 'bg-white/[0.03]' : 'bg-white shadow-sm') : 'opacity-20 grayscale'}`}
            >
              <Toggle isOn={selectedReports[rpt.id]} onToggle={() => toggleReport(rpt.id)} accent={accent} isDark={isDark} />
              <div className="flex-1 min-w-0 ml-1">
                <h5 className="text-[11px] font-black uppercase tracking-wide truncate">{rpt.title}</h5>
                <p className="text-[9px] font-black opacity-30 truncate uppercase tracking-tighter">{rpt.desc}</p>
              </div>
              <div className="text-lg transition-opacity opacity-10 group-hover:opacity-100" style={selectedReports[rpt.id] ? { color: accent, opacity: 0.8 } : {}}>
                {rpt.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`flex-1 flex flex-col p-10 relative overflow-y-auto ${isDark ? 'text-white' : 'text-slate-900'}`}>
        <div className="w-full max-w-2xl mx-auto space-y-10">
          <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-1 text-blue-500 border rounded-full bg-blue-500/10 w-fit border-blue-500/20">
                <FiMail size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Dispatch Engine v3.1</span>
              </div>
              <div>
                <h2 className="text-4xl font-black leading-none tracking-tighter uppercase">
                  Review <span style={{ color: accent }}>Registry</span>
                </h2>
                <p className="text-[11px] font-black opacity-30 tracking-[0.3em] mt-2 uppercase">Target: MAIN OFFICE</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2 ml-1">
                <FiCalendar /> Manual Date Filter
              </label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`px-5 py-3 rounded-2xl font-black text-[12px] border outline-none transition-all uppercase ${
                  isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`} 
              />
            </div>
          </header>

          <div className={`p-8 rounded-[40px] border-2 border-dashed ${isDark ? 'border-white/10 bg-white/[0.01]' : 'border-slate-200 bg-slate-50/50'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-6">Target Data Packet</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {Object.keys(selectedReports).filter(id => selectedReports[id]).map(id => (
                  <motion.div 
                    key={id} 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-center gap-3 p-4 rounded-2xl border ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-sm'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                    <span className="text-[10px] font-black uppercase tracking-widest truncate">
                      {reportOptions.find(o => o.id === id)?.title}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <button 
            onClick={handleTransmit}
            disabled={status !== "idle" || selectedCount === 0}
            className="w-full py-8 rounded-[35px] text-white font-black uppercase tracking-[0.5em] text-[14px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-20"
            style={{ backgroundColor: status === "success" ? "#10b981" : accent }}
          >
            <div className="flex items-center justify-center gap-4">
              {status === "sending" ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><FiLoader size={24}/></motion.div> Transmitting...</>
              ) : status === "success" ? (
                <><FiCheckCircle size={24}/> Dispatch Successful</>
              ) : (
                <><FiSend size={22}/> Dispatch to Main Office</>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosReportingModal;