"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FiSearch,
  FiLoader,
  FiUser,
  FiCreditCard,
  FiSmartphone,
  FiInbox,
  FiUsers,
  FiLayers,
  FiArrowRight,
  FiTrendingUp,
  FiShoppingBag,
  FiHome,
  FiGrid,
  FiCalendar,
  FiBarChart2,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosSystemLogs = ({ isDark, accent }) => {
  const apiHost = useApiHost();

  const today = new Date().toISOString().split("T")[0];

  const [viewType, setViewType] = useState("TABLE");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiHost) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${apiHost}/api/get_system_logs.php?from=${dateFrom}&to=${dateTo}&viewType=${viewType}`,
        );
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error("System logs fetch error:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiHost, dateFrom, dateTo, viewType]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const itemName = String(item?.name || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      return Number(item?.total_amount || 0) > 0 && itemName.includes(query);
    });
  }, [data, searchQuery]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => ({
        amount: acc.amount + Number(curr?.total_amount || 0),
        count: acc.count + Number(curr?.transaction_count || 0),
      }),
      { amount: 0, count: 0 },
    );
  }, [filteredData]);

  const highestCard = useMemo(() => {
    if (!filteredData.length) return null;
    return [...filteredData].sort(
      (a, b) => Number(b?.total_amount || 0) - Number(a?.total_amount || 0),
    )[0];
  }, [filteredData]);

  const getCardStyle = (name) => {
    const n = String(name || "").toUpperCase();

    if (viewType === "TABLE") {
      return {
        icon: <FiGrid size={24} />,
        color: "#ec4899",
        softBg: "rgba(236,72,153,0.12)",
      };
    }

    if (viewType === "CASHIER") {
      return {
        icon: <FiUser size={24} />,
        color: "#6366f1",
        softBg: "rgba(99,102,241,0.12)",
      };
    }

    if (n.includes("GCASH") || n.includes("PAYMAYA")) {
      return {
        icon: <FiSmartphone size={24} />,
        color: "#3b82f6",
        softBg: "rgba(59,130,246,0.12)",
      };
    }

    if (n.includes("CASH") || n.includes("PALAWAN") || n.includes("CEBUANA")) {
      return {
        icon: <FiInbox size={24} />,
        color: "#10b981",
        softBg: "rgba(16,185,129,0.12)",
      };
    }

    if (n.includes("BDO") || n.includes("BPI") || n.includes("BANK")) {
      return {
        icon: <FiHome size={24} />,
        color: "#f59e0b",
        softBg: "rgba(245,158,11,0.12)",
      };
    }

    return {
      icon: <FiCreditCard size={24} />,
      color: "#94a3b8",
      softBg: "rgba(148,163,184,0.12)",
    };
  };

  const viewButtons = [
    { id: "TABLE", label: "Tables", icon: FiGrid },
    { id: "PAYMENT", label: "Payments", icon: FiLayers },
    { id: "CASHIER", label: "Cashiers", icon: FiUsers },
  ];

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
    input: isDark
      ? "bg-slate-950/60 border-slate-800 text-white"
      : "bg-white border-slate-200 text-slate-900",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HERO / HEADER */}
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-50px] right-[-30px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
              <FiBarChart2 size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Registry Sales</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              System Logs
            </h2>

            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              Monitor sales breakdown by table, payment type, or cashier for the
              selected date range.
            </p>
          </div>

          <div
            className={`flex flex-wrap gap-3 rounded-[24px] border p-2 ${theme.panelSoft}`}
          >
            {viewButtons.map((btn) => {
              const Icon = btn.icon;
              const active = viewType === btn.id;

              return (
                <button
                  key={btn.id}
                  onClick={() => setViewType(btn.id)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
                    active
                      ? "shadow-lg"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-500 hover:text-slate-900"
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: accent,
                          color: isDark ? "#0f172a" : "#ffffff",
                        }
                      : {}
                  }
                >
                  <Icon size={15} />
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-emerald-500/10" : "bg-emerald-50"
              } text-emerald-500`}
            >
              <FiTrendingUp size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Total Net Sales
            </p>
          </div>

          <h3
            className={`text-2xl sm:text-3xl font-black ${theme.textPrimary}`}
          >
            ₱{totals.amount.toLocaleString()}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-blue-500/10" : "bg-blue-50"
              } text-blue-500`}
            >
              <FiShoppingBag size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Transaction Count
            </p>
          </div>

          <h3
            className={`text-2xl sm:text-3xl font-black ${theme.textPrimary}`}
          >
            {totals.count.toLocaleString()}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-violet-500/10" : "bg-violet-50"
              } text-violet-500`}
            >
              <FiLayers size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Top Performer
            </p>
          </div>

          <h3
            className={`text-lg sm:text-xl font-black uppercase truncate ${theme.textPrimary}`}
          >
            {highestCard?.name || "—"}
          </h3>
          <p className={`mt-2 text-sm ${theme.textMuted}`}>
            {highestCard
              ? `₱${Number(highestCard.total_amount || 0).toLocaleString()}`
              : "No available data"}
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative">
              <FiCalendar
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textSoft}`}
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`w-full sm:w-[180px] pl-12 pr-4 py-3 rounded-2xl border text-sm font-semibold outline-none ${theme.input}`}
              />
            </div>

            <div className="hidden sm:flex items-center justify-center px-1">
              <FiArrowRight className={theme.textSoft} />
            </div>

            <div className="relative">
              <FiCalendar
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textSoft}`}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`w-full sm:w-[180px] pl-12 pr-4 py-3 rounded-2xl border text-sm font-semibold outline-none ${theme.input}`}
              />
            </div>
          </div>

          <div className="relative">
            <FiSearch
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textSoft}`}
            />
            <input
              type="text"
              placeholder={`Search ${viewType.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl border text-sm outline-none ${theme.input}`}
            />
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[320px]">
          <div
            className={`rounded-[28px] border px-8 py-10 flex flex-col items-center gap-4 ${theme.panel}`}
          >
            <div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
                isDark
                  ? "bg-slate-950 border border-slate-800"
                  : "bg-slate-50 border border-slate-200"
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
                Fetching system log records...
              </p>
            </div>
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div
          className={`rounded-[32px] border p-8 sm:p-10 text-center ${theme.panel}`}
        >
          <div
            className={`mx-auto mb-5 h-20 w-20 rounded-[24px] flex items-center justify-center ${
              isDark
                ? "bg-slate-950 border border-slate-800"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <FiSearch size={30} style={{ color: accent }} />
          </div>

          <p
            className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
          >
            No Records
          </p>
          <h3 className={`mt-2 text-2xl font-black ${theme.textPrimary}`}>
            No results found
          </h3>
          <p className={`mt-3 text-sm max-w-md mx-auto ${theme.textMuted}`}>
            Try changing the date range, switching the breakdown type, or using
            a different search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredData.map((item, idx) => {
            const style = getCardStyle(item?.name);
            const amount = Number(item?.total_amount || 0);
            const transactionCount = Number(item?.transaction_count || 0);
            const percentage =
              totals.amount > 0
                ? ((amount / totals.amount) * 100).toFixed(1)
                : "0.0";

            return (
              <div
                key={idx}
                className={`rounded-[28px] border p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 ${theme.panel}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: style.softBg,
                      color: style.color,
                    }}
                  >
                    {style.icon}
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                    >
                      Contribution
                    </p>
                    <p
                      className="mt-1 text-base font-black"
                      style={{ color: style.color }}
                    >
                      {percentage}%
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <h4
                    className={`text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight ${theme.textPrimary}`}
                  >
                    {item?.name || "Unnamed"}
                  </h4>
                  <p
                    className={`mt-1 text-[10px] font-black uppercase tracking-[0.2em] ${theme.textSoft}`}
                  >
                    {item?.subtitle || `${viewType} breakdown`}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div
                    className={`rounded-[22px] border p-4 ${
                      isDark
                        ? "bg-slate-950/70 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                    >
                      Volume
                    </p>
                    <p
                      className={`mt-2 text-xl font-black ${theme.textPrimary}`}
                    >
                      {transactionCount.toLocaleString()}
                    </p>
                  </div>

                  <div
                    className={`rounded-[22px] border p-4 ${
                      isDark
                        ? "bg-slate-950/70 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                    >
                      Subtotal
                    </p>
                    <p
                      className="mt-2 text-xl font-black"
                      style={{ color: accent }}
                    >
                      ₱{amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div
                    className={`w-full rounded-full h-2 overflow-hidden ${
                      isDark ? "bg-slate-950" : "bg-slate-100"
                    }`}
                  >
                    <div
                      className="h-full transition-all duration-700"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: style.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PosSystemLogs;
