"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FiSearch, FiLoader, FiUser, FiCreditCard, FiSmartphone, FiInbox,
  FiUsers, FiLayers, FiArrowRight, FiTrendingUp, FiShoppingBag,
  FiHome, FiGrid, FiCalendar, FiBarChart2, FiX, FiExternalLink, FiChevronLeft
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosSystemLogs = ({ isDark, accent }) => {
  const apiHost = useApiHost();
  const today = new Date().toISOString().split("T")[0];

  const [viewType, setViewType] = useState("TABLE");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for Drill-down
  const [selectedItem, setSelectedItem] = useState(null);
  const [details, setDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Step 2 States (Payments)
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    if (!apiHost) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiHost}/api/get_system_logs.php?from=${dateFrom}&to=${dateTo}&viewType=${viewType}`);
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } catch (err) { setData([]); } finally { setLoading(false); }
    };
    fetchData();
  }, [apiHost, dateFrom, dateTo, viewType]);

  const handleItemClick = async (item) => {
    setSelectedItem(item);
    setSelectedTransaction(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/get_system_logs.php?from=${dateFrom}&to=${dateTo}&viewType=${viewType}&id=${item.name}`);
      const result = await res.json();
      setDetails(Array.isArray(result) ? result : []);
    } catch (err) { setDetails([]); } finally { setDetailsLoading(false); }
  };

  const handleTransactionClick = async (tr) => {
    setSelectedTransaction(tr);
    setPaymentsLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/get_system_logs.php?transaction_id=${tr.transaction_id}`);
      const result = await res.json();
      setPayments(Array.isArray(result) ? result : []);
    } catch (err) { setPayments([]); } finally { setPaymentsLoading(false); }
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const itemName = String(item?.name || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      return Number(item?.total_amount || 0) > 0 && itemName.includes(query);
    });
  }, [data, searchQuery]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      amount: acc.amount + Number(curr?.total_amount || 0),
      count: acc.count + Number(curr?.transaction_count || 0),
    }), { amount: 0, count: 0 });
  }, [filteredData]);

  const highestCard = useMemo(() => {
    if (!filteredData.length) return null;
    return [...filteredData].sort((a, b) => Number(b?.total_amount || 0) - Number(a?.total_amount || 0))[0];
  }, [filteredData]);

  const getCardStyle = (name) => {
    const n = String(name || "").toUpperCase();
    if (viewType === "TABLE") return { icon: <FiGrid size={24} />, color: "#ec4899", softBg: "rgba(236,72,153,0.12)" };
    if (viewType === "CASHIER") return { icon: <FiUser size={24} />, color: "#6366f1", softBg: "rgba(99,102,241,0.12)" };
    if (n.includes("GCASH") || n.includes("PAYMAYA")) return { icon: <FiSmartphone size={24} />, color: "#3b82f6", softBg: "rgba(59,130,246,0.12)" };
    if (n.includes("CASH") || n.includes("PALAWAN") || n.includes("CEBUANA")) return { icon: <FiInbox size={24} />, color: "#10b981", softBg: "rgba(16,185,129,0.12)" };
    if (n.includes("BDO") || n.includes("BPI") || n.includes("BANK")) return { icon: <FiHome size={24} />, color: "#f59e0b", softBg: "rgba(245,158,11,0.12)" };
    return { icon: <FiCreditCard size={24} />, color: "#94a3b8", softBg: "rgba(148,163,184,0.12)" };
  };

  const theme = {
    panel: isDark ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
    input: isDark ? "bg-slate-950/60 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}>
         <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
             <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
               <FiBarChart2 size={12} style={{ color: accent }} />
               <span style={{ color: accent }}>Registry Sales</span>
             </div>
             <h2 className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}>System Logs</h2>
          </div>
          <div className={`flex flex-wrap gap-3 rounded-[24px] border p-2 ${theme.panelSoft}`}>
            {["TABLE", "PAYMENT", "CASHIER"].map((id) => (
               <button key={id} onClick={() => setViewType(id)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${viewType === id ? "shadow-lg text-white" : theme.textMuted}`} style={viewType === id ? { backgroundColor: accent } : {}}>{id}</button>
            ))}
          </div>
         </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
         <SummaryCard label="Total Net Sales" value={`₱${totals.amount.toLocaleString()}`} icon={<FiTrendingUp/>} color="emerald" theme={theme} isDark={isDark} />
         <SummaryCard label="Transactions" value={totals.count.toLocaleString()} icon={<FiShoppingBag/>} color="blue" theme={theme} isDark={isDark} />
         <SummaryCard label="Top Performer" value={highestCard?.name || "—"} icon={<FiLayers/>} color="violet" theme={theme} isDark={isDark} subValue={highestCard ? `₱${Number(highestCard.total_amount).toLocaleString()}` : ""} />
      </div>

      {/* SEARCH */}
      <div className={`rounded-[28px] border p-5 ${theme.panel}`}>
         <div className="grid grid-cols-1 gap-4 xl:grid-cols-[auto_1fr]">
            <div className="flex gap-2">
               <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className={`p-3 rounded-xl border ${theme.input}`} />
               <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className={`p-3 rounded-xl border ${theme.input}`} />
            </div>
            <input type="text" placeholder={`Search ${viewType}...`} value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className={`p-3 rounded-xl border ${theme.input}`} />
         </div>
      </div>

      {/* MAIN CARDS GRID */}
      {loading ? (
        <div className="flex justify-center py-20"><FiLoader className="animate-spin" size={40} style={{color: accent}}/></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredData.map((item, idx) => {
            const style = getCardStyle(item?.name);
            const percentage = totals.amount > 0 ? ((item.total_amount / totals.amount) * 100).toFixed(1) : "0.0";
            return (
              <div key={idx} onClick={() => handleItemClick(item)} className={`group cursor-pointer rounded-[28px] border p-6 transition-all duration-300 hover:-translate-y-1 active:scale-95 ${theme.panel}`}>
                <div className="flex items-start justify-between">
                   <div className="flex items-center justify-center h-14 w-14 rounded-2xl" style={{backgroundColor: style.softBg, color: style.color}}>{style.icon}</div>
                   <div className="text-right">
                      <p className={`text-[10px] font-black uppercase ${theme.textSoft}`}>Contribution</p>
                      <p className="text-lg font-black" style={{color: style.color}}>{percentage}%</p>
                   </div>
                </div>
                <div className="mt-5">
                   <h4 className={`text-xl font-black uppercase truncate ${theme.textPrimary}`}>{item.name}</h4>
                   <div className="flex justify-between mt-6">
                      <div><p className={`text-[10px] font-black uppercase ${theme.textSoft}`}>Volume</p><p className={`text-lg font-black ${theme.textPrimary}`}>{item.transaction_count}</p></div>
                      <div className="text-right"><p className={`text-[10px] font-black uppercase ${theme.textSoft}`}>Total</p><p className="text-lg font-black" style={{color: accent}}>₱{item.total_amount.toLocaleString()}</p></div>
                   </div>
                </div>
                <div className="flex justify-end mt-4">
                   <span className={`text-[10px] font-bold uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`} style={{color: accent}}>View Details <FiArrowRight/></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DRILL-DOWN MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className={`relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[32px] border flex flex-col shadow-2xl ${isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                {selectedTransaction && (
                  <button onClick={() => setSelectedTransaction(null)} className="p-2 transition-all rounded-full bg-white/5 hover:bg-white/10 active:scale-90"><FiChevronLeft size={20} className={theme.textPrimary}/></button>
                )}
                <div>
                  <h3 className={`text-2xl font-black uppercase ${theme.textPrimary}`}>{selectedTransaction ? `Payments for #${selectedTransaction.transaction_id}` : selectedItem.name}</h3>
                  <p className={theme.textMuted}>{selectedTransaction ? `Bill Total: ₱${Number(selectedTransaction.amount).toLocaleString()}` : `${dateFrom} to ${dateTo}`}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="flex items-center justify-center w-10 h-10 transition-colors rounded-full bg-white/5 hover:bg-white/10"><FiX size={20} className={theme.textPrimary}/></button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {!selectedTransaction ? (
                // VIEW 1: TRANSACTION LIST
                detailsLoading ? <div className="flex flex-col items-center gap-4 py-20"><FiLoader className="text-3xl animate-spin" style={{color: accent}}/><p className={theme.textMuted}>Loading...</p></div> : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`text-[10px] font-black uppercase tracking-widest ${theme.textSoft} border-b border-white/5`}>
                        <th className="pb-4 pl-2">Ref ID</th>
                        <th className="pb-4">Date/Time</th>
                        <th className="pb-4">Staff / Table</th>
                        <th className="pb-4 text-right">Amount</th>
                        <th className="pb-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {details.map((tr, idx) => (
                        <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                          <td className={`py-4 pl-2 font-mono text-xs ${theme.textPrimary}`}>#{tr.transaction_id}</td>
                          <td className={`py-4 text-xs ${theme.textMuted}`}>{tr.created_at}</td>
                          <td className="py-4"><div className="text-xs"><p className={theme.textPrimary}>{tr.cashier}</p><p className={theme.textSoft}>Table {tr.table_number}</p></div></td>
                          <td className={`py-4 text-right font-black ${theme.textPrimary}`}>₱{Number(tr.amount).toLocaleString()}</td>
                          <td className="py-4 text-right">
                             <button onClick={() => handleTransactionClick(tr)} className="px-4 py-2 text-[10px] font-black uppercase rounded-xl border border-white/10 hover:bg-white/5 active:scale-95 transition-all" style={{color: accent}}>Payments</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                // VIEW 2: PAYMENT DETAILS (tbl_pos_transactions_payments)
                paymentsLoading ? <div className="flex flex-col items-center gap-4 py-20"><FiLoader className="text-3xl animate-spin" style={{color: accent}}/><p className={theme.textMuted}>Fetching payment data...</p></div> : (
                  <div className="grid gap-3">
                    {payments.length === 0 ? <p className="py-10 text-center text-slate-500">No payment records found.</p> : payments.map((pm, i) => (
                      <div key={i} className={`flex items-center justify-between p-5 rounded-2xl border border-white/5 ${theme.panelSoft}`}>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5" style={{color: accent}}><FiCreditCard size={18}/></div>
                            <div>
                               <p className={`text-[10px] font-black uppercase ${theme.textSoft}`}>Method</p>
                               <p className={`text-lg font-black ${theme.textPrimary}`}>{pm.payment_method}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className={`text-[10px] font-black uppercase ${theme.textSoft}`}>Amount Collected</p>
                            <p className="text-2xl font-black" style={{color: accent}}>₱{Number(pm.payment_amount).toLocaleString()}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-6 border-t border-white/5 ${theme.panelSoft} flex justify-between items-center`}>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{selectedTransaction ? "Payment Breakdown" : "Total Count"}</p>
                    <p className={`text-xl font-black ${theme.textPrimary}`}>{selectedTransaction ? `₱${Number(selectedTransaction.amount).toLocaleString()}` : details.length}</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 text-xs font-black tracking-widest text-white uppercase transition-transform rounded-2xl active:scale-95" style={{backgroundColor: accent}}>Export List <FiExternalLink/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color, theme, isDark, subValue }) => {
  const colors = {
    emerald: isDark ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-50 text-emerald-600",
    blue: isDark ? "bg-blue-500/10 text-blue-500" : "bg-blue-50 text-blue-600",
    violet: isDark ? "bg-violet-500/10 text-violet-500" : "bg-violet-50 text-violet-600",
  };
  return (
    <div className={`rounded-[28px] border p-6 ${theme.panel}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
        <p className={`text-[10px] font-black tracking-widest uppercase ${theme.textSoft}`}>{label}</p>
      </div>
      <h3 className={`text-2xl font-black ${theme.textPrimary}`}>{value}</h3>
      {subValue && <p className={`mt-1 text-sm ${theme.textMuted}`}>{subValue}</p>}
    </div>
  );
};

export default PosSystemLogs;