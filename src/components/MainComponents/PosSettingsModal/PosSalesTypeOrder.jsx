"use client";

import React, { useEffect, useState } from "react";
import { FiList, FiSave, FiLoader, FiArrowUp, FiArrowDown } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosSalesTypeOrder = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [salesTypes, setSalesTypes] = useState([]);
  const [initialOrder, setInitialOrder] = useState([]);
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
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  useEffect(() => {
    if (!apiHost) return;

    let cancelled = false;

    const loadOrder = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(`${apiHost}/api/pos_sales_type_order.php`);
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load sales type order.");
        }

        if (!cancelled) {
          const list = Array.isArray(result?.data?.sales_types)
            ? result.data.sales_types
            : [];
          setSalesTypes(list);
          setInitialOrder(list.map((item) => item.sales_type_id));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load sales type order.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  const moveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= salesTypes.length) return;

    setMessage("");
    setError("");
    setSalesTypes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const currentOrder = salesTypes.map((item) => item.sales_type_id);
  const hasChanges = JSON.stringify(currentOrder) !== JSON.stringify(initialOrder);

  const saveOrder = async () => {
    if (!apiHost || isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(`${apiHost}/api/pos_sales_type_order.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order: currentOrder }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save sales type order.");
      }

      const list = Array.isArray(result?.data?.sales_types)
        ? result.data.sales_types
        : [];
      setSalesTypes(list);
      setInitialOrder(list.map((item) => item.sales_type_id));
      setMessage("Sales type order saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save sales type order.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, rgba(59,91,253,0.18), rgba(30,58,138,0.12))"
                  : "rgba(255,255,255,0.6)",
              }}
            >
              <FiList size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Ordering Screen</span>
            </div>

            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}>
              Sales Type Order
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Arrange the order Sales Types (Dine In, Grab, Take Out, etc.) appear
              in the Service Type dropdown on the ordering screen.
            </p>
          </div>

          <button
            type="button"
            onClick={saveOrder}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Order
          </button>
        </div>
      </div>

      <div className={`rounded-[28px] border p-3 sm:p-4 ${theme.panel}`}>
        {isLoading ? (
          <p className={`px-3 py-6 text-sm ${theme.textMuted}`}>Loading sales types...</p>
        ) : salesTypes.length === 0 ? (
          <p className={`px-3 py-6 text-sm ${theme.textMuted}`}>No active sales types found.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {salesTypes.map((item, index) => (
              <li
                key={item.sales_type_id}
                className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${theme.panelSoft}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black"
                    style={{ backgroundColor: `${accent}1a`, color: accent }}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-sm font-bold ${theme.textPrimary}`}>
                    {item.sales_type}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-30 ${theme.panel} ${theme.textPrimary}`}
                    aria-label="Move up"
                  >
                    <FiArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === salesTypes.length - 1}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-30 ${theme.panel} ${theme.textPrimary}`}
                    aria-label="Move down"
                  >
                    <FiArrowDown size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message ? (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PosSalesTypeOrder;
