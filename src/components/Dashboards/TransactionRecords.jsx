import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import {
  FiRefreshCw,
  FiFilter,
  FiSearch,
  FiX,
  FiCalendar,
  FiTag,
  FiBarChart2,
  FiDatabase,
} from "react-icons/fi";
import {
  FaArrowLeft,
  FaLayerGroup,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const COLUMN_TEMPLATE =
  "160px 130px 220px 140px 130px 140px 130px 130px 130px 150px 140px 140px 150px 160px 120px 180px 130px 150px";

const TABLE_MIN_WIDTH = 2650;
const ROW_HEIGHT = 60;
const LIST_HEIGHT = 560;

const ListOuter = React.forwardRef(({ style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      overflowX: "hidden",
      overflowY: "auto",
    }}
  />
));

const ListInner = React.forwardRef(({ style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      width: "100%",
    }}
  />
));

function FilterModal({
  open,
  onClose,
  filters,
  setFilters,
  onApply,
  onClear,
  isDark,
}) {
  if (!open) return null;

  const update = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md ${
          isDark ? "bg-slate-950/75" : "bg-slate-900/20"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          className={`w-full max-w-2xl overflow-hidden rounded-[28px] border shadow-2xl ${
            isDark
              ? "border-white/10 bg-slate-900"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`flex items-center justify-between px-6 py-5 ${
              isDark
                ? "border-b border-white/5 bg-white/[0.03]"
                : "border-b border-slate-200 bg-slate-50"
            }`}
          >
            <div>
              <div
                className={`text-2xl font-black ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Filter Transactions
              </div>
              <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Fine tune your records
              </div>
            </div>

            <button
              onClick={onClose}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-red-500/15 hover:text-red-400"
                  : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
              }`}
            >
              <FiX size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <FiCalendar />
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update("dateFrom", e.target.value)}
                className={`w-full rounded-2xl px-4 py-3 outline-none transition ${
                  isDark
                    ? "border border-slate-800 bg-slate-950 text-white focus:border-blue-500"
                    : "border border-slate-200 bg-white text-slate-900 focus:border-blue-400"
                }`}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <FiCalendar />
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update("dateTo", e.target.value)}
                className={`w-full rounded-2xl px-4 py-3 outline-none transition ${
                  isDark
                    ? "border border-slate-800 bg-slate-950 text-white focus:border-blue-500"
                    : "border border-slate-200 bg-white text-slate-900 focus:border-blue-400"
                }`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <FiTag />
                Record Status
              </label>
              <select
                value={filters.recordStatus}
                onChange={(e) => update("recordStatus", e.target.value)}
                className={`w-full rounded-2xl px-4 py-3 outline-none transition ${
                  isDark
                    ? "border border-slate-800 bg-slate-950 text-white focus:border-blue-500"
                    : "border border-slate-200 bg-white text-slate-900 focus:border-blue-400"
                }`}
              >
                <option value="">All</option>
                <option value="Active">Active</option>
                <option value="Voided">Voided</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div
            className={`flex items-center justify-end gap-3 px-6 py-5 ${
              isDark ? "border-t border-white/5" : "border-t border-slate-100"
            }`}
          >
            <button
              onClick={onClear}
              className={`rounded-2xl px-5 py-3 font-semibold transition ${
                isDark
                  ? "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Clear
            </button>
            <button
              onClick={onApply}
              className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Apply Filter
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function HeaderRow({ isDark }) {
  const headers = [
    "Transaction ID",
    "Invoice#",
    "Transaction Date",
    "Type",
    "Reference",
    "Total",
    "Discount",
    "VAT Exemption",
    "Other Charges",
    "Amount Due",
    "Payment",
    "Change",
    "Method",
    "Reference No.",
    "Short / Over",
    "Remarks",
    "Status",
    "Cashier",
  ];

  return (
    <div
      className={`grid border-b ${
        isDark
          ? "border-white/5 bg-slate-950/70 text-slate-300"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
      style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
    >
      {headers.map((header) => (
        <div
          key={header}
          className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.16em]"
        >
          {header}
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ index, style, data }) {
  const row = data.rows[index];
  const getRowClassName = data.getRowClassName;
  const isDark = data.isDark;

  return (
    <div style={style}>
      <div
        className={`grid border-b transition ${
          isDark
            ? "border-white/5 hover:bg-white/[0.03]"
            : "border-slate-100 hover:bg-slate-50"
        } ${getRowClassName(row)}`}
        style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
      >
        <div className="px-5 py-4 whitespace-nowrap">{row.transaction_id}</div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.invoice_no || "-"}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.transaction_date} {row.transaction_time}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.transaction_type || "-"}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.table_number || "-"}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.total_sales)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.discount)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.vat_exemption)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.other_charges)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap font-bold">
          {peso(row.total_amount_due)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.payment_amount)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.change_amount)}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.payment_method || "-"}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.payment_reference || "-"}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.short_over)}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">{row.remarks || "-"}</div>
        <div className="px-5 py-4 whitespace-nowrap">{row.status || "-"}</div>
        <div className="px-5 py-4 whitespace-nowrap">{row.cashier || "-"}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isDark }) {
  return (
    <div
      className={`rounded-[24px] border p-5 ${
        isDark
          ? "border-white/5 bg-white/[0.03]"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            isDark
              ? "bg-slate-800 text-slate-300"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
      <div
        className={`text-2xl font-black ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function QuickFilterButton({ active, label, icon: Icon, onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : isDark
            ? "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={15} />
        <span className="font-semibold">{label}</span>
      </div>
      {active ? <FaCheckCircle size={14} /> : null}
    </button>
  );
}

export default function TransactionRecords({ onClose }) {
  const apiHost = useApiHost();
  const apiBase = useMemo(() => (apiHost ? `${apiHost}/api` : ""), [apiHost]);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [quickStatus, setQuickStatus] = useState("active");
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    dateFrom: today,
    dateTo: today,
    recordStatus: "Active",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: today,
    dateTo: today,
    recordStatus: "Active",
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalSales: 0,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const normalizeRow = (row) => ({
    id: row.ID ?? row.id ?? row.transaction_id,
    transaction_id: row.transaction_id ?? "",
    invoice_no: row.invoice_no ?? "",
    transaction_date: row.transaction_date ?? "",
    transaction_time: row.transaction_time ?? "",
    transaction_type: row.transaction_type ?? "",
    table_number: row.table_number ?? "",
    total_sales: Number(row.TotalSales ?? row.total_sales ?? 0),
    discount: Number(row.Discount ?? row.discount ?? 0),
    vat_exemption: Number(row.VATExemptSales_VAT ?? row.vat_exemption ?? 0),
    other_charges: Number(row.OtherCharges ?? row.other_charges ?? 0),
    total_amount_due: Number(row.TotalAmountDue ?? row.total_amount_due ?? 0),
    payment_amount: Number(row.payment_amount ?? 0),
    change_amount: Number(row.change_amount ?? 0),
    payment_method: row.payment_method ?? "",
    payment_reference: row.payment_reference ?? "",
    short_over: Number(row.short_over ?? 0),
    remarks: row.remarks ?? "",
    status: row.status ?? "",
    cashier: row.cashier ?? "",
  });

  const fetchTransactionRecords = useCallback(
    async (overrideFilters = null, overrideSearch = null) => {
      if (!apiBase) return;

      setLoading(true);
      setErr("");

      try {
        const activeFilters = overrideFilters || appliedFilters;
        const activeSearch = overrideSearch !== null ? overrideSearch : search;

        const params = new URLSearchParams({
          dateFrom: activeFilters.dateFrom || "",
          dateTo: activeFilters.dateTo || "",
          search: activeSearch || "",
          recordStatus: activeFilters.recordStatus || "All",
        });

        const res = await fetch(
          `${apiBase}/read_transaction_records.php?${params.toString()}`,
        );

        if (!res.ok) {
          throw new Error("Failed to fetch transaction records");
        }

        const data = await res.json();

        if (data?.success === false) {
          throw new Error(
            data?.message || "Failed to load transaction records",
          );
        }

        const normalizedRows = Array.isArray(data?.data)
          ? data.data.map(normalizeRow)
          : [];

        setRows(normalizedRows);
        setSummary({
          totalTransactions: Number(
            data?.totalTransactions ?? normalizedRows.length ?? 0,
          ),
          totalSales: Number(data?.totalSales ?? 0),
        });
      } catch (e) {
        setRows([]);
        setSummary({
          totalTransactions: 0,
          totalSales: 0,
        });
        setErr(e?.message || "Fetch error");
      } finally {
        setLoading(false);
      }
    },
    [apiBase, appliedFilters, search],
  );

  useEffect(() => {
    fetchTransactionRecords();
  }, [fetchTransactionRecords]);

  const handleRefresh = () => {
    const reset = {
      dateFrom: today,
      dateTo: today,
      recordStatus: "Active",
    };

    setSearch("");
    setQuickStatus("active");
    setFilters(reset);
    setAppliedFilters(reset);
    fetchTransactionRecords(reset, "");
  };

  const handleSearchNow = () => {
    fetchTransactionRecords(appliedFilters, search);
  };

  const handleApplyFilter = () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setShowFilter(false);

    if (
      nextFilters.recordStatus === "Active" ||
      nextFilters.recordStatus === "Voided" ||
      nextFilters.recordStatus === "Refunded"
    ) {
      setQuickStatus(nextFilters.recordStatus.toLowerCase());
    } else {
      setQuickStatus("all");
    }

    fetchTransactionRecords(nextFilters, search);
  };

  const handleQuickStatus = (value) => {
    setQuickStatus(value);

    let statusValue = "";
    if (value === "active") statusValue = "Active";
    if (value === "voided") statusValue = "Voided";
    if (value === "refunded") statusValue = "Refunded";
    if (value === "all") statusValue = "";

    const nextFilters = {
      ...appliedFilters,
      recordStatus: statusValue,
    };

    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    fetchTransactionRecords(nextFilters, search);
  };

  const getRowClassName = (row) => {
    if (row.status === "Voided" || row.status === "Refunded") {
      return "text-red-500";
    }

    if (row.remarks === "Pending for Payment" || row.remarks === "Billed") {
      return isDark ? "text-emerald-400" : "text-green-600";
    }

    return isDark ? "text-slate-200" : "text-slate-700";
  };

  const listData = useMemo(
    () => ({
      rows,
      getRowClassName,
      isDark,
    }),
    [rows, isDark],
  );

  return (
    <div
      className={
        isDark
          ? "min-h-screen bg-[#020617] text-slate-200"
          : "min-h-screen bg-slate-100 text-slate-900"
      }
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -left-20 top-0 h-72 w-72 rounded-full blur-[120px] ${
            isDark ? "bg-blue-600/10" : "bg-blue-500/15"
          }`}
        />
        <div
          className={`absolute right-0 top-20 h-80 w-80 rounded-full blur-[140px] ${
            isDark ? "bg-cyan-500/10" : "bg-sky-400/15"
          }`}
        />
      </div>

      <FilterModal
        open={showFilter}
        onClose={() => setShowFilter(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilter}
        onClear={() =>
          setFilters({
            dateFrom: today,
            dateTo: today,
            recordStatus: "Active",
          })
        }
        isDark={isDark}
      />

      <div className="relative z-10 mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => navigate("/poscorehomescreen")}
            className={`inline-flex items-center gap-3 rounded-2xl border px-5 py-3 font-semibold transition ${
              isDark
                ? "border-white/5 bg-white/[0.03] text-slate-300 hover:text-white"
                : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 shadow-sm"
            }`}
          >
            <FaArrowLeft size={14} />
            Back
          </button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-500">
            <FiTag />
            Transaction Center
          </div>
        </div>

        <div className="mb-6">
          <h1
            className={`text-3xl font-black sm:text-4xl ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Transaction Records
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Overview of your transaction activity and payment records.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                title="Total Transactions"
                value={summary.totalTransactions}
                icon={FiDatabase}
                isDark={isDark}
              />
              <StatCard
                title="Total Sales"
                value={peso(summary.totalSales)}
                icon={FiBarChart2}
                isDark={isDark}
              />
              <StatCard
                title="Selected Status"
                value={appliedFilters.recordStatus || "All"}
                icon={FiTag}
                isDark={isDark}
              />
            </div>

            <div
              className={`rounded-[28px] border p-4 sm:p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_170px_170px_140px_140px]">
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search transaction, invoice, table, cashier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchNow();
                    }}
                    className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none transition ${
                      isDark
                        ? "border border-slate-800 bg-slate-950 text-white focus:border-blue-500"
                        : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-400"
                    }`}
                  />
                </div>

                <div className="relative">
                  <FiCalendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    readOnly
                    value={appliedFilters.dateFrom || ""}
                    className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none ${
                      isDark
                        ? "border border-slate-800 bg-slate-950 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  />
                </div>

                <div className="relative">
                  <FiCalendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    readOnly
                    value={appliedFilters.dateTo || ""}
                    className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none ${
                      isDark
                        ? "border border-slate-800 bg-slate-950 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  />
                </div>

                <button
                  onClick={() => setShowFilter(true)}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold transition ${
                    isDark
                      ? "border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <FiFilter size={16} />
                  Filter
                </button>

                <button
                  onClick={handleRefresh}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white transition hover:bg-blue-500"
                >
                  <FiRefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            {/* <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSearchNow}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Search
              </button>

              {[
                { label: "All", value: "all", icon: FaLayerGroup },
                { label: "Active", value: "active", icon: FaCheckCircle },
                { label: "Voided", value: "voided", icon: FaClock },
                { label: "Refunded", value: "refunded", icon: FaClock },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => handleQuickStatus(item.value)}
                  className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition ${
                    quickStatus === item.value
                      ? "border-blue-500 bg-blue-600 text-white"
                      : isDark
                        ? "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <item.icon size={13} />
                  {item.label}
                </button>
              ))}
            </div> */}

            <div
              className={`overflow-hidden rounded-[30px] border ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {loading ? (
                <div
                  className={`flex h-[420px] items-center justify-center text-lg font-semibold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Loading transaction records...
                </div>
              ) : err ? (
                <div className="flex h-[420px] items-center justify-center px-6 text-center text-lg font-semibold text-red-500">
                  {err}
                </div>
              ) : rows.length === 0 ? (
                <div
                  className={`flex h-[420px] items-center justify-center text-2xl font-black ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  No data
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                    <HeaderRow isDark={isDark} />
                    <List
                      height={LIST_HEIGHT}
                      itemCount={rows.length}
                      itemSize={ROW_HEIGHT}
                      width={TABLE_MIN_WIDTH}
                      itemData={listData}
                      overscanCount={8}
                      outerElementType={ListOuter}
                      innerElementType={ListInner}
                    >
                      {TransactionRow}
                    </List>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div
              className={`rounded-[28px] border p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div
                className={`mb-4 text-sm font-black uppercase tracking-[0.18em] ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Quick Filters
              </div>

              <div className="space-y-3">
                <QuickFilterButton
                  active={quickStatus === "all"}
                  label="All Records"
                  icon={FaLayerGroup}
                  onClick={() => handleQuickStatus("all")}
                  isDark={isDark}
                />
                <QuickFilterButton
                  active={quickStatus === "active"}
                  label="Active"
                  icon={FaCheckCircle}
                  onClick={() => handleQuickStatus("active")}
                  isDark={isDark}
                />
                <QuickFilterButton
                  active={quickStatus === "voided"}
                  label="Voided"
                  icon={FaClock}
                  onClick={() => handleQuickStatus("voided")}
                  isDark={isDark}
                />
                <QuickFilterButton
                  active={quickStatus === "refunded"}
                  label="Refunded"
                  icon={FaClock}
                  onClick={() => handleQuickStatus("refunded")}
                  isDark={isDark}
                />
              </div>
            </div>

            <div
              className={`rounded-[28px] border p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div
                className={`mb-4 text-sm font-black uppercase tracking-[0.18em] ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Current Selection
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-slate-500">Date From</div>
                  <div className={isDark ? "text-white" : "text-slate-900"}>
                    {appliedFilters.dateFrom || "-"}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-slate-500">Date To</div>
                  <div className={isDark ? "text-white" : "text-slate-900"}>
                    {appliedFilters.dateTo || "-"}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-slate-500">Status</div>
                  <div className={isDark ? "text-white" : "text-slate-900"}>
                    {appliedFilters.recordStatus || "All"}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-slate-500">Search</div>
                  <div className={isDark ? "text-white" : "text-slate-900"}>
                    {search || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-[28px] border p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div
                className={`mb-4 text-sm font-black uppercase tracking-[0.18em] ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Legend
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-900 dark:bg-slate-300" />
                  <span className="text-slate-500">Paid Transactions</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-green-500" />
                  <span className="text-slate-500">
                    Pending for Payment / Billed
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
                  <span className="text-slate-500">Voided / Refunded</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
