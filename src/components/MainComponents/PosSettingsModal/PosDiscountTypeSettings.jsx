"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FiTag,
  FiSave,
  FiLoader,
  FiPlus,
  FiTrash2,
  FiLock,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const mappingKey = (discountTypeId, salesTypeId) =>
  `${discountTypeId}_${salesTypeId}`;

const emptyNewType = {
  discount_name: "",
  calculation_type: "percentage",
  default_value: "",
  is_vat_exempt: false,
};

const PosDiscountTypeSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [discountTypes, setDiscountTypes] = useState([]);
  const [salesTypes, setSalesTypes] = useState([]);
  const [mappings, setMappings] = useState({});

  const [rowEdits, setRowEdits] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [panelEdits, setPanelEdits] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState(emptyNewType);

  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
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

  const applyState = (data) => {
    const types = Array.isArray(data?.discount_types) ? data.discount_types : [];
    const sTypes = Array.isArray(data?.sales_types) ? data.sales_types : [];
    const maps = Array.isArray(data?.mappings) ? data.mappings : [];

    setDiscountTypes(types);
    setSalesTypes(sTypes);

    const mapObj = {};
    maps.forEach((row) => {
      mapObj[mappingKey(row.discount_type_id, row.sales_type_id)] = {
        is_active: !!Number(row.is_active),
        percent_value:
          row.percent_value === null || row.percent_value === undefined
            ? ""
            : String(Number(row.percent_value)),
      };
    });
    setMappings(mapObj);

    const edits = {};
    types.forEach((t) => {
      edits[t.id] = {
        default_value: String(Number(t.default_value || 0)),
        status: t.status || "active",
      };
    });
    setRowEdits(edits);
  };

  const load = async () => {
    if (!apiHost) return;
    try {
      setIsLoading(true);
      setError("");
      const res = await fetch(`${apiHost}/api/pos_discount_types.php`);
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to load discount types.");
      }
      applyState(result.data);
    } catch (err) {
      setError(err.message || "Failed to load discount types.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiHost]);

  const isRowDirty = (type) => {
    const edit = rowEdits[type.id];
    if (!edit) return false;
    return (
      edit.default_value !== String(Number(type.default_value || 0)) ||
      edit.status !== (type.status || "active")
    );
  };

  const saveRow = async (type) => {
    const edit = rowEdits[type.id];
    if (!edit || !apiHost) return;

    try {
      setSavingKey(`row-${type.id}`);
      setError("");
      setMessage("");

      const res = await fetch(`${apiHost}/api/pos_discount_types.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_type",
          id: type.id,
          default_value: Number(edit.default_value || 0),
          status: edit.status,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save.");
      }
      applyState(result.data);
      setMessage(`${type.discount_name} updated.`);
    } catch (err) {
      setError(err.message || "Failed to save discount type.");
    } finally {
      setSavingKey("");
    }
  };

  const deleteType = async (type) => {
    if (!apiHost) return;
    if (!window.confirm(`Delete "${type.discount_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setSavingKey(`delete-${type.id}`);
      setError("");
      const res = await fetch(`${apiHost}/api/pos_discount_types.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_type", id: type.id }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to delete.");
      }
      applyState(result.data);
      setMessage(`${type.discount_name} deleted.`);
    } catch (err) {
      setError(err.message || "Failed to delete discount type.");
    } finally {
      setSavingKey("");
    }
  };

  const createType = async () => {
    if (!apiHost || !newType.discount_name.trim()) return;

    try {
      setSavingKey("create");
      setError("");
      const res = await fetch(`${apiHost}/api/pos_discount_types.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_type",
          discount_name: newType.discount_name.trim(),
          calculation_type: newType.calculation_type,
          default_value: Number(newType.default_value || 0),
          is_vat_exempt: newType.is_vat_exempt,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to create discount type.");
      }
      applyState(result.data);
      setMessage("Discount type created.");
      setNewType(emptyNewType);
      setShowAddForm(false);
    } catch (err) {
      setError(err.message || "Failed to create discount type.");
    } finally {
      setSavingKey("");
    }
  };

  const toggleExpand = (type) => {
    if (expandedId === type.id) {
      setExpandedId(null);
      return;
    }

    const edits = {};
    salesTypes.forEach((st) => {
      const existing = mappings[mappingKey(type.id, st.sales_type_id)];
      edits[st.sales_type_id] = existing
        ? { ...existing }
        : { is_active: false, percent_value: "" };
    });
    setPanelEdits(edits);
    setExpandedId(type.id);
  };

  const updatePanelEdit = (salesTypeId, patch) => {
    setPanelEdits((prev) => ({
      ...prev,
      [salesTypeId]: { ...prev[salesTypeId], ...patch },
    }));
  };

  const saveMappingPanel = async (type) => {
    if (!apiHost) return;

    try {
      setSavingKey(`panel-${type.id}`);
      setError("");
      setMessage("");

      const rows = salesTypes.map((st) => ({
        sales_type_id: st.sales_type_id,
        is_active: !!panelEdits[st.sales_type_id]?.is_active,
        percent_value:
          panelEdits[st.sales_type_id]?.percent_value === ""
            ? null
            : Number(panelEdits[st.sales_type_id]?.percent_value),
      }));

      const res = await fetch(`${apiHost}/api/pos_discount_types.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_mapping",
          discount_type_id: type.id,
          mappings: rows,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save.");
      }
      applyState(result.data);
      setMessage(`Sales type availability saved for ${type.discount_name}.`);
      setExpandedId(null);
    } catch (err) {
      setError(err.message || "Failed to save sales type availability.");
    } finally {
      setSavingKey("");
    }
  };

  const activeSalesTypeCount = useMemo(() => {
    const counts = {};
    discountTypes.forEach((t) => {
      counts[t.id] = salesTypes.filter(
        (st) => mappings[mappingKey(t.id, st.sales_type_id)]?.is_active,
      ).length;
    });
    return counts;
  }, [discountTypes, salesTypes, mappings]);

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-current/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em]">
              <FiTag size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Discount Types</span>
            </div>
            <h3 className={`mt-3 text-xl font-black uppercase tracking-tight ${theme.textPrimary}`}>
              Sales Type Availability
            </h3>
            <p className={`mt-2 max-w-2xl text-sm ${theme.textMuted}`}>
              Manage which discount types exist, what percent each gives by
              default, and per sales type (Dine In, Grab, Take Out, etc.)
              whether it's active and what percent applies there.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
          >
            <FiPlus size={14} />
            Add Discount Type
          </button>
        </div>

        {showAddForm && (
          <div className={`mt-5 rounded-2xl border p-4 ${theme.panelSoft}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                type="text"
                placeholder="Discount name"
                value={newType.discount_name}
                onChange={(e) =>
                  setNewType((prev) => ({ ...prev, discount_name: e.target.value }))
                }
                className={`h-11 rounded-xl border px-3 text-sm font-semibold outline-none sm:col-span-2 ${theme.input}`}
              />
              <select
                value={newType.calculation_type}
                onChange={(e) =>
                  setNewType((prev) => ({ ...prev, calculation_type: e.target.value }))
                }
                className={`h-11 rounded-xl border px-3 text-sm font-semibold outline-none ${theme.input}`}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Default value"
                value={newType.default_value}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) =>
                  setNewType((prev) => ({ ...prev, default_value: e.target.value }))
                }
                className={`h-11 rounded-xl border px-3 text-sm font-semibold outline-none ${theme.input}`}
              />
            </div>

            <label className={`mt-3 flex items-center gap-2 text-xs font-semibold ${theme.textMuted}`}>
              <input
                type="checkbox"
                checked={newType.is_vat_exempt}
                onChange={(e) =>
                  setNewType((prev) => ({ ...prev, is_vat_exempt: e.target.checked }))
                }
              />
              VAT-exempt discount
            </label>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={createType}
                disabled={savingKey === "create" || !newType.discount_name.trim()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
              >
                {savingKey === "create" ? <FiLoader className="animate-spin" size={14} /> : <FiPlus size={14} />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewType(emptyNewType);
                }}
                className={`rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-widest ${theme.textPrimary}`}
                style={{ borderColor: "var(--app-border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`overflow-hidden rounded-[28px] border ${theme.panel}`}>
        {isLoading ? (
          <p className={`p-6 text-sm ${theme.textMuted}`}>Loading discount types…</p>
        ) : discountTypes.length === 0 ? (
          <p className={`p-6 text-sm ${theme.textMuted}`}>No discount types configured yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {discountTypes.map((type) => {
              const edit = rowEdits[type.id] || {
                default_value: String(Number(type.default_value || 0)),
                status: type.status || "active",
              };
              const dirty = isRowDirty(type);
              const isExpanded = expandedId === type.id;
              const isSystem = Number(type.is_system_defined) === 1;

              return (
                <div key={type.id}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {isSystem && (
                        <FiLock size={13} className={theme.textSoft} title="Statutory / system-defined" />
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-black ${theme.textPrimary}`}>
                          {type.discount_name}
                        </p>
                        <p className={`text-[11px] ${theme.textMuted}`}>
                          {type.calculation_type === "fixed" ? "Fixed amount" : "Percentage"} ·{" "}
                          {activeSalesTypeCount[type.id] || 0}/{salesTypes.length} sales types active
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.default_value}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) =>
                            setRowEdits((prev) => ({
                              ...prev,
                              [type.id]: { ...prev[type.id], default_value: e.target.value },
                            }))
                          }
                          className={`h-10 w-24 rounded-xl border px-3 pr-7 text-sm font-bold outline-none ${theme.input}`}
                        />
                        <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${theme.textMuted}`}>
                          {type.calculation_type === "fixed" ? "₱" : "%"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setRowEdits((prev) => ({
                            ...prev,
                            [type.id]: {
                              ...prev[type.id],
                              status: edit.status === "active" ? "inactive" : "active",
                            },
                          }))
                        }
                        className="h-10 rounded-xl px-3 text-[11px] font-black uppercase tracking-wide transition-colors"
                        style={{
                          backgroundColor:
                            edit.status === "active" ? `${accent}1a` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                          color: edit.status === "active" ? accent : theme.textMuted.includes("slate-400") ? "#94a3b8" : "#64748b",
                        }}
                      >
                        {edit.status === "active" ? "Active" : "Inactive"}
                      </button>

                      {dirty && (
                        <button
                          type="button"
                          onClick={() => saveRow(type)}
                          disabled={savingKey === `row-${type.id}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
                          title="Save"
                        >
                          {savingKey === `row-${type.id}` ? (
                            <FiLoader className="animate-spin" size={15} />
                          ) : (
                            <FiSave size={15} />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(type)}
                        className={`flex h-10 items-center gap-1 rounded-xl border px-3 text-[11px] font-bold ${theme.textPrimary}`}
                        style={{ borderColor: "var(--app-border)" }}
                      >
                        Sales Types
                        {isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                      </button>

                      {!isSystem && (
                        <button
                          type="button"
                          onClick={() => deleteType(type)}
                          disabled={savingKey === `delete-${type.id}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10"
                          title="Delete"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={`px-4 pb-5 sm:px-5 ${theme.panelSoft} border-t`} style={{ borderColor: "var(--app-border)" }}>
                      <div className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                        {salesTypes.map((st) => {
                          const cell = panelEdits[st.sales_type_id] || { is_active: false, percent_value: "" };
                          return (
                            <label
                              key={st.sales_type_id}
                              className="flex items-center gap-3 rounded-xl border p-3"
                              style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
                            >
                              <input
                                type="checkbox"
                                checked={cell.is_active}
                                onChange={(e) =>
                                  updatePanelEdit(st.sales_type_id, { is_active: e.target.checked })
                                }
                              />
                              <span className={`flex-1 text-xs font-bold ${theme.textPrimary}`}>
                                {st.sales_type}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={String(Number(type.default_value || 0))}
                                value={cell.percent_value}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) =>
                                  updatePanelEdit(st.sales_type_id, { percent_value: e.target.value })
                                }
                                className={`h-9 w-20 rounded-lg border px-2 text-xs font-bold outline-none ${theme.input}`}
                              />
                            </label>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => saveMappingPanel(type)}
                        disabled={savingKey === `panel-${type.id}`}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                        style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
                      >
                        {savingKey === `panel-${type.id}` ? (
                          <FiLoader className="animate-spin" size={14} />
                        ) : (
                          <FiSave size={14} />
                        )}
                        Save Availability
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message && <p className="text-sm font-semibold text-emerald-500">{message}</p>}
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
    </div>
  );
};

export default PosDiscountTypeSettings;
