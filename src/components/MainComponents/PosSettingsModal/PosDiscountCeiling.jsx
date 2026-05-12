"use client";

import React, { useEffect, useState } from "react";
import { FiPercent, FiSave, FiLoader } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosDiscountCeiling = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [amount, setAmount] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    input: isDark
      ? "bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  useEffect(() => {
    if (!apiHost) return;

    let cancelled = false;

    const loadSetting = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(`${apiHost}/api/pos_discount_ceiling.php`);
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load discount ceiling.");
        }

        if (!cancelled) {
          const nextAmount = String(Number(result?.data?.discount_ceiling || 0));
          setAmount(nextAmount);
          setInitialAmount(nextAmount);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load discount ceiling.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSetting();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  const normalizedAmount = Math.max(Number(amount || 0), 0);
  const hasChanges = String(normalizedAmount) !== String(Number(initialAmount || 0));

  const saveSetting = async () => {
    if (!apiHost || isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(`${apiHost}/api/pos_discount_ceiling.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          discount_ceiling: normalizedAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save discount ceiling.");
      }

      const savedAmount = String(Number(result?.data?.discount_ceiling || 0));
      setAmount(savedAmount);
      setInitialAmount(savedAmount);
      setMessage("Discount ceiling saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save discount ceiling.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
              <FiPercent size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Discount Control</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Discount Ceiling
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Set the maximum discount amount the POS payment modal can apply.
              Use 0 to leave discounts uncapped.
            </p>
          </div>

          <button
            type="button"
            onClick={saveSetting}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Ceiling
          </button>
        </div>
      </div>

      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <label
          className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
        >
          Ceiling Amount
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
              PHP
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => {
                setMessage("");
                setError("");
                setAmount(e.target.value);
              }}
              className={`h-14 w-full rounded-2xl border pl-16 pr-4 text-lg font-black outline-none ${theme.input}`}
              placeholder="0.00"
              disabled={isLoading || isSaving}
            />
          </div>
        </div>

        <div className={`mt-4 rounded-2xl border p-4 text-sm ${theme.panelSoft}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>Current ceiling</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              PHP {Number(initialAmount || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default PosDiscountCeiling;
