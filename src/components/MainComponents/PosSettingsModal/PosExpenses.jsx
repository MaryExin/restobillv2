"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiShoppingBag,
  FiArrowDownLeft,
  FiX,
  FiLayers,
  FiLoader,
  FiTrendingUp,
  FiCreditCard,
  FiInbox,
  FiFileText,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosExpenses = ({ isDark, accent = "#3b82f6" }) => {
  const [ledgerData, setLedgerData] = useState([]);
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    category: "Supplies",
    description: "",
    amount: "",
  });

  const [pettyForm, setPettyForm] = useState({
    description: "",
    amount: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  const fetchLedger = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        "http://localhost/api/pos_ledger_api.php?action=get_ledger",
      );
      const result = await res.json();

      if (result.status === "success") {
        setLedgerData(result.data || []);
      } else {
        setLedgerData([]);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setLedgerData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleAction = async (type, formObj, setFormObj, isModal = false) => {
    if (!formObj.description || !formObj.amount) return;

    const userEmail = localStorage.getItem("email") || "Unknown";

    const payload = {
      type,
      category: formObj.category || "General",
      description: formObj.description,
      amount: parseFloat(formObj.amount),
      recorded_by: userEmail,
    };

    try {
      setIsSubmitting(true);

      const res = await fetch(
        "http://localhost/api/pos_ledger_api.php?action=add_entry",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await res.json();

      if (result.status === "success") {
        await fetchLedger();

        if (type === "OUT") {
          setFormObj({
            category: "Supplies",
            description: "",
            amount: "",
          });
        } else {
          setFormObj({
            description: "",
            amount: "",
          });
        }

        if (isModal) setIsPettyModalOpen(false);
      }
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLogs = useMemo(
    () => ledgerData.filter((i) => i.status === "active"),
    [ledgerData],
  );

  const totalIn = useMemo(
    () =>
      activeLogs
        .filter((i) => i.entry_type === "IN")
        .reduce((a, b) => a + parseFloat(b.amount || 0), 0),
    [activeLogs],
  );

  const totalOut = useMemo(
    () =>
      activeLogs
        .filter((i) => i.entry_type === "OUT")
        .reduce((a, b) => a + parseFloat(b.amount || 0), 0),
    [activeLogs],
  );

  const remaining = totalIn - totalOut;

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HERO */}
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
              <FiCreditCard size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Expenses & Petty</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Cash Ledger
            </h2>

            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              Track petty cash in, daily expenses, and the current remaining
              drawer balance.
            </p>
          </div>

          <button
            onClick={() => setIsPettyModalOpen(true)}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            <FiPlus size={16} />
            Add Petty Cash
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-emerald-500/10" : "bg-emerald-50"
              } text-emerald-500`}
            >
              <FiArrowDownLeft size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Petty Cash In
            </p>
          </div>

          <h3
            className={`text-2xl sm:text-3xl font-black ${theme.textPrimary}`}
          >
            ₱{totalIn.toLocaleString()}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-rose-500/10" : "bg-rose-50"
              } text-rose-500`}
            >
              <FiShoppingBag size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Total Expenses
            </p>
          </div>

          <h3 className="text-2xl font-black sm:text-3xl text-rose-500">
            ₱{totalOut.toLocaleString()}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-violet-500/10" : "bg-violet-50"
              } text-violet-500`}
            >
              <FiTrendingUp size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Remaining Balance
            </p>
          </div>

          <h3
            className="text-2xl font-black sm:text-3xl"
            style={{ color: accent }}
          >
            ₱{remaining.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* FORM */}
        <div className="xl:col-span-4">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                  isDark
                    ? "bg-slate-950 border border-slate-800"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <FiLayers size={18} style={{ color: accent }} />
              </div>
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  New Expense
                </p>
                <h3 className={`text-xl font-black ${theme.textPrimary}`}>
                  Commit expense entry
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <select
                className={`w-full px-4 py-4 rounded-2xl border font-bold text-sm outline-none ${theme.input}`}
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, category: e.target.value })
                }
              >
                <option value="Supplies">🛒 Supplies</option>
                <option value="Staff Meals">🍱 Staff Meals</option>
                <option value="Utilities">⚡ Utilities</option>
                <option value="Maintenance">🛠️ Maintenance</option>
                <option value="Marketing">📢 Marketing</option>
                <option value="Others">📝 Others</option>
              </select>

              <input
                type="text"
                placeholder="Expense description"
                className={`w-full px-4 py-4 rounded-2xl border text-sm outline-none ${theme.input}`}
                value={expenseForm.description}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    description: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="0.00"
                className={`w-full px-4 py-5 rounded-2xl border text-3xl font-black text-center outline-none ${theme.input}`}
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    amount: e.target.value,
                  })
                }
              />

              <button
                onClick={() => handleAction("OUT", expenseForm, setExpenseForm)}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-60"
                style={{
                  backgroundColor: accent,
                  color: isDark ? "#0f172a" : "#ffffff",
                }}
              >
                {isSubmitting ? "Saving..." : "Commit Expense"}
              </button>
            </div>
          </div>
        </div>

        {/* LOGS */}
        <div className="xl:col-span-8">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                  isDark
                    ? "bg-slate-950 border border-slate-800"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <FiFileText size={18} style={{ color: accent }} />
              </div>
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  Ledger History
                </p>
                <h3 className={`text-xl font-black ${theme.textPrimary}`}>
                  Expense and petty cash logs
                </h3>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center min-h-[280px]">
                <div
                  className={`rounded-[24px] border px-8 py-10 flex flex-col items-center gap-4 ${theme.panelSoft}`}
                >
                  <div
                    className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
                      isDark
                        ? "bg-slate-900 border border-slate-800"
                        : "bg-white border border-slate-200"
                    }`}
                  >
                    <FiLoader
                      className="text-3xl animate-spin"
                      style={{ color: accent }}
                    />
                  </div>

                  <div className="text-center">
                    <p
                      className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
                    >
                      Loading
                    </p>
                    <p className={`mt-2 text-sm ${theme.textMuted}`}>
                      Fetching ledger records...
                    </p>
                  </div>
                </div>
              </div>
            ) : ledgerData.length === 0 ? (
              <div
                className={`rounded-[24px] border p-8 text-center ${theme.panelSoft}`}
              >
                <div
                  className={`mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center ${
                    isDark
                      ? "bg-slate-900 border border-slate-800"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  <FiInbox size={24} style={{ color: accent }} />
                </div>

                <p
                  className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
                >
                  No Records
                </p>
                <h4 className={`mt-2 text-2xl font-black ${theme.textPrimary}`}>
                  Ledger is empty
                </h4>
                <p className={`mt-2 text-sm ${theme.textMuted}`}>
                  Add petty cash or commit an expense to start tracking entries.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {ledgerData.map((item) => {
                  const isIn = item.entry_type === "IN";
                  const amount = parseFloat(item.amount || 0);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-[24px] border p-4 sm:p-5 flex items-center justify-between gap-4 ${theme.panelSoft}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                            isIn ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        >
                          {isIn ? <FiArrowDownLeft /> : <FiShoppingBag />}
                        </div>

                        <div className="min-w-0">
                          <div
                            className={`text-sm font-black uppercase truncate ${theme.textPrimary}`}
                          >
                            {item.description}
                          </div>
                          <div
                            className={`text-[10px] font-bold uppercase tracking-[0.08em] mt-1 ${theme.textMuted}`}
                          >
                            {item.category} • {item.entry_time} •{" "}
                            {item.display_name}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`text-lg sm:text-xl font-black shrink-0 ${
                          isIn ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        ₱{amount.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PETTY CASH MODAL */}
      <AnimatePresence>
        {isPettyModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className={`w-full max-w-md rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p
                    className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
                  >
                    Petty Cash
                  </p>
                  <h4
                    className={`mt-1 text-2xl font-black ${theme.textPrimary}`}
                  >
                    Add to Drawer
                  </h4>
                </div>

                <button
                  onClick={() => setIsPettyModalOpen(false)}
                  className={`p-3 rounded-2xl ${
                    isDark
                      ? "bg-slate-950 border border-slate-800 text-slate-300"
                      : "bg-slate-50 border border-slate-200 text-slate-600"
                  }`}
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Source / remarks"
                  className={`w-full px-4 py-4 rounded-2xl border text-sm outline-none ${theme.input}`}
                  value={pettyForm.description}
                  onChange={(e) =>
                    setPettyForm({
                      ...pettyForm,
                      description: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="0.00"
                  className={`w-full px-4 py-6 rounded-2xl border text-4xl font-black text-center outline-none ${theme.input}`}
                  value={pettyForm.amount}
                  onChange={(e) =>
                    setPettyForm({
                      ...pettyForm,
                      amount: e.target.value,
                    })
                  }
                />

                <button
                  onClick={() =>
                    handleAction("IN", pettyForm, setPettyForm, true)
                  }
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-60"
                  style={{
                    backgroundColor: accent,
                    color: isDark ? "#0f172a" : "#ffffff",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Add to Drawer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosExpenses;
