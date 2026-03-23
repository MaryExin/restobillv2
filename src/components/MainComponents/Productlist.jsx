import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaSyncAlt, FaArrowLeft, FaTag, FaChartPie, FaLock, FaKey, FaPowerOff, FaCheckCircle, FaExclamationTriangle, FaThLarge } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";

const ProductList = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const apiHost = useApiHost();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  
  // MODAL STATES
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // PASSWORD STATES
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passError, setPassError] = useState(false);

  const ADMIN_PASSWORD = "1324"; 
console.log(passwordInput);
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if ((passwordInput) === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
      setPasswordInput("");
    }
  };

  const fetchProducts = useCallback(async () => {
    if (!apiHost || !isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/get_product_masterlist.php`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiHost, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [isAuthenticated, fetchProducts]);

  const triggerBulkConfirm = (status) => {
    if (selectedCategory === "ALL") return; 
    setPendingStatus(status);
    setShowConfirm(true);
  };

  const executeBulkUpdate = async () => {
    const newStatus = pendingStatus;
    const currentCat = selectedCategory;
    setShowConfirm(false);
    
    const targetProducts = products.filter(p => p.item_category === currentCat);
    const ids = targetProducts.map(p => p.product_id);

    if (ids.length === 0) return;

    const previousState = [...products];
    setProducts(prev => prev.map(p => ids.includes(p.product_id) ? { ...p, status: newStatus } : p));

    try {
      const response = await fetch(`${apiHost}/api/update_product_status_bulk.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_ids: ids, 
          status: newStatus,
          item_category: currentCat 
        })
      });
      const result = await response.json();
      if (result.status !== "success") {
        setProducts(previousState);
        alert("Update failed: " + result.message);
      }
    } catch (error) {
      setProducts(previousState);
    }
  };

  const toggleStatus = async (pid) => {
    const product = products.find(p => p.product_id === pid);
    if (!product) return;
    const newStatus = product.status === "1" ? "0" : "1";

    const previousState = [...products];
    setProducts(prev => prev.map(p => p.product_id === pid ? { ...p, status: newStatus } : p));

    try {
      const response = await fetch(`${apiHost}/api/update_product_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: pid, status: newStatus })
      });
      const result = await response.json();
      if (result.status !== "success") setProducts(previousState);
    } catch (error) {
      setProducts(previousState);
    }
  };

  const categoryStats = useMemo(() => {
    const stats = products.reduce((acc, curr) => {
      const cat = curr.item_category;
      if (!acc[cat]) acc[cat] = { total: 0, active: 0 };
      acc[cat].total += 1;
      if (curr.status === "1") acc[cat].active += 1;
      return acc;
    }, {});
    return stats;
  }, [products]);

  const categories = useMemo(() => {
    const uniqueCats = Object.keys(categoryStats).sort();
    return ["ALL", ...uniqueCats];
  }, [categoryStats]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.item_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "ALL" || p.item_category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const displayStats = useMemo(() => {
    if (selectedCategory !== "ALL") {
      return { [selectedCategory]: categoryStats[selectedCategory] || { total: 0, active: 0 } };
    }
    return categoryStats;
  }, [categoryStats, selectedCategory]);

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#0f172a]" : "bg-[#f8fafc]"}`}>
        <div className={`w-full max-w-md p-8 rounded-[40px] border-2 transition-all duration-500 ${isDark ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white border-blue-500/20 shadow-xl"}`}>
          <div className="flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border-2 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-blue-50 border-blue-100 text-blue-600"}`}>
              <FaLock size={32} />
            </div>
            <h2 className={`text-2xl font-black uppercase tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>Restricted Access</h2>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-8">CNC - STA MARIA PRODUCT LIST</p>
            <form onSubmit={handlePasswordSubmit} className="w-full space-y-4">
              <div className="relative">
                <FaKey className={`absolute left-5 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"}`} size={16} />
                <input type="password" placeholder="Enter Admin Password" value={passwordInput} onChange={(e) => { setPassError(false); setPasswordInput(e.target.value); }} autoFocus className={`w-full pl-14 pr-6 py-4 rounded-2xl outline-none border-2 transition-all font-bold ${passError ? "border-rose-500 bg-rose-500/5 text-rose-500" : isDark ? "bg-slate-800 border-white/5 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500"}`} />
              </div>
              {passError && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-bounce">Access Denied! Incorrect Password.</p>}
              <button type="submit" className="w-full py-4 font-black tracking-widest text-white uppercase transition-all bg-blue-600 shadow-lg rounded-2xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95">Unlock Product List</button>
              <button type="button" onClick={() => navigate(-1)} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-600"}`}>Go Back</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? "bg-[#0f172a]" : "bg-[#f8fafc]"}`}>
      
      {/* --- CONFIRMATION MODAL OVERLAY --- */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-300">
           <div className={`w-full max-w-sm p-8 rounded-[35px] shadow-2xl border-2 transform animate-in zoom-in-95 duration-300 ${isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${pendingStatus === "1" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                  <FaExclamationTriangle size={28} />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight mb-2 ${isDark ? "text-white" : "text-slate-800"}`}>Bulk Update</h3>
                <p className={`text-xs font-bold uppercase mb-8 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Are you sure you want to <span className={pendingStatus === "1" ? "text-emerald-500" : "text-rose-500"}>{pendingStatus === "1" ? "ACTIVATE" : "DEACTIVATE"}</span> all products under <span className="text-blue-500">{selectedCategory}</span>?
                </p>
                <div className="flex w-full gap-3">
                   <button onClick={() => setShowConfirm(false)} className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${isDark ? "border-white/5 text-slate-500 hover:bg-white/5" : "border-slate-100 text-slate-400 hover:bg-slate-50"}`}>Cancel</button>
                   <button onClick={executeBulkUpdate} className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 ${pendingStatus === "1" ? "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600" : "bg-rose-500 shadow-rose-500/30 hover:bg-rose-600"}`}>Confirm</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className={`sticky top-0 z-30 border-b-2 ${isDark ? "bg-slate-900/95 border-white/10" : "bg-white/95 border-slate-200"} backdrop-blur-md px-6 py-4`}>
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center w-full gap-4 md:w-auto">
              <button onClick={() => navigate(-1)} className={`p-3 rounded-2xl border-2 transition-all ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                <FaArrowLeft size={18} />
              </button>
              <div>
                <h1 className={`text-xl font-black uppercase tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>PRODUCT LIST</h1>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">CNC - STA MARIA</p>
              </div>
            </div>

            <div className="flex items-center w-full gap-3 md:w-auto">
              {/* BULK TOGGLE BUTTONS */}
              <div className={`flex items-center gap-2 pr-3 mr-2 border-r-2 ${isDark ? "border-white/10" : "border-slate-200"} ${selectedCategory === "ALL" ? "opacity-20 grayscale pointer-events-none" : ""}`}>
                 <button onClick={() => triggerBulkConfirm("1")} className="p-3 transition-all border-2 rounded-2xl border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-90"><FaCheckCircle size={16} /></button>
                 <button onClick={() => triggerBulkConfirm("0")} className="p-3 transition-all border-2 rounded-2xl border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white active:scale-90"><FaPowerOff size={16} /></button>
              </div>

              <div className="relative flex-grow md:flex-grow-0">
                <FaSearch className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-12 pr-6 py-3 rounded-2xl text-sm w-full md:w-[280px] outline-none border-2 transition-all ${isDark ? "bg-slate-800 border-white/10 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-500"}`} />
              </div>
              <button onClick={fetchProducts} className={`p-3.5 rounded-2xl border-2 transition-all active:scale-95 ${isDark ? "border-white/10 text-slate-400 hover:bg-white/5" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}><FaSyncAlt className={isLoading ? "animate-spin" : ""} size={16} /></button>
              <button onClick={() => setIsAuthenticated(false)} className={`p-3.5 rounded-2xl border-2 transition-all ${isDark ? "border-white/10 text-rose-500 hover:bg-rose-500/10" : "border-slate-200 text-rose-500 hover:bg-rose-50"}`}><FaLock size={16} /></button>
            </div>
          </div>
          
          {/* --- GANDAHAN NATING CATEGORY BUTTONS --- */}
          <div className="flex items-center gap-3 pb-2 mt-6 overflow-x-auto no-scrollbar scroll-smooth">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = cat === "ALL" ? products.length : (categoryStats[cat]?.total || 0);
              
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    relative flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider
                    transition-all duration-300 whitespace-nowrap group
                    ${isActive 
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.5)] scale-105 z-10" 
                      : isDark 
                        ? "bg-slate-800/50 border-2 border-white/5 text-slate-400 hover:border-blue-500/30 hover:text-white" 
                        : "bg-white border-2 border-slate-100 text-slate-500 hover:border-blue-400/30 hover:text-blue-600 shadow-sm"
                    }
                  `}
                >
                  {cat === "ALL" ? <FaThLarge size={12} className={isActive ? "text-white" : "text-blue-500"} /> : null}
                  {cat}
                  
                  {/* Item Count Bubble */}
                  <span className={`
                    px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all duration-300
                    ${isActive 
                      ? "bg-white/20 text-white" 
                      : isDark ? "bg-white/5 text-slate-500 group-hover:bg-blue-500/20 group-hover:text-blue-400" 
                               : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500"
                    }
                  `}>
                    {count}
                  </span>

                  {/* Underline Indicator (Active only) */}
                  {isActive && (
                    <div className="absolute w-8 h-1 -translate-x-1/2 bg-white rounded-full -bottom-1 left-1/2"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-grow p-6 overflow-auto">
        <div className="max-w-[1600px] mx-auto">
          {isLoading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-40">
              <div className="w-12 h-12 border-[5px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 animate-pulse">Syncing Database...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map((item) => {
                const isActive = item.status === "1";
                return (
                  <div key={item.product_id} className={`group relative rounded-[35px] p-6 border-2 transition-all duration-500 ${!isActive ? "bg-slate-100/80 grayscale opacity-60 border-slate-300" : isDark ? "bg-slate-900/60 border-white/20 hover:border-white hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(255,255,255,0.08)]" : "bg-white border-blue-500/40 hover:border-blue-600 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20"}`}>
                    <div className={`absolute top-6 right-6 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 z-10 border ${isActive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></div>
                      {isActive ? "Active" : "Inactive"}
                    </div>
                    <div className={`w-full aspect-square rounded-[28px] flex items-center justify-center mb-6 overflow-hidden border-2 transition-all duration-500 group-hover:scale-[1.03] ${isActive ? (isDark ? "bg-slate-800 border-white/10" : "bg-slate-50 border-blue-500/10") : "bg-slate-200 border-slate-300"}`}>
                      <img src={`${apiHost}/item_pictures/${item.product_id}.jpg`} alt={item.item_name} className="object-cover w-full h-full" onError={(e) => { const defaultPath = `${apiHost}/item_pictures/Default.jpg`; if (e.target.src !== defaultPath) e.target.src = defaultPath; }} />
                    </div>
                    <div className="px-1">
                      <h3 className={`font-black text-sm uppercase mb-1.5 truncate tracking-tight ${isDark && isActive ? "text-white" : "text-slate-800"}`}>{item.item_name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 mb-6"><FaTag className="text-blue-500" size={10} /> {item.unit_of_measure}</p>
                      <div className="flex items-center justify-between pt-5 border-t-2 border-slate-100/10">
                        <p className={`text-xl font-black tracking-tighter ${isActive ? "text-blue-600" : "text-slate-400"}`}>₱{parseFloat(item.selling_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                        <button onClick={() => toggleStatus(item.product_id)} className={`relative w-14 h-7 rounded-full transition-all duration-300 flex items-center p-1.5 border-2 ${isActive ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/30" : "bg-slate-400 border-slate-500 shadow-inner"}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isActive ? "translate-x-7" : "translate-x-0"}`}></div></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className={`p-8 border-t-2 ${isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-600/10"><FaChartPie className="text-blue-600" size={14} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Statistics</p>
          </div>
          <div className="flex gap-5 pb-2 overflow-x-auto no-scrollbar">
            {Object.keys(displayStats).map((cat) => (
              <div key={cat} className={`min-w-[200px] p-5 rounded-[24px] border-2 transition-all duration-300 ${isDark ? "bg-white/5 border-white/10 hover:border-white/30" : "bg-slate-50 border-blue-500/20 hover:border-blue-500/40"}`}>
                <p className={`text-[9px] font-black uppercase mb-2 truncate tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>{cat}</p>
                <div className="flex items-baseline justify-between"><p className="text-2xl font-black text-blue-600">{displayStats[cat].active}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Active / {displayStats[cat].total}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductList;