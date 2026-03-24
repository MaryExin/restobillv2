import React, { useState, useEffect, useMemo } from "react";
import {
  FaChartLine,
  FaShoppingBag,
  FaWallet,
  FaTimes,
  FaFilter,
  FaChartBar,
  FaUserCheck,
  FaCheckCircle,
  FaDatabase,
  FaSyncAlt, // Added a sync icon for the refresh button
} from "react-icons/fa";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toNum = (value) => Number(value || 0);

const DashboardModal = ({ isOpen, onClose }) => {
  const today = new Date().toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("graph");

  // Auto-fetch when modal opens or dates change
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost/api/reports_dashboard.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datefrom: dateFrom,
            dateto: dateTo,
            includeVoided: false,
          }),
        }
      );

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const kpi = data?.kpi || {
    txn_count: 0,
    gross_sales: 0,
    discount_total: 0,
    net_sales: 0,
    vat_exemption: 0,
    vat_amount: 0,
  };

  const averageBasket =
    toNum(kpi.txn_count) > 0
      ? toNum(kpi.gross_sales) / toNum(kpi.txn_count)
      : 0;

  const sortedByQty = useMemo(() => {
    if (!Array.isArray(data?.salesPerProduct)) return [];
    return [...data.salesPerProduct].sort(
      (a, b) => toNum(b["Total Qty Sold"]) - toNum(a["Total Qty Sold"])
    );
  }, [data]);

  const maxQty = useMemo(() => {
    if (!sortedByQty.length) return 1;
    return Math.max(
      ...sortedByQty.map((item) => toNum(item["Total Qty Sold"])),
      1
    );
  }, [sortedByQty]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[95vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.20)]">
        <div className="px-6 py-5 bg-white border-b border-slate-200 sm:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-600">
                Sales Dashboard
              </div>
              <h2 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">
                Branch Report
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Sales summary and product performance overview.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-end gap-3 p-3 border rounded-2xl border-slate-200 bg-slate-50">
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-slate-500">
                    Start Date
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border outline-none rounded-xl border-slate-200 text-slate-700 focus:border-blue-400"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-slate-500">
                    End Date
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border outline-none rounded-xl border-slate-200 text-slate-700 focus:border-blue-400"
                  />
                </div>

                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
                  title="Refresh Data"
                >
                  <FaSyncAlt
                    className={loading ? "animate-spin" : ""}
                    size={14}
                  />
                </button>
              </div>

              <div className="flex p-1 border rounded-2xl border-slate-200 bg-slate-50">
                <button
                  onClick={() => setViewMode("graph")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    viewMode === "graph"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  <FaChartBar size={14} />
                  Analytics
                </button>

                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  <FaDatabase size={14} />
                  Table View
                </button>
              </div>

              <button
                onClick={onClose}
                className="flex items-center justify-center transition bg-white border h-11 w-11 rounded-2xl border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500"
              >
                <FaTimes size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ... Rest of the component remains the same ... */}
        <div className="flex-1 px-6 py-6 overflow-y-auto bg-slate-50 sm:px-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Sales"
                  value={peso(kpi.gross_sales)}
                  subText="Sales before deductions"
                  icon={FaWallet}
                  tone="blue"
                />
                <StatCard
                  label="Average Spend"
                  value={peso(averageBasket)}
                  subText="Average spend per transaction"
                  icon={FaUserCheck}
                  tone="violet"
                />
                <StatCard
                  label="Order Count"
                  value={Number(kpi.txn_count || 0).toLocaleString("en-PH")}
                  subText="Total number of transactions"
                  icon={FaShoppingBag}
                  tone="amber"
                />
                <StatCard
                  label="Net Revenue"
                  value={peso(kpi.net_sales)}
                  subText="Net sales after discounts"
                  icon={FaChartLine}
                  tone="emerald"
                />
              </div>

              {viewMode === "graph" ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Sales Summary
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Additional values for discounts, VAT, and activity.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <InsightRow
                        label="Senior / PWD Saved"
                        value={peso(kpi.vat_exemption || 0)}
                        desc="Total exemption and discount impact"
                        valueClass="text-rose-500"
                      />
                      <InsightRow
                        label="VAT Collected"
                        value={peso(kpi.vat_amount || 0)}
                        desc="Output tax amount"
                        valueClass="text-blue-600"
                      />
                      <InsightRow
                        label="Discount Total"
                        value={peso(kpi.discount_total || 0)}
                        desc="Total deducted discounts"
                        valueClass="text-amber-600"
                      />
                      <InsightRow
                        label="Performance"
                        value="Healthy"
                        desc="Transaction flow is stable"
                        valueClass="text-emerald-600"
                      />
                    </div>

                    <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        Daily Velocity
                      </div>
                      <div className="flex items-end h-24 gap-2">
                        {[30, 60, 45, 90, 100, 70, 40, 20].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-xl bg-blue-500/80"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Best Sellers
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Top selling products based on quantity sold.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {sortedByQty.slice(0, 8).map((item, idx) => {
                        const qty = toNum(item["Total Qty Sold"]);
                        const width = (qty / maxQty) * 100;

                        return (
                          <div key={`${item["Product Name"]}-${idx}`}>
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate text-slate-900">
                                  {item["Product Name"]}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-blue-600 shrink-0">
                                {qty} pcs
                              </div>
                            </div>

                            <div className="w-full h-3 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full transition-all duration-700 bg-blue-600 rounded-full"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {sortedByQty.length === 0 && (
                        <div className="py-12 text-sm text-center text-slate-400">
                          No product sales data available.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                            Rank
                          </th>
                          <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                            Product
                          </th>
                          <th className="px-5 py-4 text-sm font-semibold text-center text-slate-600">
                            Qty Sold
                          </th>
                          <th className="px-5 py-4 text-sm font-semibold text-right text-slate-600">
                            Gross Sales
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {sortedByQty.length > 0 ? (
                          sortedByQty.map((item, idx) => (
                            <tr
                              key={`${item["Product Name"]}-${idx}`}
                              className="transition border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="px-5 py-4 text-sm font-semibold text-blue-600">
                                #{idx + 1}
                              </td>
                              <td className="px-5 py-4 text-sm font-medium text-slate-900">
                                {item["Product Name"]}
                              </td>
                              <td className="px-5 py-4 text-sm text-center text-slate-600">
                                {toNum(item["Total Qty Sold"])} units
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-right text-slate-900">
                                {peso(item["Gross Sales"] || 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-5 py-16 text-sm text-center text-slate-400"
                            >
                              No table data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <SummaryCard
                title="Quick Summary"
                items={[
                  {
                    label: "Transactions",
                    value: Number(kpi.txn_count || 0).toLocaleString("en-PH"),
                  },
                  {
                    label: "Gross Sales",
                    value: peso(kpi.gross_sales || 0),
                  },
                  {
                    label: "Discount Total",
                    value: peso(kpi.discount_total || 0),
                  },
                  {
                    label: "Net Sales",
                    value: peso(kpi.net_sales || 0),
                  },
                ]}
              />

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <FaCheckCircle className="text-emerald-500" size={14} />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      System Live
                    </div>
                    <p className="text-sm text-slate-500">
                      Branch reporting is active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200 sm:px-8">
          <p className="text-sm text-slate-500"></p>
          <p className="text-sm text-slate-500">Sales Dashboard</p>
        </div>
      </div>
    </div>
  );
};

// ... Sub-components (StatCard, InsightRow, SummaryCard) remain exactly the same as your original ...
function StatCard({ label, value, subText, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-sm text-slate-500">{subText}</div>
    </div>
  );
}

function InsightRow({ label, value, desc, valueClass = "text-slate-900" }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function SummaryCard({ title, items = [] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-slate-900">{title}</div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <span className="text-sm text-slate-600">{item.label}</span>
            <span className="text-sm font-semibold text-slate-900">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardModal;