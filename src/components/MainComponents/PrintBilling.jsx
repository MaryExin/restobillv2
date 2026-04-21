import React, { useEffect, useState, useRef } from "react";
import ModalTrans_List from "./ModalTrans_List";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaSearch,
  FaCalendarAlt,
  FaPrint,
  FaCheckCircle,
  FaClock,
  FaLayerGroup,
  FaChevronLeft,
  FaChevronRight,
  FaThLarge,
  FaList,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";

const PrintBilling = () => {
  const { themeSettings } = useTheme();
  const navigate = useNavigate();
  const dateInputRef = useRef(null);

  const [dateFrom, setDateFrom] = useState("");
  const [originalTableList, setOriginalTableList] = useState([]);
  const [tablelist, setTablelist] = useState([]);
  const [searchtable, setsearchtable] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [viewMode, setViewMode] = useState("grid");

  const [tableselected, settableselected] = useState("");
  const [transpertable, settranspertable] = useState([]);
  const [showtranslistpertable, setshowtranslistpertable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateLoading, setIsDateLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === "grid" ? 12 : 10;

  const handleCalendarClick = () => {
    return;
  };

  const apiHost = useApiHost();

  useEffect(() => {
    if (!apiHost) return;

    let isMounted = true;
    setIsDateLoading(true);

    fetch(`${apiHost}/api/get_open_shift_date.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;

        const backendDate = data?.selectedDate || data?.shiftDate || "";

        setDateFrom(backendDate);
        setCurrentPage(1);
        setIsDateLoading(false);
      })
      .catch((error) => {
        console.error("Fetch open shift date error:", error);
        if (!isMounted) return;
        setDateFrom("");
        setIsDateLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiHost]);

  useEffect(() => {
    if (!apiHost || !dateFrom) return;
    setIsLoading(true);

    fetch(`${apiHost}/api/table_list.php?date=${dateFrom}`)
      .then((res) => res.json())
      .then((data) => {
        const safeData = Array.isArray(data) ? data : [];
        const sorted = [...safeData].sort((a, b) => {
          const numA =
            parseInt(String(a.table_number || "").replace(/^\D+/g, "")) || 0;
          const numB =
            parseInt(String(b.table_number || "").replace(/^\D+/g, "")) || 0;
          return numA - numB;
        });
        setOriginalTableList(sorted);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        setIsLoading(false);
      });
  }, [apiHost, dateFrom]);

  useEffect(() => {
    let filtered = originalTableList.filter((table) =>
      table.table_number
        .toString()
        .toLowerCase()
        .includes(searchtable.toLowerCase()),
    );

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (table) =>
          table.status_label?.toLowerCase() === statusFilter.toLowerCase(),
      );
    }
    setTablelist(filtered);
    setCurrentPage(1);
  }, [searchtable, statusFilter, originalTableList]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = tablelist.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(tablelist.length / itemsPerPage);

  const table_trasaction = (table_number) => {
    if (!apiHost || !dateFrom) return;

    const params = new URLSearchParams({
      date: dateFrom,
      table_number: table_number,
    });

    fetch(`${apiHost}/api/transactio_per_table.php?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transaction per table");
        return res.json();
      })
      .then((data) => {
        settranspertable(Array.isArray(data) ? data : data.data || []);
        settableselected(table_number);
        setshowtranslistpertable(true);
      })
      .catch((error) => {
        console.error("table_trasaction fetch error:", error);
        settranspertable([]);
      });
  };

  const FilterChip = ({ label, value, icon: Icon }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className="flex items-center gap-2 rounded-full border px-6 py-2 transition-all duration-300"
      style={{
        backgroundColor:
          statusFilter === value ? "var(--app-accent)" : "var(--app-surface)",
        borderColor:
          statusFilter === value ? "var(--app-accent)" : "var(--app-border)",
        color: statusFilter === value ? "#ffffff" : "var(--app-muted-text)",
        boxShadow:
          statusFilter === value ? "0 0 15px var(--app-accent-glow)" : "none",
      }}
    >
      <Icon size={12} />
      <span className="text-xs font-bold uppercase tracking-widest">
        {label}
      </span>
    </button>
  );

  return (
    <div
      className="min-h-screen p-4 text-[var(--app-text)] sm:p-8"
      style={{
        backgroundColor: "var(--app-bg)",
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{
          backgroundImage: `url(${
            themeSettings?.Dashboard_Background_Url
              ? themeSettings.Dashboard_Background_Url.startsWith("/")
                ? `${apiHost}${themeSettings.Dashboard_Background_Url}`
                : `${apiHost}/${themeSettings.Dashboard_Background_Url}`
              : "./pos-home-bg.png"
          })`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          opacity: 0.08,
        }}
      />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full blur-[120px]"
          style={{ backgroundColor: "var(--app-accent-glow)" }}
        />
      </div>

      <AnimatePresence>
        {showtranslistpertable && (
          <ModalTrans_List
            tableselected={tableselected}
            data={transpertable}
            setshowtranslistpertable={setshowtranslistpertable}
            dateFrom={dateFrom}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-[90vh] max-w-7xl flex-col">
        <nav className="mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate("/poscorehomescreen")}
            className="mt-2 flex items-center gap-3 rounded-full border px-10 py-6 transition-all"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--app-muted-text)",
            }}
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-bold uppercase">
              BACK TO DASHBOARD
            </span>
          </button>
          <div
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--app-accent)" }}
          >
            <FaPrint /> Billing Center
          </div>
        </nav>

        <header className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 text-4xl font-black sm:text-5xl">
              Print Billing
            </h1>
            <p style={{ color: "var(--app-muted-text)" }}>
              Showing {tablelist.length} tables found for this date.
            </p>
          </div>

          <div
            className="flex rounded-2xl border p-1.5"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              className="flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
              style={{
                backgroundColor:
                  viewMode === "grid" ? "var(--app-accent)" : "transparent",
                color:
                  viewMode === "grid" ? "#ffffff" : "var(--app-muted-text)",
                boxShadow:
                  viewMode === "grid"
                    ? "0 12px 28px var(--app-accent-glow)"
                    : "none",
              }}
            >
              <FaThLarge size={14} />
              <span className="text-[10px] font-bold uppercase"></span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
              style={{
                backgroundColor:
                  viewMode === "list" ? "var(--app-accent)" : "transparent",
                color:
                  viewMode === "list" ? "#ffffff" : "var(--app-muted-text)",
                boxShadow:
                  viewMode === "list"
                    ? "0 12px 28px var(--app-accent-glow)"
                    : "none",
              }}
            >
              <FaList size={14} />
              <span className="text-[10px] font-bold uppercase"></span>
            </button>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="group relative" onClick={handleCalendarClick}>
            <FaCalendarAlt
              className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2"
              style={{ color: "var(--app-muted-text)" }}
            />
            <input
              ref={dateInputRef}
              type="text"
              value={isDateLoading ? "Loading..." : dateFrom || "No open shift"}
              readOnly
              className="w-full rounded-2xl border py-4 pl-12 pr-4"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-text)",
              }}
            />
          </div>

          <div className="group relative">
            <FaSearch
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--app-muted-text)" }}
            />
            <input
              type="text"
              placeholder="Search table number..."
              value={searchtable}
              onChange={(e) => setsearchtable(e.target.value)}
              className="w-full rounded-2xl border py-4 pl-12 pr-4"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-text)",
              }}
            />
          </div>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          <FilterChip label="All" value="all" icon={FaLayerGroup} />
          <FilterChip label="Pending" value="pending" icon={FaClock} />
          <FilterChip label="Paid" value="paid" icon={FaCheckCircle} />
        </div>

        <main className="flex-grow">
          {isLoading || isDateLoading ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-[2rem] border"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                  }}
                />
              ))}
            </div>
          ) : viewMode === "grid" ? (
            <motion.div
              layout
              className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
            >
              {currentItems.map((table, index) => {
                const isPending =
                  table.status_label?.toLowerCase() === "pending";
                return (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    key={index}
                    onClick={() => table_trasaction(table.table_number)}
                    className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[2rem] border shadow-xl transition-all"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: "var(--app-border)",
                    }}
                  >
                    <span
                      className="text-[10px] font-black uppercase"
                      style={{ color: "var(--app-muted-text)" }}
                    >
                      Table
                    </span>
                    <span className="text-4xl font-black">
                      {String(table.table_number || "")}
                    </span>
                    <div
                      className={`absolute top-4 right-4 h-3 w-3 rounded-full ${
                        isPending
                          ? "animate-pulse bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span
                      className={`absolute bottom-4 text-[9px] font-bold uppercase tracking-widest ${
                        isPending ? "text-amber-500" : "text-emerald-500"
                      }`}
                    >
                      {table.status_label}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div layout className="flex flex-col gap-3">
              {currentItems.map((table, index) => {
                const isPending =
                  table.status_label?.toLowerCase() === "pending";
                return (
                  <motion.button
                    layout
                    key={index}
                    onClick={() => table_trasaction(table.table_number)}
                    className="flex items-center justify-between rounded-3xl border p-4 transition-all"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: "var(--app-border)",
                    }}
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black"
                        style={{
                          backgroundColor: "var(--app-surface-soft)",
                          color: "var(--app-text)",
                        }}
                      >
                        {String(table.table_number || "").replace(/^\D+/g, "")}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black uppercase">
                          Table {table.table_number}
                        </p>
                        <p
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: "var(--app-muted-text)" }}
                        >
                          Ready for billing
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-3 rounded-full border px-5 py-2 ${
                        isPending
                          ? "border-amber-500/20 bg-amber-500/5 text-amber-500"
                          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isPending
                            ? "animate-pulse bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {table.status_label}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {!isLoading && !isDateLoading && currentItems.length === 0 && (
            <div
              className="rounded-3xl border-2 border-dashed py-20 text-center"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
              }}
            >
              <p
                className="font-bold uppercase tracking-widest"
                style={{ color: "var(--app-muted-text)" }}
              >
                No Tables Found
              </p>
            </div>
          )}
        </main>

        {totalPages > 1 && (
          <div className="mt-12 mb-6 flex items-center justify-center gap-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-full border p-4 transition-all disabled:cursor-not-allowed disabled:opacity-20"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-muted-text)",
              }}
            >
              <FaChevronLeft />
            </button>

            <div className="flex items-center gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className="h-10 w-10 rounded-xl text-xs font-bold transition-all"
                  style={{
                    backgroundColor:
                      currentPage === i + 1
                        ? "var(--app-accent)"
                        : "var(--app-surface)",
                    color:
                      currentPage === i + 1
                        ? "#ffffff"
                        : "var(--app-muted-text)",
                    border:
                      currentPage === i + 1
                        ? "none"
                        : "1px solid var(--app-border)",
                    boxShadow:
                      currentPage === i + 1
                        ? "0 12px 28px var(--app-accent-glow)"
                        : "none",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="rounded-full border p-4 transition-all disabled:cursor-not-allowed disabled:opacity-20"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-muted-text)",
              }}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintBilling;
