import React, { useState, useEffect } from "react";
import { 
  FaChartLine, FaShoppingBag, FaPercentage, FaWallet, 
  FaTimes, FaFilter, FaChevronRight, FaDatabase, FaChartBar,
  FaClock, FaUserCheck, FaCrown, FaLightbulb, FaCheckCircle
} from "react-icons/fa";

const DashboardModal = ({ isOpen, onClose }) => {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("graph");

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost/api/reports_dashboard.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datefrom: dateFrom,
          dateto: dateTo,
          includeVoided: false
        }),
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const kpi = data?.kpi || { txn_count: 0, gross_sales: 0, discount_total: 0, net_sales: 0 };
  const averageBasket = kpi.txn_count > 0 ? (kpi.gross_sales / kpi.txn_count).toFixed(2) : 0;
  
  const sortedByQty = data?.salesPerProduct 
    ? [...data.salesPerProduct].sort((a, b) => b['Total Qty Sold'] - a['Total Qty Sold']) 
    : [];

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl p-4 animate-in fade-in duration-500">
      {/* MODAL SIZE INCREASED TO 95VW */}
      <div className="w-full max-w-[95vw] bg-[#020617] border border-white/10 rounded-[60px] overflow-hidden shadow-[0_0_150px_rgba(59,130,246,0.15)] flex flex-col max-h-[95vh]">
        
        {/* HEADER */}
        <div className="p-10 border-b bg-gradient-to-r from-white/[0.03] to-transparent border-white/5">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex items-center gap-10">
              <div className="relative">
                <h3 className="relative text-5xl italic font-black leading-none tracking-tighter text-white uppercase">
                  SALES <span className="text-4xl text-blue-400">DASHBOARD</span>
                </h3>
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.5em] mt-3 italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                  Branch Report | Sta. Maria
                </p>
              </div>

              <div className="flex p-1.5 bg-black/60 rounded-3xl border border-white/10 shadow-inner">
                <button onClick={() => setViewMode("graph")}
                  className={`flex items-center gap-2 px-10 py-3 rounded-2xl text-[10px] font-black uppercase transition-all duration-500 ${viewMode === 'graph' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                  <FaChartBar size={14} /> Analytics
                </button>
                <button onClick={() => setViewMode("table")}
                  className={`flex items-center gap-2 px-10 py-3 rounded-2xl text-[10px] font-black uppercase transition-all duration-500 ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                  <FaDatabase size={14} /> Table View
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 p-2 border rounded-full bg-black/40 border-white/5">
              <div className="flex items-center gap-4 px-6 border-r border-white/10">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase italic">Start</span>
                  <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="text-xs font-black text-white bg-transparent outline-none cursor-pointer focus:text-blue-500"/>
                </div>
                <FaChevronRight className="text-blue-500 text-[10px]" />
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase italic">End</span>
                  <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="text-xs font-black text-white bg-transparent outline-none cursor-pointer focus:text-blue-500"/>
                </div>
              </div>
              <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full text-[11px] font-black uppercase shadow-xl transition-all active:scale-95 flex items-center gap-3">
                <FaFilter className={loading ? "animate-spin" : ""} size={14} /> {loading ? "LOADING..." : "REFRESH"}
              </button>
            </div>
            
            <button onClick={onClose} className="flex items-center justify-center transition-all border rounded-full w-14 h-14 border-white/10 text-slate-500 hover:text-rose-500">
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-grow p-12 space-y-12 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <ExecutiveCard label="Total Sales" value={kpi.gross_sales} subText="Benta bago bawasan" icon={FaWallet} color="blue" status="ON TARGET" />
            <ExecutiveCard label="Average Spend" value={averageBasket} subText="Gastos per Customer" icon={FaUserCheck} color="purple" status="STABLE" />
            <ExecutiveCard label="Order Count" value={kpi.txn_count} subText="Bilang ng resibo" icon={FaShoppingBag} color="rose" isCurrency={false} status="HIGH" />
            <ExecutiveCard label="Net Revenue" value={kpi.net_sales} subText="Malinis na kita" icon={FaChartLine} color="emerald" isMain={true} status="GOOD" />
          </div>

          {viewMode === "graph" ? (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
              
              <div className="bg-white/[0.03] p-10 rounded-[50px] border border-white/5 flex flex-col space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-10 bg-blue-500 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Money Insights</h4>
                </div>
                
                <div className="space-y-8">
                  <IntelligenceRow label="Senior/PWD Saved" value={`₱${parseFloat(kpi.vat_exemption || 0).toLocaleString()}`} desc="Total Discount Impact" color="text-rose-400" />
                  <IntelligenceRow label="VAT Collected" value={`₱${parseFloat(kpi.vat_amount || 0).toLocaleString()}`} desc="Output Tax (12%)" color="text-blue-400" />
                  <IntelligenceRow label="Performance" value="Healthy" desc="Sales flow is steady" color="text-emerald-400" />
                </div>

                <div className="pt-8 mt-auto border-t border-white/5">
                   <p className="text-[10px] font-black text-slate-500 uppercase italic mb-4">Daily Velocity</p>
                   <div className="flex items-end h-16 gap-2">
                      {[30, 60, 45, 90, 100, 70, 40, 20].map((h, i) => (
                        <div key={i} style={{ height: `${h}%` }} className={`flex-grow rounded-md ${h > 80 ? 'bg-blue-600' : 'bg-white/10'}`}></div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white/[0.03] p-10 rounded-[50px] border border-white/5 flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-12">
                   <div className="flex items-center gap-4 pl-4 border-l-4 border-blue-600">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Best Sellers</h4>
                   </div>
                </div>
                
                <div className="flex-grow space-y-8">
                  {sortedByQty.slice(0, 6).map((item, idx) => {
                    const maxQty = Math.max(...sortedByQty.map(i => parseFloat(i['Total Qty Sold'])));
                    const width = (parseFloat(item['Total Qty Sold']) / maxQty) * 100;
                    return (
                      <div key={idx} className="relative">
                        <div className="flex items-end justify-between mb-3">
                           <span className="text-[12px] font-black text-white uppercase tracking-tight">{item['Product Name']}</span>
                           <span className="text-[11px] font-black text-blue-500">{item['Total Qty Sold']} PCS</span>
                        </div>
                        <div className="w-full h-4 p-1 rounded-full shadow-inner bg-white/5">
                          <div style={{ width: `${width}%` }} className="h-full transition-all duration-1000 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white/[0.02] p-10 rounded-[50px] border border-white/5 overflow-hidden">
               <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                      <th className="pb-8 pl-6">Rank</th>
                      <th className="pb-8">Product</th>
                      <th className="pb-8 text-center">Qty Sold</th>
                      <th className="pb-8 pr-6 text-right">Gross Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {sortedByQty.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-blue-600/[0.05] transition-colors">
                        <td className="py-6 pl-6 italic font-black text-blue-500">#{idx+1}</td>
                        <td className="py-6 text-xs italic font-black text-white uppercase">{item['Product Name']}</td>
                        <td className="py-6 font-bold text-center text-slate-400">{item['Total Qty Sold']} Units</td>
                        <td className="py-6 pr-6 italic font-black text-right text-white">₱{parseFloat(item['Gross Sales']).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-12 py-8 border-t bg-black/60 border-white/5">
            <div className="flex items-center gap-6">
               <FaCheckCircle className="text-emerald-500" size={12}/>
               <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">System Live</p>
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] italic">CNC STA. MARIA // BRANCH REPORT</p>
        </div>
      </div>
    </div>
  );
};

const ExecutiveCard = ({ label, value, subText, icon: Icon, color, isCurrency = true, isMain = false, status }) => {
  const numValue = parseFloat(value || 0);
  const formattedValue = numValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const colors = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
  };

  return (
    <div className={`p-8 rounded-[50px] border border-white/5 flex flex-col justify-between transition-all hover:scale-[1.03] relative overflow-hidden h-[250px] ${isMain ? 'bg-blue-600 shadow-2xl shadow-blue-600/30' : 'bg-white/[0.03]'}`}>
      <div className="z-10 flex items-start justify-between">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isMain ? 'bg-white/20' : 'bg-white/5 border border-white/10'}`}>
          <Icon size={20} className={isMain ? 'text-white' : colors[color].split(' ')[0]} />
        </div>
        <span className={`text-[7px] font-black px-3 py-1 rounded-full flex-shrink-0 tracking-widest ${isMain ? 'bg-white/20 text-white' : 'bg-white/5 border border-white/5 text-slate-400'}`}>
          {status}
        </span>
      </div>

      <div className="z-10 w-full mt-4">
        <div className="flex flex-col w-full overflow-hidden">
          {/* AUTO-FIT FONT SIZE USING CLAMP */}
          <h4 className="font-black leading-none tracking-tight text-white whitespace-nowrap"
              style={{ fontSize: 'clamp(1rem, 5vw, 2.5rem)' }}> 
            {isCurrency && <span className="mr-1 opacity-70" style={{ fontSize: '0.6em' }}>₱</span>}
            {formattedValue}
          </h4>
          
          <div className="mt-4">
            <p className={`text-[10px] font-black uppercase italic tracking-[0.15em] leading-none ${isMain ? 'text-blue-100' : 'text-slate-500'}`}>
              {label}
            </p>
            <p className={`text-[9px] font-bold mt-2 opacity-60 leading-tight ${isMain ? 'text-white' : 'text-slate-400'}`}>
              {subText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntelligenceRow = ({ label, value, desc, color }) => (
  <div className="group">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
    <p className="text-[9px] text-slate-600 font-bold italic tracking-tight">{desc}</p>
  </div>
);

export default DashboardModal;