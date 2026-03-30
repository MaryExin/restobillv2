"use client";

import React, { useState, useEffect } from "react";
import {
  FiShield,
  FiDownload,
  FiRefreshCw,
  FiActivity,
  FiClock,
  FiCheckCircle,
  FiSave,
  FiLock,
  FiUnlock,
  FiAlertTriangle,
  FiX,
  FiMonitor,
  FiEdit3,
  FiHash,
  FiServer,
  FiTag,
  FiCalendar,
  FiLayers,
  FiBox,
  FiDatabase,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosBackupModal = ({ isDark, accent = "#3b82f6" }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingFreq, setIsSavingFreq] = useState(false);

  const [terminalData, setTerminalData] = useState(null);
  const [editData, setEditData] = useState({});
  const [syncFrequency, setSyncFrequency] = useState("1h");
  const [timeLeft, setTimeLeft] = useState(3600);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState("Never");

  const freqMap = { "1m": 60, "30m": 1800, "1h": 3600, "2h": 7200 };
  const MASTER_PASSWORD = "LESI_POSPASS@2023";

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

  const fetchData = async () => {
    try {
      const settingsRes = await fetch(
        "http://localhost/api/pos_db_backup_api.php?action=get_settings",
      );
      const sData = await settingsRes.json();
      if (sData.status === "success") {
        setSyncFrequency(sData.frequency);
        setTimeLeft(freqMap[sData.frequency] || 3600);
      }

      const terminalRes = await fetch(
        "http://localhost/api/get_terminal_config.php",
      );
      const tData = await terminalRes.json();
      if (tData.status === "success") {
        setTerminalData(tData.data);
        setEditData(tData.data);
      }
    } catch (err) {
      console.error("System Error", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? freqMap[syncFrequency] : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [syncFrequency]);

  const handleAuth = (e) => {
    e.preventDefault();

    if (passwordInput === MASTER_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const res = await fetch(
        "http://localhost/api/update_terminal_config.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editData),
        },
      );

      const data = await res.json();

      if (data.status === "success") {
        setTerminalData(editData);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3000);
        setShowMachineModal(false);
      }
    } catch (err) {
      alert("Communication Error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveFrequency = async () => {
    setIsSavingFreq(true);

    try {
      const res = await fetch(
        "http://localhost/api/pos_db_backup_api.php?action=update_frequency",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frequency: syncFrequency }),
        },
      );

      const data = await res.json();

      if (data.status === "success") {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3000);
        setTimeLeft(freqMap[syncFrequency]);
      }
    } finally {
      setIsSavingFreq(false);
    }
  };

  const manualBackup = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch(
        "http://localhost/api/pos_db_backup_api.php?action=immediate_export",
      );
      const data = await response.json();

      if (data.status === "success") {
        setLastBackupTime(new Date().toLocaleTimeString());
        window.location.href = `http://localhost/${data.download_url}?t=${Date.now()}`;
        setTimeLeft(freqMap[syncFrequency]);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const executeSystemReset = async () => {
    setIsResetting(true);

    try {
      const response = await fetch(
        "http://localhost/api/pos_db_reset_api.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await response.json();

      if (data.status === "success") {
        setShowResetModal(false);
        alert("Database cleared.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return h > 0
      ? `${h}h ${m}m ${s}s`
      : `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const configFields = [
    {
      name: "categoryCode",
      label: "Category Code",
      icon: FiLayers,
    },
    {
      name: "unitCode",
      label: "Unit Code",
      icon: FiBox,
    },
    {
      name: "businessUnitName",
      label: "Business Unit Name",
      icon: FiServer,
    },
    {
      name: "terminalNumber",
      label: "Terminal Number",
      icon: FiHash,
    },
    {
      name: "corpName",
      label: "Corporation Legal Name",
      icon: FiDatabase,
      full: true,
    },
    {
      name: "machineNumber",
      label: "Machine Identifier",
      icon: FiMonitor,
    },
    {
      name: "serialNumber",
      label: "Hardware Serial Number",
      icon: FiTag,
    },
    {
      name: "ptuNumber",
      label: "PTU Authorization Number",
      icon: FiShield,
    },
    {
      name: "ptuDateIssued",
      label: "PTU Issue Date",
      icon: FiCalendar,
      type: "date",
    },
    {
      name: "status",
      label: "Operational Status",
      icon: FiActivity,
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto">
        <div
          className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: accent }}
            />
          </div>

          <div className="relative max-w-md mx-auto">
            <div className="text-center">
              <div
                className={`mx-auto h-24 w-24 rounded-[28px] flex items-center justify-center ${
                  isDark
                    ? "bg-slate-950 border border-slate-800"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <FiLock size={38} style={{ color: accent }} />
              </div>

              <p
                className={`mt-6 text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
              >
                Data & Security
              </p>
              <h2
                className={`mt-2 text-3xl sm:text-4xl font-black ${theme.textPrimary}`}
              >
                Protected Access
              </h2>
              <p className={`mt-3 text-sm ${theme.textMuted}`}>
                Enter the master access key to manage backup settings, export
                data, and update terminal configuration.
              </p>
            </div>

            <form onSubmit={handleAuth} className="mt-8 space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter access key"
                className={`w-full px-5 py-4 rounded-2xl border text-center font-bold outline-none transition-all ${
                  authError
                    ? "border-red-500 ring-4 ring-red-500/10"
                    : theme.input
                }`}
              />

              <button
                type="submit"
                style={{ backgroundColor: accent }}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.18em] transition-all active:scale-95"
              >
                <span style={{ color: isDark ? "#0f172a" : "#ffffff" }}>
                  Verify Credentials
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] rounded-full px-6 py-4 bg-emerald-500 text-white shadow-2xl flex items-center gap-3 font-black uppercase tracking-[0.18em] text-[11px]"
          >
            <FiCheckCircle size={18} />
            System update saved
          </motion.div>
        )}
      </AnimatePresence>

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
              <FiShield size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Encrypted Protection Active</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Core Defense
            </h2>

            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              Manage backup frequency, export snapshots, edit terminal
              configuration, and protect system integrity.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowMachineModal(true)}
              className={`px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.16em] flex items-center justify-center gap-3 border transition-all ${theme.panelSoft}`}
            >
              <FiEdit3 size={16} style={{ color: accent }} />
              <span className={theme.textPrimary}>Edit Master Config</span>
            </button>

            <button
              onClick={() => setIsAuthenticated(false)}
              className={`px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.16em] flex items-center justify-center gap-3 border ${theme.panelSoft}`}
            >
              <FiUnlock size={16} />
              <span className={theme.textPrimary}>Terminate Session</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-blue-500/10" : "bg-blue-50"
              } text-blue-500`}
            >
              <FiClock size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Next Automated Sync
            </p>
          </div>
          <h3
            className={`text-2xl sm:text-3xl font-black ${theme.textPrimary}`}
          >
            {formatTime(timeLeft)}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-emerald-500/10" : "bg-emerald-50"
              } text-emerald-500`}
            >
              <FiCheckCircle size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Last Successful Sync
            </p>
          </div>
          <h3
            className={`text-2xl sm:text-3xl font-black ${theme.textPrimary}`}
          >
            {lastBackupTime}
          </h3>
        </div>

        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-violet-500/10" : "bg-violet-50"
              } text-violet-500`}
            >
              <FiShield size={22} />
            </div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Encryption Status
            </p>
          </div>
          <h3 className="text-2xl font-black sm:text-3xl text-emerald-500">
            AES-256 ACTIVE
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                  isDark
                    ? "bg-slate-950 border border-slate-800"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <FiClock size={18} style={{ color: accent }} />
              </div>
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  Backup Frequency
                </p>
                <h3 className={`text-xl font-black ${theme.textPrimary}`}>
                  Automatic sync interval
                </h3>
              </div>
            </div>

            <div
              className={`grid grid-cols-2 gap-3 rounded-[24px] border p-3 ${theme.panelSoft}`}
            >
              {Object.keys(freqMap).map((f) => {
                const active = syncFrequency === f;

                return (
                  <button
                    key={f}
                    onClick={() => setSyncFrequency(f)}
                    className={`rounded-2xl py-4 font-black text-[11px] uppercase tracking-[0.14em] transition-all ${
                      active ? "" : theme.textMuted
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
                    {f === "1m"
                      ? "1 Min"
                      : f === "30m"
                        ? "30 Min"
                        : f === "1h"
                          ? "1 Hour"
                          : "2 Hours"}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSaveFrequency}
              disabled={isSavingFreq}
              className="w-full mt-5 py-4 rounded-2xl font-black uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-60"
              style={{
                backgroundColor: accent,
                color: isDark ? "#0f172a" : "#ffffff",
              }}
            >
              <div className="flex items-center justify-center gap-3">
                {isSavingFreq ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiSave size={18} />
                )}
                {isSavingFreq ? "Saving Changes..." : "Apply New Interval"}
              </div>
            </button>
          </div>
        </div>

        <div className="xl:col-span-7">
          <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                  isDark
                    ? "bg-slate-950 border border-slate-800"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <FiActivity size={18} style={{ color: accent }} />
              </div>
              <div>
                <p
                  className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  System Integrity
                </p>
                <h3 className={`text-xl font-black ${theme.textPrimary}`}>
                  Export and emergency actions
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={`rounded-[22px] border p-5 ${theme.panelSoft}`}>
                <p
                  className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                >
                  Current Interval
                </p>
                <p className={`mt-2 text-lg font-black ${theme.textPrimary}`}>
                  {syncFrequency}
                </p>
              </div>

              <div className={`rounded-[22px] border p-5 ${theme.panelSoft}`}>
                <p
                  className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                >
                  Config Loaded
                </p>
                <p className={`mt-2 text-lg font-black ${theme.textPrimary}`}>
                  {terminalData ? "READY" : "NOT LOADED"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-6 sm:flex-row">
              <button
                onClick={manualBackup}
                disabled={isSyncing}
                className="flex-1 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  backgroundColor: accent,
                  color: isDark ? "#0f172a" : "#ffffff",
                }}
              >
                <div className="flex items-center justify-center gap-3">
                  {isSyncing ? (
                    <FiRefreshCw className="animate-spin" />
                  ) : (
                    <FiDownload size={20} />
                  )}
                  {isSyncing ? "Processing Export..." : "Manual Data Dump"}
                </div>
              </button>

              <button
                onClick={() => setShowResetModal(true)}
                className={`sm:w-[92px] py-5 rounded-[24px] border transition-all active:scale-95 hover:border-red-500/40 hover:bg-red-500/10 ${theme.panelSoft}`}
              >
                <div className="flex items-center justify-center">
                  <FiAlertTriangle size={24} className="text-red-500" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showMachineModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              className={`w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}
            >
              <div className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                      isDark
                        ? "bg-slate-950 border border-slate-800"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <FiMonitor size={22} style={{ color: accent }} />
                  </div>

                  <div>
                    <p
                      className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                    >
                      Terminal Configuration
                    </p>
                    <h3 className={`text-2xl font-black ${theme.textPrimary}`}>
                      Hardware Profile
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setShowMachineModal(false)}
                  className={`p-3 rounded-2xl border ${theme.panelSoft}`}
                >
                  <FiX size={18} className={theme.textPrimary} />
                </button>
              </div>

              <form
                onSubmit={handleUpdateConfig}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                {configFields.map((f) => {
                  const Icon = f.icon;

                  return (
                    <div key={f.name} className={f.full ? "md:col-span-2" : ""}>
                      <label
                        className={`mb-2 block text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
                      >
                        {f.label}
                      </label>

                      <div
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 ${theme.input}`}
                      >
                        <Icon size={16} className={theme.textSoft} />
                        <input
                          required
                          type={f.type || "text"}
                          value={editData[f.name] || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              [f.name]: e.target.value,
                            })
                          }
                          className="w-full bg-transparent outline-none font-semibold"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 md:col-span-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-60"
                    style={{
                      backgroundColor: accent,
                      color: isDark ? "#0f172a" : "#ffffff",
                    }}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {isUpdating ? (
                        <FiRefreshCw className="animate-spin" />
                      ) : (
                        <FiSave size={18} />
                      )}
                      {isUpdating
                        ? "Synchronizing..."
                        : "Overwrite System Data"}
                    </div>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className={`w-full max-w-lg rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}
            >
              <div className="text-center">
                <div
                  className={`mx-auto h-24 w-24 rounded-[28px] flex items-center justify-center ${
                    isDark
                      ? "bg-red-500/10 border border-red-500/20"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <FiAlertTriangle size={40} className="text-red-500" />
                </div>

                <p
                  className={`mt-6 text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                >
                  Emergency Reset
                </p>
                <h3 className={`mt-2 text-3xl font-black ${theme.textPrimary}`}>
                  Purge all data?
                </h3>
                <p className={`mt-3 text-sm ${theme.textMuted}`}>
                  Critical warning: data recovery will be impossible after this
                  action.
                </p>

                <div className="flex flex-col gap-3 mt-8">
                  <button
                    onClick={executeSystemReset}
                    disabled={isResetting}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-60"
                  >
                    {isResetting
                      ? "Clearing System..."
                      : "I Understand, Purge All Data"}
                  </button>

                  <button
                    onClick={() => setShowResetModal(false)}
                    className={`w-full py-4 rounded-2xl border font-black uppercase tracking-[0.18em] ${theme.panelSoft}`}
                  >
                    <span className={theme.textPrimary}>Abort Action</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosBackupModal;
