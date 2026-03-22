import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaCalendarAlt,
  FaFileExcel,
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
      className={`absolute left-0 top-full z-[100005] mt-2 w-[320px] rounded-2xl border p-5 shadow-2xl ${
        isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <h4
          className={`text-lg font-semibold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {monthNames[currentView.getMonth()]} {currentView.getFullYear()}
        </h4>

        <div className="flex gap-1">
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
                ? "bg-white/5 text-white hover:bg-white/10"
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
                ? "bg-white/5 text-white hover:bg-white/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      </div>

      <div
        className={`mb-2 grid grid-cols-7 text-center text-[11px] font-medium ${
          isDark ? "text-slate-400" : "text-slate-500"
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

const DailySalesModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("Active");
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
            includeVoided: status === "All" || status === "Voided",
            voidOnly: status === "Voided",
          }),
        },
      );

      const result = await response.json();
      if (result && result.dailySales) {
        setSalesData(result.dailySales);
      } else {
        setSalesData([]);
      }
    } catch (err) {
      console.error(err);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen, fetchSales]);

  const filtered = salesData.filter((item) =>
    item.Date?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalNet = filtered.reduce(
    (sum, item) => sum + parseFloat(item["Net Sales"] || 0),
    0,
  );

  const handleExportExcel = () => {
    const rows = filtered.map((item) => ({
      Date: item.Date || "",
      "Gross Sales": item["Gross Sales"] || 0,
      "SRC Disc.": item["SRC Disc."] || 0,
      "PWD Disc.": item["PWD Disc."] || 0,
      "Other Disc.": item["Other Disc."] || 0,
      "Cash Payment": item["Cash Payment"] || 0,
      "GCash Payment": item["GCash Payment"] || 0,
      "Maya Payment": item["Maya Payment"] || 0,
      "VAT Amount": item["VAT Amount"] || 0,
      "Net Sales": item["Net Sales"] || 0,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Sales");
    XLSX.writeFile(workbook, "Daily_Sales.xlsx");
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100000] flex items-center justify-center p-3 backdrop-blur-md ${
        isDark ? "bg-slate-950/90" : "bg-slate-900/35"
      }`}
    >
      <div
        className={`relative flex h-[97vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_90px_rgba(15,23,42,0.18)] ${
          isDark
            ? "border-white/10 bg-[#020617]"
            : "border-slate-200 bg-[#f8fafc]"
        }`}
      >
        <div
          className={`shrink-0 border-b px-8 py-6 ${
            isDark
              ? "border-white/10 bg-white/[0.03]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className={`text-sm font-semibold ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              >
                Reports
              </div>
              <h2
                className={`mt-1 text-3xl font-bold sm:text-4xl ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Daily Sales
              </h2>

              <div
                className={`mt-3 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium ${
                  isDark
                    ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                    : "border-blue-100 bg-blue-50 text-blue-700"
                }`}
              >
                <FaCalendarAlt size={13} />
                <span>{dateFrom}</span>
                <FaArrowRight size={9} />
                <span>{dateTo}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                  isDark
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                <FaFileExcel size={14} />
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
          className={`flex shrink-0 items-center gap-4 px-8 py-4 ${
            isDark ? "bg-[#050a18]/40" : "bg-slate-100/70"
          }`}
        >
          <div className="relative flex-1">
            <FaSearch
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
              size={14}
            />
            <input
              type="text"
              placeholder="Search date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm font-medium outline-none transition ${
                isDark
                  ? "border-white/10 bg-[#0a0f1e] text-white placeholder:text-slate-500 focus:border-blue-500/50"
                  : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-blue-500"
              }`}
            />
          </div>

          <button
            onClick={fetchSales}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
              isDark
                ? "border-white/10 bg-[#0a0f1e] text-white hover:bg-white/10"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} size={15} />
          </button>

          <button
            onClick={() => setShowFilter(true)}
            className="flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <FaFilter size={13} />
            Filters
          </button>
        </div>

        <div className="flex-1 overflow-hidden px-8 py-5">
          <div
            className={`relative h-full overflow-auto rounded-[28px] border custom-scrollbar ${
              isDark
                ? "border-white/10 bg-[#050a18]"
                : "border-slate-200 bg-white"
            }`}
          >
            <table className="min-w-[1500px] w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-[50]">
                <tr
                  className={`text-[11px] font-semibold ${
                    isDark
                      ? "bg-[#0a0f1e] text-slate-400"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <th
                    className={`sticky left-0 top-0 z-[60] border-b p-4 ${
                      isDark
                        ? "border-white/10 bg-[#0a0f1e]"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    Date
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    Gross
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    SRC Disc
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    PWD Disc
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    Others
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    Cash
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    GCash
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    Maya
                  </th>
                  <th
                    className={`border-b p-4 ${isDark ? "border-white/10" : "border-slate-200"}`}
                  >
                    VAT
                  </th>
                  <th
                    className={`border-b p-4 text-right ${
                      isDark ? "border-white/10" : "border-slate-200"
                    }`}
                  >
                    Net Sales
                  </th>
                </tr>
              </thead>

              <tbody
                className={`divide-y ${
                  isDark
                    ? "divide-white/5 text-slate-300"
                    : "divide-slate-100 text-slate-700"
                }`}
              >
                {filtered.length > 0 ? (
                  filtered.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`text-sm transition ${
                        isDark ? "hover:bg-white/[0.03]" : "hover:bg-blue-50/50"
                      }`}
                    >
                      <td
                        className={`sticky left-0 z-[40] border-r p-4 font-semibold ${
                          isDark
                            ? "border-white/5 bg-[#050a18] text-blue-400"
                            : "border-slate-100 bg-white text-blue-600"
                        }`}
                      >
                        {item.Date}
                      </td>
                      <td className="p-4">{peso(item["Gross Sales"] || 0)}</td>
                      <td className="p-4 text-rose-500">
                        -{Number(item["SRC Disc."] || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-rose-500">
                        -{Number(item["PWD Disc."] || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-slate-500">
                        -{Number(item["Other Disc."] || 0).toFixed(2)}
                      </td>
                      <td className="p-4">{peso(item["Cash Payment"] || 0)}</td>
                      <td className="p-4">
                        {peso(item["GCash Payment"] || 0)}
                      </td>
                      <td className="p-4">{peso(item["Maya Payment"] || 0)}</td>
                      <td className="p-4">{peso(item["VAT Amount"] || 0)}</td>
                      <td
                        className={`p-4 text-right text-base font-semibold ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {peso(item["Net Sales"] || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className={`p-10 text-center text-sm ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No sales data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className={`flex shrink-0 items-center justify-between border-t px-8 py-5 ${
            isDark ? "border-white/10 bg-black/20" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-8">
            <div>
              <p
                className={`text-xs font-medium ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Entries
              </p>
              <p
                className={`text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {filtered.length}
              </p>
            </div>

            <div
              className={`h-10 w-px ${isDark ? "bg-white/10" : "bg-slate-200"}`}
            />

            <div>
              <p
                className={`text-xs font-medium ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Status
              </p>
              <p className="text-2xl font-bold text-emerald-500">Synced</p>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-600 px-7 py-4 text-right shadow-lg">
            <span className="text-xs font-medium text-white/70">
              Net Revenue
            </span>
            <h3 className="text-3xl font-bold text-white">{peso(totalNet)}</h3>
          </div>
        </div>

        {showFilter && (
          <div
            className={`absolute inset-y-0 right-0 z-[100001] flex w-[420px] flex-col border-l p-8 shadow-2xl ${
              isDark
                ? "border-white/10 bg-[#0a0f1e]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-8 flex items-center justify-between shrink-0">
              <h3
                className={`text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Filters
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
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  From
                </label>

                <button
                  onClick={() => {
                    setOpenStartCal(!openStartCal);
                    setOpenEndCal(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-medium">{dateFrom}</span>
                  <FaChevronDown className="text-slate-400" size={12} />
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
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  To
                </label>

                <button
                  onClick={() => {
                    setOpenEndCal(!openEndCal);
                    setOpenStartCal(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-medium">{dateTo}</span>
                  <FaChevronDown className="text-slate-400" size={12} />
                </button>

                <CustomCalendar
                  selectedDate={dateTo}
                  onChange={setDateTo}
                  isOpen={openEndCal}
                  onClose={() => setOpenEndCal(false)}
                  isDark={isDark}
                />
              </div>

              <div>
                <label
                  className={`mb-3 block text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Status
                </label>

                <div
                  className={`grid grid-cols-1 gap-2 rounded-2xl p-1 ${
                    isDark ? "bg-black/20" : "bg-slate-100"
                  }`}
                >
                  {["Active", "Voided", "All"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`h-11 rounded-xl text-sm font-medium transition ${
                        status === s
                          ? "bg-blue-600 text-white shadow"
                          : isDark
                            ? "text-slate-400 hover:bg-white/10 hover:text-white"
                            : "bg-white text-slate-600 hover:text-blue-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                fetchSales();
                setShowFilter(false);
              }}
              className="mt-8 rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99]"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(15,23,42,0.12)"};
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};

export default DailySalesModal;
