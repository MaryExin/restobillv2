"use client";

import React, { useEffect, useState } from "react";
import {
  FiImage,
  FiLoader,
  FiSave,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosPictureSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [enablePictures, setEnablePictures] = useState(false);
  const [initEnablePictures, setInitEnablePictures] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const th = {
    panel:     isDark ? "bg-slate-900/40 border-white/5"   : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    primary:   isDark ? "text-white"     : "text-slate-900",
    muted:     isDark ? "text-slate-400" : "text-slate-500",
    soft:      isDark ? "text-slate-500" : "text-slate-400",
  };

  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        const res = await fetch(`${apiHost}/api/pos_pictures_settings.php`);
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to load.");
        if (!cancelled) {
          const val = Boolean(json.data?.enable_pictures);
          setEnablePictures(val);
          setInitEnablePictures(val);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load picture settings.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiHost]);

  const hasChanges = enablePictures !== initEnablePictures;

  const save = async () => {
    if (!apiHost || isSaving) return;
    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      const res = await fetch(`${apiHost}/api/pos_pictures_settings.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable_pictures: enablePictures }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed to save.");
      const val = Boolean(json.data?.enable_pictures);
      setEnablePictures(val);
      setInitEnablePictures(val);
      setMessage("Picture settings saved successfully.");
    } catch (e) {
      setError(e.message || "Failed to save picture settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${th.panel}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiImage size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Display Options</span>
            </div>
            <h2 className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${th.primary}`}>
              Picture <span style={{ color: accent }}>Settings</span>
            </h2>
            <p className={`mt-3 max-w-2xl text-sm ${th.muted}`}>
              Control whether product pictures are shown in the ordering screen and product list. Disabling pictures frees screen space and improves rendering speed.
            </p>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
          >
            {isSaving ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
            Save Settings
          </button>
        </div>
      </div>

      {/* Toggle */}
      {isLoading ? (
        <div className={`rounded-[28px] border p-16 text-center ${th.panel} flex flex-col items-center gap-4`}>
          <FiLoader size={36} className="text-blue-500 animate-spin" />
          <p className={`text-[11px] font-black uppercase tracking-widest ${th.soft}`}>Loading settings...</p>
        </div>
      ) : (
        <div className={`rounded-[24px] border p-5 sm:p-6 space-y-3 ${th.panelSoft}`}>
          <div>
            <p className={`text-sm font-black ${th.primary}`}>Show Product Pictures</p>
            <p className={`text-xs mt-0.5 ${th.muted}`}>
              When enabled, product images are displayed on the ordering screen and product list. When disabled, a compact text-only layout is used instead.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setMessage(""); setError(""); setEnablePictures((v) => !v); }}
            disabled={isLoading || isSaving}
            className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
              enablePictures
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : isDark
                  ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
                  : "border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-700"
            }`}
          >
            {enablePictures ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
            <span className="text-sm font-bold">{enablePictures ? "Enabled" : "Disabled"}</span>
          </button>
        </div>
      )}

      {/* Saved state summary */}
      {!isLoading && (
        <div className={`rounded-[24px] border p-4 sm:p-5 ${th.panelSoft}`}>
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <span className={`text-xs font-black uppercase tracking-widest ${th.soft}`}>Saved State</span>
            <span className={`text-xs ${th.muted}`}>
              Pictures:{" "}
              <span className={`font-black ${initEnablePictures ? "text-emerald-500" : th.soft}`}>
                {initEnablePictures ? "ON" : "OFF"}
              </span>
            </span>
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">{message}</p>
      )}
      {error && (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">{error}</p>
      )}
    </div>
  );
};

export default PosPictureSettings;
