import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Orderlist from "./Orderlist";
import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaArrowLeft,
  FaLayerGroup,
  FaPlus,
  FaCheck,
  FaThLarge,
  FaList,
} from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";

const ViewOrdering = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  // --- New State for View Switching ---
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"

  const [originalTableList, setOriginalTableList] = useState([]);
  const [masterTableList, setMasterTableList] = useState([]);

  const [searchTable, setSearchTable] = useState("");
  const [tableselected, settableselected] = useState("");
  const [showorderlist, setshoworderlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState("");
  const [isDateLoading, setIsDateLoading] = useState(true);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPendingConfirmModal, setShowPendingConfirmModal] = useState(false);
  const [pendingTableToOpen, setPendingTableToOpen] = useState("");
  const [tableMode, setTableMode] = useState("fixed");
  const [fixedSearch, setFixedSearch] = useState("");
  const [selectedFixedTable, setSelectedFixedTable] = useState("");
  const [customTableNumber, setCustomTableNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 15;
  const apiHost = useApiHost();

  const sortFloorTables = (list) => {
    return [...list].sort((a, b) =>
      String(a.table_number).localeCompare(String(b.table_number), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  };

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

        setSelectedDate(backendDate);
        setCurrentPage(1);
        setIsDateLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedDate("");
        setIsDateLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiHost]);

  useEffect(() => {
    if (!apiHost || !selectedDate) return;

    const loadTables = () => {
      fetch(
        `${apiHost}/api/table_list.php?date=${selectedDate}&onlyPending=true`,
      )
        .then((res) => res.json())
        .then((data) => {
          setOriginalTableList(
            sortFloorTables(Array.isArray(data) ? data : []),
          );
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    };

    setIsLoading(true);
    loadTables();

    const interval = setInterval(loadTables, 3000);
    return () => clearInterval(interval);
  }, [apiHost, selectedDate]);

  const filteredTables = useMemo(() => {
    return sortFloorTables(
      originalTableList.filter((table) =>
        String(table.table_number).includes(searchTable),
      ),
    );
  }, [searchTable, originalTableList]);

  const totalPages = Math.ceil(filteredTables.length / itemsPerPage);
  const currentTables = filteredTables.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const filteredMasterTables = useMemo(() => {
    return [...masterTableList].filter((table) =>
      String(table.table_name || "")
        .toLowerCase()
        .includes(fixedSearch.toLowerCase()),
    );
  }, [fixedSearch, masterTableList]);

  const openOrderList = (tableValue, txId = "") => {
    settableselected(tableValue);
    setTransactionId(txId || "");
    setshoworderlist(true);
  };

  const handleTableSelect = (table) => {
    const tableValue = table.table_number;
    const status = String(table.status_label || "").toLowerCase();
    const txId = table.transaction_id || "";

    if (status === "pending") {
      setPendingTableToOpen(tableValue);
      setTransactionId(txId);
      setShowPendingConfirmModal(true);
      return;
    }

    openOrderList(tableValue, "");
  };

  const handleConfirmPendingOrder = () => {
    if (!pendingTableToOpen) return;

    openOrderList(pendingTableToOpen, transactionId);

    setPendingTableToOpen("");
    setShowPendingConfirmModal(false);
  };

  const handleCancelPendingOrder = () => {
    setPendingTableToOpen("");
    setShowPendingConfirmModal(false);
  };

  const resetOrderModal = () => {
    setShowOrderModal(false);
    setTableMode("fixed");
    setFixedSearch("");
    setSelectedFixedTable("");
    setCustomTableNumber("");
    setTransactionId("");
  };

  const handleOpenOrderModal = () => {
    if (!apiHost) return;

    fetch(`${apiHost}/api/master_table_list.php`)
      .then((res) => res.json())
      .then((data) => {
        setMasterTableList(Array.isArray(data) ? data : []);
        setShowOrderModal(true);
      })
      .catch(() => {
        setMasterTableList([]);
        setShowOrderModal(true);
      });
  };

  const handleOpenOrder = () => {
    let value = "";

    if (tableMode === "fixed") {
      value = selectedFixedTable;
    } else {
      const customValue = customTableNumber.trim();
      if (!customValue) return;
      value = `Table ${customValue}`;
    }

    if (!value) return;

    openOrderList(value, "");
    resetOrderModal();
  };

  return (
    <div
      className={`min-h-screen selection:bg-blue-500/20 overflow-x-hidden pb-20 ${
        isDark
          ? "bg-[#020617] text-slate-200 selection:bg-blue-500/30"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none">
        <div
          className={`absolute top-[-5%] left-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-blue-600/5" : "bg-blue-600/10"
          }`}
        />
        <div
          className={`absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[100px] ${
            isDark ? "bg-indigo-600/5" : "bg-indigo-600/10"
          }`}
        />
      </div>

      <AnimatePresence>
        {showorderlist && (
          <Orderlist
            tableselected={tableselected}
            setshoworderlist={setshoworderlist}
            dateSelected={selectedDate}
            transactionId={transactionId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPendingConfirmModal && (
          <motion.div
            className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4 ${
              isDark ? "bg-black/60" : "bg-slate-900/30"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-md rounded-[2rem] p-6 shadow-2xl ${
                isDark
                  ? "bg-slate-950 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <h2
                className={`text-xl font-black mb-3 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Pending Billing
              </h2>
              <p
                className={`leading-relaxed ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                This table has a pending bill. Do you want to proceed and edit
                the existing order?
              </p>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleCancelPendingOrder}
                  className={`flex-1 rounded-2xl px-5 py-4 transition-all ${
                    isDark
                      ? "bg-slate-800 text-slate-300 hover:text-white"
                      : "bg-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmPendingOrder}
                  className="flex-1 px-5 py-4 font-bold text-white transition-all bg-blue-600 rounded-2xl hover:bg-blue-500"
                >
                  Proceed
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderModal && (
          <motion.div
            className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4 ${
              isDark ? "bg-black/60" : "bg-slate-900/30"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-xl rounded-[2rem] p-6 shadow-2xl ${
                isDark
                  ? "bg-slate-950 border border-white/10"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2
                    className={`text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Add Order
                  </h2>
                  <p
                    className={`text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Choose fixed table or enter custom table.
                  </p>
                </div>

                <button
                  onClick={resetOrderModal}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-800"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FiX size={18} />
                </button>
              </div>

              <div
                className={`grid grid-cols-2 gap-2 mb-5 p-1.5 rounded-2xl ${
                  isDark
                    ? "bg-slate-900/40 border border-white/5"
                    : "bg-slate-100 border border-slate-200"
                }`}
              >
                <button
                  onClick={() => setTableMode("fixed")}
                  className={`rounded-2xl px-4 py-3 font-bold transition-all ${
                    tableMode === "fixed"
                      ? "bg-blue-600 text-white"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Fixed Table
                </button>
                <button
                  onClick={() => setTableMode("custom")}
                  className={`rounded-2xl px-4 py-3 font-bold transition-all ${
                    tableMode === "custom"
                      ? "bg-blue-600 text-white"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Custom Table
                </button>
              </div>

              {tableMode === "fixed" ? (
                <div className="space-y-4">
                  <div className="relative group">
                    <FaSearch
                      className={`absolute left-5 top-1/2 -translate-y-1/2 ${
                        isDark ? "text-slate-600" : "text-slate-400"
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Search fixed table..."
                      value={fixedSearch}
                      onChange={(e) => setFixedSearch(e.target.value)}
                      className={`w-full rounded-2xl py-4 pl-14 pr-5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                        isDark
                          ? "bg-slate-900/50 border border-slate-800 text-white focus:border-blue-500/40"
                          : "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-400"
                      }`}
                    />
                  </div>

                  <div
                    className={`max-h-64 overflow-y-auto rounded-2xl ${
                      isDark
                        ? "border border-white/5 bg-slate-900/30"
                        : "border border-slate-200 bg-slate-50"
                    }`}
                  >
                    {filteredMasterTables.length > 0 ? (
                      filteredMasterTables.map((table) => {
                        const isSelected =
                          String(selectedFixedTable) ===
                          String(table.table_name);

                        return (
                          <button
                            key={table.ID ?? table.table_name}
                            type="button"
                            onClick={() =>
                              setSelectedFixedTable(table.table_name)
                            }
                            className={`w-full flex items-center justify-between px-5 py-4 text-left transition-all last:border-b-0 ${
                              isSelected
                                ? "bg-blue-600/20 text-blue-700 dark:text-white"
                                : isDark
                                  ? "text-slate-300 hover:bg-slate-800/60 border-b border-white/5"
                                  : "text-slate-700 hover:bg-slate-100 border-b border-slate-200"
                            }`}
                          >
                            <span className="font-semibold">
                              {table.table_name}
                            </span>
                            {isSelected && <FaCheck size={12} />}
                          </button>
                        );
                      })
                    ) : (
                      <div
                        className={`px-5 py-4 ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        No fixed table found.
                      </div>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl px-5 py-4 ${
                      isDark
                        ? "bg-slate-900/40 border border-white/5"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}
                    >
                      Selected
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {selectedFixedTable || "None"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label
                      className={`block text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}
                    >
                      Custom Number
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. 01/02/02"
                      value={customTableNumber}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(
                          /[^a-zA-Z0-9&,/\s-]/g,
                          "",
                        );
                        setCustomTableNumber(sanitized);
                      }}
                      className={`w-full rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                        isDark
                          ? "bg-slate-900/50 border border-slate-800 text-white focus:border-blue-500/40"
                          : "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-400"
                      }`}
                    />
                  </div>

                  <div
                    className={`rounded-2xl px-5 py-4 ${
                      isDark
                        ? "bg-slate-900/40 border border-white/5"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}
                    >
                      Preview
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Table {customTableNumber || "00"}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-5">
                <button
                  onClick={resetOrderModal}
                  className={`flex-1 rounded-2xl px-5 py-4 transition-all ${
                    isDark
                      ? "bg-slate-800 text-slate-300 hover:text-white"
                      : "bg-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>

                <button
                  onClick={handleOpenOrder}
                  className="flex-1 px-5 py-4 font-bold text-white transition-all bg-blue-600 rounded-2xl hover:bg-blue-500"
                >
                  Open Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className={`sticky top-0 z-40 backdrop-blur-xl px-4 py-4 mb-8 ${
          isDark
            ? "bg-slate-950/60 border-b border-white/5"
            : "bg-white/80 border-b border-slate-200/80 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mx-auto max-w-7xl">
          <button
            onClick={() => navigate("/poscorehomescreen")}
            className={`flex items-center gap-3 mt-2 px-10 py-6 rounded-full transition-all ${
              isDark
                ? "bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
            }`}
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-bold uppercase">BACK TO DASHBOARD</span>
          </button>

          <div className="flex items-center gap-4">
            {/* --- VIEW SWITCHER --- */}
            <div
              className={`flex p-1 rounded-2xl ${isDark ? "bg-slate-900/80 border border-white/5" : "bg-slate-100 border border-slate-200"}`}
            >
              <button
                onClick={() => setViewMode("card")}
                className={`p-2.5 rounded-xl transition-all ${viewMode === "card" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:text-slate-400"}`}
              >
                <FaThLarge size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2.5 rounded-xl transition-all ${viewMode === "table" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:text-slate-400"}`}
              >
                <FaList size={14} />
              </button>
            </div>

            <div className="items-center hidden gap-2 sm:flex">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                Live Floor
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 px-6 mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-8 mb-10 lg:flex-row lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1
              className={`text-4xl md:text-6xl font-black tracking-tighter mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Pending <span className="text-blue-500">Tables</span>
            </h1>
            <p className="font-medium text-slate-500">
              Click a table to manage guest orders.
            </p>
          </motion.div>

          <div className="flex flex-col w-full gap-3 lg:flex-row lg:w-auto lg:items-center">
            <div
              className={`rounded-[2rem] px-6 py-4 backdrop-blur-sm w-full lg:w-auto ${
                isDark
                  ? "bg-slate-900/30 border border-slate-800 hover:border-slate-700"
                  : "bg-white border border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
                Date
              </label>
              <div
                className={`min-w-[140px] ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {isDateLoading ? "Loading..." : selectedDate || "No open shift"}
              </div>
            </div>

            <div className="relative w-full group lg:w-96">
              <FaSearch className="absolute z-20 transition-colors -translate-y-1/2 left-5 top-1/2 text-slate-600 group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Jump to table..."
                value={searchTable}
                onChange={(e) => {
                  setSearchTable(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full rounded-[2rem] py-5 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all backdrop-blur-sm ${
                  isDark
                    ? "bg-slate-900/30 border border-slate-800 hover:border-slate-700 text-white"
                    : "bg-white border border-slate-200 hover:border-slate-300 text-slate-900 shadow-sm"
                }`}
              />
            </div>

            <button
              onClick={handleOpenOrderModal}
              className="flex items-center justify-center gap-3 px-6 py-5 bg-blue-600 text-white rounded-[2rem] font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
            >
              <FaPlus size={12} />
              Order
            </button>
          </div>
        </header>

        <main className="min-h-[50vh]">
          {isLoading || isDateLoading ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 md:gap-6">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`aspect-[4/5] rounded-[2rem] animate-pulse ${
                    isDark
                      ? "bg-slate-900/50 border border-white/5"
                      : "bg-white border border-slate-200 shadow-sm"
                  }`}
                />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "card" ? (
                /* --- ORIGINAL CARD GRID --- */
                <motion.div
                  key="card-view"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 md:gap-6"
                >
                  {currentTables.map((table) => (
                    <motion.button
                      key={table.table_number}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTableSelect(table)}
                      className={`relative aspect-[4/5] rounded-[2rem] flex flex-col items-center justify-center transition-all group overflow-hidden ${
                        isDark
                          ? "bg-slate-900/30 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800/60"
                          : "bg-white border border-slate-200 hover:border-blue-400/50 hover:bg-slate-50 shadow-sm"
                      }`}
                    >
                      <FaLayerGroup
                        className={`${
                          isDark ? "text-slate-800" : "text-slate-100"
                        } group-hover:text-blue-900/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl transition-colors duration-500`}
                      />

                      <div className="relative z-10 flex flex-col items-center">
                        <span
                          className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 transition-colors ${
                            isDark
                              ? "text-slate-600 group-hover:text-blue-400"
                              : "text-slate-400 group-hover:text-blue-500"
                          }`}
                        >
                          Table
                        </span>
                        <span
                          className={`text-3xl md:text-5xl font-black group-hover:scale-110 transition-transform duration-500 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {table.table_number}
                        </span>
                      </div>
                      <div
                        className={`absolute bottom-6 w-1 h-1 rounded-full group-hover:w-8 transition-all ${
                          isDark
                            ? "bg-slate-700 group-hover:bg-blue-500"
                            : "bg-slate-300 group-hover:bg-blue-500"
                        }`}
                      />
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                /* --- NEW TABLE LIST VIEW --- */
                <motion.div
                  key="table-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className={`rounded-[2.5rem] overflow-hidden border ${
                    isDark
                      ? "bg-slate-950/40 border-white/5"
                      : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr
                        className={`${isDark ? "bg-slate-900/50" : "bg-slate-100/50"}`}
                      >
                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                          Table info
                        </th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                          Current Status
                        </th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTables.map((table) => (
                        <tr
                          key={table.table_number}
                          className={`border-b last:border-0 transition-colors ${isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50"}`}
                        >
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${isDark ? "bg-slate-900 text-blue-500" : "bg-blue-50 text-blue-600"}`}
                              >
                                {table.table_number}
                              </div>
                              <span
                                className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                              >
                                Table {table.table_number}
                              </span>
                            </div>
                          </td>
                          <td className="p-8">
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              {table.status_label || "Pending"}
                            </span>
                          </td>
                          <td className="p-8 text-right">
                            <button
                              onClick={() => handleTableSelect(table)}
                              className="px-6 py-3 text-xs font-bold text-white transition-all bg-blue-600 shadow-lg hover:bg-blue-500 rounded-2xl shadow-blue-900/10"
                            >
                              Open Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>

        {totalPages > 1 && (
          <footer className="flex justify-center mt-16">
            <div
              className={`flex items-center gap-1 p-1.5 rounded-full shadow-xl ${
                isDark
                  ? "bg-slate-900/50 border border-white/5"
                  : "bg-white border border-slate-200"
              }`}
            >
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className={`w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 transition-all ${
                  isDark
                    ? "text-slate-500 hover:text-white hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FaChevronLeft size={12} />
              </button>

              <div
                className={`flex px-2 items-center gap-4 text-[10px] font-black uppercase tracking-widest ${
                  isDark ? "text-slate-500" : "text-slate-500"
                }`}
              >
                Page{" "}
                <span className={isDark ? "text-white" : "text-slate-900"}>
                  {currentPage}
                </span>{" "}
                of {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className={`w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 transition-all ${
                  isDark
                    ? "text-slate-500 hover:text-white hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FaChevronRight size={12} />
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default ViewOrdering;
