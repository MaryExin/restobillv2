"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FixedSizeList as List } from "react-window";
import {
  FaArrowLeft,
  FaSearch,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCloudUploadAlt,
  FaList,
  FaThLarge,
} from "react-icons/fa";
import {
  FiRefreshCw,
  FiWifiOff,
  FiPackage,
  FiClock,
  FiInfo,
  FiCheckSquare,
  FiFilter,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useTheme } from "../../context/ThemeContext";
import useCustomQuery from "../../hooks/useCustomQuery";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";

import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";

const normalize = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const TABLE_TEMPLATE =
  "minmax(90px,0.9fr) minmax(140px,1.2fr) minmax(80px,0.8fr) minmax(100px,0.9fr) minmax(150px,1.2fr) minmax(150px,1.2fr) minmax(70px,0.7fr) minmax(70px,0.7fr) minmax(70px,0.7fr) minmax(70px,0.7fr) minmax(70px,0.7fr) minmax(120px,1fr) minmax(110px,0.9fr)";

const StatCard = ({
  title,
  value,
  icon,
  accent = "blue",
  subtitle,
  isDark,
}) => {
  const accentCls =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "amber"
        ? "text-amber-400"
        : accent === "rose"
          ? "text-rose-400"
          : accent === "violet"
            ? "text-violet-400"
            : "text-blue-400";

  return (
    <div
      className={`rounded-[2rem] p-5 border backdrop-blur-xl ${
        isDark
          ? "bg-slate-900/40 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
            {title}
          </div>
          <div
            className={`text-3xl font-black ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {value}
          </div>
          {subtitle ? (
            <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
          ) : null}
        </div>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isDark ? "bg-slate-950/80" : "bg-slate-100"
          } ${accentCls}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

const FilterChip = ({
  active,
  label,
  onClick,
  tone = "default",
  isDark,
  disabled = false,
}) => {
  const activeCls =
    tone === "emerald"
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
      : tone === "amber"
        ? "bg-amber-600 text-white shadow-lg shadow-amber-900/20"
        : tone === "rose"
          ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20"
          : tone === "slate"
            ? "bg-slate-700 text-white shadow-lg"
            : "bg-blue-600 text-white shadow-lg shadow-blue-900/20";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
        disabled
          ? isDark
            ? "bg-slate-800/40 text-slate-500 border border-white/5 cursor-not-allowed"
            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          : active
            ? activeCls
            : isDark
              ? "bg-slate-900/40 text-slate-400 border border-white/5 hover:text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
};

const InfoStrip = ({ isDark, title, message, tone = "blue" }) => {
  const toneCls = isDark
    ? tone === "amber"
      ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
      : tone === "rose"
        ? "bg-rose-500/10 border border-rose-500/20 text-rose-200"
        : tone === "emerald"
          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200"
          : "bg-blue-500/10 border border-blue-500/20 text-blue-200"
    : tone === "amber"
      ? "bg-amber-50 border border-amber-200 text-amber-800"
      : tone === "rose"
        ? "bg-rose-50 border border-rose-200 text-rose-800"
        : tone === "emerald"
          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
          : "bg-blue-50 border border-blue-200 text-blue-800";

  return (
    <div className={`rounded-[2rem] p-4 flex items-start gap-3 ${toneCls}`}>
      <FiInfo className="mt-1 shrink-0" />
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
          {title}
        </div>
        <div className="text-sm whitespace-pre-line">{message}</div>
      </div>
    </div>
  );
};

const badgeForShift = (row, isDark) => {
  if (row.already_synced) {
    return isDark
      ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
      : "bg-violet-50 text-violet-700 border border-violet-200";
  }

  if (row.shift_status === "Open") {
    return isDark
      ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
      : "bg-rose-50 text-rose-700 border border-rose-200";
  }

  return isDark
    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
    : "bg-emerald-50 text-emerald-700 border border-emerald-200";
};

const readinessLabel = (row) => {
  if (row.already_synced) return "Already Synced";
  if (row.shift_status === "Open") return "Open / Not Ready";
  if (row.ready_to_sync) return "Ready To Sync";
  return "Not Ready";
};

const SyncingOverlay = ({ isDark, open }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div
        className={`absolute inset-0 backdrop-blur-md ${
          isDark ? "bg-slate-950/75" : "bg-white/70"
        }`}
      />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className={`w-full max-w-xl rounded-[2.5rem] border p-8 md:p-10 text-center shadow-2xl ${
            isDark
              ? "bg-slate-900/90 border-white/10 text-white"
              : "bg-white/95 border-slate-200 text-slate-900"
          }`}
        >
          <div className="mx-auto mb-6 h-28 w-28 rounded-full border-[10px] border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="text-3xl md:text-4xl font-black tracking-tight">
            Syncing to WEB...
          </div>
          <div className="mt-3 text-sm md:text-base text-slate-500">
            Exporting selected OFFLINE data, uploading to WEB, and refreshing
            LOCAL + WEB reads. All actions are temporarily disabled.
          </div>
        </div>
      </div>
    </div>
  );
};

const ShiftCard = ({ row, checked, onToggle, isDark, disabledAll = false }) => {
  const disabled = !row.ready_to_sync || disabledAll;
  const badgeCls = badgeForShift(row, isDark);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[2rem] overflow-hidden border ${
        isDark
          ? "bg-slate-900/30 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      }`}
      style={{ marginBottom: "18px" }}
    >
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeCls}`}
              >
                {row.shift_status}
              </span>

              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  isDark
                    ? "bg-slate-900/70 text-slate-300 border border-white/5"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {readinessLabel(row)}
              </span>
            </div>

            <h3
              className={`text-xl font-black break-words ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {row.category_code || row.unit_code}
            </h3>

            <div className="mt-1 text-sm text-slate-500 break-words">
              Busunit: {row.unit_code}
            </div>

            <div className="mt-1 text-sm text-slate-500 break-words">
              Shift #{row.shift_id} • Terminal {row.terminal_number}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isDark
                    ? "bg-slate-900/50 border border-white/5"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Opening
                </div>
                <div className="font-bold">{row.opening_datetime || "—"}</div>
              </div>

              <div
                className={`rounded-2xl px-4 py-3 ${
                  isDark
                    ? "bg-slate-900/50 border border-white/5"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Closing
                </div>
                <div className="font-bold">{row.closing_datetime || "—"}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 xl:grid-cols-5 gap-3">
              {[
                ["Transactions", row.count_transactions || 0],
                ["Detailed", row.count_detailed || 0],
                ["Discounts", row.count_discounts || 0],
                ["Payments", row.count_payments || 0],
                ["Other Charges", row.count_other_charges || 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={`rounded-2xl px-4 py-3 ${
                    isDark
                      ? "bg-slate-900/50 border border-white/5"
                      : "bg-slate-50 border border-slate-200"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    {label}
                  </div>
                  <div className="text-lg font-black mt-1">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  row.shift_status === "Open"
                    ? isDark
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                      : "bg-rose-50 border border-rose-200 text-rose-700"
                    : row.already_synced
                      ? isDark
                        ? "bg-violet-500/10 border border-violet-500/20 text-violet-300"
                        : "bg-violet-50 border border-violet-200 text-violet-700"
                      : isDark
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                }`}
              >
                {row.shift_status === "Open"
                  ? "This shift is still Open. It stays visible for monitoring, but selection is disabled until Closing_DateTime is present and Shift_Status becomes Closed."
                  : row.already_synced
                    ? "This shift is already marked Synced on WEB, so it is not eligible for re-sync."
                    : `This sync will export this shift from OFFLINE, then upload it to WEB with ${
                        row.count_transactions || 0
                      } transaction(s), ${
                        row.count_detailed || 0
                      } detailed row(s), ${
                        row.count_discounts || 0
                      } discount row(s), ${
                        row.count_payments || 0
                      } payment row(s), and ${
                        row.count_other_charges || 0
                      } other charge row(s).`}
              </div>
            </div>
          </div>

          <div className="md:pl-4 md:w-[180px]">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(row.row_key)}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition-all ${
                checked
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                  : disabled
                    ? isDark
                      ? "bg-slate-800/30 text-slate-500 cursor-not-allowed border border-white/5"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    : isDark
                      ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                      : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
            >
              {checked ? "Selected" : disabled ? "Disabled" : "Select"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ProgressLoader = ({ isDark, text = "Loading shift sync details..." }) => {
  return (
    <div
      className={`rounded-[2rem] p-8 border text-center ${
        isDark
          ? "bg-slate-900/40 border-white/5"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="mx-auto mb-4 w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
      <div
        className={`text-2xl font-black ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {text}
      </div>
      <div className="mt-2 text-slate-500">
        Reading OFFLINE shifts and checking WEB synced state.
      </div>
    </div>
  );
};

const VirtualHeader = ({ isDark }) => {
  const cols = [
    "Shift",
    "Busunit",
    "Terminal",
    "Status",
    "Opening",
    "Closing",
    "Txn",
    "Dtl",
    "Disc",
    "Pay",
    "Oth",
    "Readiness",
    "Select",
  ];

  return (
    <div
      className={isDark ? "bg-slate-900/60" : "bg-slate-100/70"}
      style={{
        display: "grid",
        gridTemplateColumns: TABLE_TEMPLATE,
        width: "1600px",
        minWidth: "1600px",
      }}
    >
      {cols.map((col) => (
        <div
          key={col}
          className="p-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500"
        >
          {col}
        </div>
      ))}
    </div>
  );
};

const VirtualRow = ({ index, style, data }) => {
  const { rows, selectedRowKeys, toggleSelect, isDark, disabledAll } = data;
  const row = rows[index];
  const checked = selectedRowKeys.includes(row.row_key);
  const disabled = !row.ready_to_sync || disabledAll;

  return (
    <div style={style}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: TABLE_TEMPLATE,
          width: "1600px",
          minWidth: "1600px",
        }}
        className={`border-b last:border-0 transition-colors ${
          isDark
            ? "border-white/5 hover:bg-white/5"
            : "border-slate-100 hover:bg-slate-50"
        }`}
      >
        <div className="p-4">
          <div
            className={`font-black text-sm ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Shift #{row.shift_id}
          </div>
          <div className="text-xs text-slate-500">
            {row.category_code || "—"}
          </div>
        </div>

        <div className="p-4">
          <div className="font-black">{row.unit_code}</div>
          <div className="text-xs text-slate-500">{row.category_code}</div>
        </div>

        <div className="p-4">{row.terminal_number}</div>

        <div className="p-4">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeForShift(
              row,
              isDark,
            )}`}
          >
            {row.shift_status}
          </span>
        </div>

        <div className="p-4 text-sm">{row.opening_datetime || "—"}</div>
        <div className="p-4 text-sm">{row.closing_datetime || "—"}</div>

        <div className="p-4 font-bold">{row.count_transactions || 0}</div>
        <div className="p-4 font-bold">{row.count_detailed || 0}</div>
        <div className="p-4 font-bold">{row.count_discounts || 0}</div>
        <div className="p-4 font-bold">{row.count_payments || 0}</div>
        <div className="p-4 font-bold">{row.count_other_charges || 0}</div>

        <div className="p-4">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
              row.ready_to_sync
                ? isDark
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : row.shift_status === "Open"
                  ? isDark
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                  : isDark
                    ? "bg-slate-500/10 text-slate-300 border border-slate-500/20"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}
          >
            {readinessLabel(row)}
          </span>
        </div>

        <div className="p-4">
          <button
            disabled={disabled}
            onClick={() => toggleSelect(row.row_key)}
            className={`rounded-2xl px-4 py-2 font-bold transition-all ${
              checked
                ? "bg-blue-600 text-white"
                : disabled
                  ? isDark
                    ? "bg-slate-700/30 text-slate-500 cursor-not-allowed"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : isDark
                    ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                    : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            {checked ? "Selected" : disabled ? "Disabled" : "Select"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SyncOfflineSalesToWeb = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ready");
  const [terminalFilter, setTerminalFilter] = useState("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [virtualHeight, setVirtualHeight] = useState(620);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [showhidesuccess, setshowhidesuccess] = useState(false);
  const [returnmessage, setReturnmessage] = useState({ message: "" });

  const localReadUrl =
    import.meta.env.VITE_LOCALAPIENDPOINT +
    import.meta.env.VITE_SHIFT_SYNC_LOCAL_READ_ENDPOINT;

  const {
    data: localReadData,
    isLoading,
    refetch,
  } = useCustomQuery(localReadUrl, ["shift-sync-local-read"]);

  const { mutate: localExportMutate } = useCustomSecuredMutation(
    import.meta.env.VITE_LOCALAPIENDPOINT +
      import.meta.env.VITE_SHIFT_SYNC_LOCAL_EXPORT_ENDPOINT,
  );

  const { mutate: webStatusMutate, data: webStatusData } =
    useCustomSecuredMutation(
      import.meta.env.VITE_WEBAPIENDPOINT +
        import.meta.env.VITE_SHIFT_SYNC_WEB_STATUS_ENDPOINT,
    );

  const { mutate: webUploadMutate } = useCustomSecuredMutation(
    import.meta.env.VITE_WEBAPIENDPOINT +
      import.meta.env.VITE_SHIFT_SYNC_WEB_MUTATE_ENDPOINT,
  );

  const targetBusunitName =
    webStatusData?.busunit_names?.[localReadData?.target?.busunitcode] ||
    localReadData?.target?.busunit_name ||
    localReadData?.target?.busunitcode ||
    "No target busunit";

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      const h = Math.max(360, window.innerHeight - 300);
      setVirtualHeight(h);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const runWebStatusCheck = useCallback(
    (rowsInput = []) => {
      const shifts = (rowsInput || [])
        .map((row) => ({
          row_key: row.row_key,
          unit_code: row.unit_code,
          shift_id: row.shift_id,
          terminal_number: row.terminal_number,
          opening_datetime: row.opening_datetime,
        }))
        .filter(
          (row) =>
            row.row_key &&
            row.unit_code &&
            row.shift_id &&
            row.terminal_number &&
            row.opening_datetime,
        );

      if (shifts.length === 0) return;
      webStatusMutate({ shifts });
    },
    [webStatusMutate],
  );

  const runFullRefresh = useCallback(async () => {
    const res = await refetch?.();
    const latestRows = res?.data?.rows || [];
    if (latestRows.length > 0) {
      runWebStatusCheck(latestRows);
    }
    return res;
  }, [refetch, runWebStatusCheck]);

  useEffect(() => {
    const localRows = localReadData?.rows || [];
    if (localRows.length === 0) return;
    runWebStatusCheck(localRows);
  }, [localReadData, runWebStatusCheck]);

  const mergedRows = useMemo(() => {
    const localRows = localReadData?.rows || [];
    const syncedKeys = new Set(webStatusData?.synced_row_keys || []);

    return localRows
      .map((row) => ({
        ...row,
        already_synced: syncedKeys.has(row.row_key),
      }))
      .filter((row) => !row.already_synced);
  }, [localReadData, webStatusData]);

  const rows = mergedRows;

  const terminalOptions = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((r) => String(r.terminal_number || "")).filter(Boolean)),
    );
    return values.sort((a, b) => Number(a) - Number(b));
  }, [rows]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      closed: rows.filter((r) => r.shift_status === "Closed").length,
      open: rows.filter((r) => r.shift_status === "Open").length,
      ready: rows.filter((r) => r.ready_to_sync).length,
      selected: rows.filter(
        (r) => selectedRowKeys.includes(r.row_key) && r.ready_to_sync,
      ).length,
      transactions: rows.reduce(
        (sum, r) => sum + Number(r.count_transactions || 0),
        0,
      ),
    };
  }, [rows, selectedRowKeys]);

  useEffect(() => {
    const auto = rows.filter((r) => r.ready_to_sync).map((r) => r.row_key);
    setSelectedRowKeys((prev) => {
      const prevSet = new Set(prev);
      const next = auto.filter((key) => !prevSet.has(key));
      return prev.length === 0
        ? auto
        : [...prev.filter((k) => auto.includes(k)), ...next];
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    let data = [...rows];

    if (filter === "ready") {
      data = data.filter((r) => r.ready_to_sync);
    } else if (filter === "closed") {
      data = data.filter((r) => r.shift_status === "Closed");
    } else if (filter === "open") {
      data = data.filter((r) => r.shift_status === "Open");
    }

    if (terminalFilter !== "all") {
      data = data.filter(
        (r) => String(r.terminal_number || "") === String(terminalFilter),
      );
    }

    if (search.trim()) {
      const q = normalize(search);
      data = data.filter((r) => {
        const hay = [
          r.category_code,
          r.unit_code,
          r.shift_id,
          r.terminal_number,
          r.opening_datetime,
          r.closing_datetime,
          r.shift_status,
        ]
          .map(normalize)
          .join(" ");
        return hay.includes(q);
      });
    }

    data.sort((a, b) => {
      const aa = normalize(a.closing_sort || a.closing_datetime);
      const bb = normalize(b.closing_sort || b.closing_datetime);
      return bb.localeCompare(aa, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return data;
  }, [rows, filter, search, terminalFilter]);

  const selectedRows = useMemo(() => {
    const map = new Set(selectedRowKeys);
    return rows.filter((r) => map.has(r.row_key) && r.ready_to_sync);
  }, [rows, selectedRowKeys]);

  const toggleSelect = useCallback(
    (rowKey) => {
      if (isSyncing) return;
      setSelectedRowKeys((prev) =>
        prev.includes(rowKey)
          ? prev.filter((id) => id !== rowKey)
          : [...prev, rowKey],
      );
    },
    [isSyncing],
  );

  const selectAllVisibleReady = () => {
    if (isSyncing) return;

    const visibleReady = filteredRows
      .filter((r) => r.ready_to_sync)
      .map((r) => r.row_key);

    setSelectedRowKeys((prev) => {
      const s = new Set(prev);
      visibleReady.forEach((id) => s.add(id));
      return Array.from(s);
    });
  };

  const clearSelection = () => {
    if (isSyncing) return;
    setSelectedRowKeys([]);
  };

  const openSyncConfirm = () => {
    if (isSyncing) return;
    setYesNoModalOpen(true);
  };

  const handleModalConfirm = () => {
    setYesNoModalOpen(false);

    if (!isOnline) {
      setReturnmessage({
        message: "Offline. Cannot sync while there is no internet.",
      });
      setshowhidesuccess(true);
      return;
    }

    if ((localReadData?.target?.busunitcode || "") === "") {
      setReturnmessage({
        message: "No active business unit mapping found.",
      });
      setshowhidesuccess(true);
      return;
    }

    if (selectedRows.length === 0) {
      setReturnmessage({ message: "No selected closed shifts to sync." });
      setshowhidesuccess(true);
      return;
    }

    setIsSyncing(true);

    localExportMutate(
      {
        busunitcode: localReadData.target.busunitcode,
        shifts: selectedRows.map((row) => ({
          row_key: row.row_key,
          shift_id: row.shift_id,
          terminal_number: row.terminal_number,
          unit_code: row.unit_code,
          opening_datetime: row.opening_datetime,
          closing_datetime: row.closing_datetime,
        })),
      },
      {
        onSuccess: (exportData) => {
          webUploadMutate(exportData, {
            onSuccess: async (uploadData) => {
              await runFullRefresh();

              const latestSyncedKeys = new Set(
                webStatusData?.synced_row_keys || [],
              );

              setSelectedRowKeys((prev) =>
                prev.filter((key) => !latestSyncedKeys.has(key)),
              );

              setReturnmessage({
                message:
                  uploadData?.summary_message ||
                  `Uploaded ${uploadData?.synced_shifts || 0} shift(s) to WEB.`,
              });
              setshowhidesuccess(true);
              setIsSyncing(false);
            },
            onError: (err) => {
              setIsSyncing(false);
              setReturnmessage({
                message:
                  err?.response?.data?.message ||
                  err?.message ||
                  "WEB upload failed.",
              });
              setshowhidesuccess(true);
            },
          });
        },
        onError: (err) => {
          setIsSyncing(false);
          setReturnmessage({
            message:
              err?.response?.data?.message ||
              err?.message ||
              "LOCAL export failed.",
          });
          setshowhidesuccess(true);
        },
      },
    );
  };

  const modalMessage = useMemo(() => {
    const shiftsCount = selectedRows.length;
    const txns = selectedRows.reduce(
      (sum, r) => sum + Number(r.count_transactions || 0),
      0,
    );
    const details = selectedRows.reduce(
      (sum, r) => sum + Number(r.count_detailed || 0),
      0,
    );
    const discounts = selectedRows.reduce(
      (sum, r) => sum + Number(r.count_discounts || 0),
      0,
    );
    const payments = selectedRows.reduce(
      (sum, r) => sum + Number(r.count_payments || 0),
      0,
    );
    const otherCharges = selectedRows.reduce(
      (sum, r) => sum + Number(r.count_other_charges || 0),
      0,
    );

    return `Do you want to export ${shiftsCount} selected closed shift(s) from OFFLINE and upload them to WEB?

Shifts: ${shiftsCount}
Transactions: ${txns}
Detailed rows: ${details}
Discount rows: ${discounts}
Payment rows: ${payments}
Other charge rows: ${otherCharges}

WEB shifting records for those same shifts will be updated to Status = Synced after successful upload.`;
  }, [selectedRows]);

  const localReadMessage = localReadData?.message || "";
  const webStatusMessage = webStatusData?.message || "";

  const isLocalFailed = localReadMessage === "Failed";
  const isWebFailed = webStatusMessage === "Failed";
  const noBusinessUnit = localReadMessage === "NoBusinessUnit";

  const listData = useMemo(
    () => ({
      rows: filteredRows,
      selectedRowKeys,
      toggleSelect,
      isDark,
      disabledAll: isSyncing,
    }),
    [filteredRows, selectedRowKeys, toggleSelect, isDark, isSyncing],
  );

  return (
    <div
      className={`min-h-screen overflow-x-hidden pb-20 ${
        isDark ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      <SyncingOverlay isDark={isDark} open={isSyncing} />

      <div className="fixed inset-0 pointer-events-none">
        <div
          className={`absolute top-[-5%] left-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-blue-600/5" : "bg-blue-600/10"
          }`}
        />
        <div
          className={`absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-indigo-600/5" : "bg-indigo-600/10"
          }`}
        />
      </div>

      <nav
        className={`sticky top-0 z-40 backdrop-blur-xl px-4 py-4 mb-8 ${
          isDark
            ? "bg-slate-950/60 border-b border-white/5"
            : "bg-white/80 border-b border-slate-200/80 shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            disabled={isSyncing}
            className={`flex items-center gap-3 px-6 py-3 rounded-full transition-all ${
              isSyncing
                ? isDark
                  ? "bg-slate-900/30 border border-white/5 text-slate-500 cursor-not-allowed"
                  : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                : isDark
                  ? "bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
            }`}
          >
            <FaArrowLeft size={14} />
            <span className="text-xs font-bold tracking-wider uppercase">
              Back
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div
              className={`flex p-1 rounded-2xl ${
                isDark
                  ? "bg-slate-900/80 border border-white/5"
                  : "bg-slate-100 border border-slate-200"
              }`}
            >
              <button
                onClick={() => setViewMode("card")}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${
                  isSyncing
                    ? "text-slate-500 cursor-not-allowed"
                    : viewMode === "card"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                      : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <FaThLarge size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${
                  isSyncing
                    ? "text-slate-500 cursor-not-allowed"
                    : viewMode === "table"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                      : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <FaList size={14} />
              </button>
            </div>

            <button
              onClick={runFullRefresh}
              disabled={isSyncing}
              className={`rounded-2xl px-4 py-3 font-bold transition-all flex items-center gap-2 ${
                isSyncing
                  ? isDark
                    ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
              }`}
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-10">
          <div>
            <h1
              className={`text-2xl md:text-5xl font-black tracking-tighter mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              OFFLINE to WEB <span className="text-blue-500">Sales Sync</span>
            </h1>
            <p className="text-slate-500 font-medium">
              OFFLINE data is read from LOCAL API. ONLINE synced state is
              checked through WEB API.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:w-[700px]">
            <div className="relative group">
              <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500" />
              <input
                type="text"
                disabled={isSyncing}
                placeholder="Search busunit / category / shift / terminal / date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-[2rem] py-2 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all backdrop-blur-sm ${
                  isSyncing
                    ? isDark
                      ? "bg-slate-800/30 border border-white/5 text-slate-500 cursor-not-allowed"
                      : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                    : isDark
                      ? "bg-slate-900/30 border border-slate-800 hover:border-slate-700 text-white"
                      : "bg-white border border-slate-200 hover:border-slate-300 text-slate-900 shadow-sm"
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={filter === "ready"}
                label="Ready"
                tone="emerald"
                onClick={() => setFilter("ready")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "closed"}
                label="Closed"
                tone="blue"
                onClick={() => setFilter("closed")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "open"}
                label="Open"
                tone="rose"
                onClick={() => setFilter("open")}
                isDark={isDark}
                disabled={isSyncing}
              />
              <FilterChip
                active={filter === "all"}
                label="All"
                tone="slate"
                onClick={() => setFilter("all")}
                isDark={isDark}
                disabled={isSyncing}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 ${
                  isDark
                    ? "bg-slate-900/60 border border-white/5"
                    : "bg-white border border-slate-200 shadow-sm"
                }`}
              >
                <FiFilter />
                <select
                  value={terminalFilter}
                  disabled={isSyncing}
                  onChange={(e) => setTerminalFilter(e.target.value)}
                  className={`bg-transparent outline-none ${
                    isSyncing
                      ? "text-slate-500 cursor-not-allowed"
                      : isDark
                        ? "text-white"
                        : "text-slate-900"
                  }`}
                  style={{ fontSize: "16px" }}
                >
                  <option value="all">All Terminals</option>
                  {terminalOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      Terminal {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mb-8">
          <StatCard
            title="Target Business Unit"
            value={targetBusunitName}
            subtitle={localReadData?.target?.busunitcode || "—"}
            icon={<FiPackage size={20} />}
            isDark={isDark}
          />
          <StatCard
            title="Ready Closed Shifts"
            value={summary.ready}
            subtitle="Selectable for sync"
            icon={<FaCheckCircle size={18} />}
            accent="emerald"
            isDark={isDark}
          />
          <StatCard
            title="Open Shifts"
            value={summary.open}
            subtitle="Red and disabled"
            icon={<FiClock size={18} />}
            accent="rose"
            isDark={isDark}
          />
          <StatCard
            title="Selected"
            value={summary.selected}
            subtitle="Current upload selection"
            icon={<FiCheckSquare size={18} />}
            accent="amber"
            isDark={isDark}
          />
          <StatCard
            title="Transactions Found"
            value={summary.transactions}
            subtitle="Across visible source shifts"
            icon={<FaCloudUploadAlt size={18} />}
            accent="violet"
            isDark={isDark}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] mb-8">
          <div
            className={`rounded-[2rem] p-5 border ${
              isDark
                ? "bg-slate-900/30 border-white/5"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
              Sync Rule
            </div>
            <div
              className={`text-xl font-black ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              LOCAL exports, WEB uploads
            </div>
            <div className="mt-2 text-sm text-slate-500 whitespace-pre-line">
              LOCAL API reads OFFLINE tables.
              {"\n"}
              WEB API checks if a shift is already synced.
              {"\n"}
              Selected OFFLINE rows are exported from LOCAL and uploaded to WEB.
              {"\n"}
              ONLINE tbl_pos_shifting_records.Status becomes Synced after
              success.
            </div>
          </div>

          <div
            className={`rounded-[2rem] p-5 border ${
              isDark
                ? "bg-slate-900/30 border-white/5"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
              Reconciliation Controls
            </div>

            <div className="space-y-3">
              <button
                onClick={selectAllVisibleReady}
                disabled={isSyncing}
                className={`w-full rounded-2xl px-4 py-3 font-bold transition-all ${
                  isSyncing
                    ? isDark
                      ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : isDark
                      ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                      : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                Check All Visible Ready
              </button>

              <button
                onClick={clearSelection}
                disabled={isSyncing}
                className={`w-full rounded-2xl px-4 py-3 font-bold transition-all ${
                  isSyncing
                    ? isDark
                      ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : isDark
                      ? "bg-slate-900/70 border border-white/5 text-slate-300 hover:text-white"
                      : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                Clear Selected
              </button>

              <button
                onClick={openSyncConfirm}
                disabled={
                  isSyncing ||
                  !isOnline ||
                  isLocalFailed ||
                  isWebFailed ||
                  noBusinessUnit ||
                  selectedRows.length === 0
                }
                className={`w-full rounded-2xl px-5 py-3 font-bold transition-all ${
                  isSyncing ||
                  !isOnline ||
                  isLocalFailed ||
                  isWebFailed ||
                  noBusinessUnit ||
                  selectedRows.length === 0
                    ? isDark
                      ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                }`}
              >
                Sync Selected Shifts
              </button>

              <div
                className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                  isOnline
                    ? isDark
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : isDark
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                      : "bg-rose-50 border border-rose-200 text-rose-700"
                }`}
              >
                {isOnline ? (
                  <FaCheckCircle size={16} />
                ) : (
                  <FiWifiOff size={16} />
                )}
                <span className="font-bold">
                  {isOnline ? "Device online" : "Device offline"}
                </span>
              </div>

              <div
                className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                  isLocalFailed || isWebFailed
                    ? isDark
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                      : "bg-rose-50 border border-rose-200 text-rose-700"
                    : noBusinessUnit
                      ? isDark
                        ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                        : "bg-amber-50 border border-amber-200 text-amber-700"
                      : isDark
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                        : "bg-blue-50 border border-blue-200 text-blue-700"
                }`}
              >
                <FaExclamationTriangle size={16} />
                <span className="font-bold">
                  {isLocalFailed
                    ? "LOCAL API read failed"
                    : isWebFailed
                      ? "WEB API status check failed"
                      : noBusinessUnit
                        ? "No active local BU pricing mapping"
                        : "LOCAL + WEB reconciliation ready"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <InfoStrip
          isDark={isDark}
          tone="blue"
          title="What will sync"
          message="Per selected closed shift: LOCAL API exports tbl_pos_shifting_records row itself, plus tbl_pos_transactions rows inside the shift datetime window, then their related tbl_pos_transactions_detailed, tbl_pos_transactions_discounts, tbl_pos_transactions_payments, and tbl_pos_transactions_other_charges rows. WEB API then writes those rows online and marks the online shift as Synced."
        />

        {!isOnline && (
          <div
            className={`mb-8 mt-6 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FiWifiOff size={18} />
            <div className="font-semibold">
              You are offline. Reads may be stale and syncing is disabled until
              internet returns.
            </div>
          </div>
        )}

        {isLocalFailed && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              Cannot read OFFLINE shifts from LOCAL API.
            </div>
          </div>
        )}

        {isWebFailed && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-rose-50 border border-rose-200 text-rose-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              Cannot check WEB synced state right now.
            </div>
          </div>
        )}

        {noBusinessUnit && (
          <div
            className={`mb-8 rounded-[2rem] p-5 flex items-center gap-3 ${
              isDark
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}
          >
            <FaExclamationTriangle size={18} />
            <div className="font-semibold">
              No active row found in <code>tbl_pricing_by_sales_type</code>. Add
              at least one active business unit mapping first.
            </div>
          </div>
        )}

        <main className="min-h-[40vh] mt-5">
          {isLoading ? (
            <ProgressLoader
              isDark={isDark}
              text="Loading shift reconciliation details..."
            />
          ) : filteredRows.length === 0 ? (
            <div
              className={`rounded-[2rem] p-10 text-center border ${
                isDark
                  ? "bg-slate-900/30 border-white/5"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div
                className={`text-2xl font-black mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                No matching shifts
              </div>
              <div className="text-slate-500">
                Try another filter, terminal, or search keyword.
              </div>
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredRows.map((row) => (
                  <ShiftCard
                    key={row.row_key}
                    row={row}
                    checked={selectedRowKeys.includes(row.row_key)}
                    onToggle={toggleSelect}
                    isDark={isDark}
                    disabledAll={isSyncing}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div
              className={`rounded-[2.5rem] overflow-hidden border ${
                isDark
                  ? "bg-slate-950/40 border-white/5"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="overflow-y-hidden">
                <div
                  className="overflow-y-auto overflow-x-auto"
                  style={{ maxHeight: `${virtualHeight + 80}px` }}
                >
                  <VirtualHeader isDark={isDark} />
                  <div style={{ width: "1600px", minWidth: "1600px" }}>
                    <List
                      height={virtualHeight}
                      itemCount={filteredRows.length}
                      itemSize={96}
                      width={1600}
                      itemData={listData}
                    >
                      {VirtualRow}
                    </List>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isYesNoModalOpen && !isSyncing && (
        <ModalYesNoReusable
          header="Confirm Sales Sync"
          message={modalMessage}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleModalConfirm}
        />
      )}

      {showhidesuccess && !isSyncing && (
        <ModalSuccessNavToSelf
          header="Sync Result"
          message={returnmessage.message}
          button="OK"
          setIsModalOpen={setshowhidesuccess}
          resetForm={async () => {
            setReturnmessage({ message: "" });
            await runFullRefresh();
          }}
        />
      )}
    </div>
  );
};

export default SyncOfflineSalesToWeb;
