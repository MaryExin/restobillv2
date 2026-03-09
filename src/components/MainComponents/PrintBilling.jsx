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
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";
const PrintBilling = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const dateInputRef = useRef(null);

  // const [apiHost, setApiHost] = useState("");
  const [dateFrom, setDateFrom] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [originalTableList, setOriginalTableList] = useState([]);
  const [tablelist, setTablelist] = useState([]);
  const [searchtable, setsearchtable] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const [tableselected, settableselected] = useState("");
  const [transpertable, settranspertable] = useState([]);
  const [showtranslistpertable, setshowtranslistpertable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Adjusted for a nice 6x2 or 4x3 grid

  const handleCalendarClick = () => {
    if (
      dateInputRef.current &&
      typeof dateInputRef.current.showPicker === "function"
    ) {
      dateInputRef.current.showPicker();
    }
  };

// useEffect(() => {
//   fetch("./ip.txt")
//     .then((res) => res.text())
//     .then((data) => setApiHost(data.trim()));
// }, []);
const apiHost = useApiHost();

  useEffect(() => {
    if (!apiHost) return;
    setIsLoading(true);
    fetch(`${apiHost}/api/table_list.php?date=${dateFrom}`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const numA = parseInt(a.table_number.replace(/^\D+/g, "")) || 0;
          const numB = parseInt(b.table_number.replace(/^\D+/g, "")) || 0;
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

  // Handle Filtering and Reset Page to 1 on Search/Filter
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
    setCurrentPage(1); // Reset to first page when filtering
  }, [searchtable, statusFilter, originalTableList]);

  // --- PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = tablelist.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(tablelist.length / itemsPerPage);

  const table_trasaction = (table_number) => {
    if (!apiHost) return;
    fetch(
      `${apiHost}/api/transactio_per_table.php?date=${dateFrom}&table_number=${table_number}`,
    )
      .then((res) => res.json())
      .then((data) => {
        settranspertable(data);
        settableselected(table_number);
        setshowtranslistpertable(true);
      });
  };

  const FilterChip = ({ label, value, icon: Icon }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`flex items-center gap-2 px-6 py-2 rounded-full border transition-all duration-300 ${
        statusFilter === value
          ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600"
      }`}
    >
      <Icon size={12} />
      <span className="text-xs font-bold uppercase tracking-widest">
        {label}
      </span>
    </button>
  );

  return (
    <div className={isDark ? "min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-8" : "min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8"}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDark ? "bg-blue-600/10" : "bg-blue-600/15"}`} />
      </div>

      <AnimatePresence>
        {showtranslistpertable && (
          <ModalTrans_List
            tableselected={tableselected}
            data={transpertable}
            setshowtranslistpertable={setshowtranslistpertable}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col min-h-[90vh]">
        <nav className="mb-8 flex justify-between items-center">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-3 mt-2 px-10 py-6 rounded-full transition-all ${isDark ? "bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"}`}
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-bold uppercase">Back To Menu</span>
          </button>
          <div className="text-blue-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
            <FaPrint /> Billing Center
          </div>
        </nav>

        <header className="mb-10">
          <h1 className={`text-4xl sm:text-5xl font-black mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            Print Billing
          </h1>
          <p className="text-slate-400">
            Showing {tablelist.length} tables found for this date.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            className="relative group cursor-pointer"
            onClick={handleCalendarClick}
          >
            <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 pointer-events-none z-20" />
            <input
              ref={dateInputRef}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500/40 cursor-pointer ${isDark ? "bg-slate-900/50 border border-slate-800 text-white [color-scheme:dark]" : "bg-white border border-slate-200 text-slate-900 [color-scheme:light] shadow-sm"}`}
            />
          </div>

          <div className="relative group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search table number..."
              value={searchtable}
              onChange={(e) => setsearchtable(e.target.value)}
              className={`w-full rounded-2xl py-4 pl-12 pr-4 ${isDark ? "bg-slate-900/50 border border-slate-800 text-white" : "bg-white border border-slate-200 text-slate-900 shadow-sm"}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          <FilterChip label="All" value="all" icon={FaLayerGroup} />
          <FilterChip label="Pending" value="pending" icon={FaClock} />
          <FilterChip label="Paid" value="paid" icon={FaCheckCircle} />
        </div>

        <main className="flex-grow">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[2rem] bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4"
            >
              {currentItems.map((table, index) => {
                const isPending =
                  table.status_label?.toLowerCase() === "pending";
                return (
                  <motion.button
                    layout
                    whileHover={{ y: -5 }}
                    key={index}
                    onClick={() => table_trasaction(table.table_number)}
                    className="aspect-square rounded-[2rem] bg-slate-900/40 border border-white/5 hover:border-blue-500/50 flex flex-col items-center justify-center relative overflow-hidden transition-all shadow-xl"
                  >
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                      Table
                    </span>
                    <span className="text-4xl font-black text-white">
                      {table.table_number.replace(/^\D+/g, "")}
                    </span>
                    <div
                      className={`absolute top-4 right-4 w-3 h-3 rounded-full ${isPending ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
                    />
                    <span
                      className={`absolute bottom-4 text-[9px] font-bold uppercase tracking-widest ${isPending ? "text-amber-500" : "text-emerald-500"}`}
                    >
                      {table.status_label}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* NO RESULTS STATE */}
          {!isLoading && currentItems.length === 0 && (
            <div className="text-center py-20 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-3xl">
              <p className="text-slate-500 font-bold uppercase tracking-widest">
                No Tables Found
              </p>
            </div>
          )}
        </main>

        {/* --- PAGINATION CONTROLS --- */}
        {totalPages > 1 && (
          <div className="mt-12 mb-6 flex items-center justify-center gap-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="p-4 rounded-full bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <FaChevronLeft />
            </button>

            <div className="flex items-center gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-xl font-bold text-xs transition-all ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "bg-slate-900/50 text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="p-4 rounded-full bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
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
