/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LinearProgress } from "@mui/material";
import useApiHost from "../../hooks/useApiHost";
import {
  FiFilter,
  FiDownload,
  FiSun,
  FiMoon,
  FiBarChart2,
  FiClock,
  FiList,
  FiGrid,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiCalendar,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from "chart.js";
import { Bar as ChartJSBar, Line as ChartJSLine } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { FixedSizeList as List } from "react-window";
import { useTheme } from "../../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartTooltip,
  ChartLegend,
  Filler,
);

const peso0 = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const num0 = (n) => Number(n || 0).toLocaleString("en-US");
const safeArr = (v) => (Array.isArray(v) ? v : []);

const dayISO = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const firstDayOfMonthISO = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const hourLabel12 = (h) => {
  const H = Number(h) || 0;
  const hr12 = ((H + 11) % 12) + 1; // 0->12, 13->1
  const ampm = H < 12 ? "AM" : "PM";
  return `${String(hr12).padStart(2, "0")}:00 ${ampm}`;
};

const toNum = (v) => {
  const n = Number(
    String(v ?? "")
      .replace(/[₱,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
};

const isProbablyNumber = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return true;
  const s = String(v).trim();
  if (!s) return false;
  return /^[₱\s]*-?\d[\d,]*(\.\d+)?\s*$/.test(s);
};

const cmp = (a, b, dir = "asc") => {
  const mult = dir === "asc" ? 1 : -1;
  const A = a ?? "";
  const B = b ?? "";
  if (isProbablyNumber(A) && isProbablyNumber(B))
    return (toNum(A) - toNum(B)) * mult;
  return (
    String(A).localeCompare(String(B), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * mult
  );
};

/* -------------------------
   Theme tokens
------------------------- */
const DARK = {
  page: "min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30 overflow-x-hidden pb-24",
  shell: "relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  glowBg:
    "relative overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/30 backdrop-blur-xl shadow-[0_25px_70px_rgba(0,0,0,0.35)]",
  softBlobBg:
    "fixed inset-0 pointer-events-none " +
    "before:content-[''] before:absolute before:top-[-8%] before:left-[-8%] before:w-[55%] before:h-[55%] before:bg-blue-600/5 before:rounded-full before:blur-[120px] " +
    "after:content-[''] after:absolute after:bottom-[-8%] after:right-[-8%] after:w-[55%] after:h-[55%] after:bg-indigo-600/5 after:rounded-full after:blur-[120px]",
  nav: "sticky top-0 z-40 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 px-4 py-4",
  pillBtn:
    "rounded-full bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white transition-all",
  input:
    "h-12 w-full rounded-[2rem] bg-slate-900/30 border border-slate-800 hover:border-slate-700 " +
    "px-4 text-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all backdrop-blur-sm",
  miniLabel: "text-[10px] font-black uppercase tracking-[0.3em] text-slate-500",
  title: "text-white font-black tracking-tight",
  sub: "text-slate-500 font-medium",
  tableHeader: "bg-slate-950/60",
  tableRow: "border-t border-white/5 hover:bg-slate-900/40",
};

const WHITE = {
  page: "min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden pb-24",
  shell: "relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  glowBg:
    "relative overflow-hidden bg-white/65 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.12)]",
  softBlobBg:
    "fixed inset-0 pointer-events-none " +
    "[background:radial-gradient(600px_circle_at_20%_10%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(500px_circle_at_85%_25%,rgba(14,165,233,0.10),transparent_50%),radial-gradient(700px_circle_at_55%_90%,rgba(99,102,241,0.10),transparent_55%)]",
  nav: "sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/70 px-4 py-4",
  pillBtn:
    "rounded-full bg-white/70 border border-slate-200/70 text-slate-700 hover:text-slate-900 transition-all",
  input:
    "h-12 w-full rounded-2xl bg-white/70 border border-slate-200/70 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-amber-200 transition",
  miniLabel: "text-[10px] font-black uppercase tracking-[0.3em] text-slate-500",
  title: "text-slate-900 font-black tracking-tight",
  sub: "text-slate-600 font-medium",
  tableHeader: "bg-white/70",
  tableRow: "border-t border-slate-200/70 hover:bg-slate-50",
};

const REPORTS = [
  { id: "daily", label: "Daily Sales" },
  { id: "hourly", label: "Hourly Sales" },
  { id: "perproduct", label: "Sales / Product" },
  { id: "hourlyperproduct", label: "Hourly / Product" },
];

const Chip = ({ on, children, onClick, t, icon }) => {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold border transition active:scale-[0.99]";
  const off =
    t === DARK
      ? "border-white/5 bg-slate-900/40 text-slate-200 hover:bg-slate-900/55"
      : "border-slate-200/70 bg-white/70 text-slate-800 hover:bg-white";
  const onCls =
    t === DARK
      ? "border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15"
      : "border-amber-300/70 bg-amber-50 text-amber-800 hover:bg-amber-100";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${on ? onCls : off}`}
    >
      {icon}
      {children}
    </button>
  );
};

const SortIcon = ({ dir }) => {
  if (!dir) return null;
  return dir === "asc" ? (
    <FiChevronUp className="opacity-80" />
  ) : (
    <FiChevronDown className="opacity-80" />
  );
};

/* -------------------------
   VirtualTable (react-window)
------------------------- */
const VirtualTable = ({
  t,
  themeMode,
  columns,
  rows,
  height = 420,
  rowHeight = 48,
  initialSort = { key: "", dir: "asc" },
  stickyHeader = true,
  emptyText = "No rows.",
}) => {
  const [sortKey, setSortKey] = useState(initialSort.key || "");
  const [sortDir, setSortDir] = useState(initialSort.dir || "asc");

  useEffect(() => {
    setSortKey(initialSort.key || "");
    setSortDir(initialSort.dir || "asc");
  }, [initialSort.key, initialSort.dir]);

  const sortedRows = useMemo(() => {
    const arr = safeArr(rows);
    if (!sortKey) return arr;
    const copy = [...arr];
    copy.sort((a, b) => cmp(a?.[sortKey], b?.[sortKey], sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  const onHeaderClick = (key, sortable) => {
    if (!sortable) return;
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  };

  const totalWidth = useMemo(
    () => columns.reduce((a, c) => a + (c.width || 160), 0),
    [columns],
  );

  const HeaderRow = () => (
    <div
      className={`flex items-center ${t.tableHeader} ${
        stickyHeader ? "sticky top-0 z-10" : ""
      }`}
      style={{ height: 44, minWidth: totalWidth }}
    >
      {columns.map((c) => {
        const isActive = sortKey === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onHeaderClick(c.key, c.sortable)}
            className={`px-3 flex items-center gap-2 text-left text-xs font-black whitespace-nowrap ${
              themeMode === "dark" ? "text-slate-300" : "text-slate-700"
            } ${c.sortable ? "hover:opacity-90" : "cursor-default"}`}
            style={{ width: c.width || 160 }}
            title={c.sortable ? "Click to sort" : ""}
          >
            <span className="truncate">{c.label}</span>
            {c.sortable && isActive && <SortIcon dir={sortDir} />}
          </button>
        );
      })}
    </div>
  );

  const Row = ({ index, style }) => {
    const r = sortedRows[index];
    return (
      <div
        style={{ ...style, minWidth: totalWidth }}
        className={`flex items-center ${t.tableRow}`}
      >
        {columns.map((c) => {
          const v = r?.[c.key];
          const display = c.render ? c.render(v, r) : (v ?? "");
          return (
            <div
              key={c.key}
              className={`px-3 text-sm whitespace-nowrap overflow-hidden text-ellipsis ${
                c.align === "right" ? "text-right" : "text-left"
              } ${c.strong ? "font-black" : c.bold ? "font-bold" : ""}`}
              style={{ width: c.width || 160 }}
              title={typeof display === "string" ? display : ""}
            >
              {display}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        themeMode === "dark" ? "border-white/5" : "border-slate-200/70"
      }`}
    >
      <div className="overflow-hidden" style={{ maxHeight: height }}>
        <HeaderRow />
        {sortedRows.length === 0 ? (
          <div className="py-10 text-center opacity-70">{emptyText}</div>
        ) : (
          <List
            height={Math.min(height - 44, sortedRows.length * rowHeight)}
            itemCount={sortedRows.length}
            itemSize={rowHeight}
            width={Math.max(totalWidth, 900)}
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
};

const SalesDashboard = () => {
  const navigate = useNavigate();

  // Theme
  const { theme, toggleTheme } = useTheme();
  const T = theme === "dark" ? DARK : WHITE;

  const apiHost = useApiHost();

  // API host from ip.txt
  // const [apiHost, setApiHost] = useState("");
  // useEffect(() => {
  //   fetch("/ip.txt")
  //     .then((res) => res.text())
  //     .then((data) => setApiHost((data || "").trim()))
  //     .catch(() => setApiHost("http://localhost"));
  // }, []);
  const apiBase = useMemo(() => (apiHost ? `${apiHost}/api` : ""), [apiHost]);

  // Applied filters
  const todayISO = dayISO(new Date());
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [voidOnly, setVoidOnly] = useState(false);

  // Draft filters (modal)
  const [draftDateFrom, setDraftDateFrom] = useState(todayISO);
  const [draftDateTo, setDraftDateTo] = useState(todayISO);
  const [draftIncludeVoided, setDraftIncludeVoided] = useState(false);
  const [draftVoidOnly, setDraftVoidOnly] = useState(false);

  // Modal state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Keep draft in sync when open
  useEffect(() => {
    if (isFilterOpen) {
      setDraftDateFrom(dateFrom);
      setDraftDateTo(dateTo);
      setDraftIncludeVoided(includeVoided);
      setDraftVoidOnly(voidOnly);
    }
  }, [isFilterOpen, dateFrom, dateTo, includeVoided, voidOnly]);

  const applyFilters = useCallback(() => {
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setIncludeVoided(draftIncludeVoided);
    setVoidOnly(draftVoidOnly);
  }, [draftDateFrom, draftDateTo, draftIncludeVoided, draftVoidOnly]);

  const closeWithApply = useCallback(() => {
    applyFilters();
    setIsFilterOpen(false);
  }, [applyFilters]);

  // Reports chips
  const [enabledReports, setEnabledReports] = useState(
    () => new Set(REPORTS.map((r) => r.id)),
  );
  const toggleReport = (id) => {
    setEnabledReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return new Set(REPORTS.map((r) => r.id));
      return next;
    });
  };

  const [viewMode, setViewMode] = useState("table"); // cards | table
  const [topNProducts, setTopNProducts] = useState(50);

  // Data
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState("");

  // Daily graph range: month-start → selected FROM
  const graphDateFrom = useMemo(() => firstDayOfMonthISO(dateFrom), [dateFrom]);
  const graphDateTo = useMemo(() => dateFrom, [dateFrom]);

  const fetchDashboard = async () => {
    if (!apiBase) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${apiBase}/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datefrom: dateFrom,
          dateto: dateTo,
          includeVoided,
          voidOnly,
          graph_datefrom: graphDateFrom,
          graph_dateto: graphDateTo,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const data = await res.json();
      setPayload(data);
    } catch (e) {
      setErr(e?.message || "Fetch error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!apiBase) return;
    fetchDashboard();
  }, [
    apiBase,
    dateFrom,
    dateTo,
    includeVoided,
    voidOnly,
    graphDateFrom,
    graphDateTo,
  ]);

  const dailyGraph = useMemo(
    () => safeArr(payload?.dailyGraph || payload?.dailySales || []),
    [payload],
  );
  const dailyTable = useMemo(
    () => safeArr(payload?.dailySales || []),
    [payload],
  );
  const hourly = useMemo(() => safeArr(payload?.hourlySales || []), [payload]);
  const perProductAll = useMemo(
    () => safeArr(payload?.salesPerProduct || []),
    [payload],
  );
  const hourlyPerProductAll = useMemo(
    () => safeArr(payload?.hourlySalesPerProduct || []),
    [payload],
  );
  const kpi = payload?.kpi || {};

  // Default sort Product Name ASC
  const perProduct = useMemo(() => {
    const arr = [...perProductAll];
    arr.sort((a, b) => cmp(a?.["Product Name"], b?.["Product Name"], "asc"));
    return arr.slice(0, Math.max(1, Number(topNProducts || 50)));
  }, [perProductAll, topNProducts]);

  const hourlyPerProduct = useMemo(() => {
    const arr = [...hourlyPerProductAll];
    arr.sort((a, b) => cmp(a?.["Product Name"], b?.["Product Name"], "asc"));
    return arr;
  }, [hourlyPerProductAll]);

  // Charts
  const dailyChart = useMemo(() => {
    const labels = dailyGraph.map((r) => r["Date"]);
    const gross = dailyGraph.map((r) => Number(r["Gross Sales"] || 0));
    const net = dailyGraph.map((r) => Number(r["Net Sales"] || 0));
    const disc = dailyGraph.map(
      (r) =>
        Number(r["SRC Disc."] || 0) +
        Number(r["PWD Disc."] || 0) +
        Number(r["NAAC Disc."] || 0) +
        Number(r["Solo Parent Disc."] || 0) +
        Number(r["Other Disc."] || 0),
    );

    return {
      labels,
      datasets: [
        {
          label: "Gross Sales",
          data: gross,
          fill: true,
          borderColor: "rgba(59,130,246,1)",
          backgroundColor: "rgba(59,130,246,0.14)",
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: "Net Sales",
          data: net,
          fill: false,
          borderColor: "rgba(34,197,94,1)",
          backgroundColor: "transparent",
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: "Discounts",
          data: disc,
          fill: false,
          borderColor: "rgba(234,179,8,1)",
          backgroundColor: "transparent",
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    };
  }, [dailyGraph]);

  const lineOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: theme === "dark" ? "#cbd5e1" : "#334155" } },
      },
      scales: {
        x: {
          ticks: { color: theme === "dark" ? "#94a3b8" : "#64748b" },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: theme === "dark" ? "#94a3b8" : "#64748b",
            callback: (v) => peso0(v),
          },
          grid: {
            color:
              theme === "dark"
                ? "rgba(148,163,184,0.12)"
                : "rgba(148,163,184,0.22)",
          },
        },
      },
    }),
    [theme],
  );

  const hourlyTotals = useMemo(() => {
    const acc = Array.from({ length: 24 }, () => 0);
    for (const row of hourly) {
      const hrs = row?.hours || [];
      for (let h = 0; h < 24; h++) acc[h] += Number(hrs[h] || 0);
    }
    return acc;
  }, [hourly]);

  // ✅ Top 3 peak hours
  const peakHoursTop3 = useMemo(() => {
    const ranked = hourlyTotals
      .map((value, h) => ({
        h,
        label: hourLabel12(h),
        value: Number(value || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    if (!ranked.some((r) => r.value > 0)) {
      return [0, 1, 2].map((h) => ({ h, label: hourLabel12(h), value: 0 }));
    }
    return ranked;
  }, [hourlyTotals]);

  const hourlyChart = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, h) => hourLabel12(h));
    return {
      labels,
      datasets: [
        {
          label: "Sales per hour (sum)",
          data: hourlyTotals,
          backgroundColor: "rgba(59,130,246,0.85)",
          borderRadius: 10,
        },
      ],
    };
  }, [hourlyTotals]);

  const barOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: theme === "dark" ? "#94a3b8" : "#64748b" },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: theme === "dark" ? "#94a3b8" : "#64748b",
            callback: (v) => peso0(v),
          },
          grid: {
            color:
              theme === "dark"
                ? "rgba(148,163,184,0.12)"
                : "rgba(148,163,184,0.22)",
          },
        },
      },
    }),
    [theme],
  );

  const topProdChart = useMemo(() => {
    const labels = perProduct.map((r) => r["Product Name"]);
    const values = perProduct.map((r) => Number(r["Gross Sales"] || 0));
    return {
      labels,
      datasets: [
        {
          label: "Top products (Gross Sales)",
          data: values,
          backgroundColor:
            theme === "dark" ? "rgba(34,197,94,0.9)" : "rgba(22,163,74,0.9)",
          borderRadius: 10,
        },
      ],
    };
  }, [perProduct, theme]);

  const exportReport = async (report) => {
    if (!apiBase) return;

    try {
      const qs = new URLSearchParams({
        report,
        datefrom: dateFrom,
        dateto: dateTo,
        includeVoided: includeVoided ? "1" : "",
        voidOnly: voidOnly ? "1" : "",
      });

      const url = `${apiBase}/export_report.php?${qs.toString()}`;

      const res = await fetch(url);
      const blob = await res.blob();

      const filename = `${report}_${dateFrom}_${dateTo}.csv`;

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Columns (hour labels 12-hour)
  const hourlyColumns = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      key: `H${h}`,
      label: hourLabel12(h),
      width: 120,
      sortable: true,
      align: "right",
      render: (v) => peso0(v),
    }));
    return [
      { key: "Date", label: "Date", width: 120, sortable: true, bold: true },
      {
        key: "Total Sales",
        label: "Total Sales",
        width: 150,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
        strong: true,
      },
      ...hours,
    ];
  }, []);

  const hourlyRows = useMemo(() => {
    return hourly.map((r) => {
      const o = { ...r };
      const hrs = r?.hours || [];
      for (let h = 0; h < 24; h++) o[`H${h}`] = Number(hrs[h] || 0);
      return o;
    });
  }, [hourly]);

  const hourlyPerProductColumns = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      key: `H${h}`,
      label: hourLabel12(h),
      width: 95,
      sortable: true,
      align: "right",
      render: (v) => (Number(v || 0) ? num0(v) : ""),
    }));
    return [
      { key: "Code", label: "Code", width: 120, sortable: true, bold: true },
      { key: "Category", label: "Category", width: 200, sortable: true },
      {
        key: "Product Name",
        label: "Product Name",
        width: 320,
        sortable: true,
        bold: true,
      },
      ...hours,
      {
        key: "TOTAL",
        label: "TOTAL",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => num0(v),
        strong: true,
      },
    ];
  }, []);

  const hourlyPerProductRows = useMemo(() => {
    return hourlyPerProduct.map((r) => {
      const o = { ...r };
      const hrs = r?.hours || [];
      for (let h = 0; h < 24; h++) o[`H${h}`] = Number(hrs[h] || 0);
      return o;
    });
  }, [hourlyPerProduct]);

  const dailyColumns = useMemo(
    () => [
      { key: "Date", label: "Date", width: 120, sortable: true, bold: true },
      {
        key: "Gross Sales",
        label: "Gross Sales",
        width: 140,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "SRC Disc.",
        label: "SRC Disc.",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "PWD Disc.",
        label: "PWD Disc.",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "NAAC Disc.",
        label: "NAAC Disc.",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Solo Parent Disc.",
        label: "Solo Parent",
        width: 140,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Other Disc.",
        label: "Other Disc.",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Cash Payment",
        label: "Cash",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Card Payment",
        label: "Card",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "GCash Payment",
        label: "GCash",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Maya Payment",
        label: "Maya",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Other Payment",
        label: "Other Pay",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "VATable Sales",
        label: "VATable",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "VAT Amount",
        label: "VAT",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "VAT Exempt Sales",
        label: "VAT Exempt",
        width: 140,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "VAT Exemption",
        label: "VAT Exempt.",
        width: 140,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
      },
      {
        key: "Net Sales",
        label: "Net Sales",
        width: 140,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
        strong: true,
      },
    ],
    [],
  );

  const perProductColumns = useMemo(
    () => [
      { key: "Code", label: "Code", width: 120, sortable: true, bold: true },
      {
        key: "Product Name",
        label: "Product Name",
        width: 320,
        sortable: true,
        bold: true,
      },
      { key: "Item Type", label: "Type", width: 140, sortable: true },
      {
        key: "Total Qty Sold",
        label: "Qty",
        width: 120,
        sortable: true,
        align: "right",
        render: (v) => num0(v),
      },
      {
        key: "Gross Sales",
        label: "Gross Sales",
        width: 160,
        sortable: true,
        align: "right",
        render: (v) => peso0(v),
        strong: true,
      },
    ],
    [],
  );

  const Header = () => (
    <div className={`${T.glowBg} p-5 mt-5`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={T.miniLabel}>Unified Reports Dashboard</div>
            <div className={`mt-2 text-2xl sm:text-3xl ${T.title}`}>
              Reports • Sales • Hourly • Products
            </div>
            <div className={`mt-1 text-sm ${T.sub}`}>
              Tables/Export:{" "}
              <b>
                {dateFrom} → {dateTo}
              </b>{" "}
              • Daily Graph:{" "}
              <b>
                {graphDateFrom} → {graphDateTo}
              </b>{" "}
              •{" "}
              {voidOnly
                ? "VOID ONLY"
                : includeVoided
                  ? "ACTIVE + VOID"
                  : "ACTIVE ONLY"}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className={`h-11 px-4 ${T.pillBtn} flex items-center gap-2`}
              title="Toggle theme"
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
              <span className="text-xs font-extrabold">
                {theme === "dark" ? "White" : "Dark"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className={`h-11 px-4 ${T.pillBtn} flex items-center gap-2`}
              title="Filters"
            >
              <FiFilter />
              <span className="text-xs font-extrabold">Filters</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORTS.map((r) => (
            <Chip
              key={r.id}
              t={T}
              on={enabledReports.has(r.id)}
              onClick={() => toggleReport(r.id)}
              icon={
                <FiCheckCircle
                  className={enabledReports.has(r.id) ? "" : "opacity-60"}
                />
              }
            >
              {r.label}
            </Chip>
          ))}

          <Chip
            t={T}
            on={viewMode === "table"}
            onClick={() =>
              setViewMode((v) => (v === "cards" ? "table" : "cards"))
            }
            icon={viewMode === "cards" ? <FiGrid /> : <FiList />}
          >
            {viewMode === "cards" ? "Cards" : "Table"} View
          </Chip>

          <Chip
            t={T}
            on={false}
            onClick={() => fetchDashboard()}
            icon={<FiBarChart2 />}
          >
            Refresh
          </Chip>
        </div>
      </div>
    </div>
  );

  const KpiCard = ({ icon, label, value, sub }) => (
    <motion.div
      className={`${T.glowBg} p-5`}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
    >
      <div className="flex items-center justify-between">
        <div
          className={`h-11 w-11 rounded-2xl grid place-items-center ${
            theme === "dark"
              ? "bg-slate-900/50 border border-white/5"
              : "bg-white/70 border border-slate-200/70"
          }`}
        >
          {icon}
        </div>
        <div className="text-right">
          <div
            className={`text-xs font-extrabold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
          >
            {label}
          </div>
          <div className="text-[11px] opacity-70">{sub}</div>
        </div>
      </div>
      <div
        className={`mt-4 text-3xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}
      >
        {value}
      </div>
    </motion.div>
  );

  // ✅ Filter sheet that will NOT close/reopen while using the native date picker
  const FilterSheet = () => (
    <AnimatePresence>
      {isFilterOpen && (
        <motion.div
          className="fixed inset-0 z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // ✅ close ONLY when user clicks outside the panel
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeWithApply();
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            className={`absolute bottom-0 left-0 right-0 p-4 ${
              theme === "dark"
                ? "bg-slate-950/90 border-t border-white/5"
                : "bg-white/90 border-t border-slate-200/70"
            } backdrop-blur-xl rounded-t-[28px] shadow-2xl`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            // ✅ stop inside clicks from bubbling to wrapper
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={T.miniLabel}>Filters</div>
                <div
                  className={`text-xs mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                >
                  Make changes then click <b>Apply</b>. Closing will also apply.
                </div>
              </div>

              <button
                type="button"
                className={`h-10 w-10 grid place-items-center rounded-2xl ${
                  theme === "dark"
                    ? "bg-slate-900/50 border border-white/5 text-slate-200"
                    : "bg-white/70 border border-slate-200/70 text-slate-700"
                }`}
                onClick={closeWithApply}
                title="Close (applies)"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className={`${T.glowBg} p-4`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <div className={T.miniLabel}>From</div>
                    <FiCalendar className="absolute left-4 top-[46px] text-slate-500" />
                    <input
                      type="date"
                      value={draftDateFrom}
                      onChange={(e) => setDraftDateFrom(e.target.value)}
                      className={`${T.input} pl-10`}
                      style={{
                        colorScheme: theme === "dark" ? "dark" : "light",
                      }}
                    />
                    <div
                      className={`text-[11px] mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}
                    >
                      Daily graph will use month start → this From date.
                    </div>
                  </div>

                  <div className="relative">
                    <div className={T.miniLabel}>To</div>
                    <FiCalendar className="absolute left-4 top-[46px] text-slate-500" />
                    <input
                      type="date"
                      value={draftDateTo}
                      onChange={(e) => setDraftDateTo(e.target.value)}
                      className={`${T.input} pl-10`}
                      style={{
                        colorScheme: theme === "dark" ? "dark" : "light",
                      }}
                    />
                    <div
                      className={`text-[11px] mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}
                    >
                      Tables/export use From → To exactly.
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip
                    t={T}
                    on={draftIncludeVoided}
                    onClick={() => {
                      setDraftVoidOnly(false);
                      setDraftIncludeVoided((v) => !v);
                    }}
                    icon={<FiAlertTriangle />}
                  >
                    Include Voided
                  </Chip>

                  <Chip
                    t={T}
                    on={draftVoidOnly}
                    onClick={() => {
                      setDraftIncludeVoided(false);
                      setDraftVoidOnly((v) => !v);
                    }}
                    icon={<FiAlertTriangle />}
                  >
                    Void Only
                  </Chip>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div
                    className={`text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}
                  >
                    Tip: Set From and To to the same day (usual), then Apply.
                  </div>

                  <button
                    type="button"
                    className={`h-10 px-5 rounded-2xl text-xs font-extrabold ${
                      theme === "dark"
                        ? "bg-blue-500/15 border border-blue-500/30 text-blue-200"
                        : "bg-amber-100 border border-amber-200 text-amber-900"
                    }`}
                    onClick={closeWithApply}
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className={`${T.glowBg} p-4`}>
                <div className={T.miniLabel}>Exports</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip
                    t={T}
                    on={false}
                    onClick={() => exportReport("daily")}
                    icon={<FiDownload />}
                  >
                    Daily CSV
                  </Chip>
                  <Chip
                    t={T}
                    on={false}
                    onClick={() => exportReport("hourly")}
                    icon={<FiDownload />}
                  >
                    Hourly CSV
                  </Chip>
                  <Chip
                    t={T}
                    on={false}
                    onClick={() => exportReport("perproduct")}
                    icon={<FiDownload />}
                  >
                    Per Product CSV
                  </Chip>
                  <Chip
                    t={T}
                    on={false}
                    onClick={() => exportReport("hourlyperproduct")}
                    icon={<FiDownload />}
                  >
                    Hourly/Product CSV
                  </Chip>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={T.page}>
      <div className={T.softBlobBg} />

      {/* Sticky nav */}
      <div className={T.nav}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-2 w-2 rounded-full ${theme === "dark" ? "bg-green-500" : "bg-emerald-500"} animate-pulse`}
            />
            <div className={T.miniLabel}>Live Reports</div>
          </div>

          <div className="text-[11px] opacity-70">
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-3 px-6 py-2 ${
                theme === "dark"
                  ? "bg-slate-900/50 border border-white/5 rounded-full text-slate-400 hover:text-white transition-all"
                  : "bg-white border border-slate-200/70 rounded-full text-slate-700 hover:text-slate-900 transition-all"
              }`}
            >
              <FaArrowLeft size={14} />
              <span className="text-sm font-bold uppercase">Back</span>
            </button>
          </div>
        </div>
      </div>

      <FilterSheet />

      <div className={T.shell}>
        {loading && <LinearProgress color="success" />}
        <Header />

        {err ? (
          <div className={`${T.glowBg} p-5 mt-4`}>
            <div
              className={`text-sm font-extrabold ${theme === "dark" ? "text-rose-300" : "text-rose-600"}`}
            >
              {err}
            </div>
            <div
              className={`text-xs mt-2 ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}
            >
              Check <b>/ip.txt</b> and <b>/api/reports_dashboard.php</b>.
            </div>
          </div>
        ) : null}

        {/* KPI row */}
        <section className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={
              <FiBarChart2
                className={theme === "dark" ? "text-blue-300" : "text-blue-700"}
              />
            }
            label="Gross Sales"
            value={peso0(kpi.gross_sales)}
            sub="Selected range"
          />
          <KpiCard
            icon={
              <FiCheckCircle
                className={
                  theme === "dark" ? "text-emerald-300" : "text-emerald-700"
                }
              />
            }
            label="Net Sales"
            value={peso0(kpi.net_sales)}
            sub="TotalAmountDue sum"
          />
          <KpiCard
            icon={
              <FiAlertTriangle
                className={
                  theme === "dark" ? "text-yellow-300" : "text-yellow-700"
                }
              />
            }
            label="Discounts"
            value={peso0(kpi.discount_total)}
            sub="Discount sum"
          />
          <KpiCard
            icon={
              <FiClock
                className={
                  theme === "dark" ? "text-indigo-300" : "text-indigo-700"
                }
              />
            }
            label="Transactions"
            value={num0(kpi.txn_count)}
            sub={
              voidOnly
                ? "Voided only"
                : includeVoided
                  ? "Active + Voided"
                  : "Active only"
            }
          />
        </section>

        {/* DAILY */}
        {enabledReports.has("daily") && (
          <section className={`${T.glowBg} p-5 mt-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FiBarChart2
                  className={
                    theme === "dark" ? "text-blue-300" : "text-blue-700"
                  }
                />
                <div
                  className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Daily Sales Report
                </div>
                <span className={T.miniLabel}>Graph: month start → FROM</span>
              </div>

              <button
                type="button"
                onClick={() => exportReport("daily")}
                className={T.pillBtn + " h-10 px-4 flex items-center gap-2"}
              >
                <FiDownload />
                <span className="text-xs font-extrabold">Export</span>
              </button>
            </div>

            <div className="mt-4" style={{ height: 320 }}>
              <ChartJSLine data={dailyChart} options={lineOptions} />
            </div>

            {viewMode === "table" && (
              <div className="mt-4">
                <VirtualTable
                  t={T}
                  themeMode={theme}
                  columns={dailyColumns}
                  rows={dailyTable}
                  height={460}
                  rowHeight={48}
                  initialSort={{ key: "Date", dir: "asc" }}
                  emptyText="No daily rows for this range."
                />
              </div>
            )}
          </section>
        )}

        {/* HOURLY */}
        {enabledReports.has("hourly") && (
          <section className={`${T.glowBg} p-5 mt-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FiClock
                  className={
                    theme === "dark" ? "text-indigo-300" : "text-indigo-700"
                  }
                />
                <div
                  className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Hourly Sales
                </div>
                <span className={T.miniLabel}>
                  Top: {peakHoursTop3?.[0]?.label || "-"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => exportReport("hourly")}
                className={T.pillBtn + " h-10 px-4 flex items-center gap-2"}
              >
                <FiDownload />
                <span className="text-xs font-extrabold">Export</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div
                className={`${
                  theme === "dark"
                    ? "bg-slate-900/30 border-white/5"
                    : "bg-white/70 border-slate-200/70"
                } rounded-[2rem] border p-4 lg:col-span-2`}
              >
                <div className={T.miniLabel}>
                  Sales by hour (sum across days)
                </div>
                <div className="mt-3" style={{ height: 320 }}>
                  <ChartJSBar data={hourlyChart} options={barOptions} />
                </div>
              </div>

              {/* ✅ TOP 3 peak hours */}
              <div
                className={`${
                  theme === "dark"
                    ? "bg-slate-900/30 border-white/5"
                    : "bg-white/70 border-slate-200/70"
                } rounded-[2rem] border p-4`}
              >
                <div className={T.miniLabel}>Top 3 peak hours</div>

                <div className="mt-3 space-y-2">
                  {peakHoursTop3.map((p, i) => (
                    <div
                      key={p.h}
                      className={`flex items-center justify-between rounded-2xl border p-3 ${
                        theme === "dark"
                          ? "border-white/5 bg-slate-900/30"
                          : "border-slate-200/70 bg-white/70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-black ${
                            theme === "dark"
                              ? "bg-blue-500/15 text-blue-200"
                              : "bg-blue-50 text-blue-800"
                          }`}
                        >
                          {i + 1}
                        </div>
                        <div
                          className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                        >
                          {p.label}
                        </div>
                      </div>

                      <div
                        className={`text-sm font-black ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}
                      >
                        {peso0(p.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {viewMode === "table" && (
              <div className="mt-4">
                <VirtualTable
                  t={T}
                  themeMode={theme}
                  columns={hourlyColumns}
                  rows={hourlyRows}
                  height={460}
                  rowHeight={48}
                  initialSort={{ key: "Date", dir: "asc" }}
                  emptyText="No hourly rows for this range."
                />
              </div>
            )}
          </section>
        )}

        {/* SALES / PRODUCT */}
        {enabledReports.has("perproduct") && (
          <section className={`${T.glowBg} p-5 mt-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FiBarChart2
                  className={
                    theme === "dark" ? "text-emerald-300" : "text-emerald-700"
                  }
                />
                <div
                  className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Sales / Product
                </div>
                <span className={T.miniLabel}>
                  Default sort: Product Name ASC
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={T.miniLabel}>Top</span>
                  <select
                    value={topNProducts}
                    onChange={(e) => setTopNProducts(Number(e.target.value))}
                    className={`h-10 px-3 rounded-2xl outline-none ${
                      theme === "dark"
                        ? "bg-slate-900/40 border border-white/5 text-slate-200"
                        : "bg-white/70 border border-slate-200/70 text-slate-900"
                    }`}
                  >
                    {[10, 20, 50, 80, 100, 200, 500, 1000].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => exportReport("perproduct")}
                  className={T.pillBtn + " h-10 px-4 flex items-center gap-2"}
                >
                  <FiDownload />
                  <span className="text-xs font-extrabold">Export</span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div
                className={`${
                  theme === "dark"
                    ? "bg-slate-900/30 border-white/5"
                    : "bg-white/70 border-slate-200/70"
                } rounded-[2rem] border p-4 lg:col-span-2`}
              >
                <div className={T.miniLabel}>Top products by gross sales</div>
                <div className="mt-3" style={{ height: 340 }}>
                  <ChartJSBar data={topProdChart} options={barOptions} />
                </div>
              </div>

              <div
                className={`${
                  theme === "dark"
                    ? "bg-slate-900/30 border-white/5"
                    : "bg-white/70 border-slate-200/70"
                } rounded-[2rem] border p-4`}
              >
                <div className={T.miniLabel}>Notes</div>
                <div
                  className={`mt-3 text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"} space-y-2`}
                >
                  <div>
                    • Table defaults to <b>Product Name ASC</b>.
                  </div>
                  <div>• Click headers to sort by any column.</div>
                  <div>
                    • UI shows Top N; export includes all rows for the range.
                  </div>
                </div>
              </div>
            </div>

            {viewMode === "table" && (
              <div className="mt-4">
                <VirtualTable
                  t={T}
                  themeMode={theme}
                  columns={perProductColumns}
                  rows={perProduct}
                  height={460}
                  rowHeight={48}
                  initialSort={{ key: "Product Name", dir: "asc" }}
                  emptyText="No product rows for this range."
                />
              </div>
            )}
          </section>
        )}

        {/* HOURLY / PRODUCT */}
        {enabledReports.has("hourlyperproduct") && (
          <section className={`${T.glowBg} p-5 mt-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FiClock
                  className={
                    theme === "dark" ? "text-cyan-300" : "text-cyan-700"
                  }
                />
                <div
                  className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Hourly / Product (Qty)
                </div>
                <span className={T.miniLabel}>
                  Default sort: Product Name ASC
                </span>
              </div>

              <button
                type="button"
                onClick={() => exportReport("hourlyperproduct")}
                className={T.pillBtn + " h-10 px-4 flex items-center gap-2"}
              >
                <FiDownload />
                <span className="text-xs font-extrabold">Export</span>
              </button>
            </div>

            {viewMode === "table" && (
              <div className="mt-4">
                <VirtualTable
                  t={T}
                  themeMode={theme}
                  columns={hourlyPerProductColumns}
                  rows={hourlyPerProductRows}
                  height={520}
                  rowHeight={48}
                  initialSort={{ key: "Product Name", dir: "asc" }}
                  emptyText="No hourly/product rows for this range."
                />
              </div>
            )}
          </section>
        )}

        {/* Floating mobile actions */}
        <div className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 lg:hidden">
          <motion.button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="rounded-full px-4 py-3 text-xs font-extrabold text-white shadow-2xl flex items-center gap-2 "
            style={{
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, rgba(59,130,246,1) 0%, rgba(99,102,241,1) 100%)"
                  : "linear-gradient(135deg, rgba(59,130,246,1) 0%, rgba(99,102,241,1) 100%)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            <FiFilter />
            Filters
          </motion.button>

          <motion.button
            type="button"
            onClick={() => exportReport("daily")}
            className="rounded-full px-4 py-3 text-xs font-extrabold text-white shadow-2xl flex items-center gap-2"
            style={{
              background:
                theme === "dark"
                  ? "linear-gradient(135deg, rgba(34,197,94,1) 0%, rgba(16,185,129,1) 100%)"
                  : "linear-gradient(135deg, rgba(34,197,94,1) 0%, rgba(16,185,129,1) 100%)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            <FiDownload />
            Daily CSV
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
