"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  FiSend,
  FiCheckCircle,
  FiList,
  FiTrendingUp,
  FiLoader,
  FiCalendar,
  FiMail,
  FiLayers,
  FiInbox,
} from "react-icons/fi";
import { TbCurrencyPeso } from "react-icons/tb";
import { motion, AnimatePresence } from "framer-motion";

const Toggle = ({ isOn, onToggle, accent, isDark }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
      isOn ? "" : isDark ? "bg-slate-800" : "bg-slate-200"
    }`}
    style={{ backgroundColor: isOn ? accent : undefined }}
  >
    <motion.div
      animate={{ x: isOn ? 24 : 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
    />
  </button>
);

const PosReportingModal = ({ isDark, accent = "#2563eb" }) => {
  const [status, setStatus] = useState("idle");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [shiftStart, setShiftStart] = useState("");

  const [selectedReports, setSelectedReports] = useState({
    dailySales: true,
    salesPerItem: true,
    expensesPetty: true,
  });

  useEffect(() => {
    fetch("http://localhost/api/pos_dispatch_sender.php")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setSelectedDate(data.reporting_date);
          setShiftStart(data.shift_opened);
        }
      })
      .catch((err) => console.error("Fetch Error:", err));
  }, []);

  const reportOptions = [
    {
      id: "dailySales",
      title: "Daily Sales Reports",
      desc: "Overall revenue summary",
      icon: FiTrendingUp,
    },
    {
      id: "salesPerItem",
      title: "Sales Per Item",
      desc: "Individual SKU performance",
      icon: FiList,
    },
    {
      id: "expensesPetty",
      title: "Expenses and Petty",
      desc: "Ledger cash out movements",
      icon: TbCurrencyPeso,
    },
  ];

  const isAllSelected = useMemo(
    () => reportOptions.every((rpt) => selectedReports[rpt.id]),
    [selectedReports],
  );

  const selectedCount = useMemo(
    () => Object.values(selectedReports).filter(Boolean).length,
    [selectedReports],
  );

  const handleSelectAll = () => {
    const nextVal = !isAllSelected;
    const newState = {};
    reportOptions.forEach((rpt) => {
      newState[rpt.id] = nextVal;
    });
    setSelectedReports(newState);
  };

  const toggleReport = (id) => {
    setSelectedReports((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleTransmit = async () => {
    setStatus("sending");

    try {
      const response = await fetch(
        "http://localhost/api/pos_dispatch_sender.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shift_start: shiftStart,
            selected_date: selectedDate,
            reports: selectedReports,
          }),
        },
      );

      const resData = await response.json();

      if (resData.status === "success") {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        alert("Dispatch Error: " + resData.message);
        setStatus("idle");
      }
    } catch (error) {
      console.error("Dispatch Error:", error);
      setStatus("idle");
    }
  };

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
      ? "bg-slate-950/70 border-slate-800 text-white"
      : "bg-white border-slate-200 text-slate-900",
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
              <FiMail size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Email Reports</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Registry Dispatch
            </h2>

            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              Select report packets, review the dispatch date, and send the
              registry summary to the main office.
            </p>
          </div>

          <div className={`rounded-[24px] border px-5 py-4 ${theme.panelSoft}`}>
            <p
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
            >
              Selected Reports
            </p>
            <p className={`mt-2 text-2xl font-black ${theme.textPrimary}`}>
              {selectedCount}
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT PANEL */}
        <div className="xl:col-span-4">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  Report Selection
                </p>
                <h3 className={`text-xl font-black ${theme.textPrimary}`}>
                  Choose report packets
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <Toggle
                  isOn={isAllSelected}
                  onToggle={handleSelectAll}
                  accent={accent}
                  isDark={isDark}
                />
              </div>
            </div>

            <div className="space-y-3">
              {reportOptions.map((rpt) => {
                const Icon = rpt.icon;
                const isSelected = selectedReports[rpt.id];

                return (
                  <button
                    key={rpt.id}
                    type="button"
                    onClick={() => toggleReport(rpt.id)}
                    className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                      isSelected
                        ? theme.panelSoft
                        : isDark
                          ? "bg-slate-950/20 border-slate-900 opacity-70"
                          : "bg-slate-50/60 border-slate-200 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isSelected ? "" : isDark ? "bg-slate-900" : "bg-white"
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${accent}18`,
                                color: accent,
                              }
                            : {}
                        }
                      >
                        <Icon size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4
                              className={`text-sm font-black uppercase tracking-[0.06em] ${theme.textPrimary}`}
                            >
                              {rpt.title}
                            </h4>
                            <p className={`mt-1 text-xs ${theme.textMuted}`}>
                              {rpt.desc}
                            </p>
                          </div>

                          <Toggle
                            isOn={isSelected}
                            onToggle={() => toggleReport(rpt.id)}
                            accent={accent}
                            isDark={isDark}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="xl:col-span-8">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  Dispatch Details
                </p>
                <h3 className={`text-2xl font-black ${theme.textPrimary}`}>
                  Review transmission packet
                </h3>
                <p className={`mt-2 text-sm ${theme.textMuted}`}>
                  Target destination: Main Office
                </p>
              </div>

              <div>
                <label
                  className={`mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
                >
                  <FiCalendar size={12} />
                  Manual Date Filter
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`w-full lg:w-[220px] px-4 py-3 rounded-2xl border text-sm font-semibold outline-none ${theme.input}`}
                />
              </div>
            </div>

            <div
              className={`mt-6 rounded-[24px] border p-5 ${theme.panelSoft}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                    isDark
                      ? "bg-slate-900 border border-slate-800"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  <FiInbox size={18} style={{ color: accent }} />
                </div>

                <div>
                  <p
                    className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                  >
                    Target Data Packet
                  </p>
                  <h4 className={`text-lg font-black ${theme.textPrimary}`}>
                    Included reports
                  </h4>
                </div>
              </div>

              {selectedCount === 0 ? (
                <div
                  className={`rounded-[20px] border p-6 text-center ${
                    isDark
                      ? "bg-slate-900/50 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <p
                    className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                  >
                    No Selection
                  </p>
                  <p className={`mt-2 text-sm ${theme.textMuted}`}>
                    Select at least one report before dispatching.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {Object.keys(selectedReports)
                      .filter((id) => selectedReports[id])
                      .map((id) => (
                        <motion.div
                          key={id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className={`flex items-center gap-3 rounded-[20px] border p-4 ${
                            isDark
                              ? "bg-slate-900/50 border-slate-800"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: accent }}
                          />
                          <span
                            className={`text-[11px] font-black uppercase tracking-[0.14em] truncate ${theme.textPrimary}`}
                          >
                            {reportOptions.find((o) => o.id === id)?.title}
                          </span>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className={`rounded-[22px] border p-5 ${
                  isDark
                    ? "bg-slate-950/70 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <p
                  className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                >
                  Reporting Date
                </p>
                <p className={`mt-2 text-lg font-black ${theme.textPrimary}`}>
                  {selectedDate || "—"}
                </p>
              </div>

              <div
                className={`rounded-[22px] border p-5 ${
                  isDark
                    ? "bg-slate-950/70 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <p
                  className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                >
                  Shift Start
                </p>
                <p className={`mt-2 text-lg font-black ${theme.textPrimary}`}>
                  {shiftStart || "—"}
                </p>
              </div>
            </div>

            <button
              onClick={handleTransmit}
              disabled={status !== "idle" || selectedCount === 0}
              className="w-full mt-6 py-5 rounded-[24px] font-black uppercase tracking-[0.22em] transition-all active:scale-[0.99] disabled:opacity-50"
              style={{
                backgroundColor: status === "success" ? "#10b981" : accent,
                color: isDark ? "#0f172a" : "#ffffff",
              }}
            >
              <div className="flex items-center justify-center gap-3">
                {status === "sending" ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        ease: "linear",
                      }}
                    >
                      <FiLoader size={20} />
                    </motion.div>
                    Transmitting...
                  </>
                ) : status === "success" ? (
                  <>
                    <FiCheckCircle size={20} />
                    Dispatch Successful
                  </>
                ) : (
                  <>
                    <FiSend size={20} />
                    Dispatch to Main Office
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosReportingModal;
