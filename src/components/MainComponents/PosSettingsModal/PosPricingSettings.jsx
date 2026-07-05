"use client";

import React, { useEffect, useState } from "react";
import {
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiLoader,
  FiSave,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosPricingSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [noPriceOnOS, setNoPriceOnOS]               = useState(false);
  const [groupByCategory, setGroupByCategory]         = useState(false);
  const [initNoPriceOnOS, setInitNoPriceOnOS]         = useState(false);
  const [initGroupByCategory, setInitGroupByCategory] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [message, setMessage]     = useState("");
  const [error, setError]         = useState("");

  const th = {
    panel:     isDark ? "bg-slate-900/40 border-white/5"   : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    primary:   isDark ? "text-white"     : "text-slate-900",
    muted:     isDark ? "text-slate-400" : "text-slate-500",
    soft:      isDark ? "text-slate-500" : "text-slate-400",
  };

  // ── Load settings ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        const res  = await fetch(`${apiHost}/api/pos_order_slip_settings.php`);
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to load.");
        if (!cancelled) {
          const hp = Boolean(json.data?.hide_price_on_os);
          const gc = Boolean(json.data?.group_by_category);
          setNoPriceOnOS(hp);       setInitNoPriceOnOS(hp);
          setGroupByCategory(gc);   setInitGroupByCategory(gc);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load pricing settings.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiHost]);

  const hasChanges = noPriceOnOS !== initNoPriceOnOS || groupByCategory !== initGroupByCategory;

  // ── Save settings ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!apiHost || isSaving) return;
    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      const res  = await fetch(`${apiHost}/api/pos_order_slip_settings.php`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ hide_price_on_os: noPriceOnOS, group_by_category: groupByCategory }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to save.");
      const hp = Boolean(json.data?.hide_price_on_os);
      const gc = Boolean(json.data?.group_by_category);
      setNoPriceOnOS(hp);       setInitNoPriceOnOS(hp);
      setGroupByCategory(gc);   setInitGroupByCategory(gc);
      setMessage("Pricing settings saved successfully.");
    } catch (e) {
      setError(e.message || "Failed to save pricing settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reusable toggle card ─────────────────────────────────────────────────────
  const Toggle = ({ icon: Icon, label, description, value, onChange }) => (
    <div className={`rounded-[24px] border p-5 sm:p-6 space-y-4 ${th.panelSoft}`}>
      {/* Icon + label row */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex-shrink-0 p-2 rounded-xl"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(37,99,235,0.06)", color: accent }}
        >
          <Icon size={15} strokeWidth={2.5} />
        </div>
        <div>
          <p className={`text-sm font-black leading-tight ${th.primary}`}>{label}</p>
          <p className={`text-xs mt-1 leading-relaxed ${th.muted}`}>{description}</p>
        </div>
      </div>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => { setMessage(""); setError(""); onChange(!value); }}
        disabled={isLoading || isSaving}
        className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
          value
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : isDark
              ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
              : "border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-700"
        }`}
      >
        {value ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
        <span className="text-sm font-bold">{value ? "Enabled" : "Disabled"}</span>
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${th.panel}`}>
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {/* Chip */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiDollarSign size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Order Slip Config</span>
            </div>

            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${th.primary}`}>
              Pricing &{" "}
              <span style={{ color: accent }}>Order Slip</span>
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${th.muted}`}>
              Control how item prices and product categories are handled when
              kitchen or order slips are printed. Changes apply globally across
              all ordering and printing modules.
            </p>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={save}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Settings
          </button>
        </div>
      </div>

      {/* ── Toggle cards ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={`rounded-[28px] border p-16 text-center ${th.panel} flex flex-col items-center gap-4`}>
          <FiLoader size={36} className="animate-spin" style={{ color: accent }} />
          <p className={`text-[11px] font-black uppercase tracking-widest ${th.soft}`}>
            Loading settings…
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle
            icon={FiFileText}
            label="No Price on Order Slip"
            description="When enabled, item prices are stripped from all kitchen and order slips. Only item names and quantities are printed — totals, unit prices, and subtotals are fully hidden."
            value={noPriceOnOS}
            onChange={setNoPriceOnOS}
          />
          <Toggle
            icon={FiLayers}
            label="Per Category Sort"
            description="When enabled, items on order slips and receipts are automatically sorted and grouped by their product category before printing, making kitchen workflow easier to follow."
            value={groupByCategory}
            onChange={setGroupByCategory}
          />
        </div>
      )}

      {/* ── Saved-state summary ──────────────────────────────────────────────── */}
      {!isLoading && (
        <div className={`rounded-[24px] border p-4 sm:p-5 ${th.panelSoft}`}>
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <span className={`text-xs font-black uppercase tracking-widest ${th.soft}`}>
              Saved State
            </span>
            <div className="flex items-center gap-6">
              <span className={`text-xs ${th.muted}`}>
                No Price on OS:{" "}
                <span className={`font-black ${initNoPriceOnOS ? "text-emerald-500" : th.soft}`}>
                  {initNoPriceOnOS ? "ON" : "OFF"}
                </span>
              </span>
              <span className={`text-xs ${th.muted}`}>
                Per Category Sort:{" "}
                <span className={`font-black ${initGroupByCategory ? "text-emerald-500" : th.soft}`}>
                  {initGroupByCategory ? "ON" : "OFF"}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────────────── */}
      {message && (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
          {error}
        </p>
      )}
    </div>
  );
};

export default PosPricingSettings;
