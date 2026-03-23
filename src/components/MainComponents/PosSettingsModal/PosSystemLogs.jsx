"use client";

import React, { useState } from "react";
import { FiSearch, FiDollarSign, FiAward, FiArrowRight, FiActivity, FiTrendingUp } from "react-icons/fi";
import { motion } from "framer-motion";

const PosSystemLogs = ({ isDark, accent }) => {
  const [filter, setFilter] = useState("TODAY");

  const registrySales = [
    { 
        id: "USR-001", 
        firstName: "Leonardo",
        lastName: "DiCaprio",
        role: "Head Cashier", 
        totalSales: 45850.75, 
        transactionCount: 125, 
        lastTransaction: "2026-03-21 09:15 AM", 
        performance: "HIGHEST",
        image: "https://images.perthnow.com.au/publication/C-13837911/496956276856011352e825a0b73c9886470389f4-16x9-x0y16w1403h789.jpg?imwidth=1200"
    },
    { 
        id: "USR-002", 
        firstName: "Scarlett",
        lastName: "Johansson",
        role: "Senior Cashier", 
        totalSales: 32150.20, 
        transactionCount: 98, 
        lastTransaction: "2026-03-21 09:00 AM", 
        performance: "STABLE",
        image: "https://hips.hearstapps.com/hmg-prod/images/scarlett-johansson-1563814041.jpg?crop=1xw:1xh;center,top&resize=1200:*"
    },
    { 
        id: "USR-003", 
        firstName: "Ryan",
        lastName: "Reynolds",
        role: "Cashier Trainee", 
        totalSales: 18450.50, 
        transactionCount: 65, 
        lastTransaction: "2026-03-21 08:30 AM", 
        performance: "TRENDING",
        image: "https://resizing.flixster.com/-XZCFrR-p6sBhv99pY9Lz87E-70=/218x280/v2/https://resizing.flixster.com/B942D_B09_nZpMv-gGv8v9q78Yg=/ems.cHJkLWVtcy1hc3NldHMvbmFtZXMvMTBiMDNlMzMtMzYwMS00MmUxLTlkYTgtMmI0YmZlZDRjN2NlLmpwZw=="
    }
  ];

  const theme = {
    panel: isDark ? "border-white/5 bg-white/[0.02] shadow-2xl" : "border-slate-200 bg-white shadow-sm",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
    subPanel: isDark ? "bg-white/[0.04]" : "bg-slate-50",
    input: isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900",
  };

  const getPerformanceBadge = (perf) => {
    switch (perf) {
      case "HIGHEST": return { color: "#f59e0b", bg: "#f59e0b15", icon: <FiAward />, label: "Top Performer" }; 
      case "TRENDING": return { color: "#10b981", bg: "#10b98115", icon: <FiTrendingUp />, label: "Fast Learner" };
      default: return null;
    }
  };

  return (
    <div className="space-y-8 text-left duration-700 animate-in fade-in slide-in-from-bottom-4">
      
      <div className="flex flex-col gap-2 px-2">
        <h3 className={`text-4xl font-black uppercase tracking-tighter leading-none ${theme.textPrimary}`}>
          Registry <span style={{ color: accent }}>Sales</span> Performance
        </h3>
        <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${theme.textMuted}`}>Computed Shift Earnings per Employee</p>
      </div>

      <div className={`rounded-[40px] border p-8 flex flex-col lg:flex-row gap-6 items-center justify-between transition-all duration-500 ${theme.panel}`}>
        <div className="flex gap-2 p-2 border rounded-full bg-black/5 dark:bg-white/5 border-white/5">
          {["TODAY", "THIS WEEK", "THIS MONTH"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab.replace(' ', '_'))}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === tab.replace(' ', '_') ? "text-white shadow-lg" : `${theme.textMuted} hover:text-white`
              }`}
              style={{ backgroundColor: filter === tab.replace(' ', '_') ? accent : "transparent", boxShadow: filter === tab.replace(' ', '_') ? `0 10px 20px ${accent}30` : "none" }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-96">
          <FiSearch className={`absolute left-6 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
          <input 
            type="text" 
            placeholder="SEARCH REGISTRY NAME..." 
            className={`w-full pl-14 pr-8 py-4 rounded-full outline-none border text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${theme.input} ${theme.textPrimary}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {registrySales.map((staff) => {
          const award = getPerformanceBadge(staff.performance);
          const fallbackUrl = `https://ui-avatars.com/api/?name=${staff.firstName}+${staff.lastName}&background=334155&color=fff&bold=true`;

          return (
            <div key={staff.id} className={`rounded-[50px] border p-10 space-y-8 group relative overflow-hidden transition-all duration-500 hover:translate-y-[-8px] ${theme.panel}`}>
              
              <div className="flex items-center gap-6">
                 <div 
                   className="h-28 w-28 rounded-[35px] p-1.5 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-500"
                   style={{ background: `linear-gradient(135deg, ${accent}, #67e8f9)` }}
                 >
                    <div className={`h-full w-full rounded-[30px] overflow-hidden ${isDark ? "bg-[#0b1222]" : "bg-white"}`}>
                      <img 
                        src={staff.image} 
                        alt={staff.firstName} 
                        className="object-cover w-full h-full transition-all duration-700 grayscale group-hover:grayscale-0"
                        onError={(e) => { e.target.src = fallbackUrl; }} 
                      />
                    </div>
                 </div>
                 
                 <div className="flex-1 space-y-1">
                    {award && (
                        <div className="w-fit mb-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 border" style={{ backgroundColor: award.bg, color: award.color, borderColor: `${award.color}30` }}>
                            {award.icon} {award.label}
                        </div>
                    )}
                    <h4 className={`text-[17px] font-black uppercase tracking-wider ${theme.textPrimary}`}>
                        {staff.firstName} <span style={{ color: accent }}>{staff.lastName[0]}.</span>
                    </h4>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>
                        #ID-{staff.id} • {staff.role}
                    </p>
                 </div>
              </div>

              <div className={`p-8 rounded-[35px] border-2 border-dashed transition-all duration-500 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${theme.textPrimary}`}>Transactions</span>
                            <div className="flex items-center gap-2">
                                <FiActivity className="text-lg opacity-30" style={{ color: accent }} />
                                <span className={`text-2xl font-black tracking-tighter ${theme.textPrimary}`}>{staff.transactionCount}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${theme.textPrimary}`}>Computed Sales</span>
                            <div className="flex items-center gap-2">
                                <FiDollarSign className="text-lg" style={{ color: "#10b981" }} />
                                <span className="text-2xl font-black tracking-tighter text-[#10b981]">
                                    {staff.totalSales.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                    </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                    <div className="flex flex-col">
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>Latest Activity</span>
                        <span className={`text-[11px] font-black uppercase ${theme.textPrimary}`}>{staff.lastTransaction}</span>
                    </div>
                    <button 
                      className={`p-5 rounded-2xl border-2 transition-all duration-300 active:scale-90 ${isDark ? 'border-white/5 hover:bg-white/10' : 'border-slate-200 hover:bg-white hover:shadow-xl'}`}
                      style={{ color: accent }}
                    >
                      <FiArrowRight size={18} />
                    </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-between gap-6 px-6 pt-10 border-t md:flex-row border-white/5">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.textMuted}`}>
          Registry sales data based on recorded shifts
        </p>
        <button 
          className="w-full md:w-auto px-10 py-5 rounded-full text-white text-[10px] font-black tracking-[0.3em] uppercase shadow-2xl transition-all active:scale-95 hover:brightness-110"
          style={{ backgroundColor: accent, boxShadow: `0 20px 40px ${accent}40` }}
        >
          Generate Full Registry Report
        </button>
      </div>
    </div>
  );
};

export default PosSystemLogs;