"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiSearch,
  FiUserPlus,
  FiLoader,
  FiArrowLeft,
  FiUsers,
  FiPhone,
  FiTrash2,
  FiAlertTriangle,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosLoyaltyMembers = ({ isOpen, onClose, isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [view, setView] = useState("list"); // "list" | "register"
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [signupBonusPoints, setSignupBonusPoints] = useState(0);

  const theme = {
    modal: isDark ? "bg-[#0b1222] border-white/5" : "bg-white border-slate-200",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    input: isDark
      ? "bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
    rowBorder: isDark ? "border-white/5" : "border-slate-100",
  };

  const fetchMembers = async () => {
    if (!apiHost) return;

    try {
      setIsLoading(true);
      setListError("");

      const response = await fetch(`${apiHost}/api/pos_loyalty_members.php`);
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to load loyalty members.");
      }

      setMembers(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error(err);
      setListError(err.message || "Failed to load loyalty members.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setView("list");
      setSearch("");
      setFormError("");
      setPendingDelete(null);
      fetchMembers();

      if (apiHost) {
        fetch(`${apiHost}/api/pos_loyalty_config.php`)
          .then((res) => res.json())
          .then((result) => {
            setSignupBonusPoints(Number(result?.data?.signup_bonus_points || 0));
          })
          .catch(() => setSignupBonusPoints(0));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, apiHost]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? members.filter((m) => {
          const name = String(m.customer_name || "").toLowerCase();
          const phone = String(m.phone_number || "").toLowerCase();
          return name.includes(term) || phone.includes(term);
        })
      : members;

    return [...filtered].sort((a, b) =>
      String(a.customer_name || "").localeCompare(String(b.customer_name || "")),
    );
  }, [members, search]);

  const registerCustomer = async () => {
    if (isSaving) return;

    const trimmedName = customerName.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedName || !trimmedPhone) {
      setFormError("Customer name and phone number are required.");
      return;
    }

    try {
      setIsSaving(true);
      setFormError("");

      const response = await fetch(`${apiHost}/api/pos_loyalty_members.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: trimmedName,
          phone_number: trimmedPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to register customer.");
      }

      setCustomerName("");
      setPhoneNumber("");
      setView("list");
      await fetchMembers();
    } catch (err) {
      console.error(err);
      setFormError(err.message || "Failed to register customer.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteMember = async () => {
    if (!pendingDelete || deletingId) return;

    const member = pendingDelete;

    try {
      setDeletingId(member.id);
      setListError("");

      const response = await fetch(`${apiHost}/api/pos_loyalty_members.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to delete loyalty member.");
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setPendingDelete(null);
    } catch (err) {
      console.error(err);
      setListError(err.message || "Failed to delete loyalty member.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] border p-6 sm:p-8 ${theme.modal}`}
          >
            {view === "list" ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
                      <FiUsers size={12} style={{ color: accent }} />
                      <span style={{ color: accent }}>Loyalty Members</span>
                    </div>
                    <h3 className={`mt-3 text-2xl sm:text-3xl font-black uppercase tracking-tight ${theme.textPrimary}`}>
                      Manage Loyalty Accounts
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormError("");
                        setView("register");
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] shadow-lg transition-all active:scale-95"
                      style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
                    >
                      <FiUserPlus size={16} />
                      Add Member
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className={`rounded-2xl border p-3 transition-opacity hover:opacity-70 ${theme.panelSoft} ${theme.textPrimary}`}
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                </div>

                <div className="relative mt-6">
                  <FiSearch
                    className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
                    size={16}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or phone number..."
                    className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm font-bold outline-none ${theme.input}`}
                  />
                </div>

                <div className={`mt-6 rounded-[24px] border overflow-x-auto ${theme.panelSoft}`}>
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className={`text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>
                        <th className="px-5 py-4">Customer Name</th>
                        <th className="px-5 py-4">Phone Number</th>
                        <th className="px-5 py-4">Points Balance</th>
                        <th className="px-5 py-4">Registered</th>
                        <th className="px-5 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center">
                            <FiLoader
                              className="mx-auto animate-spin"
                              size={20}
                              style={{ color: accent }}
                            />
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={`px-5 py-10 text-center text-sm font-bold ${theme.textMuted}`}>
                            No loyalty members found.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((m) => (
                          <tr key={m.id} className={`border-t ${theme.rowBorder}`}>
                            <td className={`px-5 py-4 text-sm font-black ${theme.textPrimary}`}>
                              {m.customer_name}
                            </td>
                            <td className={`px-5 py-4 text-sm font-bold ${theme.textMuted}`}>
                              {m.phone_number}
                            </td>
                            <td className="px-5 py-4 text-sm font-black" style={{ color: accent }}>
                              {Number(m.loyalty_points || 0).toFixed(2)} pts
                            </td>
                            <td className={`px-5 py-4 text-sm font-bold ${theme.textMuted}`}>
                              {formatDate(m.date_registered)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setPendingDelete(m)}
                                disabled={deletingId === m.id}
                                className="p-2 text-rose-500 transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Delete member"
                              >
                                {deletingId === m.id ? (
                                  <FiLoader className="animate-spin" size={16} />
                                ) : (
                                  <FiTrash2 size={16} />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {listError ? (
                  <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
                    {listError}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] ${theme.textMuted} hover:opacity-70`}
                  >
                    <FiArrowLeft size={14} />
                    Back to List
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`rounded-2xl border p-3 transition-opacity hover:opacity-70 ${theme.panelSoft} ${theme.textPrimary}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>

                <div className="mt-6">
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
                    <FiUserPlus size={12} style={{ color: accent }} />
                    <span style={{ color: accent }}>New Member</span>
                  </div>
                  <h3 className={`mt-3 text-2xl sm:text-3xl font-black uppercase tracking-tight ${theme.textPrimary}`}>
                    Register Customer
                  </h3>
                  <p className={`mt-2 text-sm ${theme.textMuted}`}>
                    New members start with {signupBonusPoints.toFixed(2)} loyalty points.
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
                      Customer Name
                    </label>
                    <div className="relative">
                      <FiUsers
                        className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
                        size={16}
                      />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => {
                          setFormError("");
                          setCustomerName(e.target.value);
                        }}
                        placeholder="Juan Dela Cruz"
                        className={`h-14 w-full rounded-2xl border pl-11 pr-4 text-sm font-bold outline-none ${theme.input}`}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
                      Phone Number
                    </label>
                    <div className="relative">
                      <FiPhone
                        className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
                        size={16}
                      />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          setFormError("");
                          setPhoneNumber(e.target.value);
                        }}
                        placeholder="09XXXXXXXXX"
                        className={`h-14 w-full rounded-2xl border pl-11 pr-4 text-sm font-bold outline-none ${theme.input}`}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                {formError ? (
                  <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
                    {formError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={registerCustomer}
                  disabled={isSaving}
                  className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
                >
                  {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiUserPlus size={16} />}
                  Register Customer
                </button>
              </>
            )}
          </motion.div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`w-full max-w-sm rounded-[28px] border p-6 ${theme.modal}`}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-500"
              }`}
            >
              <FiAlertTriangle size={20} />
            </div>

            <h3 className={`mt-4 text-xl font-black uppercase tracking-tight ${theme.textPrimary}`}>
              Delete Member?
            </h3>
            <p className={`mt-2 text-sm ${theme.textMuted}`}>
              This will permanently remove{" "}
              <span className={`font-bold ${theme.textPrimary}`}>
                {pendingDelete.customer_name}
              </span>{" "}
              and their loyalty points balance. This cannot be undone.
            </p>

            {listError ? (
              <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500">
                {listError}
              </p>
            ) : null}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(deletingId)}
                className={`flex-1 rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50 ${theme.panelSoft} ${theme.textPrimary}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                disabled={Boolean(deletingId)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? <FiLoader className="animate-spin" size={14} /> : <FiTrash2 size={14} />}
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

export default PosLoyaltyMembers;
