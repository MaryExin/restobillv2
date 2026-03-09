import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LinearProgress } from "@mui/material";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import ModalSLRunningBal from "./ModalSLRunningBal";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useWindowSize } from "react-use";

import { FaList } from "react-icons/fa";
import { HiX, HiSearch, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { FiDownload, FiFilter, FiRefreshCw } from "react-icons/fi";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const ModalSubledgerList = ({
  slList,
  setIsModalSlList,
  setGlCode,
  busunit,
  dateTo,
  filterType = "",
  filterValue = "",
}) => {
  const { width, height } = useWindowSize();
  const isMobile = width < 768;

  // ✅ Always treat list as array
  const list = useMemo(() => (Array.isArray(slList) ? slList : []), [slList]);

  const [slCode, setSlCode] = useState(0);
  const [isModalSlRunningBal, setIsModalSlRunningBal] = useState(false);

  // ✅ UI-only filters/search
  const [searchParams, setSearchParams] = useState("");
  const [glFilter, setGlFilter] = useState("ALL");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");

  // ✅ collapsible filters
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    if (isMobile) setShowFilters(false);
  }, [isMobile]);

  const money = (n) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(Number(n || 0));

  // ✅ Endpoint unchanged (running bal)
  const {
    mutate: fetchSlRunningBal,
    data: slRunningBal,
    isLoading: slRunningBalLoading,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_SUBLEDGER_RUNNING_BAL_ENDPOINT,
    "POST",
  );

  useEffect(() => {
    if (!slCode || !dateTo) return;

    const ft = String(filterType || "")
      .toUpperCase()
      .trim();
    const fv = String(filterValue || "").trim();
    const isGroup =
      ["AREA", "CORP", "CORPORATION", "BRAND"].includes(ft) && !!fv;

    // ✅ BUSUNIT mode: requires busunit
    // ✅ GROUP mode: does NOT require busunit, but requires filterType/filterValue
    if (!isGroup && !busunit) return;

    fetchSlRunningBal({
      busunitcode: busunit || "",
      dateTo,
      slCode,
      filterType: ft,
      filterValue: fv,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slCode, dateTo, busunit, filterType, filterValue]);

  useEffect(() => {
    if (slCode !== 0 && slRunningBal) setIsModalSlRunningBal(true);
  }, [slRunningBal, slCode]);

  async function exportSubledgerToExcel(items, total) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Subledger Summary");

    const titleRow = sheet.addRow(["Subledger Summary"]);
    sheet.mergeCells(`A1:D1`);
    titleRow.font = { size: 16, bold: true };
    titleRow.alignment = { horizontal: "center" };

    const header = sheet.addRow([
      "GL Code",
      "SL Code",
      "SL Description",
      "Amount",
    ]);
    header.font = { bold: true };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9531E" },
    };

    (Array.isArray(items) ? items : []).forEach((item) => {
      sheet.addRow([
        item.glcode,
        item.slcode,
        item.sl_description,
        parseFloat(item.cumulative || 0),
      ]);
    });

    const subtotalRow = sheet.addRow([
      "",
      "",
      "Subtotal:",
      parseFloat(total || 0),
    ]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(4).numFmt = '"₱"#,##0.00;[Red]-"₱"#,##0.00';

    sheet.getColumn(4).numFmt = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
    sheet.getColumn(4).alignment = { horizontal: "right" };

    sheet.columns.forEach((col) => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const text = cell.value ? cell.value.toString() : "";
        maxLength = Math.max(maxLength, text.length);
      });
      col.width = Math.max(10, Math.min(60, maxLength + 2));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "subledger_summary.xlsx");
  }

  // UI helpers
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

  // filter + search
  const normalizedSearch = (searchParams || "").trim().toLowerCase();

  const glOptions = useMemo(() => {
    const set = new Set();
    list.forEach((it) => {
      if (it?.glcode !== undefined && it?.glcode !== null)
        set.add(String(it.glcode));
    });
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [list]);

  const filteredList = useMemo(() => {
    let arr = [...list];

    if (glFilter !== "ALL") {
      arr = arr.filter((it) => String(it.glcode) === String(glFilter));
    }

    if (normalizedSearch) {
      arr = arr.filter((it) => {
        const gl = String(it.glcode ?? "").toLowerCase();
        const sl = String(it.slcode ?? "").toLowerCase();
        const desc = String(it.sl_description ?? "").toLowerCase();
        return (
          gl.includes(normalizedSearch) ||
          sl.includes(normalizedSearch) ||
          desc.includes(normalizedSearch)
        );
      });
    }

    const min = minAmount === "" ? null : Number(minAmount);
    const max = maxAmount === "" ? null : Number(maxAmount);

    if (min !== null && !Number.isNaN(min)) {
      arr = arr.filter((it) => Number(it.cumulative || 0) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      arr = arr.filter((it) => Number(it.cumulative || 0) <= max);
    }

    const num = (v) => Number(v || 0);
    const str = (v) => String(v ?? "");
    switch (sortBy) {
      case "amount_asc":
        arr.sort((a, b) => num(a.cumulative) - num(b.cumulative));
        break;
      case "amount_desc":
        arr.sort((a, b) => num(b.cumulative) - num(a.cumulative));
        break;
      case "sl_asc":
        arr.sort((a, b) => str(a.slcode).localeCompare(str(b.slcode)));
        break;
      case "sl_desc":
        arr.sort((a, b) => str(b.slcode).localeCompare(str(a.slcode)));
        break;
      case "gl_asc":
        arr.sort((a, b) => str(a.glcode).localeCompare(str(b.glcode)));
        break;
      case "gl_desc":
        arr.sort((a, b) => str(b.glcode).localeCompare(str(a.glcode)));
        break;
      default:
        break;
    }

    return arr;
  }, [list, glFilter, normalizedSearch, minAmount, maxAmount, sortBy]);

  const filteredTotal = useMemo(
    () =>
      filteredList.reduce(
        (sum, item) => sum + (Number(item.cumulative) || 0),
        0,
      ),
    [filteredList],
  );

  const closeModal = () => {
    setGlCode(0);
    setIsModalSlList(false);
  };

  const resetFilters = () => {
    setSearchParams("");
    setGlFilter("ALL");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("amount_desc");
  };

  const maxModalHeight = height ? height * 0.88 : 720;
  const estimatedChrome = isMobile
    ? showFilters
      ? 520
      : 330
    : showFilters
      ? 430
      : 300;
  const listMaxHeight = clamp(
    maxModalHeight - estimatedChrome,
    240,
    isMobile ? 460 : 540,
  );

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/60" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(circle_at_20%_15%,white,transparent_35%),radial-gradient(circle_at_80%_25%,white,transparent_38%),radial-gradient(circle_at_40%_80%,white,transparent_42%)]" />

          <motion.div
            className="relative w-[95vw] sm:w-[90vw] md:w-[84vw] lg:w-[80vw] max-w-4xl"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-3xl p-[1px] bg-gradient-to-br from-colorBrandLight via-white/30 to-colorBrandLight shadow-[0_30px_90px_-55px_rgba(0,0,0,0.7)]">
              <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/70 backdrop-blur-xl">
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
                            <FaList className="h-6 w-6 sm:h-7 sm:w-7 text-colorBrand" />
                          </div>
                        </div>

                        <div className="leading-tight min-w-0">
                          <p className="text-[11px] font-semibold tracking-wide text-slate-500 truncate">
                            GL • Subledger Summary{" "}
                            {busunit ? `• BU: ${busunit}` : ""}{" "}
                            {dateTo ? `• As of: ${dateTo}` : ""}
                          </p>
                          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                            Subledger Summary
                          </h2>
                          <p className="text-[12px] text-slate-500 truncate">
                            Items received:{" "}
                            <span className="font-bold text-slate-700">
                              {list.length}
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={closeModal}
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-sm transition hover:bg-white/85 active:scale-[0.98]"
                        aria-label="Close"
                      >
                        <HiX className="h-5 w-5 text-slate-700" />
                      </button>
                    </div>

                    {slRunningBalLoading && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/40 bg-white/60">
                        <LinearProgress color="inherit" />
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        className="h-11 px-4 rounded-2xl border border-white/45 bg-white/65 text-[12px] font-extrabold text-slate-800 shadow-sm backdrop-blur-xl transition hover:bg-white/80 active:scale-[0.99] flex items-center gap-2"
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
                        >
                          <FiRefreshCw />
                          Reset
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            exportSubledgerToExcel(filteredList, filteredTotal)
                          }
                          className="h-11 px-4 rounded-2xl border border-colorBrand/25 bg-white/70 text-[12px] font-extrabold text-slate-900 shadow-sm backdrop-blur-xl transition hover:bg-white/85 flex items-center gap-2"
                        >
                          <FiDownload />
                          Export
                        </button>
                      </div>
                    </div>

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
                            <div className="lg:col-span-1">
                              <label className="block text-[12px] font-semibold text-slate-700">
                                <HiSearch className="inline h-4 w-4 -mt-[1px] mr-1 text-colorBrand" />
                                Search SL / GL / Description
                              </label>
                              <input
                                type="text"
                                value={searchParams}
                                placeholder="Type to search…"
                                autoComplete="off"
                                style={{ fontSize: "16px", maxWidth: "100%" }}
                                className={["mt-2", FIELD].join(" ")}
                                onChange={(e) =>
                                  setSearchParams(e.target.value)
                                }
                              />
                            </div>

                            <div className="lg:col-span-2">
                              <div className="mt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600">
                                    GL Code
                                  </label>
                                  <select
                                    value={glFilter}
                                    onChange={(e) =>
                                      setGlFilter(e.target.value)
                                    }
                                    className={["mt-1", SELECT].join(" ")}
                                  >
                                    {glOptions.map((g) => (
                                      <option key={g} value={g}>
                                        {g === "ALL" ? "All GL" : `GL ${g}`}
                                      </option>
                                    ))}
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
                                    onChange={(e) =>
                                      setMinAmount(e.target.value)
                                    }
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
                                    onChange={(e) =>
                                      setMaxAmount(e.target.value)
                                    }
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
                                    <option value="amount_desc">
                                      Amount ↓
                                    </option>
                                    <option value="amount_asc">Amount ↑</option>
                                    <option value="sl_asc">SL Code ↑</option>
                                    <option value="sl_desc">SL Code ↓</option>
                                    <option value="gl_asc">GL Code ↑</option>
                                    <option value="gl_desc">GL Code ↓</option>
                                  </select>
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                                <button
                                  type="button"
                                  className={PillBtn(sortBy === "amount_desc")}
                                  onClick={() => setSortBy("amount_desc")}
                                >
                                  Amount ↓
                                </button>
                                <button
                                  type="button"
                                  className={PillBtn(sortBy === "amount_asc")}
                                  onClick={() => setSortBy("amount_asc")}
                                >
                                  Amount ↑
                                </button>
                                <button
                                  type="button"
                                  className={PillBtn(glFilter !== "ALL")}
                                  onClick={() => setGlFilter("ALL")}
                                >
                                  All GL
                                </button>
                                <button
                                  type="button"
                                  className={PillBtn(Boolean(searchParams))}
                                  onClick={() => setSearchParams("")}
                                >
                                  Clear Search
                                </button>

                                <div className="ml-auto shrink-0 rounded-2xl border border-white/40 bg-white/60 px-3 py-2 text-[12px] font-extrabold text-slate-700">
                                  {filteredList.length} item
                                  {filteredList.length !== 1 ? "s" : ""}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* List */}
                  <div className="px-4 sm:px-5 pb-5 flex-1 min-h-0">
                    <div
                      className="rounded-2xl border border-white/40 bg-white/60 overflow-auto"
                      style={{ maxHeight: listMaxHeight }}
                    >
                      <div className="h-full overflow-auto pr-1 bg-white/20">
                        <div className="hidden lg:grid sticky top-0 z-10 grid-cols-[0.9fr_0.9fr_1.6fr_1fr] gap-2 border-b border-white/40 bg-white/85 backdrop-blur-xl px-4 py-3 text-[11px] font-extrabold text-slate-600">
                          <div>GL Code</div>
                          <div>SL Code</div>
                          <div>SL Description</div>
                          <div className="text-right">Amount</div>
                        </div>

                        <div className="p-2">
                          <div className="hidden lg:block space-y-2">
                            {filteredList.map((item) => (
                              <div
                                key={String(item.slcode)}
                                className="rounded-2xl border border-white/40 bg-white/70 px-4 py-4 cursor-pointer hover:bg-white/85 transition"
                                onDoubleClick={() => setSlCode(item.slcode)}
                                title="Double-click to open running balance"
                              >
                                <div className="grid grid-cols-[0.9fr_0.9fr_1.6fr_1fr] gap-2 items-center">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {item.glcode}
                                  </p>
                                  <p className="text-sm font-extrabold text-slate-900">
                                    {item.slcode}
                                  </p>
                                  <p className="text-sm text-slate-700 truncate">
                                    {item.sl_description}
                                  </p>
                                  <p className="text-sm font-extrabold text-slate-900 text-right">
                                    {money(item.cumulative)}
                                  </p>
                                </div>
                              </div>
                            ))}

                            <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <span className="text-sm font-extrabold text-slate-700">
                                  Subtotal:
                                </span>
                                <span className="text-lg font-black text-colorBrand">
                                  {money(filteredTotal)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="lg:hidden space-y-3">
                            {filteredList.map((item) => (
                              <button
                                key={String(item.slcode)}
                                type="button"
                                className="w-full text-left rounded-2xl border border-white/40 bg-white/70 px-4 py-4 shadow-sm active:scale-[0.99]"
                                onClick={() => setSlCode(item.slcode)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="inline-flex shrink-0 items-center rounded-xl border border-colorBrand/15 bg-colorBrand/10 px-2 py-1 text-[11px] font-extrabold text-slate-900">
                                        SL {item.slcode}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-500">
                                        GL {item.glcode}
                                      </span>
                                    </div>

                                    <p className="mt-2 text-sm font-extrabold text-slate-900 line-clamp-2">
                                      {item.sl_description}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      Tap to view running balance →
                                    </p>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <p className="text-[11px] font-bold text-slate-500">
                                      Amount
                                    </p>
                                    <p className="text-sm font-extrabold text-slate-900">
                                      {money(item.cumulative)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}

                            <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-4">
                              <div className="text-right text-colorBrand text-lg font-black">
                                Subtotal: {money(filteredTotal)}
                              </div>
                            </div>
                          </div>

                          {filteredList.length === 0 && (
                            <div className="py-10 text-center text-sm text-slate-500">
                              No items found.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      {isMobile
                        ? "Tip: Show/Hide filters to maximize list space."
                        : "Tip: List scroll is inside this panel; desktop supports double-click to open."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {isModalSlRunningBal && (
        <ModalSLRunningBal
          slRunningBal={slRunningBal}
          setIsModalSlRunningBal={setIsModalSlRunningBal}
          setSlCode={setSlCode}
        />
      )}
    </>
  );
};

export default ModalSubledgerList;
