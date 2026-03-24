import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaPrint,
  FaFileExcel,
  FaBox,
  FaArrowRight,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { useTheme } from "../../../context/ThemeContext";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CustomCalendar = ({
  selectedDate,
  onChange,
  isOpen,
  onClose,
  isDark,
}) => {
  const [currentView, setCurrentView] = useState(new Date(selectedDate));
  const calendarRef = useRef(null);

  useEffect(() => {
    setCurrentView(new Date(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(
    currentView.getFullYear(),
    currentView.getMonth(),
    1,
  ).getDay();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handlePickDay = (day) => {
    const localDate = new Date(
      currentView.getFullYear(),
      currentView.getMonth(),
      day,
    );
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const date = String(localDate.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${date}`);
    onClose();
  };

  return (
    <div
      ref={calendarRef}
      className={`absolute left-0 top-full z-[100005] mt-2 w-[320px] rounded-2xl border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.25)] ${
        isDark ? "border-white/10 bg-[#0b1220]" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between px-1 mb-4">
        <h4
          className={`text-base font-semibold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {monthNames[currentView.getMonth()]} {currentView.getFullYear()}
        </h4>

        <div className="flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView(
                new Date(
                  currentView.getFullYear(),
                  currentView.getMonth() - 1,
                  1,
                ),
              );
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isDark
                ? "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FaChevronLeft size={10} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView(
                new Date(
                  currentView.getFullYear(),
                  currentView.getMonth() + 1,
                  1,
                ),
              );
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isDark
                ? "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      </div>

      <div
        className={`mb-2 grid grid-cols-7 text-center text-[11px] font-medium ${
          isDark ? "text-slate-500" : "text-slate-500"
        }`}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => (
          <div key={i} />
        ))}

        {[
          ...Array(
            daysInMonth(currentView.getFullYear(), currentView.getMonth()),
          ),
        ].map((_, i) => {
          const day = i + 1;
          const localDate = new Date(
            currentView.getFullYear(),
            currentView.getMonth(),
            day,
          );
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, "0");
          const date = String(localDate.getDate()).padStart(2, "0");
          const dateString = `${year}-${month}-${date}`;

          return (
            <button
              key={day}
              onClick={(e) => {
                e.stopPropagation();
                handlePickDay(day);
              }}
              className={`h-9 w-full rounded-lg text-sm font-medium transition ${
                dateString === selectedDate
                  ? "bg-blue-600 text-white"
                  : isDark
                    ? "text-slate-300 hover:bg-white/10 hover:text-white"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SalesPerProductModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchTerm, setSearchTerm] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost/api/reports_dashboard.php`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datefrom: dateFrom,
            dateto: dateTo,
            includeVoided: false,
          }),
        },
      );

      const data = await response.json();
      setSalesData(data?.salesPerProduct || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen, fetchSales]);

  const filteredData = useMemo(() => {
    return salesData.filter((item) => {
      const productName = String(item["Product Name"] || "").toLowerCase();
      const code = String(item["Code"] || "").toLowerCase();
      const keyword = searchTerm.toLowerCase();

      return productName.includes(keyword) || code.includes(keyword);
    });
  }, [salesData, searchTerm]);

  const totalAmt = filteredData.reduce(
    (sum, item) => sum + parseFloat(item["Gross Sales"] || 0),
    0,
  );

  const totalQty = filteredData.reduce(
    (sum, item) => sum + parseFloat(item["Total Qty Sold"] || 0),
    0,
  );

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item) => ({
        Code: item.Code || "",
        "Product Name": item["Product Name"] || "",
        "Qty Sold": item["Total Qty Sold"] || 0,
        "Total Amount": item["Gross Sales"] || 0,
      })),
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Per_Item");
    XLSX.writeFile(workbook, `Sales_Per_Item_${dateFrom}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden p-3 backdrop-blur-md ${
        isDark ? "bg-[#020617]/85" : "bg-slate-900/35"
      }`}
    >
      <style>{`
        @media screen {
          #thermal-receipt {
            display: none;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .no-print {
            display: none !important;
          }

          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible !important;
          }

          #thermal-receipt {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            background: white !important;
            color: black !important;
            font-family: "Courier New", Courier, monospace !important;
            box-sizing: border-box !important;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      <div
        className={`no-print relative flex h-[96vh] w-full max-w-[98%] flex-col overflow-hidden rounded-[30px] border shadow-[0_30px_90px_rgba(0,0,0,0.18)] ${
          isDark
            ? "border-white/10 bg-[#020817]"
            : "border-slate-200 bg-[#f8fafc]"
        }`}
      >
        <div
          className={`shrink-0 border-b px-8 py-6 ${
            isDark
              ? "border-white/5 bg-white/[0.02]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-blue-600 text-white"
                }`}
              >
                <FaBox size={22} />
              </div>

              <div>
                <div
                  className={`text-sm font-semibold ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  Reports
                </div>

                <h2
                  className={`mt-1 text-3xl font-bold tracking-tight sm:text-4xl ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Sales Per Item
                </h2>

                <div
                  className={`mt-3 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium ${
                    isDark
                      ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                      : "border-blue-100 bg-blue-50 text-blue-700"
                  }`}
                >
                  <span>Report Date</span>
                  <FaArrowRight size={9} />
                  <span>{dateFrom}</span>
                  <FaArrowRight size={9} />
                  <span>{dateTo}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <FaPrint size={13} />
                Print
              </button>

              <button
                onClick={exportToExcel}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                  isDark
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                <FaFileExcel size={13} />
                Export Excel
              </button>

              <button
                onClick={onClose}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-rose-500 hover:text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-rose-500 hover:text-white"
                }`}
              >
                <FaTimes size={16} />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`shrink-0 border-b px-8 py-4 ${
            isDark
              ? "border-white/5 bg-[#07101f]/70"
              : "border-slate-200 bg-slate-100/70"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <FaSearch
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
                size={13}
              />
              <input
                type="text"
                placeholder="Search item name or code..."
                className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm font-medium outline-none transition ${
                  isDark
                    ? "border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500 focus:border-blue-500/40"
                    : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-blue-500"
                }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={fetchSales}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                isDark
                  ? "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} size={14} />
            </button>

            <button
              onClick={() => setShowFilter(true)}
              className="flex items-center h-12 gap-2 px-5 text-sm font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700"
            >
              <FaFilter size={13} />
              Filters
            </button>
          </div>
        </div>

        <div className="flex-1 px-8 py-5 overflow-hidden">
          <div
            className={`custom-scrollbar relative h-full overflow-auto rounded-[26px] border shadow-inner ${
              isDark
                ? "border-white/5 bg-[#050c18]"
                : "border-slate-200 bg-white"
            }`}
          >
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-[50]">
                <tr
                  className={`text-[11px] font-semibold backdrop-blur-md ${
                    isDark
                      ? "bg-[#0b1422]/95 text-slate-400"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <th
                    className={`border-b p-5 ${
                      isDark ? "border-white/5" : "border-slate-200"
                    }`}
                  >
                    Code
                  </th>
                  <th
                    className={`border-b p-5 ${
                      isDark ? "border-white/5" : "border-slate-200"
                    }`}
                  >
                    Item Description
                  </th>
                  <th
                    className={`border-b p-5 text-center ${
                      isDark ? "border-white/5" : "border-slate-200"
                    }`}
                  >
                    Type
                  </th>
                  <th
                    className={`border-b p-5 text-center ${
                      isDark ? "border-white/5" : "border-slate-200"
                    }`}
                  >
                    Qty
                  </th>
                  <th
                    className={`border-b p-5 text-right ${
                      isDark ? "border-white/5" : "border-slate-200"
                    }`}
                  >
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody
                className={`divide-y text-sm ${
                  isDark
                    ? "divide-white/[0.03] text-slate-300"
                    : "divide-slate-100 text-slate-700"
                }`}
              >
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`transition ${
                        isDark ? "hover:bg-white/[0.03]" : "hover:bg-blue-50/50"
                      }`}
                    >
                      <td
                        className={`p-5 font-mono text-xs ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        {item.Code}
                      </td>

                      <td className="p-5">
                        <div
                          className={`font-semibold ${
                            isDark ? "text-slate-100" : "text-slate-900"
                          }`}
                        >
                          {item["Product Name"]}
                        </div>
                      </td>

                      <td
                        className={`p-5 text-center text-xs ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        {item["Item Type"] || "—"}
                      </td>

                      <td
                        className={`p-5 text-center text-lg font-bold ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {Number(item["Total Qty Sold"] || 0).toLocaleString()}
                      </td>

                      <td
                        className={`p-5 text-right text-lg font-bold ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        {peso(item["Gross Sales"] || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className={`p-12 text-center text-sm ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No product sales found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className={`shrink-0 border-t px-8 py-5 ${
            isDark ? "border-white/5 bg-black/20" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <div>
                <p
                  className={`text-xs font-medium ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Items Sold
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {totalQty.toLocaleString()}
                </p>
              </div>

              <div
                className={`h-10 w-px ${
                  isDark ? "bg-white/10" : "bg-slate-200"
                }`}
              />

              <div>
                <p
                  className={`text-xs font-medium ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  SALES
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  Per Item
                </p>
              </div>
            </div>

            <div className="py-4 text-right bg-blue-600 shadow-lg rounded-2xl px-7 shadow-blue-950/20">
              <span className="text-xs font-medium text-white/70">
                Grand Total Sales
              </span>
              <h3 className="text-3xl font-bold text-white">
                {peso(totalAmt)}
              </h3>
            </div>
          </div>
        </div>

        {showFilter && (
          <div
            className={`absolute inset-y-0 right-0 z-[100001] flex w-[400px] flex-col border-l p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)] ${
              isDark
                ? "border-white/10 bg-[#0a1220]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h3
                className={`text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Report Dates
              </h3>

              <button
                onClick={() => setShowFilter(false)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isDark
                    ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    : "bg-slate-100 text-slate-500 hover:text-rose-500"
                }`}
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-6">
              <div className="relative">
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Start Date
                </label>

                <button
                  onClick={() => {
                    setOpenStartCal(!openStartCal);
                    setOpenEndCal(false);
                  }}
                  className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-left transition ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white hover:border-blue-500/40"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400"
                  }`}
                >
                  <span className="font-medium">{dateFrom}</span>
                  <FaChevronDown
                    className={isDark ? "text-slate-500" : "text-slate-400"}
                    size={12}
                  />
                </button>

                <CustomCalendar
                  selectedDate={dateFrom}
                  onChange={setDateFrom}
                  isOpen={openStartCal}
                  onClose={() => setOpenStartCal(false)}
                  isDark={isDark}
                />
              </div>

              <div className="relative">
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  End Date
                </label>

                <button
                  onClick={() => {
                    setOpenEndCal(!openEndCal);
                    setOpenStartCal(false);
                  }}
                  className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-left transition ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white hover:border-blue-500/40"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400"
                  }`}
                >
                  <span className="font-medium">{dateTo}</span>
                  <FaChevronDown
                    className={isDark ? "text-slate-500" : "text-slate-400"}
                    size={12}
                  />
                </button>

                <CustomCalendar
                  selectedDate={dateTo}
                  onChange={setDateTo}
                  isOpen={openEndCal}
                  onClose={() => setOpenEndCal(false)}
                  isDark={isDark}
                />
              </div>
            </div>

            <button
              onClick={() => {
                fetchSales();
                setShowFilter(false);
              }}
              className="py-4 mt-8 text-sm font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>

      <div id="thermal-receipt">
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h2 style={{ fontSize: "16px", margin: 0, fontWeight: "bold" }}>
            REPORT
          </h2>
          <p
            style={{
              fontSize: "10px",
              margin: "2px 0",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Sales Per Item
          </p>
          <div
            style={{
              fontSize: "9px",
              margin: "4px 0",
              borderTop: "1px dashed black",
              borderBottom: "1px dashed black",
              padding: "4px 0",
            }}
          >
            {dateFrom} TO {dateTo}
          </div>
        </div>

        <table
          style={{
            width: "100%",
            fontSize: "10px",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid black" }}>
              <th align="left" style={{ paddingBottom: "4px", width: "60%" }}>
                ITEM
              </th>
              <th align="center" style={{ paddingBottom: "4px", width: "15%" }}>
                QTY
              </th>
              <th align="right" style={{ paddingBottom: "4px", width: "25%" }}>
                TOTAL
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td
                  style={{
                    padding: "4px 0",
                    fontSize: "9px",
                    verticalAlign: "top",
                    textTransform: "uppercase",
                  }}
                >
                  {item["Product Name"]}
                </td>
                <td
                  align="center"
                  style={{ padding: "4px 0", verticalAlign: "top" }}
                >
                  {parseFloat(item["Total Qty Sold"] || 0)}
                </td>
                <td
                  align="right"
                  style={{
                    padding: "4px 0",
                    verticalAlign: "top",
                    fontWeight: "bold",
                  }}
                >
                  {parseFloat(item["Gross Sales"] || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            borderTop: "1px solid black",
            marginTop: "8px",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              marginBottom: "2px",
            }}
          >
            <span>TOTAL QTY:</span>
            <span>{totalQty.toLocaleString()}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            <span>GRAND TOTAL:</span>
            <span>
              {totalAmt.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: "8px",
              marginTop: "15px",
            }}
          >
            <p style={{ margin: 0 }}>Printed: {new Date().toLocaleString()}</p>
            <p
              style={{
                marginTop: "8px",
                fontWeight: "bold",
                borderTop: "1px dashed #ccc",
                paddingTop: "5px",
              }}
            >
              *** END OF REPORT ***
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(15,23,42,0.12)"};
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark
            ? "rgba(59,130,246,0.35)"
            : "rgba(59,130,246,0.35)"};
        }
      `}</style>
    </div>
  );
};

export default SalesPerProductModal;
