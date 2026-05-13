"use client";

import React, { useEffect, useState } from "react";
import { FiPercent, FiSave, FiLoader, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosServiceCharge = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [isEnabled, setIsEnabled] = useState(false);
  const [initialIsEnabled, setInitialIsEnabled] = useState(false);
  const [percentage, setPercentage] = useState("");
  const [initialPercentage, setInitialPercentage] = useState("");
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

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(`${apiHost}/api/pos_service_charge.php`);
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load service charge settings.");
        }

        if (!cancelled) {
          const nextIsEnabled = Boolean(result?.data?.service_charge_enabled || false);
          const nextPercentage = String(Number(result?.data?.service_charge_percentage || 0));
          setIsEnabled(nextIsEnabled);
          setInitialIsEnabled(nextIsEnabled);
          setPercentage(nextPercentage);
          setInitialPercentage(nextPercentage);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load service charge settings.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  const normalizedPercentage = Math.max(Number(percentage || 0), 0);
  const hasChanges = isEnabled !== initialIsEnabled || String(normalizedPercentage) !== String(Number(initialPercentage || 0));

  const saveSettings = async () => {
    if (!apiHost || isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(`${apiHost}/api/pos_service_charge.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_charge_enabled: isEnabled,
          service_charge_percentage: normalizedPercentage,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save service charge settings.");
      }

      const savedIsEnabled = Boolean(result?.data?.service_charge_enabled || false);
      const savedPercentage = String(Number(result?.data?.service_charge_percentage || 0));
      setIsEnabled(savedIsEnabled);
      setInitialIsEnabled(savedIsEnabled);
      setPercentage(savedPercentage);
      setInitialPercentage(savedPercentage);
      setMessage("Service charge settings saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save service charge settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiPercent size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Service Control</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Service Charge
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Automatically apply a service charge percentage to all transactions.
              Enable/disable and set the percentage rate here.
            </p>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Settings
          </button>
        </div>
      </div>

      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div>
            <label
              className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
            >
              Service Charge Status
            </label>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
                setIsEnabled(!isEnabled);
              }}
              disabled={isLoading || isSaving}
              className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                isEnabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : isDark
                    ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-700"
              }`}
            >
              {isEnabled ? (
                <FiToggleRight size={20} />
              ) : (
                <FiToggleLeft size={20} />
              )}
              <span className="text-sm font-bold">
                {isEnabled ? "Enabled" : "Disabled"}
              </span>
            </button>
          </div>

          {/* Percentage Input */}
          <div>
            <label
              className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
            >
              Service Charge Percentage
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={percentage}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    setMessage("");
                    setError("");
                    setPercentage(e.target.value);
                  }}
                  className={`h-14 w-full rounded-2xl border pl-4 pr-12 text-lg font-black outline-none ${theme.input}`}
                  placeholder="0.00"
                  disabled={isLoading || isSaving}
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-6 rounded-2xl border p-4 text-sm ${theme.panelSoft}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>Current settings</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              {initialIsEnabled ? "Enabled" : "Disabled"} • {Number(initialPercentage || 0).toFixed(2)}%
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

export default PosServiceCharge;