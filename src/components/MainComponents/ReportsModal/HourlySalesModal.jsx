import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FaClock,
  FaSyncAlt,
  FaTimes,
  FaFileExcel,
  FaCalendarAlt,
  FaArrowRight,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaTable,
  FaSearch,
  FaBox,
} from "react-icons/fa";
import * as XLSX from "xlsx";

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

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
      className="absolute left-0 top-full z-[100005] mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <h4 className="text-lg font-semibold text-slate-900">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-medium text-slate-500">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {[...Array(firstDayOfMonth)].map((_, i) => (
          <div key={i} />
        ))}

        {[...Array(daysInMonth(currentView.getFullYear(), currentView.getMonth()))].map(
          (_, i) => {
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
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                {day}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
};

const HourlySalesModal = ({ isOpen, onClose }) => {
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyProductData, setHourlyProductData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [viewMode, setViewMode] = useState("general");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [openStartCal, setOpenStartCal] = useState(false);
  const [openEndCal, setOpenEndCal] = useState(false);

  const hoursLabels = [
    "12AM",
    "1AM",
    "2AM",
    "3AM",
    "4AM",
    "5AM",
    "6AM",
    "7AM",
    "8AM",
    "9AM",
    "10AM",
    "11AM",
    "12PM",
    "1PM",
    "2PM",
    "3PM",
    "4PM",
    "5PM",
    "6PM",
    "7PM",
    "8PM",
    "9PM",
    "10PM",
    "11PM",
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost/api/reports_dashboard.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datefrom: dateFrom,
          dateto: dateTo,
          includeVoided: false,
        }),
      });

      const result = await response.json();

      if (result) {
        setHourlyData(result.hourlySales || []);
        setHourlyProductData(result.hourlySalesPerProduct || []);
      }
    } catch (err) {
      console.error(err);
      setHourlyData([]);
      setHourlyProductData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  const categories = useMemo(() => {
    const cats = hourlyProductData.map((item) => item.Category).filter(Boolean);
    return ["ALL", ...new Set(cats)];
  }, [hourlyProductData]);

  const filteredDisplayData = useMemo(() => {
    if (viewMode === "general") return hourlyData;

    return hourlyProductData.filter((item) => {
      const productName = String(item["Product Name"] || "").toLowerCase();
      const code = String(item.Code || "").toLowerCase();
      const matchesSearch =
        productName.includes(searchTerm.toLowerCase()) ||
        code.includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "ALL" || item.Category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [viewMode, hourlyData, hourlyProductData, searchTerm, selectedCategory]);

  const exportToExcel = () => {
    const rows = filteredDisplayData.map((item) => {
      const baseInfo =
        viewMode === "general"
          ? {
              Date: item.Date || "",
              "Total Sales": item["Total Sales"] || 0,
            }
          : {
              Code: item.Code || "",
              Category: item.Category || "",
              "Product Name": item["Product Name"] || "",
              "Total Qty": item.TOTAL || 0,
            };

      const hoursFlat = hoursLabels.reduce((acc, label, i) => {
        acc[label] = item.hours?.[i] || 0;
        return acc;
      }, {});

      return { ...baseInfo, ...hoursFlat };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hourly Report");
    XLSX.writeFile(
      workbook,
      `Hourly_${viewMode === "general" ? "Sales" : "Products"}_${dateFrom}.xlsx`,
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-md">
      <div className="relative flex h-[97vh] w-full max-w-[99%] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-[#f8fafc] shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="shrink-0 border-b border-slate-200 bg-white px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
                {viewMode === "general" ? <FaClock size={22} /> : <FaBox size={22} />}
              </div>

              <div>
                <div className="text-sm font-semibold text-blue-600">
                  Reports
                </div>

                <h2 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">
                  {viewMode === "general"
                    ? "Hourly Sales"
                    : "Hourly Product Sales"}
                </h2>

                <div className="mt-3 inline-flex items-center gap-3 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                  <span>Sta. Maria</span>
                  <FaArrowRight size={9} />
                  <span>{dateFrom}</span>
                  <FaArrowRight size={9} />
                  <span>{dateTo}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setViewMode(viewMode === "general" ? "product" : "general")
                }
                className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FaTable className="text-blue-500" size={13} />
                {viewMode === "general" ? "Product View" : "General View"}
              </button>

              <button
                onClick={exportToExcel}
                className="flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
              >
                <FaFileExcel size={14} />
                Export Excel
              </button>

              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-rose-500 hover:text-white"
              >
                <FaTimes size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 bg-slate-100/70 px-8 py-4">
          {viewMode === "product" ? (
            <div className="flex flex-1 gap-3">
              <div className="relative max-w-sm flex-1">
                <FaSearch
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={13}
                />
                <input
                  type="text"
                  placeholder="Search product or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">
              Hourly sales distribution
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={fetchData}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} size={15} />
            </button>

            <button
              onClick={() => setShowFilter(true)}
              className="flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <FaCalendarAlt size={13} />
              Filters
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-8 py-5">
          <div className="custom-scrollbar relative h-full overflow-auto rounded-[28px] border border-slate-200 bg-white">
            <table className="w-full min-w-[2000px] border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-[50]">
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="sticky left-0 top-0 z-[60] min-w-[220px] border-b border-slate-200 bg-slate-50 p-4">
                    {viewMode === "general" ? "Date" : "Product Details"}
                  </th>

                  <th className="min-w-[120px] border-b border-slate-200 bg-blue-50 p-4 text-center text-blue-700">
                    {viewMode === "general" ? "Total Sales" : "Total Qty"}
                  </th>

                  {hoursLabels.map((h, i) => (
                    <th
                      key={i}
                      className="min-w-[100px] border-b border-l border-slate-200 p-4 text-center"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDisplayData.length > 0 ? (
                  filteredDisplayData.map((item, idx) => (
                    <tr
                      key={idx}
                      className="text-sm transition hover:bg-blue-50/50"
                    >
                      <td className="sticky left-0 z-[40] max-w-[260px] border-r border-slate-100 bg-white p-4">
                        {viewMode === "general" ? (
                          <span className="font-semibold text-blue-600">
                            {item.Date}
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="truncate font-semibold text-slate-900">
                              {item["Product Name"]}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.Category} • {String(item.Code || "").slice(0, 8)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="border-r border-slate-100 bg-slate-50/50 p-4 text-center text-sm font-semibold text-slate-900">
                        {viewMode === "general"
                          ? peso(item["Total Sales"] || 0)
                          : Number(item.TOTAL || 0).toLocaleString()}
                      </td>

                      {(item.hours || []).map((val, hrIdx) => (
                        <td
                          key={hrIdx}
                          className={`border-l border-slate-100 p-4 text-center text-[11px] ${
                            val > 0 ? "text-slate-800" : "text-slate-300"
                          }`}
                        >
                          {val > 0
                            ? viewMode === "general"
                              ? peso(Math.round(val))
                              : Number(val).toLocaleString()
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={26}
                      className="p-16 text-center text-sm text-slate-400"
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs font-medium text-slate-400">Rows</p>
              <p className="text-2xl font-bold text-slate-900">
                {filteredDisplayData.length}
              </p>
            </div>

            <div className="h-10 w-px bg-slate-200" />

            <div>
              <p className="text-xs font-medium text-slate-400">Store</p>
              <p className="text-2xl font-bold text-blue-600">Sta. Maria</p>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-600 px-7 py-4 text-right shadow-lg">
            <span className="text-xs font-medium text-white/70">
              Active View
            </span>
            <h3 className="text-3xl font-bold text-white">
              {viewMode === "general" ? "Sales" : "Products"}
            </h3>
          </div>
        </div>

        {showFilter && (
          <div className="absolute inset-y-0 right-0 z-[100001] flex w-[420px] flex-col border-l border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-8 flex shrink-0 items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">Filters</h3>

              <button
                onClick={() => setShowFilter(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:text-rose-500"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-6">
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  From
                </label>

                <button
                  onClick={() => {
                    setOpenStartCal(!openStartCal);
                    setOpenEndCal(false);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 transition"
                >
                  <span className="font-medium">{dateFrom}</span>
                  <FaChevronDown className="text-slate-400" size={12} />
                </button>

                <CustomCalendar
                  selectedDate={dateFrom}
                  onChange={setDateFrom}
                  isOpen={openStartCal}
                  onClose={() => setOpenStartCal(false)}
                />
              </div>

              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  To
                </label>

                <button
                  onClick={() => {
                    setOpenEndCal(!openEndCal);
                    setOpenStartCal(false);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 transition"
                >
                  <span className="font-medium">{dateTo}</span>
                  <FaChevronDown className="text-slate-400" size={12} />
                </button>

                <CustomCalendar
                  selectedDate={dateTo}
                  onChange={setDateTo}
                  isOpen={openEndCal}
                  onClose={() => setOpenEndCal(false)}
                />
              </div>
            </div>

            <button
              onClick={() => {
                fetchData();
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
          background: rgba(15, 23, 42, 0.12);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};

export default HourlySalesModal;