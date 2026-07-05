"use client";

import React, { useEffect, useState } from "react";
import { FiUsers, FiSave, FiLoader, FiShoppingCart } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const MODES = [
  {
    value: "PerCustomer",
    label: "Per Customer",
    icon: FiUsers,
    description:
      "Discount is prorated based on the ratio of qualified customers to total customers. " +
      "The total discountable amount is divided equally among all customers, and only the qualified customers' share is discounted.",
    example: "5 customers, 2 seniors, ₱1,000 discountable → Senior base = ₱400 → Discount = ₱80",
  },
  {
    value: "PerProduct",
    label: "Per Product",
    icon: FiShoppingCart,
    description:
      "Cashier selects which discountable products to include. The discount is computed only on those " +
      "selected items, still prorated by per-person share (selected base ÷ total customers × qualified count).",
    example: "10 customers, 1 senior, selected item ₱329 → pax share ₱29.38 → Discount ₱5.88",
  },
];

const PosDiscountMode = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [mode, setMode] = useState("PerCustomer");
  const [savedMode, setSavedMode] = useState("PerCustomer");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    card: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");
        const res = await fetch(`${apiHost}/api/pos_discount_mode.php`);
        const result = await res.json();
        if (!cancelled) {
          const val = result?.data?.discount_mode || "PerCustomer";
          setMode(val);
          setSavedMode(val);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load discount mode.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [apiHost]);

  const hasChanges = mode !== savedMode;

  const save = async () => {
    if (!apiHost || isSaving) return;
    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      const res = await fetch(`${apiHost}/api/pos_discount_mode.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_mode: mode }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) throw new Error(result?.message || "Failed to save.");
      setSavedMode(mode);
      setMessage("Discount mode saved.");
    } catch (err) {
      setError(err.message || "Failed to save discount mode.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
              <FiUsers size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Discount Control</span>
            </div>

            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}>
              Discount Mode
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Choose how statutory discounts (Senior, PWD, NAAC, Solo Parent) are computed
              relative to the total bill.
            </p>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Mode
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm font-semibold text-emerald-500">{message}</p>
        )}
        {error && (
          <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>
        )}
      </div>

      {/* Mode cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {MODES.map(({ value, label, icon: Icon, description, example }) => {
          const isSelected = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); setMessage(""); setError(""); }}
              className={`relative flex flex-col gap-3 rounded-[28px] border p-6 text-left transition-all ${
                isSelected
                  ? "border-2 shadow-lg"
                  : `${theme.card} hover:border-current/20`
              }`}
              style={
                isSelected
                  ? { borderColor: accent, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }
                  : {}
              }
            >
              {/* Selected indicator */}
              {isSelected && (
                <span
                  className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                  style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
                >
                  ✓
                </span>
              )}

              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: isSelected ? accent : undefined, opacity: isSelected ? 1 : 0.4 }}
              >
                <Icon size={20} style={{ color: isSelected ? (isDark ? "#0f172a" : "#ffffff") : (isDark ? "#94a3b8" : "#64748b") }} />
              </div>

              <div>
                <p className={`text-base font-black ${theme.textPrimary}`}>{label}</p>
                <p className={`mt-1 text-xs leading-relaxed ${theme.textMuted}`}>{description}</p>
              </div>

              <div
                className="rounded-xl px-3 py-2 text-[10px] font-semibold leading-relaxed"
                style={{
                  backgroundColor: isSelected ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)") : undefined,
                  color: isSelected ? (isDark ? "#94a3b8" : "#64748b") : (isDark ? "#475569" : "#94a3b8"),
                  border: `1px solid ${isSelected ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent"}`,
                }}
              >
                Example: {example}
              </div>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className={`text-center text-sm ${theme.textSoft}`}>Loading…</p>
      )}
    </div>
  );
};

export default PosDiscountMode;
