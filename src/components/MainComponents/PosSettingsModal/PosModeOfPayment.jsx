"use client";
/* eslint-disable react/prop-types */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { FiCreditCard, FiLoader, FiToggleLeft, FiToggleRight, FiBookmark, FiUpload, FiCheck, FiPlus } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const mutationHeaders = (headers = {}) => {
  const nextHeaders = { ...headers };
  const token = window.localStorage.getItem("access_token");
  if (token) nextHeaders.Authorization = `Bearer ${token}`;
  return nextHeaders;
};

const PosModeOfPayment = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [mops, setMops] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState("");

  // QR upload state
  const qrInputRef   = useRef(null);
  const [pendingQrMop, setPendingQrMop]   = useState(null);
  const [uploadingQrId, setUploadingQrId] = useState(null);
  const [qrDone, setQrDone]               = useState({}); // mop_id → brief success flash
  const [existingQrNames, setExistingQrNames] = useState(new Set()); // sanitized names that already have a QR file

  // Add new mode of payment
  const [newMop, setNewMop] = useState({ mop: "", sl_code: "", reference_On_Off: true });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addedName, setAddedName] = useState("");
  // Inline SL code edit: { mop_id, value }
  const [slEdit, setSlEdit] = useState(null);
  const [slSaving, setSlSaving] = useState(false);

  const t = {
    panel:     isDark ? "bg-slate-900/40 border-white/5"   : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    primary:   isDark ? "text-white"     : "text-slate-900",
    muted:     isDark ? "text-slate-400" : "text-slate-500",
    soft:      isDark ? "text-slate-500" : "text-slate-400",
    row:       isDark
      ? "border-white/5 hover:bg-white/[0.03]"
      : "border-slate-100 hover:bg-slate-50",
  };

  const load = useCallback(async () => {
    if (!apiHost) return;
    setIsLoading(true);
    setError("");
    try {
      const res    = await fetch(`${apiHost}/api/pos_manage_mode_of_payment.php`);
      const result = await res.json();
      if (result?.success && Array.isArray(result.data)) {
        setMops(result.data);
      } else {
        setError(result?.message || "Failed to load.");
      }
    } catch (e) {
      setError(e.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  }, [apiHost]);

  useEffect(() => { load(); }, [load]);

  // Load which payment methods already have a QR file on the server
  const loadExistingQrFiles = useCallback(async () => {
    if (!apiHost) return;
    try {
      const res  = await fetch(`${apiHost}/api/pos_second_screen.php`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data?.images)) {
        // e.g. "GCASH_QR.png" → "GCASH"
        const names = new Set(
          data.images
            .filter((f) => f.toUpperCase().endsWith("_QR.PNG") || f.toUpperCase().endsWith("_QR.JPG"))
            .map((f) => f.replace(/_QR\.(png|jpg|jpeg)$/i, "").toUpperCase())
        );
        setExistingQrNames(names);
      }
    } catch { /* silent */ }
  }, [apiHost]);

  useEffect(() => { loadExistingQrFiles(); }, [loadExistingQrFiles]);

  const toggle = async (mopId, field, currentVal) => {
    const key = `${mopId}:${field}`;
    if (togglingId === key) return;

    // Optimistic update
    setMops((prev) =>
      prev.map((m) =>
        m.mop_id === mopId ? { ...m, [field]: currentVal ? 0 : 1 } : m
      )
    );
    setTogglingId(key);
    setError("");

    try {
      const res = await fetch(`${apiHost}/api/pos_manage_mode_of_payment.php`, {
        method:  "PATCH",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body:    JSON.stringify({ mop_id: mopId, [field]: currentVal ? 0 : 1 }),
      });
      const result = await res.json();
      if (result?.success && Array.isArray(result.data)) {
        setMops(result.data); // sync server state
      } else {
        // Revert on failure
        setMops((prev) =>
          prev.map((m) =>
            m.mop_id === mopId ? { ...m, [field]: currentVal } : m
          )
        );
        setError(result?.message || "Failed to update.");
      }
    } catch (e) {
      setMops((prev) =>
        prev.map((m) =>
          m.mop_id === mopId ? { ...m, [field]: currentVal } : m
        )
      );
      setError(e.message || "Network error.");
    } finally {
      setTogglingId(null);
    }
  };

  const Toggle = ({ mopId, field, value }) => {
    const key     = `${mopId}:${field}`;
    const loading = togglingId === key;
    const on      = Boolean(value);

    return (
      <button
        type="button"
        disabled={loading || !!togglingId}
        onClick={() => toggle(mopId, field, value)}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
          on
            ? "bg-emerald-500/15 text-emerald-500"
            : isDark
            ? "bg-slate-800 text-slate-500"
            : "bg-slate-100 text-slate-400"
        } disabled:opacity-50`}
      >
        {loading ? (
          <FiLoader size={12} className="animate-spin" />
        ) : on ? (
          <FiToggleRight size={14} />
        ) : (
          <FiToggleLeft size={14} />
        )}
        {on ? "ON" : "OFF"}
      </button>
    );
  };

  const openQrPicker = (mop) => {
    setPendingQrMop(mop);
    qrInputRef.current.value = "";
    qrInputRef.current.click();
  };

  const handleQrFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingQrMop) return;

    const id = pendingQrMop.mop_id;
    setUploadingQrId(id);

    const formData = new FormData();
    formData.append("qr_image", file);
    formData.append("mop_name", pendingQrMop.mop);

    try {
      const res  = await fetch(`${apiHost}/api/pos_second_screen_settings.php`, {
        method: "POST",
        headers: mutationHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (data?.success) {
        // Mark as existing immediately so UI reflects the new state
        const safeName = pendingQrMop.mop.toUpperCase().replace(/\s+/g, "_");
        setExistingQrNames((prev) => new Set([...prev, safeName]));
        setQrDone((prev) => ({ ...prev, [id]: true }));
        setTimeout(() => setQrDone((prev) => { const n = { ...prev }; delete n[id]; return n; }), 2500);
      } else {
        setError(data?.message || "QR upload failed.");
      }
    } catch {
      setError("Network error during QR upload.");
    } finally {
      setUploadingQrId(null);
      setPendingQrMop(null);
    }
  };

  const saveSlCode = async () => {
    if (!slEdit) return;
    const value = slEdit.value.trim();
    const current = mops.find((m) => m.mop_id === slEdit.mop_id);
    if (!value || value === String(current?.sl_code || "")) {
      if (!value) setError("SL code cannot be blank.");
      setSlEdit(null);
      return;
    }
    setSlSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiHost}/api/pos_manage_mode_of_payment.php`, {
        method: "PATCH",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mop_id: slEdit.mop_id, sl_code: value }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result?.success) throw new Error(result?.message || "Failed to save SL code.");
      if (Array.isArray(result.data)) setMops(result.data);
      setSlEdit(null);
    } catch (err) {
      setError(err.message || "Failed to save SL code.");
    } finally {
      setSlSaving(false);
    }
  };

  const slCodeOptions = useMemo(
    () => [...new Set(mops.map((m) => String(m.sl_code || "").trim()).filter(Boolean))].sort(),
    [mops],
  );

  const addMop = async (e) => {
    e.preventDefault();
    const mop = newMop.mop.trim().replace(/\s+/g, " ");
    const slCode = newMop.sl_code.trim();
    if (!mop) return setAddError("Enter the payment method name.");
    if (!slCode) return setAddError("Enter the SL code.");
    if (mops.some((m) => String(m.mop || "").trim().toLowerCase() === mop.toLowerCase())) {
      return setAddError(`"${mop}" already exists.`);
    }

    setIsAdding(true);
    setAddError("");
    try {
      const res = await fetch(`${apiHost}/api/pos_manage_mode_of_payment.php`, {
        method: "POST",
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          mop,
          sl_code: slCode,
          reference_On_Off: newMop.reference_On_Off ? 1 : 0,
          MOP_On_Off: 1,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to add payment method.");
      }
      if (Array.isArray(result.data)) setMops(result.data);
      setNewMop({ mop: "", sl_code: "", reference_On_Off: true });
      setAddedName(mop);
      setTimeout(() => setAddedName(""), 2500);
    } catch (err) {
      setAddError(err.message || "Failed to add payment method.");
    } finally {
      setIsAdding(false);
    }
  };

  const enabledCount  = mops.filter((m) => m.MOP_On_Off).length;
  const disabledCount = mops.length - enabledCount;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${t.panel}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5"
            >
              <FiCreditCard size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Payment Settings</span>
            </div>
            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${t.primary}`}>
              Mode of Payment
            </h2>
            <p className={`mt-3 max-w-2xl text-sm ${t.muted}`}>
              Enable or disable individual payment methods. Toggle{" "}
              <span className="font-bold">Reference</span> to require a reference
              number, and <span className="font-bold">MOP</span> to make the method
              available at checkout.
            </p>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-black text-emerald-500">
              {enabledCount} Active
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              {disabledCount} Disabled
            </span>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500">
            {error}
          </p>
        )}
      </div>

      {/* Add payment method */}
      <form
        onSubmit={addMop}
        className={`rounded-[28px] border p-5 sm:p-6 ${t.panel}`}
      >
        <p className={`mb-4 text-[10px] font-black uppercase tracking-[0.18em] ${t.soft}`}>
          Add Payment Method
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-end">
          <label className="block">
            <span className={`mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] ${t.muted}`}>
              Name
            </span>
            <input
              type="text"
              maxLength={45}
              value={newMop.mop}
              onChange={(e) => {
                setAddError("");
                setNewMop((prev) => ({ ...prev, mop: e.target.value }));
              }}
              placeholder="e.g. UNIONBANK QR"
              className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-bold outline-none transition-all ${t.panelSoft} ${t.primary}`}
            />
          </label>
          <label className="block">
            <span className={`mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] ${t.muted}`}>
              SL Code
            </span>
            <input
              type="text"
              maxLength={45}
              list="mop-sl-code-options"
              value={newMop.sl_code}
              onChange={(e) => {
                setAddError("");
                setNewMop((prev) => ({ ...prev, sl_code: e.target.value }));
              }}
              placeholder="e.g. 110005"
              className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-bold outline-none transition-all ${t.panelSoft} ${t.primary}`}
            />
            <datalist id="mop-sl-code-options">
              {slCodeOptions.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            onClick={() => setNewMop((prev) => ({ ...prev, reference_On_Off: !prev.reference_On_Off }))}
            className={`flex items-center justify-center gap-1.5 rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
              newMop.reference_On_Off
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                : `${t.panelSoft} ${t.muted}`
            }`}
            title="Require a reference number for this payment method"
          >
            {newMop.reference_On_Off ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
            Reference {newMop.reference_On_Off ? "ON" : "OFF"}
          </button>
          <button
            type="submit"
            disabled={isAdding || !apiHost}
            className="flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {isAdding ? <FiLoader size={13} className="animate-spin" /> : <FiPlus size={13} />}
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
        {addError && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500">
            {addError}
          </p>
        )}
        {addedName && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500">
            <FiCheck size={14} /> {addedName} added and turned ON.
          </p>
        )}
      </form>

      {/* Hidden QR file input — shared across all rows */}
      <input
        ref={qrInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQrFileChange}
      />

      {/* Table */}
      <div className={`overflow-hidden rounded-[28px] border ${t.panel}`}>
        {/* Column headers */}
        <div
          className={`grid grid-cols-[2rem_1fr_6rem_6rem_6rem_5rem] gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] ${t.soft} border-b ${isDark ? "border-white/5" : "border-slate-200"}`}
        >
          <span>#</span>
          <span>Method</span>
          <span className="text-center">SL Code</span>
          <span className="text-center">Reference</span>
          <span className="text-center">MOP</span>
          <span className="text-center">QR</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <FiLoader className="animate-spin text-slate-400" size={18} />
            <span className={`text-sm ${t.muted}`}>Loading…</span>
          </div>
        ) : mops.length === 0 ? (
          <div className={`py-16 text-center text-sm ${t.muted}`}>
            No payment methods found.
          </div>
        ) : (
          <div className="divide-y divide-inherit">
            {mops.map((m) => (
              <div
                key={m.mop_id}
                className={`grid grid-cols-[2rem_1fr_6rem_6rem_6rem_5rem] items-center gap-3 px-5 py-3.5 transition-colors ${t.row} ${
                  !m.MOP_On_Off ? "opacity-50" : ""
                }`}
              >
                {/* Seq */}
                <span className={`text-[11px] font-bold ${t.soft}`}>{m.seq}</span>

                {/* MOP name + icon */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: m.MOP_On_Off
                        ? `${accent}18`
                        : isDark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <FiCreditCard
                      size={13}
                      style={{ color: m.MOP_On_Off ? accent : undefined }}
                      className={m.MOP_On_Off ? "" : t.soft}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-[13px] font-black ${t.primary}`}>
                      {m.mop}
                    </p>
                  </div>
                </div>

                {/* SL Code (click to edit) */}
                <div className="flex justify-center">
                  {slEdit?.mop_id === m.mop_id ? (
                    <input
                      autoFocus
                      maxLength={45}
                      value={slEdit.value}
                      disabled={slSaving}
                      list="mop-sl-code-options"
                      onChange={(e) => setSlEdit({ mop_id: m.mop_id, value: e.target.value })}
                      onBlur={saveSlCode}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setSlEdit(null);
                      }}
                      className={`w-24 rounded-lg border px-2 py-0.5 text-center text-[11px] font-bold outline-none ${t.panelSoft} ${t.primary}`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSlEdit({ mop_id: m.mop_id, value: String(m.sl_code || "") })}
                      title="Edit SL code"
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        m.sl_code
                          ? isDark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-100 text-slate-500"
                          : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      <FiBookmark size={9} />
                      {m.sl_code || "Set"}
                    </button>
                  )}
                </div>

                {/* Reference toggle */}
                <div className="flex justify-center">
                  <Toggle mopId={m.mop_id} field="reference_On_Off" value={m.reference_On_Off} />
                </div>

                {/* MOP on/off toggle */}
                <div className="flex justify-center">
                  <Toggle mopId={m.mop_id} field="MOP_On_Off" value={m.MOP_On_Off} />
                </div>

                {/* QR upload / replace */}
                <div className="flex justify-center">
                  {qrDone[m.mop_id] ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-500">
                      <FiCheck size={11} /> Saved
                    </span>
                  ) : (() => {
                    const safeName = m.mop.toUpperCase().replace(/\s+/g, "_");
                    const hasQr    = existingQrNames.has(safeName);
                    return (
                      <button
                        type="button"
                        disabled={uploadingQrId === m.mop_id}
                        onClick={() => openQrPicker(m)}
                        title={hasQr ? `Replace QR for ${m.mop}` : `Upload QR for ${m.mop}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-40 ${
                          hasQr
                            ? "bg-cyan-500/15 text-cyan-600 hover:bg-cyan-500/25"
                            : isDark
                            ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        }`}
                      >
                        {uploadingQrId === m.mop_id ? (
                          <FiLoader size={11} className="animate-spin" />
                        ) : (
                          <FiUpload size={11} />
                        )}
                        {hasQr ? "Replace" : "Upload"}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={`rounded-[20px] border px-5 py-4 text-[11px] ${t.panelSoft} ${t.muted} space-y-1`}>
        <p>
          <span className="font-black">Reference ON</span> — cashier must enter a reference number (e.g., transaction/check no.) when this method is used.
        </p>
        <p>
          <span className="font-black">MOP ON</span> — payment method is available at the payment screen. Disabled methods are hidden from cashiers.
        </p>
      </div>
    </div>
  );
};

export default PosModeOfPayment;
