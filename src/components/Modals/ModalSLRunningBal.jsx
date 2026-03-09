import React, { useMemo, useState, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowSize } from "react-use";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { HiX, HiSearch, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { FiDownload, FiFilter, FiRefreshCw } from "react-icons/fi";
import { FaClockRotateLeft } from "react-icons/fa6";

const peso2 = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const safeArr = (v) => (Array.isArray(v) ? v : []);

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const ModalSLRunningBal = ({
  slRunningBal,
  setIsModalSlRunningBal,
  setSlCode,
}) => {
  const { width, height } = useWindowSize();
  const isMobile = width < 768;

  // ✅ Safe destructuring (keeps your variables)
  const sldata = safeArr(slRunningBal?.sldata);
  const begdata = slRunningBal?.begdata || {};
  const begBal = Number(begdata?.begbal || 0);

  // ✅ UI-only states (no endpoint changes, no prop changes)
  const [searchParams, setSearchParams] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | POS | AR | AP | JV | OTHERS (best-effort inference)
  const [sortBy, setSortBy] = useState("date_desc"); // date_desc | date_asc | amount_desc | amount_asc

  // ✅ NEW: collapsible filter panel
  const [showFilters, setShowFilters] = useState(true);

  // default: collapse on mobile for more list space
  useEffect(() => {
    if (isMobile) setShowFilters(false);
  }, [isMobile]);

  const normalizedSearch = (searchParams || "").trim().toLowerCase();

  const filteredRows = useMemo(() => {
    let rows = [...sldata];

    // Search across multiple fields
    if (normalizedSearch) {
      rows = rows.filter((r) => {
        const t = String(r?.transdate ?? "").toLowerCase();
        const a = String(r?.amount ?? "").toLowerCase();
        const p = String(r?.particulars ?? "").toLowerCase();
        const ref = String(r?.reference ?? "").toLowerCase();
        const c = String(r?.customer ?? "").toLowerCase();
        const s = String(r?.supplier ?? "").toLowerCase();
        return (
          t.includes(normalizedSearch) ||
          a.includes(normalizedSearch) ||
          p.includes(normalizedSearch) ||
          ref.includes(normalizedSearch) ||
          c.includes(normalizedSearch) ||
          s.includes(normalizedSearch)
        );
      });
    }

    // Best-effort "Type" filter (uses reference/particulars keywords if present)
    if (typeFilter !== "ALL") {
      const pick = (r) =>
        `${r?.reference || ""} ${r?.particulars || ""}`.toLowerCase();

      rows = rows.filter((r) => {
        const txt = pick(r);
        if (typeFilter === "POS") return txt.includes("pos");
        if (typeFilter === "AR")
          return (
            txt.includes("ar") ||
            txt.includes("receivable") ||
            txt.includes("credit")
          );
        if (typeFilter === "AP")
          return (
            txt.includes("ap") ||
            txt.includes("payable") ||
            txt.includes("supplier")
          );
        if (typeFilter === "JV")
          return txt.includes("jv") || txt.includes("journal");
        if (typeFilter === "OTHERS") {
          const any =
            txt.includes("pos") ||
            txt.includes("ar") ||
            txt.includes("receivable") ||
            txt.includes("credit") ||
            txt.includes("ap") ||
            txt.includes("payable") ||
            txt.includes("supplier") ||
            txt.includes("jv") ||
            txt.includes("journal");
          return !any;
        }
        return true;
      });
    }

    // Amount range
    const min = minAmount === "" ? null : Number(minAmount);
    const max = maxAmount === "" ? null : Number(maxAmount);

    if (min !== null && !Number.isNaN(min)) {
      rows = rows.filter((r) => Number(r?.amount || 0) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      rows = rows.filter((r) => Number(r?.amount || 0) <= max);
    }

    // Sort
    const toNum = (v) => Number(v || 0);
    const toStr = (v) => String(v ?? "");
    switch (sortBy) {
      case "amount_asc":
        rows.sort((a, b) => toNum(a?.amount) - toNum(b?.amount));
        break;
      case "amount_desc":
        rows.sort((a, b) => toNum(b?.amount) - toNum(a?.amount));
        break;
      case "date_asc":
        rows.sort((a, b) =>
          toStr(a?.transdate).localeCompare(toStr(b?.transdate)),
        );
        break;
      case "date_desc":
      default:
        rows.sort((a, b) =>
          toStr(b?.transdate).localeCompare(toStr(a?.transdate)),
        );
        break;
    }

    return rows;
  }, [sldata, normalizedSearch, minAmount, maxAmount, sortBy, typeFilter]);

  // ✅ Totals (based on FILTERED list)
  const movementTotal = useMemo(
    () => filteredRows.reduce((sum, r) => sum + Number(r?.amount || 0), 0),
    [filteredRows],
  );

  const endingBal = begBal + movementTotal;

  // ✅ Virtualization sizing (more list space when filters collapsed)
  const rowHeight = isMobile ? 120 : 80;
  const itemCount = filteredRows.length + 1; // + Beg Bal

  // Estimate panel height so list becomes scrollable (and bigger when filters hidden)
  const estimatedChrome = isMobile
    ? showFilters
      ? 520
      : 330
    : showFilters
      ? 380
      : 260;

  const maxModalHeight = height ? height * 0.88 : 720;
  const computedListHeight = clamp(maxModalHeight - estimatedChrome, 260, 520);

  async function exportSubledgerToExcel(dataRows, beg) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Subledger Detail");

    const titleRow = sheet.addRow(["Subledger Running Balance"]);
    sheet.mergeCells("A1:F1");
    titleRow.font = { size: 16, bold: true };
    titleRow.alignment = { horizontal: "center" };

    const header = sheet.addRow([
      "Date",
      "Amount",
      "Particulars",
      "Reference",
      "Customer",
      "Supplier",
    ]);
    header.font = { bold: true };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9531E" },
    };
    header.font = { color: { argb: "FFFFFF" }, bold: true };

    // Beg Bal
    sheet.addRow(["Beg Bal", parseFloat(beg?.begbal || 0), "", "", "", ""]);

    // Data
    dataRows.forEach((item) => {
      sheet.addRow([
        item?.transdate || "",
        parseFloat(item?.amount || 0),
        item?.particulars || "",
        item?.reference || "",
        item?.customer || "",
        item?.supplier || "",
      ]);
    });

    // Format amount column
    sheet.getColumn(2).numFmt = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
    sheet.getColumn(2).alignment = { horizontal: "right" };

    // Auto width
    sheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value ? cell.value.toString() : "";
        maxLength = Math.max(maxLength, val.length);
      });
      column.width = Math.max(10, Math.min(60, maxLength + 2));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "subledger_running_balance.xlsx");
  }

  const close = () => {
    setIsModalSlRunningBal(false);
    setSlCode(0);
  };

  // ---------------- UI helpers ----------------
  const FIELD =
    "h-11 w-full rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-xl px-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-colorBrand";

  const SELECT =
    "h-11 w-full rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-xl px-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-colorBrand";

  const PillBtn = (active) =>
    [
      "whitespace-nowrap rounded-2xl px-3 py-2 text-[12px] font-extrabold transition",
      active
        ? "border border-colorBrand/25 bg-white/75 text-slate-900 shadow-sm"
        : "border border-white/35 bg-white/55 text-slate-600 hover:bg-white/70",
    ].join(" ");

  const resetFilters = () => {
    setSearchParams("");
    setMinAmount("");
    setMaxAmount("");
    setTypeFilter("ALL");
    setSortBy("date_desc");
  };

  // Row renderer (Beg Bal at index 0)
  const Row = ({ index, style }) => {
    if (index === 0) {
      return (
        <div style={style} className="px-3 py-2">
          <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900">
                  Beginning Balance
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Opening balance before the listed transactions.
                </div>
              </div>
              <div className="text-sm font-black text-colorBrand">
                {peso2(begBal)}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const item = filteredRows[index - 1] || {};
    const amt = Number(item.amount || 0);

    // Desktop row (table-like)
    if (!isMobile) {
      return (
        <div
          style={style}
          className="flex items-center border-b border-white/40 bg-white/60 hover:bg-white/80 transition"
        >
          <div className="w-1/6 px-3 text-xs font-bold text-slate-900">
            {item.transdate || "-"}
          </div>
          <div className="w-1/6 px-3 text-xs font-black text-right text-slate-900">
            {peso2(amt)}
          </div>
          <div className="w-2/6 px-3 text-xs text-slate-700 truncate">
            {item.particulars || "-"}
          </div>
          <div className="w-2/6 px-3 text-xs text-slate-700 truncate">
            {item.reference || "-"}
          </div>
          <div className="w-1/6 px-3 text-xs text-slate-700 truncate">
            {item.customer || "-"}
          </div>
          <div className="w-1/6 px-3 text-xs text-slate-700 truncate">
            {item.supplier || "-"}
          </div>
        </div>
      );
    }

    // Mobile card row
    return (
      <div style={style} className="px-3 py-2">
        <div className="rounded-2xl bg-white/70 border border-white/40 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex shrink-0 items-center rounded-xl border border-colorBrand/15 bg-colorBrand/10 px-2 py-1 text-[11px] font-extrabold text-slate-900">
                  {item.transdate || "-"}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Ref: {item.reference || "-"}
                </span>
              </div>

              <div className="mt-2 text-sm font-black text-slate-900 line-clamp-2">
                {item.particulars || "-"}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="truncate">
                  <span className="font-bold text-slate-500">Customer: </span>
                  {item.customer || "-"}
                </div>
                <div className="truncate text-right">
                  <span className="font-bold text-slate-500">Supplier: </span>
                  {item.supplier || "-"}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[11px] font-bold text-slate-500">Amount</div>
              <div
                className="text-sm font-black"
                style={{ color: amt >= 0 ? "#16A34A" : "#DC2626" }}
              >
                {peso2(amt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {/* vignette layer */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/60" />
        {/* subtle sheen/noise */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(circle_at_20%_15%,white,transparent_35%),radial-gradient(circle_at_80%_25%,white,transparent_38%),radial-gradient(circle_at_40%_80%,white,transparent_42%)]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-[95vw] sm:w-[90vw] md:w-[84vw] lg:w-[78vw] max-w-6xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-colorBrandLight via-white/30 to-colorBrandLight shadow-[0_30px_90px_-55px_rgba(0,0,0,0.7)]">
            <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/70 backdrop-blur-xl">
              {/* top hairline highlight */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />

              <div className="flex max-h-[88vh] flex-col">
                {/* Header */}
                <div className="relative px-4 sm:px-5 pt-5 pb-4">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-16 -left-20 h-44 w-44 rounded-full bg-colorBrand/10 blur-2xl" />
                    <div className="absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-colorBrand/10 blur-2xl" />
                  </div>

                  <div className="relative flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="absolute -inset-3 rounded-3xl bg-colorBrand/15 blur-xl" />
                        <div className="relative grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-3xl border border-white/50 bg-white/75 shadow-sm">
                          <FaClockRotateLeft className="h-6 w-6 sm:h-7 sm:w-7 text-colorBrand" />
                        </div>
                      </div>

                      <div className="leading-tight min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-500 truncate">
                          GL • Subledger Running Balance
                        </p>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                          Running Balance
                        </h2>
                        <p className="text-[12px] text-slate-500 truncate">
                          Filters are optional — collapse them for more space
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          exportSubledgerToExcel(filteredRows, begdata)
                        }
                        className="hidden sm:flex h-11 px-4 rounded-2xl border border-colorBrand/25 bg-white/70 text-[12px] font-extrabold text-slate-900 shadow-sm backdrop-blur-xl transition hover:bg-white/85 items-center gap-2"
                        title="Export current view"
                      >
                        <FiDownload />
                        Export
                      </button>

                      <button
                        onClick={close}
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-sm transition hover:bg-white/85 active:scale-[0.98]"
                        aria-label="Close"
                      >
                        <HiX className="h-5 w-5 text-slate-700" />
                      </button>
                    </div>
                  </div>

                  {/* KPI strip */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/40 bg-white/65 px-4 py-3">
                      <div className="text-[11px] font-bold text-slate-500">
                        Beginning Balance
                      </div>
                      <div className="text-lg font-black text-slate-900">
                        {peso2(begBal)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/40 bg-white/65 px-4 py-3">
                      <div className="text-[11px] font-bold text-slate-500">
                        Movements Total (filtered)
                      </div>
                      <div className="text-lg font-black text-slate-900">
                        {peso2(movementTotal)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/40 bg-white/65 px-4 py-3">
                      <div className="text-[11px] font-bold text-slate-500">
                        Ending Balance (computed)
                      </div>
                      <div
                        className="text-lg font-black"
                        style={{
                          color: endingBal >= 0 ? "#16A34A" : "#DC2626",
                        }}
                      >
                        {peso2(endingBal)}
                      </div>
                    </div>
                  </div>

                  {/* Filters toggle row */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFilters((v) => !v)}
                      className="h-11 px-4 rounded-2xl border border-white/45 bg-white/65 text-[12px] font-extrabold text-slate-800 shadow-sm backdrop-blur-xl transition hover:bg-white/80 active:scale-[0.99] flex items-center gap-2"
                      title={showFilters ? "Hide filters" : "Show filters"}
                    >
                      <FiFilter className="text-colorBrand" />
                      {showFilters ? "Hide Filters" : "Show Filters"}
                      {showFilters ? (
                        <HiChevronUp className="opacity-70" />
                      ) : (
                        <HiChevronDown className="opacity-70" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="h-11 px-4 rounded-2xl border border-white/45 bg-white/65 text-[12px] font-extrabold text-slate-800 shadow-sm backdrop-blur-xl transition hover:bg-white/80 active:scale-[0.99] flex items-center gap-2"
                        title="Reset filters"
                      >
                        <FiRefreshCw />
                        Reset
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          exportSubledgerToExcel(filteredRows, begdata)
                        }
                        className="sm:hidden h-11 px-4 rounded-2xl border border-colorBrand/25 bg-white/70 text-[12px] font-extrabold text-slate-900 shadow-sm backdrop-blur-xl transition hover:bg-white/85 flex items-center gap-2"
                        title="Export current view"
                      >
                        <FiDownload />
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Collapsible filter panel */}
                  <AnimatePresence initial={false}>
                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                          {/* Search */}
                          <div className="lg:col-span-1">
                            <label className="block text-[12px] font-semibold text-slate-700">
                              <HiSearch className="inline h-4 w-4 -mt-[1px] mr-1 text-colorBrand" />
                              Search date / reference / particulars / names
                            </label>
                            <input
                              type="text"
                              value={searchParams}
                              placeholder="Type to search…"
                              autoComplete="off"
                              style={{ fontSize: "16px", maxWidth: "100%" }}
                              className={["mt-2", FIELD].join(" ")}
                              onChange={(e) => setSearchParams(e.target.value)}
                            />
                          </div>

                          {/* Filters */}
                          <div className="lg:col-span-2">
                            <div className="mt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Type (best-effort)
                                </label>
                                <select
                                  value={typeFilter}
                                  onChange={(e) =>
                                    setTypeFilter(e.target.value)
                                  }
                                  className={["mt-1", SELECT].join(" ")}
                                >
                                  <option value="ALL">All</option>
                                  <option value="POS">POS</option>
                                  <option value="AR">AR</option>
                                  <option value="AP">AP</option>
                                  <option value="JV">JV</option>
                                  <option value="OTHERS">Others</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Min amount
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={minAmount}
                                  onChange={(e) => setMinAmount(e.target.value)}
                                  placeholder="0"
                                  style={{ fontSize: "16px" }}
                                  className={["mt-1", FIELD].join(" ")}
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Max amount
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={maxAmount}
                                  onChange={(e) => setMaxAmount(e.target.value)}
                                  placeholder="∞"
                                  style={{ fontSize: "16px" }}
                                  className={["mt-1", FIELD].join(" ")}
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Sort
                                </label>
                                <select
                                  value={sortBy}
                                  onChange={(e) => setSortBy(e.target.value)}
                                  className={["mt-1", SELECT].join(" ")}
                                >
                                  <option value="date_desc">Date ↓</option>
                                  <option value="date_asc">Date ↑</option>
                                  <option value="amount_desc">Amount ↓</option>
                                  <option value="amount_asc">Amount ↑</option>
                                </select>
                              </div>
                            </div>

                            {/* Quick pills */}
                            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                              <button
                                type="button"
                                className={PillBtn(sortBy === "date_desc")}
                                onClick={() => setSortBy("date_desc")}
                              >
                                Date ↓
                              </button>
                              <button
                                type="button"
                                className={PillBtn(sortBy === "amount_desc")}
                                onClick={() => setSortBy("amount_desc")}
                              >
                                Amount ↓
                              </button>
                              <button
                                type="button"
                                className={PillBtn(Boolean(searchParams))}
                                onClick={() => setSearchParams("")}
                              >
                                Clear Search
                              </button>
                              <div className="ml-auto shrink-0 rounded-2xl border border-white/40 bg-white/60 px-3 py-2 text-[12px] font-extrabold text-slate-700">
                                {filteredRows.length} row
                                {filteredRows.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Body: dedicated scroll area (mobile/tablet/desktop) */}
                <div className="px-4 sm:px-5 pb-5 flex-1 min-h-0 ">
                  {/* Desktop/tablet: allow horizontal scroll if needed */}
                  <div className="rounded-2xl border border-white/40 bg-white/60 overflow-auto">
                    {!isMobile && (
                      <div className="overflow-x-auto">
                        <div className="min-w-[980px]">
                          <div className="sticky top-0 z-10 flex bg-white/85 backdrop-blur-xl border-b border-white/40">
                            <div className="w-1/6 px-3 py-2 text-xs font-black text-slate-700">
                              Date
                            </div>
                            <div className="w-1/6 px-3 py-2 text-xs font-black text-slate-700 text-right">
                              Amount
                            </div>
                            <div className="w-2/6 px-3 py-2 text-xs font-black text-slate-700">
                              Particulars
                            </div>
                            <div className="w-2/6 px-3 py-2 text-xs font-black text-slate-700">
                              Reference
                            </div>
                            <div className="w-1/6 px-3 py-2 text-xs font-black text-slate-700">
                              Customer
                            </div>
                            <div className="w-1/6 px-3 py-2 text-xs font-black text-slate-700">
                              Supplier
                            </div>
                          </div>

                          {/* ✅ Scroll happens here (List is the scroll container) */}
                          <List
                            height={computedListHeight}
                            itemCount={itemCount}
                            itemSize={rowHeight}
                            width="100%"
                          >
                            {Row}
                          </List>
                        </div>
                      </div>
                    )}

                    {/* Mobile: the list itself is scrollable */}
                    {isMobile && (
                      <List
                        height={computedListHeight}
                        itemCount={itemCount}
                        itemSize={rowHeight}
                        width="100%"
                      >
                        {Row}
                      </List>
                    )}
                  </div>

                  {/* Empty state */}
                  {filteredRows.length === 0 && (
                    <div className="mt-3 py-8 text-center text-sm text-slate-500">
                      No items found.
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-slate-500">
                    {isMobile
                      ? "Tip: Hide filters to get more list space."
                      : "Tip: You can scroll vertically in the list area; table supports horizontal scroll if needed."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalSLRunningBal;
