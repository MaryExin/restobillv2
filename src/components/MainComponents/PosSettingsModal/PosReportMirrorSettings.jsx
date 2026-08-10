"use client";

/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { FiDatabase, FiLoader, FiSave } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const REPORT_MIRROR_SETTINGS_PATH =
  import.meta.env.VITE_POS_REPORT_MIRROR_SETTINGS_ENDPOINT ||
  "/api/pos_report_mirror_settings.php";

const reportMirrorHeaders = (includeJson = false) => {
  const headers = new Headers({ Accept: "application/json" });
  const token = localStorage.getItem("access_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (includeJson) headers.set("Content-Type", "application/json");
  return headers;
};

const PosReportMirrorSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [skipInterval, setSkipInterval] = useState("3");
  const [initialSkipInterval, setInitialSkipInterval] = useState("3");
  const [reportDatabase, setReportDatabase] = useState("");
  const [isSynced, setIsSynced] = useState(false);
  const [mirrorActivation, setMirrorActivation] = useState(null);
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
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  const savedLabel = useMemo(() => {
    const savedValue = Number.parseInt(initialSkipInterval, 10);
    return savedValue === 0 ? "Disabled" : `Every ${savedValue} transactions`;
  }, [initialSkipInterval]);

  const hasChanges = String(skipInterval) !== String(initialSkipInterval);
  const activationLabel = useMemo(() => {
    if (mirrorActivation?.active) {
      const value = String(mirrorActivation.activation_business_date || "");
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime())
        ? value || "Active"
        : new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(date);
    }
    if (mirrorActivation?.migration_required) return "Setup Required";
    return "First Sale After Skipping Is Enabled";
  }, [mirrorActivation]);

  useEffect(() => {
    if (!apiHost) return;

    let cancelled = false;

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(
          `${apiHost}${REPORT_MIRROR_SETTINGS_PATH}`,
          {
            cache: "no-store",
            headers: reportMirrorHeaders(),
          },
        );
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.message || "Failed to load report database settings.",
          );
        }

        if (!cancelled) {
          const nextSkipInterval = String(result?.data?.skip_interval ?? 3);
          setSkipInterval(nextSkipInterval);
          setInitialSkipInterval(nextSkipInterval);
          setReportDatabase(String(result?.data?.report_database || ""));
          setIsSynced(Boolean(result?.data?.synced_to_report_database));
          setMirrorActivation(result?.data?.report_mirror_activation || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load report database settings.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  const validateSkipInterval = () => {
    const value = String(skipInterval).trim();

    if (!/^\d+$/.test(value)) {
      return "Skip interval must be 0 or a whole number of at least 2.";
    }

    const parsed = Number.parseInt(value, 10);

    if (parsed === 1 || parsed > 1000000) {
      return "Use 0 to disable skipping, or enter a number from 2 to 1000000.";
    }

    return "";
  };

  const saveSettings = async () => {
    if (!apiHost || isSaving) return;

    const validationError = validateSkipInterval();
    if (validationError) {
      setMessage("");
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${apiHost}${REPORT_MIRROR_SETTINGS_PATH}`,
        {
          method: "POST",
          headers: reportMirrorHeaders(true),
          body: JSON.stringify({
            skip_interval: Number.parseInt(skipInterval, 10),
          }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || "Failed to save report database settings.",
        );
      }

      const savedSkipInterval = String(result?.data?.skip_interval ?? "3");
      setSkipInterval(savedSkipInterval);
      setInitialSkipInterval(savedSkipInterval);
      setReportDatabase(String(result?.data?.report_database || ""));
      setIsSynced(Boolean(result?.data?.synced_to_report_database));
      setMirrorActivation(result?.data?.report_mirror_activation || null);
      setMessage("Report database settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save report database settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}
      >
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiDatabase size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Report Database</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Transaction Skipping
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Set the interval used when mirroring POS transactions into the
              report database.
            </p>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isSaving ? (
              <FiLoader className="animate-spin" size={16} />
            ) : (
              <FiSave size={16} />
            )}
            Save Settings
          </button>
        </div>
      </div>

      {isLoading ? (
        <div
          className={`rounded-[28px] border p-16 text-center ${theme.panel} flex flex-col items-center gap-4`}
        >
          <FiLoader size={36} className="text-blue-500 animate-spin" />
          <p
            className={`text-[11px] font-black uppercase tracking-widest ${theme.textSoft}`}
          >
            Loading settings...
          </p>
        </div>
      ) : (
        <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <label
            htmlFor="report-skip-interval"
            className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
          >
            Skip Every Nth Transaction
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="report-skip-interval"
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={skipInterval}
              onChange={(event) => {
                setMessage("");
                setError("");
                setSkipInterval(event.target.value);
              }}
              disabled={isSaving}
              className={`w-full sm:max-w-[220px] rounded-2xl border px-4 py-3 text-sm font-black outline-none transition focus:ring-2 ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-white focus:ring-blue-500"
                  : "border-slate-200 bg-white text-slate-900 focus:ring-blue-500"
              }`}
            />

            <span className={`text-xs ${theme.textMuted}`}>
              Enter 0 to stop skipping transactions.
            </span>
          </div>

          <div
            className={`mt-6 grid grid-cols-1 gap-4 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4 ${theme.panelSoft}`}
          >
            <div>
              <span
                className={`block text-[10px] font-black uppercase tracking-[0.16em] ${theme.textSoft}`}
              >
                Saved Setting
              </span>
              <span className={`mt-1 block text-lg font-black ${theme.textPrimary}`}>
                {savedLabel}
              </span>
            </div>

            <div>
              <span
                className={`block text-[10px] font-black uppercase tracking-[0.16em] ${theme.textSoft}`}
              >
                Stored In
              </span>
              <span className={`mt-1 block break-all text-sm font-bold ${theme.textMuted}`}>
                {reportDatabase || "reports_database"}
              </span>
            </div>

            <div>
              <span
                className={`block text-[10px] font-black uppercase tracking-[0.16em] ${theme.textSoft}`}
              >
                Status
              </span>
              <span
                className={`mt-1 block text-lg font-black ${
                  isSynced ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {isSynced ? "Saved" : "Pending"}
              </span>
            </div>

            <div>
              <span
                className={`block text-[10px] font-black uppercase tracking-[0.16em] ${theme.textSoft}`}
              >
                Skip Started
              </span>
              <span
                className={`mt-1 block text-sm font-black ${
                  mirrorActivation?.active
                    ? "text-emerald-500"
                    : "text-amber-500"
                }`}
              >
                {activationLabel}
              </span>
            </div>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PosReportMirrorSettings;
