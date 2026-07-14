"use client";

import React, { useEffect, useState } from "react";
import { FiAward, FiSave, FiLoader, FiTrendingUp, FiGift, FiLock, FiUsers, FiUserPlus } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";
import PosLoyaltyMembers from "./PosLoyaltyMembers";

const PosLoyaltyConfig = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [earningRule, setEarningRule] = useState("");
  const [redemptionRule, setRedemptionRule] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [signupBonus, setSignupBonus] = useState("");
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const [initial, setInitial] = useState({
    earningRule: "",
    redemptionRule: "",
    minPoints: "",
    signupBonus: "",
  });

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

        const response = await fetch(`${apiHost}/api/pos_loyalty_config.php`);
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load loyalty configuration.");
        }

        if (!cancelled) {
          const next = {
            earningRule: String(Number(result?.data?.earning_rule_amount || 100)),
            redemptionRule: String(Number(result?.data?.redemption_rule_value || 1)),
            minPoints: String(Number(result?.data?.minimum_points_to_redeem || 50)),
            signupBonus: String(Number(result?.data?.signup_bonus_points || 0)),
          };
          setEarningRule(next.earningRule);
          setRedemptionRule(next.redemptionRule);
          setMinPoints(next.minPoints);
          setSignupBonus(next.signupBonus);
          setInitial(next);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load loyalty configuration.");
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

  const normalizedEarningRule = Math.max(Number(earningRule || 0), 0);
  const normalizedRedemptionRule = Math.max(Number(redemptionRule || 0), 0);
  const normalizedMinPoints = Math.max(parseInt(minPoints || 0, 10) || 0, 0);
  const normalizedSignupBonus = Math.max(Number(signupBonus || 0), 0);

  const hasChanges =
    String(normalizedEarningRule) !== String(Number(initial.earningRule || 0)) ||
    String(normalizedRedemptionRule) !== String(Number(initial.redemptionRule || 0)) ||
    String(normalizedMinPoints) !== String(Number(initial.minPoints || 0)) ||
    String(normalizedSignupBonus) !== String(Number(initial.signupBonus || 0));

  const saveSetting = async () => {
    if (!apiHost || isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(`${apiHost}/api/pos_loyalty_config.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          earning_rule_amount: normalizedEarningRule,
          redemption_rule_value: normalizedRedemptionRule,
          minimum_points_to_redeem: normalizedMinPoints,
          signup_bonus_points: normalizedSignupBonus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save loyalty configuration.");
      }

      const saved = {
        earningRule: String(Number(result?.data?.earning_rule_amount || 0)),
        redemptionRule: String(Number(result?.data?.redemption_rule_value || 0)),
        minPoints: String(Number(result?.data?.minimum_points_to_redeem || 0)),
        signupBonus: String(Number(result?.data?.signup_bonus_points || 0)),
      };
      setEarningRule(saved.earningRule);
      setRedemptionRule(saved.redemptionRule);
      setMinPoints(saved.minPoints);
      setSignupBonus(saved.signupBonus);
      setInitial(saved);
      setMessage("Loyalty configuration saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save loyalty configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const previewSpend = Math.max(normalizedEarningRule, 1) * 5;
  const previewPointsEarned = normalizedEarningRule > 0 ? previewSpend / normalizedEarningRule : 0;
  const previewRedeemDiscount = normalizedMinPoints * normalizedRedemptionRule;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        {isDark ? (
          <>
            <div
              className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle, #3b5bfd 0%, transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, #1e3a8a 0%, transparent 70%)" }}
            />
          </>
        ) : null}

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
              <FiAward size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Loyalty Program</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Loyalty Configuration
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Control how customers earn and redeem loyalty points across the POS
              without touching any code.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsMembersOpen(true)}
              className={`inline-flex items-center justify-center gap-3 rounded-2xl border px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] transition-all active:scale-95 ${theme.panelSoft} ${theme.textPrimary}`}
            >
              <FiUsers size={16} style={{ color: accent }} />
              Manage Loyalty Accounts
            </button>

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
              Save Rules
            </button>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Earning Rule */}
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}1a` }}
            >
              <FiTrendingUp size={16} style={{ color: accent }} />
            </div>
            <label className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
              Earning Rule
            </label>
          </div>

          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
              PHP
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={earningRule}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => {
                setMessage("");
                setError("");
                setEarningRule(e.target.value);
              }}
              className={`h-14 w-full rounded-2xl border pl-16 pr-4 text-lg font-black outline-none ${theme.input}`}
              placeholder="100.00"
              disabled={isLoading || isSaving}
            />
          </div>

          <p className={`mt-3 text-xs ${theme.textMuted}`}>
            Amount spent per 1 point earned. Example: <span className={theme.textPrimary}>PHP {Number(earningRule || 0).toFixed(2)}</span> spend = 1 point.
          </p>
        </div>

        {/* Redemption Rule */}
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}1a` }}
            >
              <FiGift size={16} style={{ color: accent }} />
            </div>
            <label className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
              Redemption Rule
            </label>
          </div>

          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
              PHP
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={redemptionRule}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => {
                setMessage("");
                setError("");
                setRedemptionRule(e.target.value);
              }}
              className={`h-14 w-full rounded-2xl border pl-16 pr-4 text-lg font-black outline-none ${theme.input}`}
              placeholder="1.00"
              disabled={isLoading || isSaving}
            />
          </div>

          <p className={`mt-3 text-xs ${theme.textMuted}`}>
            Cash discount per 1 point redeemed. Example: 1 point = <span className={theme.textPrimary}>PHP {Number(redemptionRule || 0).toFixed(2)}</span> off.
          </p>
        </div>

        {/* Minimum Points to Redeem */}
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}1a` }}
            >
              <FiLock size={16} style={{ color: accent }} />
            </div>
            <label className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
              Redemption Threshold
            </label>
          </div>

          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={minPoints}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => {
                setMessage("");
                setError("");
                setMinPoints(e.target.value);
              }}
              className={`h-14 w-full rounded-2xl border px-4 text-lg font-black outline-none ${theme.input}`}
              placeholder="50"
              disabled={isLoading || isSaving}
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
              PTS
            </span>
          </div>

          <p className={`mt-3 text-xs ${theme.textMuted}`}>
            Minimum points balance a customer must accumulate before redemption is allowed.
            Set to 0 to allow redemption at any balance.
          </p>
        </div>

        {/* Signup Bonus Points */}
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}1a` }}
            >
              <FiUserPlus size={16} style={{ color: accent }} />
            </div>
            <label className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
              New Member Bonus
            </label>
          </div>

          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={signupBonus}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => {
                setMessage("");
                setError("");
                setSignupBonus(e.target.value);
              }}
              className={`h-14 w-full rounded-2xl border px-4 text-lg font-black outline-none ${theme.input}`}
              placeholder="0"
              disabled={isLoading || isSaving}
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black ${theme.textMuted}`}>
              PTS
            </span>
          </div>

          <p className={`mt-3 text-xs ${theme.textMuted}`}>
            Points automatically credited when a new customer is registered. Set to 0
            for no signup bonus.
          </p>
        </div>
      </div>

      {/* Live preview */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panelSoft}`}>
        <p className={`mb-4 text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}>
          Preview
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>Spend PHP {previewSpend.toFixed(2)}</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              {previewPointsEarned.toFixed(2)} pts earned
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>At {normalizedMinPoints} pts (threshold)</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              PHP {previewRedeemDiscount.toFixed(2)} off
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>New member registers</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              +{normalizedSignupBonus.toFixed(2)} pts
            </span>
          </div>
        </div>
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

      <PosLoyaltyMembers
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        isDark={isDark}
        accent={accent}
      />
    </div>
  );
};

export default PosLoyaltyConfig;
