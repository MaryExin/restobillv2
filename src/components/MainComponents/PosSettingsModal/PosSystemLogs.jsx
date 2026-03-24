"use client";

import React, { useState, useEffect } from "react";
import { FiSearch, FiDollarSign, FiAward, FiArrowRight, FiActivity, FiTrendingUp, FiLoader, FiCalendar, FiMail, FiUser } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosSystemLogs = ({ isDark, accent }) => {
  const apiHost = useApiHost();
  const [filter, setFilter] = useState("TODAY");
  const [registrySales, setRegistrySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    if (!apiHost) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/get_system_logs.php?filter=${filter}`);
      const data = await res.json();
      setRegistrySales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [apiHost, filter]);

  const filteredData = registrySales.filter(s => 
    `${s.firstname} ${s.lastname} ${s.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const theme = {
    panel: isDark ? "border-white/5 bg-white/[0.02] shadow-2xl" : "border-slate-200 bg-white shadow-sm",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
    input: isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900",
  };

  const getPerformanceBadge = (perf) => {
    switch (perf) {
      case "HIGHEST": return { color: "#f59e0b", bg: "#f59e0b15", icon: <FiAward />, label: "Top Performer" }; 
      case "TRENDING": return { color: "#10b981", bg: "#10b98115", icon: <FiTrendingUp />, label: "Active Today" };
      default: return { color: "#3b82f6", bg: "#3b82f615", icon: <FiActivity />, label: "Stable" };
    }
  };

  return (
    <div className="space-y-8 text-left duration-700 animate-in fade-in">
      <div className="flex flex-col gap-2 px-2">
        <h3 className={`text-4xl font-black uppercase tracking-tighter leading-none ${theme.textPrimary}`}>
          Collection <span style={{ color: accent }}>Logs</span>
        </h3>
        <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${theme.textMuted}`}>Performance-Based Shift Tracking</p>
      </div>

      {/* FILTER & SEARCH */}
      <div className={`rounded-[40px] border p-8 flex flex-col lg:flex-row gap-6 items-center justify-between ${theme.panel}`}>
        <div className="flex gap-2 p-2 overflow-x-auto border rounded-full bg-black/5 dark:bg-white/5 border-white/5 no-scrollbar">
          {["TODAY", "THIS_WEEK", "THIS_MONTH", "ALL_TIME"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filter === tab ? "text-white shadow-lg" : `${theme.textMuted} hover:text-white`
              }`}
              style={{ backgroundColor: filter === tab ? accent : "transparent" }}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-96">
          <FiSearch className={`absolute left-6 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
          <input 
            type="text" 
            placeholder="SEARCH STAFF..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-14 pr-8 py-4 rounded-full outline-none border text-[10px] font-black uppercase tracking-widest ${theme.input} ${theme.textPrimary}`}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96"><FiLoader className="text-4xl animate-spin" style={{ color: accent }} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {filteredData.map((staff) => {
            const award = getPerformanceBadge(staff.performance);
            
            return (
              <div key={staff.id} className={`rounded-[50px] border p-10 space-y-8 group relative transition-all duration-500 hover:translate-y-[-8px] ${theme.panel}`}>
                <div className="flex items-center gap-6">
                    {/* AVATAR LOGIC */}
                    <div className="h-24 w-24 rounded-[30px] flex items-center justify-center shadow-xl border border-white/10 overflow-hidden bg-slate-800 relative">
                        {staff.image ? (
                           <img 
                            src={`${apiHost}/profile_pictures/${staff.image}`} 
                            className="object-cover w-full h-full" 
                            alt="profile"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                           />
                        ) : null}
                        <div className={`${staff.image ? 'hidden' : 'flex'} items-center justify-center w-full h-full bg-white/5`}>
                           <FiUser size={40} className="text-white opacity-20" />
                        </div>
                    </div>
                    
                    <div className="flex-1 space-y-1 overflow-hidden">
                       <div className="w-fit mb-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 border" style={{ backgroundColor: award.bg, color: award.color, borderColor: `${award.color}30` }}>
                           {award.icon} {award.label}
                       </div>
                       <h4 className={`text-[17px] font-black uppercase tracking-wider truncate ${theme.textPrimary}`}>
                           {staff.firstname} {staff.lastname}
                       </h4>
                       <div className="flex items-center gap-1 opacity-40">
                          <FiMail size={10} className={theme.textPrimary} />
                          <p className={`text-[8px] font-black uppercase tracking-tighter truncate ${theme.textPrimary}`}>{staff.email}</p>
                       </div>
                    </div>
                </div>

                {/* SALES DATA CARDS */}
                <div className={`p-8 rounded-[35px] border-2 border-dashed transition-all duration-500 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${theme.textPrimary}`}>Trans. Count</span>
                            <div className="flex items-center gap-2">
                                <FiActivity className="text-lg opacity-30" style={{ color: accent }} />
                                <span className={`text-2xl font-black tracking-tighter ${theme.textPrimary}`}>{staff.transactionCount}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${theme.textPrimary}`}>Collected</span>
                            <div className="flex items-center gap-2">
                                <FiDollarSign className="text-lg" style={{ color: "#10b981" }} />
                                <span className="text-2xl font-black tracking-tighter text-[#10b981]">
                                    {staff.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER INFO */}
                <div className="flex items-center justify-between pt-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <FiCalendar className="text-[10px]" style={{ color: accent }} />
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>Last Activity</span>
                        </div>
                        <span className={`text-[11px] font-black uppercase ${theme.textPrimary}`}>
                            {staff.transaction_date} <span className="mx-1 opacity-30">|</span> {staff.lastTransaction !== 'NO ACTIVITY' ? staff.lastTransaction.split(' ')[1] : '--:--'}
                        </span>
                    </div>
                    <button className={`p-5 rounded-2xl border-2 transition-all duration-300 active:scale-90 ${isDark ? 'border-white/5 hover:bg-white/10' : 'border-slate-200 hover:bg-white hover:shadow-xl'}`} style={{ color: accent }}>
                      <FiArrowRight size={18} />
                    </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PosSystemLogs;