import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import {
  FiRefreshCw,
  FiFilter,
  FiSearch,
  FiX,
  FiCalendar,
  FiTag,
} from "react-icons/fi";
import useApiHost from "../../hooks/useApiHost";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const COLUMN_TEMPLATE =
  "160px 140px 220px 150px 150px 140px 130px 140px 140px 160px 150px 150px 150px 170px 130px 180px 130px 140px";

const TABLE_MIN_WIDTH = 2720;
const ROW_HEIGHT = 58;
const LIST_HEIGHT = 520;

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

function FilterModal({ open, onClose, filters, setFilters, onApply, onClear }) {
  if (!open) return null;

  const update = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-400 to-teal-300 px-6 py-4">
          <div className="text-xl font-bold text-slate-800">
            Filter Transactions
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white transition hover:scale-105"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FiCalendar />
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update("dateFrom", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FiCalendar />
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => update("dateTo", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FiTag />
              Record Status
            </label>
            <select
              value={filters.recordStatus}
              onChange={(e) => update("recordStatus", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Voided">Voided</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            onClick={onClear}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            onClick={onApply}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-6 py-3 font-semibold text-white shadow-md transition hover:scale-[1.02]"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}

function HeaderRow() {
  const headers = [
    "Transaction ID",
    "Invoice#",
    "Transaction Date",
    "Transaction Type",
    "Reference/Tag",
    "Total Amount",
    "Discount",
    "VAT Exemption",
    "Other Charges",
    "Total Amount Due",
    "Payment Amount",
    "Change Amount",
    "Payment Method",
    "Payment Reference",
    "Short / Over",
    "Remarks",
    "Status",
    "Cashier",
  ];

  return (
    <div
      className="grid border-b border-slate-200 bg-white"
      style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
    >
      {headers.map((header) => (
        <div
          key={header}
          className="px-5 py-5 text-left text-[15px] font-bold text-slate-700"
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

  return (
    <div style={style}>
      <div
        className={`grid border-b border-slate-100 transition hover:bg-slate-50 ${getRowClassName(
          row
        )}`}
        style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
      >
        <div className="px-5 py-4 whitespace-nowrap">{row.transaction_id}</div>
        <div className="px-5 py-4 whitespace-nowrap">{row.invoice_no || "-"}</div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.transaction_date} {row.transaction_time}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.transaction_type || "-"}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">{row.table_number || "-"}</div>
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
        <div className="px-5 py-4 text-right whitespace-nowrap font-semibold">
          {peso(row.total_amount_due)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.payment_amount)}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.change_amount)}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">{row.payment_method || "-"}</div>
        <div className="px-5 py-4 whitespace-nowrap">
          {row.payment_reference || "-"}
        </div>
        <div className="px-5 py-4 text-right whitespace-nowrap">
          {peso(row.short_over)}
        </div>
        <div className="px-5 py-4 whitespace-nowrap">{row.remarks}</div>
        <div className="px-5 py-4 whitespace-nowrap">{row.status}</div>
        <div className="px-5 py-4 whitespace-nowrap">{row.cashier}</div>
      </div>
    </div>
  );
}

export default function TransactionRecords({ onClose }) {
  const apiHost = useApiHost();
  const apiBase = useMemo(() => (apiHost ? `${apiHost}/api` : ""), [apiHost]);

  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);

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
          `${apiBase}/read_transaction_records.php?${params.toString()}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch transaction records");
        }

        const data = await res.json();

        if (data?.success === false) {
          throw new Error(data?.message || "Failed to load transaction records");
        }

        const normalizedRows = Array.isArray(data?.data)
          ? data.data.map(normalizeRow)
          : [];

        setRows(normalizedRows);
        setSummary({
          totalTransactions: Number(
            data?.totalTransactions ?? normalizedRows.length ?? 0
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
    [apiBase, appliedFilters, search]
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
    fetchTransactionRecords(nextFilters, search);
  };

  const getRowClassName = (row) => {
    if (row.status === "Voided" || row.status === "Refunded") {
      return "text-red-500";
    }
    if (row.remarks === "Pending for Payment" || row.remarks === "Billed") {
      return "text-green-600";
    }
    return "text-slate-700";
  };

  const listData = useMemo(
    () => ({
      rows,
      getRowClassName,
    }),
    [rows]
  );

  return (
    <div className="min-h-screen w-full bg-[#eef3fb] p-4 md:p-6">
      <div className="overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_15px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-cyan-400 to-teal-300 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
            Transaction Records
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-cyan-700 transition hover:bg-white/40"
            >
              <FiRefreshCw size={23} />
            </button>

            <button
              onClick={() => setShowFilter(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-cyan-700 transition hover:bg-white/40"
            >
              <FiFilter size={23} />
            </button>

            <div className="flex h-12 items-center gap-3 rounded-full border border-orange-200 bg-white px-4 shadow-sm">
              <FiSearch className="text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchNow();
                }}
                className="w-[180px] bg-transparent text-sm outline-none placeholder:text-slate-300 md:w-[260px]"
              />
              <button
                onClick={handleSearchNow}
                className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600"
              >
                Search
              </button>
            </div>

            <button
              onClick={onClose}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white transition hover:scale-105"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                <HeaderRow />

                {loading ? (
                  <div className="h-[520px] flex items-center justify-center px-5 py-10 text-lg font-medium text-slate-400">
                    Loading transaction records...
                  </div>
                ) : err ? (
                  <div className="h-[520px] flex items-center justify-center px-5 py-10 text-lg font-medium text-red-500">
                    {err}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="h-[520px] flex items-center justify-center px-5 py-10 text-lg font-medium text-slate-300">
                    No transaction records found.
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-8 text-lg">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="h-4 w-4 rounded-full bg-black" />
                  Paid Transactions
                </div>
                <div className="flex items-center gap-2 font-medium text-green-600">
                  <span className="h-4 w-4 rounded-full bg-green-500" />
                  Pending for Payment / Billed
                </div>
                <div className="flex items-center gap-2 font-medium text-red-500">
                  <span className="h-4 w-4 rounded-full bg-red-500" />
                  Voided / Refunded
                </div>
              </div>

              <div className="mt-3 text-[20px] font-extrabold text-slate-700 md:text-[28px]">
                Total Transactions: {summary.totalTransactions}
              </div>
            </div>

            <div className="text-right text-[22px] font-extrabold text-slate-700 md:text-[34px]">
              Total Sales&nbsp;&nbsp;{peso(summary.totalSales)}
            </div>
          </div>
        </div>
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
      />
    </div>
  );
}