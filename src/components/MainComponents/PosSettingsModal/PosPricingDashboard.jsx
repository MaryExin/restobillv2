"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch, FiEdit2, FiCamera, FiPlus, FiRefreshCw,
  FiLoader, FiSave, FiToggleLeft, FiToggleRight,
  FiAlertCircle, FiCheckCircle, FiShoppingBag,
  FiTag, FiFileText, FiLayers,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosPricingDashboard = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const th = {
    card:      isDark ? "bg-slate-900/50 border-slate-800"   : "bg-white border-slate-100",
    panel:     isDark ? "bg-slate-900/40 border-white/5"     : "bg-white border-slate-200 shadow-sm",
    toolbar:   isDark ? "bg-[#020617]/95 border-white/5"     : "bg-white/95 border-slate-200",
    primary:   isDark ? "text-white"     : "text-slate-900",
    muted:     isDark ? "text-slate-400" : "text-slate-500",
    soft:      isDark ? "text-slate-500" : "text-slate-400",
    input:     isDark
      ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
      : "bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400",
    select:    isDark
      ? "bg-slate-900 border-slate-700 text-white"
      : "bg-slate-50 border-slate-100 text-slate-700",
    btn:       isDark
      ? "bg-white/5 border-white/10 hover:bg-white/10"
      : "bg-blue-50 border-blue-100 hover:bg-blue-100",
  };

  // ── Products state ────────────────────────────────────────────────────────────
  const [products, setProducts]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [cacheKey, setCacheKey]             = useState(() => Date.now());
  const [searchTerm, setSearchTerm]         = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [enablePictures, setEnablePictures] = useState(true);

  // ── Config state (read/write) ─────────────────────────────────────────────────
  const [noPriceOnOS, setNoPriceOnOS]               = useState(false);
  const [groupByCategory, setGroupByCategory]       = useState(false);
  const [initNoPriceOnOS, setInitNoPriceOnOS]       = useState(false);
  const [initGroupByCategory, setInitGroupByCategory] = useState(false);
  const [isSavingConfig, setIsSavingConfig]         = useState(false);
  const [configMsg, setConfigMsg]                   = useState("");
  const [configErr, setConfigErr]                   = useState("");

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg]   = useState("");

  // ── Add product modal ─────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    inv_code: "", item_name: "", item_category: "", unit_of_measure: "PC",
    srp: "", vatable: "Yes", isDiscountable: "Yes", target_sales_type: "",
  });

  // ── Edit price modal ──────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingItem, setEditingItem]   = useState(null);
  const [newPrice, setNewPrice]         = useState("");
  const [showConfirm, setShowConfirm]   = useState(false);

  // ── Fetch products ────────────────────────────────────────────────────────────
  const fetchPricingData = useCallback(async () => {
    if (!apiHost) return;
    try {
      setLoading(true);
      const res = await axios.get(`${apiHost}/api/get_pricing.php`);
      const data = res.data;
      setProducts(data);
      setCacheKey(Date.now());
      if (data.length > 0) {
        setSelectedService((prev) => prev || data[0].service_type || "DINE-IN");
        setActiveCategory((prev) => prev || data[0].item_category || "OTHERS");
      }
    } catch (e) {
      console.error("Pricing fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [apiHost]);

  useEffect(() => { fetchPricingData(); }, [fetchPricingData]);

  // ── Fetch order-slip config ───────────────────────────────────────────────────
  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;
    fetch(`${apiHost}/api/pos_order_slip_settings.php`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success) {
          const hp = Boolean(d.data?.hide_price_on_os);
          const gc = Boolean(d.data?.group_by_category);
          setNoPriceOnOS(hp);     setInitNoPriceOnOS(hp);
          setGroupByCategory(gc); setInitGroupByCategory(gc);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiHost]);

  // ── Fetch pictures setting ────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;
    fetch(`${apiHost}/api/pos_pictures_settings.php`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.success) setEnablePictures(Boolean(d.data?.enable_pictures)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiHost]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const triggerToast = (msg) => {
    setToastMsg(msg); setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const hasConfigChanges =
    noPriceOnOS !== initNoPriceOnOS || groupByCategory !== initGroupByCategory;

  const saveConfig = async () => {
    if (!apiHost || isSavingConfig) return;
    try {
      setIsSavingConfig(true); setConfigErr(""); setConfigMsg("");
      const res = await fetch(`${apiHost}/api/pos_order_slip_settings.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hide_price_on_os: noPriceOnOS, group_by_category: groupByCategory }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to save.");
      const hp = Boolean(json.data?.hide_price_on_os);
      const gc = Boolean(json.data?.group_by_category);
      setNoPriceOnOS(hp);     setInitNoPriceOnOS(hp);
      setGroupByCategory(gc); setInitGroupByCategory(gc);
      setConfigMsg("Slip configuration saved.");
    } catch (e) {
      setConfigErr(e.message || "Save failed.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ── Image upload ──────────────────────────────────────────────────────────────
  const handleImageUpload = async (e, itemName) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file); form.append("item_name", itemName); form.append("action", "upload_image");
    try {
      const res = await axios.post(`${apiHost}/api/pricing_engine.php`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.status === "success") { fetchPricingData(); triggerToast("Image updated."); }
    } catch { alert("Upload failed."); }
  };

  const generateInvCode = () =>
    setNewProduct((p) => ({ ...p, inv_code: `BD-${Math.floor(1e9 + Math.random() * 9e9)}` }));

  const handleOpenAddModal = () => {
    generateInvCode();
    setNewProduct((p) => ({ ...p, target_sales_type: selectedService, item_category: categories[0] || "" }));
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item); setNewPrice(item.srp);
    setShowConfirm(false); setIsModalOpen(true);
  };

  const handleAddProduct = async () => {
    const userId = localStorage.getItem("user_id") || "0";
    try {
      const res = await axios.post(`${apiHost}/api/pricing_engine.php`, {
        action: "add", ...newProduct, user_id: userId,
      });
      if (res.data.status === "success") {
        setIsAddModalOpen(false); fetchPricingData(); triggerToast("Product added.");
      }
    } catch { alert("Error adding product."); }
  };

  const executeUpdate = async () => {
    const userId = localStorage.getItem("user_id") || "0";
    try {
      const res = await axios.post(`${apiHost}/api/pricing_engine.php`, {
        action: "update", inv_code: editingItem.inv_code,
        new_price: parseFloat(newPrice), service_type: selectedService, user_id: userId,
      });
      if (res.data.status === "success") {
        setIsModalOpen(false); fetchPricingData(); triggerToast("Price updated.");
      }
    } catch { alert("Update failed."); }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const categories   = [...new Set(products.map((p) => p.item_category || "OTHERS"))];
  const serviceTypes = [...new Set(products.map((p) => p.service_type))].filter(Boolean);
  const uomList      = ["PC", "BOX", "KILO", "PACK", "BOTTLE"];

  const filteredProducts = products
    .filter(
      (item) =>
        item.service_type === selectedService &&
        (item.item_category || "OTHERS") === activeCategory &&
        (item.item_description || "").toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) =>
      groupByCategory
        ? (a.item_category || "OTHERS").localeCompare(b.item_category || "OTHERS") ||
          (a.item_description || "").localeCompare(b.item_description || "")
        : 0,
    );

  return (
    <div className="space-y-5">

      {/* ── Header card with config toggles ──────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${th.panel}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Title + description */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiTag size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Pricing Engine</span>
            </div>
            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${th.primary}`}>
              Product <span style={{ color: accent }}>Pricing</span>
            </h2>
            <p className={`mt-3 max-w-xl text-sm ${th.muted}`}>
              Manage product prices, upload images, add inventory items, and
              configure how prices appear on printed order slips.
            </p>
          </div>

          {/* Right: Config toggles + save button */}
          <div className="flex flex-col gap-3 lg:items-end flex-shrink-0">
            <div className="flex gap-3 flex-wrap lg:justify-end">
              <button
                type="button"
                onClick={() => { setConfigMsg(""); setConfigErr(""); setNoPriceOnOS((v) => !v); }}
                disabled={isSavingConfig}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-all ${
                  noPriceOnOS
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : isDark
                      ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
                      : "border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                <FiFileText size={13} />
                <span>No Price on OS</span>
                {noPriceOnOS ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
              </button>

              <button
                type="button"
                onClick={() => { setConfigMsg(""); setConfigErr(""); setGroupByCategory((v) => !v); }}
                disabled={isSavingConfig}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-all ${
                  groupByCategory
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : isDark
                      ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
                      : "border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                <FiLayers size={13} />
                <span>Per Category</span>
                {groupByCategory ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
              </button>
            </div>

            <button
              type="button"
              onClick={saveConfig}
              disabled={isSavingConfig || !hasConfigChanges}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
            >
              {isSavingConfig ? <FiLoader className="animate-spin" size={14} /> : <FiSave size={14} />}
              Save Slip Config
            </button>

            {configMsg && (
              <p className="text-xs font-bold text-emerald-500 lg:text-right">{configMsg}</p>
            )}
            {configErr && (
              <p className="text-xs font-bold text-red-500 lg:text-right">{configErr}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky toolbar ────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-20 rounded-[24px] border backdrop-blur-xl p-4 ${th.toolbar}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className={`flex-shrink-0 rounded-2xl border px-4 py-2.5 text-[11px] font-black outline-none cursor-pointer ${th.select}`}
          >
            {serviceTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
          </select>

          <div className="relative flex-1 min-w-[160px]">
            <FiSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-2xl border py-2.5 pl-9 pr-4 text-[11px] font-bold outline-none ${th.input}`}
            />
          </div>

        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 pt-3 overflow-x-auto no-scrollbar">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 rounded-xl px-4 py-1.5 text-[10px] font-black uppercase border transition-all ${
                  activeCategory === cat
                    ? "text-white scale-105 shadow-md"
                    : isDark
                      ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                }`}
                style={activeCategory === cat ? { backgroundColor: accent, borderColor: accent } : {}}
              >
                {cat}
                {groupByCategory && activeCategory === cat && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-white/60 align-middle" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Product grid ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <FiLoader size={32} className="animate-spin" style={{ color: accent }} />
          <p className={`text-[11px] font-black uppercase tracking-widest ${th.soft}`}>
            Loading products…
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <FiShoppingBag size={36} className={th.soft} strokeWidth={1.5} />
          <p className={`text-[11px] font-black uppercase tracking-widest ${th.soft}`}>
            No products found
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            enablePictures
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {filteredProducts.map((item, idx) => (
            <motion.div
              layout
              key={idx}
              className={`relative flex flex-col overflow-hidden rounded-[2rem] border group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${th.card}`}
            >
              {enablePictures && (
                <div className={`relative w-full overflow-hidden aspect-square ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <img
                    src={`${apiHost}/item_pictures/${item.item_description}.jpg?t=${cacheKey}`}
                    className="object-cover w-full h-full transition-transform group-hover:scale-105"
                    onError={(e) => {
                      e.target.src = `${apiHost}/item_pictures/default.jpg?t=${cacheKey}`;
                    }}
                    alt={item.item_description}
                  />
                </div>
              )}

              <div className="flex flex-col justify-between flex-1 p-4">
                <div>
                  <p
                    className="text-[8px] font-black uppercase tracking-tight"
                    style={{ color: accent }}
                  >
                    {item.inv_code}
                  </p>
                  <h3 className={`text-[11px] font-black leading-tight uppercase line-clamp-2 mt-0.5 ${th.primary}`}>
                    {item.item_description}
                  </h3>
                  {groupByCategory && (
                    <span
                      className={`inline-block mt-1.5 px-2 py-0.5 text-[8px] font-black uppercase rounded-lg tracking-wide border ${
                        isDark
                          ? "bg-white/5 border-white/10 text-slate-400"
                          : "bg-blue-50 border-blue-100 text-blue-500"
                      }`}
                    >
                      {item.item_category || "OTHERS"}
                    </span>
                  )}
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[18px] font-black" style={{ color: accent }}>
                      ₱{Number(item.srp).toLocaleString()}
                    </p>
                    {noPriceOnOS && (
                      <span
                        className={`text-[8px] font-black uppercase rounded-lg px-1.5 py-0.5 border ${
                          isDark ? "text-slate-500 border-slate-700" : "text-slate-400 border-slate-200"
                        }`}
                      >
                        Hidden on OS
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label
                      className={`p-2 rounded-xl border cursor-pointer transition-colors ${th.btn}`}
                      style={{ color: accent }}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, item.item_description)}
                      />
                      <FiCamera size={12} strokeWidth={2.5} />
                    </label>
                    <button
                      onClick={() => openEditModal(item)}
                      className={`p-2 rounded-xl border transition-colors ${th.btn}`}
                      style={{ color: accent }}
                    >
                      <FiEdit2 size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Success toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-10 z-[10000000] flex items-center gap-4 px-8 py-5 bg-white border border-blue-100 rounded-3xl shadow-2xl left-1/2 -translate-x-1/2"
          >
            <FiCheckCircle className="text-blue-600" size={22} />
            <p className="text-[13px] font-bold text-slate-700">{toastMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Product Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-[450px] bg-white rounded-[2.5rem] p-10 shadow-2xl border border-white max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <h2 className="mb-8 text-xs font-black uppercase text-slate-700 tracking-[0.2em] flex items-center gap-2">
                <FiPlus size={14} className="text-blue-600" /> New Inventory Entry
              </h2>

              <div className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Product ID</label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        readOnly
                        value={newProduct.inv_code}
                        className="w-full px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black text-blue-600 border border-slate-100"
                      />
                      <button
                        onClick={generateInvCode}
                        className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-300 hover:text-blue-500"
                      >
                        <FiRefreshCw size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Sales Mode</label>
                    <select
                      value={newProduct.target_sales_type}
                      onChange={(e) => setNewProduct({ ...newProduct, target_sales_type: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100 outline-none"
                    >
                      {serviceTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Product Name</label>
                  <input
                    type="text"
                    value={newProduct.item_name}
                    onChange={(e) => setNewProduct({ ...newProduct, item_name: e.target.value })}
                    className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-bold border border-slate-100 outline-none"
                    placeholder="Enter product name..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Category</label>
                    <select
                      value={newProduct.item_category}
                      onChange={(e) => setNewProduct({ ...newProduct, item_category: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100 uppercase"
                    >
                      {categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">UOM</label>
                    <select
                      value={newProduct.unit_of_measure}
                      onChange={(e) => setNewProduct({ ...newProduct, unit_of_measure: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100"
                    >
                      {uomList.map((u, i) => <option key={i} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Selling Price (SRP)</label>
                  <input
                    type="number"
                    value={newProduct.srp}
                    onChange={(e) => setNewProduct({ ...newProduct, srp: e.target.value })}
                    className="w-full px-4 py-3 mt-1 text-lg font-black text-blue-600 border outline-none bg-slate-50 rounded-xl"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Vatable</label>
                    <select
                      value={newProduct.vatable}
                      onChange={(e) => setNewProduct({ ...newProduct, vatable: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Discountable</label>
                    <select
                      value={newProduct.isDiscountable}
                      onChange={(e) => setNewProduct({ ...newProduct, isDiscountable: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-10">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-4 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-[1.2rem]"
                >
                  Abort
                </button>
                <button
                  onClick={handleAddProduct}
                  className="py-4 text-white text-[10px] font-black uppercase rounded-[1.2rem] shadow-lg"
                  style={{ backgroundColor: accent }}
                >
                  Save Entry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Price Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-[300px] bg-white rounded-[2.5rem] p-10 shadow-2xl text-center border border-white"
            >
              {!showConfirm ? (
                <>
                  <div
                    className="flex items-center justify-center mx-auto mb-4 w-14 h-14 rounded-2xl"
                    style={{ backgroundColor: "rgba(37,99,235,0.06)", color: accent }}
                  >
                    <FiEdit2 size={22} />
                  </div>
                  <p
                    className="text-[10px] font-black uppercase mb-2"
                    style={{ color: accent }}
                  >
                    {selectedService}
                  </p>
                  <h2 className="mb-8 text-xs font-black leading-snug uppercase text-slate-700 line-clamp-2">
                    {editingItem?.item_description}
                  </h2>
                  <div className="relative mb-8">
                    <span className="absolute text-xl font-black -translate-y-1/2 left-5 top-1/2 text-slate-300">
                      ₱
                    </span>
                    <input
                      autoFocus
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full py-5 pl-10 pr-6 text-3xl font-black transition-all border-2 outline-none bg-slate-50 border-slate-50 rounded-2xl text-slate-800 focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full py-4 text-white text-[11px] font-black uppercase rounded-2xl shadow-lg"
                    style={{ backgroundColor: accent }}
                  >
                    Update Price
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="mt-4 text-[10px] font-black uppercase text-slate-400"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <div className="py-2">
                  <div
                    className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full"
                    style={{ backgroundColor: "rgba(37,99,235,0.06)", color: accent }}
                  >
                    <FiAlertCircle size={32} />
                  </div>
                  <h3 className="mb-2 text-lg font-black tracking-tight uppercase text-slate-800">
                    Confirm Change?
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="py-4 bg-slate-100 text-slate-500 text-[10px] font-black rounded-xl uppercase"
                    >
                      No
                    </button>
                    <button
                      onClick={executeUpdate}
                      className="py-4 text-white text-[10px] font-black rounded-xl uppercase shadow-lg"
                      style={{ backgroundColor: accent }}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosPricingDashboard;
