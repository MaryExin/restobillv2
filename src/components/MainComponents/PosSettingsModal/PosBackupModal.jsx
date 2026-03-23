"use client";

import React, { useState, useEffect } from "react";
import { 
  FiShield, FiDownload, FiRefreshCw, FiActivity, FiClock, FiCheckCircle, FiSave 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PosBackupModal = ({ isDark, accent }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState("1h");
  const [timeLeft, setTimeLeft] = useState(3600); 
  const [lastBackup, setLastBackup] = useState(null);

  const freqMap = { "1m": 60, "30m": 1800, "1h": 3600, "2h": 7200 };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("http://localhost/api/pos_db_backup_api.php?action=get_settings");
        const data = await res.json();
        if (data.status === "success") {
          setSyncFrequency(data.frequency);
          setTimeLeft(freqMap[data.frequency] || 3600);
        }
      } catch (err) { console.error("Database connection error"); }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const handleGlobalBackupDone = (e) => {
      setLastBackup(e.detail.time); 
      setTimeLeft(freqMap[syncFrequency]); 
    };

    window.addEventListener("backup-completed", handleGlobalBackupDone);
    return () => window.removeEventListener("backup-completed", handleGlobalBackupDone);
  }, [syncFrequency]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("http://localhost/api/pos_db_backup_api.php?action=update_frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: syncFrequency }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3000);
        setTimeLeft(freqMap[syncFrequency]); 
      }
    } finally { setIsSaving(false); }
  };

  const manualBackup = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("http://localhost/api/pos_db_backup_api.php?action=immediate_export");
      const data = await response.json();
      if (data.status === "success") {
        setLastBackup(new Date().toLocaleTimeString());
        window.location.href = `http://localhost/${data.download_url}?t=${Date.now()}`;
        setTimeLeft(freqMap[syncFrequency]); 
      }
    } finally { setIsSyncing(false); }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="relative w-full max-w-4xl p-4 mx-auto space-y-10">
      
      <AnimatePresence>
        {showSavedToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-8 py-4 rounded-full bg-emerald-500 text-white shadow-2xl font-bold text-[10px] uppercase tracking-[0.2em]"
          >
            <FiCheckCircle size={18} /> Settings Synchronized
          </motion.div>
        )}
      </AnimatePresence>

      <header className="space-y-4">
        <div className="flex items-center gap-3 text-blue-500 bg-blue-500/10 w-fit px-4 py-1.5 rounded-full border border-blue-500/20">
          <FiShield size={14} />
          <span className="font-black text-[9px] uppercase tracking-[0.2em]">Live Backup Protocol</span>
        </div>
        {/* REMOVED ITALIC, APPLIED FONT-BLACK */}
        <h2 className={`text-5xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Database <span style={{ color: accent }}>Protection</span>
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={`p-8 rounded-[40px] border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          {/* REMOVED ITALIC */}
          <h4 className="font-black text-[10px] uppercase tracking-[0.3em] mb-8 opacity-40 flex items-center gap-2">
            <FiClock /> Time Interval
          </h4>
          <div className="space-y-6">
            <div className={`flex p-1.5 rounded-[25px] ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              {Object.keys(freqMap).map((f) => (
                <button
                  key={f}
                  onClick={() => setSyncFrequency(f)}
                  className="relative flex-1 py-4 rounded-[20px] font-black text-[10px] uppercase z-10 transition-all active:scale-95"
                  style={{ color: syncFrequency === f ? (isDark ? '#000' : '#fff') : 'gray' }}
                >
                  {syncFrequency === f && <motion.div layoutId="tab" className="absolute inset-0 rounded-[20px] shadow-lg" style={{ backgroundColor: accent, zIndex: -1 }} />}
                  {f === '1m' ? 'Per Min' : f === '30m' ? '30 Mins' : f === '1h' ? '1 Hr' : '2 Hrs'}
                </button>
              ))}
            </div>
            
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={`w-full py-5 rounded-3xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.97] ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {isSaving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
              {isSaving ? "Syncing..." : "Apply Settings"}
            </button>
          </div>
        </div>

        <div className={`p-8 rounded-[40px] border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          {/* REMOVED ITALIC */}
          <h4 className="font-black text-[10px] uppercase tracking-[0.3em] mb-8 opacity-40 flex items-center gap-2">
            <FiActivity /> System Health
          </h4>
          <div className="space-y-4">
             <div className="p-6 rounded-[35px] bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                <div>
                   <p className="font-black text-[9px] uppercase text-blue-500 mb-1 tracking-widest leading-none">Next Auto-Run:</p>
                   <p className={`text-4xl font-black tabular-nums tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {formatTime(timeLeft)}
                   </p>
                </div>
                <div className="relative">
                   <FiRefreshCw className={`text-blue-500 ${timeLeft < 10 ? 'animate-spin' : ''}`} size={24} />
                </div>
             </div>
             <div className={`flex items-center gap-4 p-5 rounded-3xl ${isDark ? 'bg-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="p-3 rounded-full bg-emerald-500/20">
                   <FiCheckCircle className="text-emerald-500" size={18} />
                </div>
                <div>
                   <p className="font-black text-[9px] uppercase opacity-40 tracking-widest">Latest SQL Export</p>
                   <p className="font-bold text-[11px] tracking-tight">
                    {lastBackup ? `Successful @ ${lastBackup}` : 'Standby Mode'}
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <button 
        onClick={manualBackup} 
        disabled={isSyncing} 
        className="w-full py-9 rounded-[40px] text-white font-black uppercase tracking-[0.5em] text-[15px] shadow-2xl transition-all active:scale-[0.98] group relative overflow-hidden" 
        style={{ backgroundColor: accent }}
      >
        <div className="relative z-10 flex items-center justify-center gap-4">
          {isSyncing ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
          {isSyncing ? "Exporting Database..." : "Force Overwrite Data"}
        </div>
        <div className="absolute inset-0 transition-transform duration-700 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full" />
      </button>

    </div>
  );
};

export default PosBackupModal;