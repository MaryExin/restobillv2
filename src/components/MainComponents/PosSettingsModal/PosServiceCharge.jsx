"use client";
/* eslint-disable react/prop-types */

import { useEffect, useState, useCallback } from "react";
import {
  FiPercent, FiSave, FiLoader, FiToggleLeft, FiToggleRight, FiPlus, FiTrash2,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";
import {
  DEFAULT_SERVICE_CHARGE_BASIS,
  normalizeServiceChargeBasis,
  VAT_EXCLUSIVE_LESS_DISCOUNT,
} from "../../../utils/serviceChargeMath";

const RATE_TYPES = ["Percentage", "Fixed"];

const mutationHeaders = (headers = {}) => {
  const nextHeaders = { ...headers };
  const token = window.localStorage.getItem("access_token");
  if (token) nextHeaders.Authorization = `Bearer ${token}`;
  return nextHeaders;
};

const PosServiceCharge = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  // Global master switch (tbl_pos_settings)
  const [globalEnabled, setGlobalEnabled]               = useState(false);
  const [initialGlobalEnabled, setInitialGlobalEnabled] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal]             = useState(false);
  const [calculationBasis, setCalculationBasis] = useState(DEFAULT_SERVICE_CHARGE_BASIS);
  const [initialCalculationBasis, setInitialCalculationBasis] = useState(DEFAULT_SERVICE_CHARGE_BASIS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Charge list (tbl_pos_list_of_other_charges)
  const [charges, setCharges]   = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add new charge form
  const [newName, setNewName]         = useState("");
  const [newAmount, setNewAmount]     = useState("");
  const [newRateType, setNewRateType] = useState("Percentage");
  const [isAdding, setIsAdding]       = useState(false);

  const [savingId, setSavingId]   = useState(null); // ID being saved
  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");

  const t = {
    panel:     isDark ? "bg-slate-900/40 border-white/5"   : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    input:     isDark
      ? "bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    primary: isDark ? "text-white"     : "text-slate-900",
    muted:   isDark ? "text-slate-400" : "text-slate-500",
    soft:    isDark ? "text-slate-500" : "text-slate-400",
    label:   `mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] ${isDark ? "text-slate-500" : "text-slate-400"}`,
  };

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!apiHost) return;
    setIsLoading(true);
    setSettingsLoaded(false);
    setError("");
    try {
      const [scRes, listRes] = await Promise.all([
        fetch(`${apiHost}/api/pos_service_charge.php`),
        fetch(`${apiHost}/api/pos_manage_other_charges.php`),
      ]);
      const sc   = await scRes.json();
      const list = await listRes.json();

      if (!scRes.ok || !sc?.success) {
        throw new Error(sc?.message || "Failed to load service charge settings.");
      }
      if (sc?.success) {
        const v = Boolean(sc?.data?.service_charge_enabled || false);
        const basis = normalizeServiceChargeBasis(sc?.data?.service_charge_basis);
        setGlobalEnabled(v);
        setInitialGlobalEnabled(v);
        setCalculationBasis(basis);
        setInitialCalculationBasis(basis);
        setSettingsLoaded(true);
      }
      if (list?.success) {
        setCharges(Array.isArray(list.charges) ? list.charges : []);
      }
    } catch (err) {
      setError(err.message || "Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }, [apiHost]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (msg, isErr = false) => {
    if (isErr) setError(msg); else setMessage(msg);
    if (!isErr) setError("");  else setMessage("");
  };

  // ── Save global toggle ────────────────────────────────────────────────────
  const saveGlobal = async () => {
    if (!apiHost || !settingsLoaded || isSavingGlobal) return;
    setIsSavingGlobal(true);
    setError(""); setMessage("");
    try {
      const res    = await fetch(`${apiHost}/api/pos_service_charge.php`, {
        method: "POST",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          service_charge_enabled:    globalEnabled,
          service_charge_percentage: 0,
          service_charge_type:       "",
          service_charge_basis:      calculationBasis,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) throw new Error(result?.message || "Failed to save.");
      const v = Boolean(result?.data?.service_charge_enabled || false);
      const basis = normalizeServiceChargeBasis(result?.data?.service_charge_basis);
      setGlobalEnabled(v); setInitialGlobalEnabled(v);
      setCalculationBasis(basis); setInitialCalculationBasis(basis);
      flash("Service charge settings saved.");
    } catch (err) {
      flash(err.message || "Failed to save.", true);
    } finally {
      setIsSavingGlobal(false);
    }
  };

  // ── Toggle individual charge ──────────────────────────────────────────────
  const toggleCharge = async (id, currentEnabled) => {
    if (!apiHost || savingId !== null) return;
    setSavingId(id);
    try {
      const res    = await fetch(`${apiHost}/api/pos_manage_other_charges.php`, {
        method: "PUT",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id, is_enabled: currentEnabled ? 0 : 1 }),
      });
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || "Failed to update.");
      setCharges(Array.isArray(result.charges) ? result.charges : []);
    } catch (err) {
      flash(err.message || "Failed to update.", true);
    } finally {
      setSavingId(null);
    }
  };

  // ── Save amount/rate_type for a charge ────────────────────────────────────
  const saveCharge = async (id, amount, rateType) => {
    if (!apiHost || savingId !== null) return;
    setSavingId(id);
    setError(""); setMessage("");
    try {
      const res    = await fetch(`${apiHost}/api/pos_manage_other_charges.php`, {
        method: "PUT",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id, amount: Number(amount || 0), rate_type: rateType }),
      });
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || "Failed to save.");
      setCharges(Array.isArray(result.charges) ? result.charges : []);
      flash("Saved.");
    } catch (err) {
      flash(err.message || "Failed to save.", true);
    } finally {
      setSavingId(null);
    }
  };

  // ── Delete charge ─────────────────────────────────────────────────────────
  const deleteCharge = async (id) => {
    if (!apiHost || deletingId !== null) return;
    setDeletingId(id);
    setError(""); setMessage("");
    try {
      const res    = await fetch(`${apiHost}/api/pos_manage_other_charges.php`, {
        method: "DELETE",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || "Failed to delete.");
      setCharges(Array.isArray(result.charges) ? result.charges : []);
      flash("Charge removed.");
    } catch (err) {
      flash(err.message || "Failed to delete.", true);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Add new charge ────────────────────────────────────────────────────────
  const addCharge = async () => {
    const name = newName.trim();
    if (!name || !apiHost || isAdding) return;
    setIsAdding(true);
    setError(""); setMessage("");
    try {
      const res    = await fetch(`${apiHost}/api/pos_manage_other_charges.php`, {
        method: "POST",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ particulars: name, amount: Number(newAmount || 0), rate_type: newRateType }),
      });
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || "Failed to add.");
      setCharges(Array.isArray(result.charges) ? result.charges : []);
      setNewName(""); setNewAmount(""); setNewRateType("Percentage");
      flash(`"${name}" added.`);
    } catch (err) {
      flash(err.message || "Failed to add charge.", true);
    } finally {
      setIsAdding(false);
    }
  };

  // Local edit state — track per-row amount/rate edits before saving
  const [localEdits, setLocalEdits] = useState({});
  const getLocal = (id, field, fallback) =>
    localEdits[id]?.[field] !== undefined ? localEdits[id][field] : fallback;
  const setLocal = (id, field, value) =>
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const globalChanged =
    globalEnabled !== initialGlobalEnabled || calculationBasis !== initialCalculationBasis;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${t.panel}`}>
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
          <FiPercent size={12} style={{ color: accent }} />
          <span style={{ color: accent }}>Service Control</span>
        </div>
        <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${t.primary}`}>
          Service Charge
        </h2>
        <p className={`mt-2 max-w-2xl text-sm ${t.muted}`}>
          Manage charge types and auto-apply percentages or fixed amounts to billing and payment.
        </p>
      </div>

      {/* ── Global master switch ─────────────────────────────────────────── */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${t.panel}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-base font-black uppercase tracking-wide ${t.primary}`}>Master Switch</p>
            <p className={`text-xs mt-0.5 ${t.muted}`}>
              When OFF, no auto-charges are applied even if individual charges are enabled.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setMessage(""); setError(""); setGlobalEnabled(!globalEnabled); }}
              disabled={!settingsLoaded || isLoading || isSavingGlobal}
              className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                globalEnabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : isDark
                    ? "border-slate-700 bg-slate-800 text-slate-400"
                    : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
            >
              {globalEnabled ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
              <span className="text-sm font-bold">{globalEnabled ? "Enabled" : "Disabled"}</span>
            </button>
            <button
              type="button"
              onClick={saveGlobal}
              disabled={!settingsLoaded || !globalChanged || isLoading || isSavingGlobal}
              aria-label="Save service charge settings"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {isSavingGlobal ? <FiLoader size={14} className="animate-spin" /> : <FiSave size={14} />}
              Save
            </button>
          </div>
        </div>

        <div className={`mt-5 rounded-2xl border p-4 sm:p-5 ${t.panelSoft}`}>
          <label
            htmlFor="service-charge-basis"
            className={`block text-sm font-[Poppins-SemiBold] ${t.primary}`}
          >
            Calculation basis
          </label>
          <p id="service-charge-basis-help" className={`mt-1 text-xs leading-relaxed ${t.muted}`}>
            Choose how percentage charges are calculated. This applies to all percentage charge
            types below. Fixed amounts stay the same.
          </p>
          <select
            id="service-charge-basis"
            aria-describedby="service-charge-basis-help"
            value={calculationBasis}
            onChange={(event) => {
              setCalculationBasis(event.target.value);
              setMessage(""); setError("");
            }}
            disabled={!settingsLoaded || isLoading || isSavingGlobal}
            className={`mt-3 min-h-[44px] w-full rounded-xl border px-3 py-2 text-sm font-[Poppins-Regular] outline-none focus:ring-2 focus:ring-[var(--app-accent)] disabled:opacity-60 ${t.input}`}
          >
            <option value={DEFAULT_SERVICE_CHARGE_BASIS}>
              After deductions, then remove VAT (current)
            </option>
            <option value={VAT_EXCLUSIVE_LESS_DISCOUNT}>
              Remove VAT, then deduct discounts
            </option>
          </select>
          <div className={`mt-4 text-xs leading-relaxed font-[Poppins-Regular] ${t.muted}`}>
            <p>
              {calculationBasis === VAT_EXCLUSIVE_LESS_DISCOUNT
                ? "Remove VAT from VATable items, keep non-VAT items at full value, then subtract discounts."
                : "Subtract discounts and VAT exemptions from the gross total, then divide by 1.12."}
            </p>
            <p className={`mt-2 font-[Poppins-Medium] ${t.primary}`}>
              Example: ₱1,760 VAT-inclusive subtotal, ₱78.57 discount, ₱47.14 VAT exemption, 5% charge.
            </p>
            <p className="mt-1">
              {calculationBasis === VAT_EXCLUSIVE_LESS_DISCOUNT
                ? "Base: ₱1,492.86 · Service charge: ₱74.64 · Amount due: ₱1,708.93"
                : "Base: ₱1,459.19 · Service charge: ₱72.96 · Amount due: ₱1,707.25"}
            </p>
            <p className="mt-2">Save to use this method for future billing calculations. Existing saved bills keep their charges.</p>
          </div>
        </div>

        {message && <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">{message}</p>}
        {error   && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">{error}</p>}
      </div>

      {/* ── Charge list ──────────────────────────────────────────────────── */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${t.panel}`}>
        <p className={`text-base font-black uppercase tracking-wide mb-1 ${t.primary}`}>Charge Types</p>
        <p className={`text-xs mb-5 ${t.muted}`}>
          Each enabled charge is automatically applied to billing and payment. Changes to amount/rate take effect after clicking Save on that row.
        </p>

        {isLoading ? (
          <div className={`flex items-center gap-2 text-sm ${t.muted}`}>
            <FiLoader size={14} className="animate-spin" /> Loading...
          </div>
        ) : charges.length === 0 ? (
          <p className={`text-sm ${t.muted}`}>No charge types yet. Add one below.</p>
        ) : (
          <div className="space-y-3">
            {charges.map((charge) => {
              const id        = Number(charge.ID);
              const enabled   = Boolean(charge.is_enabled);
              const amt       = getLocal(id, "amount",   String(charge.amount));
              const rateType  = getLocal(id, "rate_type", charge.rate_type || "Percentage");
              const isDirty   =
                amt !== String(charge.amount) ||
                rateType !== (charge.rate_type || "Percentage");

              return (
                <div
                  key={id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${t.panelSoft} ${
                    enabled ? "border-emerald-500/30" : ""
                  }`}
                >
                  {/* Enable toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCharge(id, enabled)}
                    disabled={savingId !== null}
                    className={`flex-shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      enabled
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                        : isDark
                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                          : "bg-white text-slate-500 border border-slate-200"
                    }`}
                  >
                    {savingId === id ? (
                      <FiLoader size={14} className="animate-spin" />
                    ) : enabled ? (
                      <FiToggleRight size={14} />
                    ) : (
                      <FiToggleLeft size={14} />
                    )}
                    {enabled ? "ON" : "OFF"}
                  </button>

                  {/* Name */}
                  <span className={`flex-1 text-sm font-bold ${t.primary}`}>{charge.particulars}</span>

                  {/* Amount */}
                  <div className="relative w-36">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amt}
                      onChange={(e) => setLocal(id, "amount", e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`h-10 w-full rounded-xl border pl-3 pr-8 text-sm outline-none ${t.input}`}
                      placeholder="0.00"
                    />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${t.soft}`}>
                      {rateType === "Percentage" ? "%" : "₱"}
                    </span>
                  </div>

                  {/* Rate type */}
                  <select
                    value={rateType}
                    onChange={(e) => setLocal(id, "rate_type", e.target.value)}
                    className={`h-10 rounded-xl border px-3 text-sm outline-none ${t.input}`}
                  >
                    {RATE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>

                  {/* Save row */}
                  <button
                    type="button"
                    onClick={() => saveCharge(id, amt, rateType)}
                    disabled={!isDirty || savingId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white transition disabled:opacity-40"
                    style={{ backgroundColor: accent }}
                  >
                    {savingId === id ? <FiLoader size={12} className="animate-spin" /> : <FiSave size={12} />}
                    Save
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteCharge(id)}
                    disabled={deletingId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    {deletingId === id ? <FiLoader size={12} className="animate-spin" /> : <FiTrash2 size={12} />}
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add new charge ─────────────────────────────────────────────── */}
        <div className={`mt-5 rounded-2xl border p-4 ${t.panelSoft}`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] mb-3 ${t.soft}`}>Add New Charge</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className={t.label}>Charge Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCharge(); }}
                placeholder="e.g. Service Charge"
                className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none ${t.input}`}
                disabled={isAdding}
              />
            </div>
            <div className="w-32">
              <label className={t.label}>Amount</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className={`h-11 w-full rounded-2xl border pl-3 pr-7 text-sm outline-none ${t.input}`}
                  disabled={isAdding}
                />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${t.soft}`}>
                  {newRateType === "Percentage" ? "%" : "₱"}
                </span>
              </div>
            </div>
            <div className="w-36">
              <label className={t.label}>Rate Type</label>
              <select
                value={newRateType}
                onChange={(e) => setNewRateType(e.target.value)}
                className={`h-11 w-full rounded-2xl border px-3 text-sm outline-none ${t.input}`}
                disabled={isAdding}
              >
                {RATE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={addCharge}
              disabled={isAdding || !newName.trim()}
              className="inline-flex items-center gap-2 rounded-2xl px-5 h-11 text-sm font-black text-white transition disabled:opacity-50 flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              {isAdding ? <FiLoader size={14} className="animate-spin" /> : <FiPlus size={14} />}
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosServiceCharge;
