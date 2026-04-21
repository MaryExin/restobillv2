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

const FALLBACK_BG = "./pos-home-bg.png";

const readCssVar = (name, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;

  let normalized = hex.replace("#", "").trim();

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (normalized.length !== 6) return null;

  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const toRgba = (hex, alpha = 1) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(59,130,246,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getContrastText = (hex, fallback = "#ffffff") => {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 155 ? "#0f172a" : "#ffffff";
};

const ViewOrdering = () => {
  const { themeSettings } = useTheme();
  const navigate = useNavigate();
  const apiHost = useApiHost();

  const [viewMode, setViewMode] = useState("card");

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
  const [mergeSearch, setMergeSearch] = useState("");
  const [selectedFixedTable, setSelectedFixedTable] = useState("");
  const [selectedCustomTables, setSelectedCustomTables] = useState([]);
  const [transactionId, setTransactionId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [customFixedTableName, setCustomFixedTableName] = useState("");
  const [customMergeTableName, setCustomMergeTableName] = useState("");

  const itemsPerPage = 15;

  const accent = readCssVar("--app-accent", "#2563eb");
  const accentSecondary = readCssVar("--app-accent-secondary", "#1d4ed8");
  const bg = readCssVar("--app-bg", "#0f172a");
  const surface = readCssVar("--app-surface", "#111827");
  const surfaceSoft = readCssVar("--app-surface-soft", "rgba(15,23,42,0.72)");
  const text = readCssVar("--app-text", "#ffffff");
  const mutedText = readCssVar("--app-muted-text", "rgba(255,255,255,0.68)");
  const border = readCssVar("--app-border", "rgba(255,255,255,0.08)");
  const accentGlow = readCssVar("--app-accent-glow", "rgba(37,99,235,0.35)");

  const dashboardBgValue = themeSettings?.Dashboard_Background_Url || "";
  const dashboardBackgroundImage = !dashboardBgValue
    ? FALLBACK_BG
    : dashboardBgValue.startsWith("/")
      ? `${apiHost}${dashboardBgValue}`
      : `${apiHost}/${dashboardBgValue}`;

  const normalizeTableName = (value) =>
    String(value || "")
      .replace(/\s*&\s*/g, " & ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const buildUniqueTableNames = (tables = []) => {
    const seen = new Set();
    const merged = [];

    tables.forEach((tableName) => {
      const cleanName = String(tableName || "").trim();
      const normalizedName = normalizeTableName(cleanName);

      if (!cleanName || seen.has(normalizedName)) return;

      seen.add(normalizedName);
      merged.push(cleanName);
    });

    return merged.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  };

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
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;

        const backendDate = data?.selectedDate || data?.shiftDate || "";
        setSelectedDate(backendDate);
        setCurrentPage(1);
        setIsDateLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load open shift date:", error);
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
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          setOriginalTableList(
            sortFloorTables(Array.isArray(data) ? data : []),
          );
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to load pending tables:", error);
          setIsLoading(false);
        });
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
    setSelectedFixedTable("");
    setSelectedCustomTables([]);
    setFixedSearch("");
    setMergeSearch("");
    setCustomFixedTableName("");
    setCustomMergeTableName("");
  };

  const toggleCustomTableSelection = (tableName) => {
    setSelectedCustomTables((prev) => {
      const exists = prev.includes(tableName);

      if (exists) {
        return prev.filter((item) => item !== tableName);
      }

      return [...prev, tableName].sort((a, b) =>
        String(a).localeCompare(String(b), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    });
  };

  const customTablePreview = useMemo(() => {
    const merged = buildUniqueTableNames([
      ...selectedCustomTables,
      customMergeTableName,
    ]);

    return merged.length ? merged.join(" & ") : "None";
  }, [selectedCustomTables, customMergeTableName]);

  const handleOpenOrderModal = () => {
    if (!apiHost) return;

    fetch(`${apiHost}/api/master_table_list.php`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setMasterTableList(Array.isArray(data) ? data : []);
        setShowOrderModal(true);
      })
      .catch((error) => {
        console.error("Failed to load master table list:", error);
        setMasterTableList([]);
        setShowOrderModal(true);
      });
  };

  const handleOpenOrder = () => {
    let value = "";

    if (tableMode === "fixed") {
      value = customFixedTableName.trim() || selectedFixedTable;

      if (!value) {
        alert("Please select a fixed table or type a custom table name.");
        return;
      }
    } else if (tableMode === "custom") {
      const mergedTables = buildUniqueTableNames([
        ...selectedCustomTables,
        customMergeTableName,
      ]);

      if (mergedTables.length === 0) {
        alert(
          "Please select at least 1 table to merge or type a custom table name.",
        );
        return;
      }

      value = mergedTables.join(" & ");
    }

    openOrderList(value, "");
    resetOrderModal();
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden pb-20"
      style={{
        backgroundColor: bg,
        color: text,
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${dashboardBackgroundImage})`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${toRgba(bg, 0.82)} 0%, ${toRgba(
            bg,
            0.9,
          )} 55%, ${toRgba(bg, 0.96)} 100%)`,
        }}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-[-5%] left-[-5%] w-[50%] h-[50%] rounded-full blur-[100px]"
          style={{ backgroundColor: toRgba(accent, 0.1) }}
        />
        <div
          className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[100px]"
          style={{ backgroundColor: toRgba(accentSecondary, 0.1) }}
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
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-[2rem] p-6 shadow-2xl border"
              style={{
                backgroundColor: surface,
                borderColor: border,
                boxShadow: `0 24px 60px ${toRgba(bg, 0.35)}`,
              }}
            >
              <h2 className="text-xl font-black mb-3" style={{ color: text }}>
                Pending Billing
              </h2>
              <p className="leading-relaxed" style={{ color: mutedText }}>
                This table has a pending bill. Do you want to proceed and edit
                the existing order?
              </p>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleCancelPendingOrder}
                  className="flex-1 rounded-2xl px-5 py-4 transition-all"
                  style={{
                    backgroundColor: surfaceSoft,
                    color: text,
                    border: `1px solid ${border}`,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmPendingOrder}
                  className="flex-1 px-5 py-4 font-bold rounded-2xl transition-all"
                  style={{
                    background: `linear-gradient(180deg, ${accent} 0%, ${accentSecondary} 100%)`,
                    color: getContrastText(accent, "#ffffff"),
                    boxShadow: `0 12px 28px ${accentGlow}`,
                  }}
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
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-3 sm:px-4 py-3"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="w-full max-w-[730px] rounded-[1.5rem] p-4 sm:p-5 shadow-2xl border"
              style={{
                backgroundColor: surface,
                borderColor: border,
                boxShadow: `0 24px 60px ${toRgba(bg, 0.35)}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2
                    className="text-lg sm:text-xl font-black leading-tight"
                    style={{ color: text }}
                  >
                    Add Order
                  </h2>
                  <p
                    className="text-xs sm:text-sm leading-snug mt-1"
                    style={{ color: mutedText }}
                  >
                    Choose a fixed table or merge tables. You can also type a
                    custom or special table name inside either option.
                  </p>
                </div>

                <button
                  onClick={resetOrderModal}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
                  style={{ color: mutedText }}
                >
                  <FiX size={17} />
                </button>
              </div>

              <div
                className="grid grid-cols-2 gap-2 mb-4 p-1 rounded-xl border"
                style={{
                  backgroundColor: surfaceSoft,
                  borderColor: border,
                }}
              >
                <button
                  onClick={() => setTableMode("fixed")}
                  className="rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                  style={{
                    backgroundColor:
                      tableMode === "fixed" ? accent : "transparent",
                    color:
                      tableMode === "fixed"
                        ? getContrastText(accent, "#ffffff")
                        : mutedText,
                  }}
                >
                  Fixed Table
                </button>

                <button
                  onClick={() => setTableMode("custom")}
                  className="rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                  style={{
                    backgroundColor:
                      tableMode === "custom" ? accent : "transparent",
                    color:
                      tableMode === "custom"
                        ? getContrastText(accent, "#ffffff")
                        : mutedText,
                  }}
                >
                  Merge Table
                </button>
              </div>

              {tableMode === "fixed" ? (
                <div className="space-y-4">
                  <div className="relative group">
                    <FaSearch
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: mutedText }}
                    />
                    <input
                      type="text"
                      placeholder="Search fixed table..."
                      value={fixedSearch}
                      onChange={(e) => setFixedSearch(e.target.value)}
                      className="w-full rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all border"
                      style={{
                        backgroundColor: surfaceSoft,
                        borderColor: border,
                        color: text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Select Fixed Table
                    </label>

                    <div
                      className="max-h-[160px] overflow-y-auto rounded-2xl p-2.5 border"
                      style={{
                        borderColor: border,
                        backgroundColor: surfaceSoft,
                      }}
                    >
                      {sortFloorTables(
                        filteredMasterTables
                          .filter((table) =>
                            String(table.table_name || "")
                              .toLowerCase()
                              .includes(fixedSearch.toLowerCase()),
                          )
                          .map((table) => ({
                            table_number: table.table_name,
                            raw: table,
                          })),
                      ).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {sortFloorTables(
                            filteredMasterTables
                              .filter((table) =>
                                String(table.table_name || "")
                                  .toLowerCase()
                                  .includes(fixedSearch.toLowerCase()),
                              )
                              .map((table) => ({
                                table_number: table.table_name,
                                raw: table,
                              })),
                          ).map((tableObj) => {
                            const table = tableObj.raw;
                            const tableName = tableObj.table_number;
                            const isSelected =
                              String(selectedFixedTable) === String(tableName);

                            return (
                              <button
                                key={table.ID ?? tableName}
                                type="button"
                                onClick={() => setSelectedFixedTable(tableName)}
                                className="group relative rounded-xl px-3 py-3 text-left transition-all duration-200 border shadow-sm hover:scale-[1.01] active:scale-[0.98]"
                                style={{
                                  backgroundColor: isSelected
                                    ? toRgba(accent, 0.12)
                                    : surface,
                                  borderColor: isSelected
                                    ? toRgba(accent, 0.4)
                                    : border,
                                  color: text,
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p
                                      className="text-[9px] font-black uppercase tracking-[0.22em] mb-1"
                                      style={{
                                        color: isSelected ? accent : mutedText,
                                      }}
                                    >
                                      Table
                                    </p>
                                    <p className="text-sm font-extrabold leading-tight break-words">
                                      {tableName}
                                    </p>
                                  </div>

                                  <div
                                    className="shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                      backgroundColor: isSelected
                                        ? accent
                                        : toRgba(text, 0.08),
                                      color: isSelected
                                        ? getContrastText(accent, "#ffffff")
                                        : mutedText,
                                    }}
                                  >
                                    {isSelected ? (
                                      <FaCheck size={10} />
                                    ) : (
                                      <span className="text-[10px] font-bold">
                                        +
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          className="rounded-xl px-4 py-5 text-center text-sm border"
                          style={{
                            backgroundColor: surface,
                            color: mutedText,
                            borderColor: border,
                          }}
                        >
                          No fixed table found.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Or Type Custom / Special Table
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. VIP Table, Function Hall"
                      value={customFixedTableName}
                      onChange={(e) => setCustomFixedTableName(e.target.value)}
                      className="w-full rounded-xl py-3 px-4 text-sm focus:outline-none transition-all border"
                      style={{
                        backgroundColor: surfaceSoft,
                        borderColor: border,
                        color: text,
                      }}
                    />
                  </div>

                  <div
                    className="rounded-2xl px-4 py-4 border"
                    style={{
                      backgroundColor: surfaceSoft,
                      borderColor: border,
                    }}
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Selected
                    </p>

                    <div
                      className="rounded-xl px-4 py-3 border"
                      style={{
                        backgroundColor: surface,
                        borderColor: border,
                      }}
                    >
                      <p
                        className="text-base font-bold leading-relaxed"
                        style={{ color: text }}
                      >
                        {customFixedTableName.trim() ||
                          selectedFixedTable ||
                          "None"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group">
                    <FaSearch
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: mutedText }}
                    />
                    <input
                      type="text"
                      placeholder="Search tables to merge..."
                      value={mergeSearch}
                      onChange={(e) => setMergeSearch(e.target.value)}
                      className="w-full rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all border"
                      style={{
                        backgroundColor: surfaceSoft,
                        borderColor: border,
                        color: text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Select Tables To Merge
                    </label>

                    <div
                      className="max-h-[190px] overflow-y-auto rounded-2xl p-2.5 border"
                      style={{
                        borderColor: border,
                        backgroundColor: surfaceSoft,
                      }}
                    >
                      {sortFloorTables(
                        masterTableList
                          .filter((table) =>
                            String(table.table_name || "")
                              .toLowerCase()
                              .includes(mergeSearch.toLowerCase()),
                          )
                          .map((table) => ({
                            table_number: table.table_name,
                            raw: table,
                          })),
                      ).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {sortFloorTables(
                            masterTableList
                              .filter((table) =>
                                String(table.table_name || "")
                                  .toLowerCase()
                                  .includes(mergeSearch.toLowerCase()),
                              )
                              .map((table) => ({
                                table_number: table.table_name,
                                raw: table,
                              })),
                          ).map((tableObj) => {
                            const tableName = tableObj.table_number;
                            const isSelected =
                              selectedCustomTables.includes(tableName);

                            return (
                              <button
                                key={tableName}
                                type="button"
                                onClick={() =>
                                  toggleCustomTableSelection(tableName)
                                }
                                className="group relative rounded-xl px-3 py-3 text-left transition-all duration-200 border shadow-sm hover:scale-[1.01] active:scale-[0.98]"
                                style={{
                                  backgroundColor: isSelected
                                    ? toRgba(accent, 0.12)
                                    : surface,
                                  borderColor: isSelected
                                    ? toRgba(accent, 0.4)
                                    : border,
                                  color: text,
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p
                                      className="text-[9px] font-black uppercase tracking-[0.22em] mb-1"
                                      style={{
                                        color: isSelected ? accent : mutedText,
                                      }}
                                    >
                                      Table
                                    </p>
                                    <p className="text-sm font-extrabold leading-tight break-words">
                                      {tableName}
                                    </p>
                                  </div>

                                  <div
                                    className="shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                      backgroundColor: isSelected
                                        ? accent
                                        : toRgba(text, 0.08),
                                      color: isSelected
                                        ? getContrastText(accent, "#ffffff")
                                        : mutedText,
                                    }}
                                  >
                                    {isSelected ? (
                                      <FaCheck size={10} />
                                    ) : (
                                      <span className="text-[10px] font-bold">
                                        +
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          className="rounded-xl px-4 py-5 text-center text-sm border"
                          style={{
                            backgroundColor: surface,
                            color: mutedText,
                            borderColor: border,
                          }}
                        >
                          No tables found.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Add Custom / Special Table To Merge
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. VIP Table, Function Hall"
                      value={customMergeTableName}
                      onChange={(e) => setCustomMergeTableName(e.target.value)}
                      className="w-full rounded-xl py-3 px-4 text-sm focus:outline-none transition-all border"
                      style={{
                        backgroundColor: surfaceSoft,
                        borderColor: border,
                        color: text,
                      }}
                    />
                  </div>

                  <div
                    className="rounded-2xl px-4 py-4 border"
                    style={{
                      backgroundColor: surfaceSoft,
                      borderColor: border,
                    }}
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.28em] mb-2"
                      style={{ color: mutedText }}
                    >
                      Preview
                    </p>

                    <div
                      className="rounded-xl px-4 py-3 min-h-[52px] border"
                      style={{
                        backgroundColor: surface,
                        borderColor: border,
                      }}
                    >
                      <p
                        className="text-base font-bold leading-relaxed break-words"
                        style={{ color: text }}
                      >
                        {customTablePreview}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetOrderModal}
                  className="flex-1 rounded-xl px-4 py-3 text-sm transition-all border"
                  style={{
                    backgroundColor: surfaceSoft,
                    color: text,
                    borderColor: border,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleOpenOrder}
                  className="flex-1 px-4 py-3 text-sm font-bold rounded-xl transition-all"
                  style={{
                    background: `linear-gradient(180deg, ${accent} 0%, ${accentSecondary} 100%)`,
                    color: getContrastText(accent, "#ffffff"),
                    boxShadow: `0 12px 28px ${accentGlow}`,
                  }}
                >
                  Open Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="sticky top-0 z-40 backdrop-blur-xl px-4 py-4 mb-8 border-b"
        style={{
          backgroundColor: toRgba(bg, 0.6),
          borderColor: border,
        }}
      >
        <div className="flex items-center justify-between mx-auto max-w-7xl">
          <button
            onClick={() => navigate("/poscorehomescreen")}
            className="flex items-center gap-3 mt-2 px-10 py-6 rounded-full transition-all border"
            style={{
              backgroundColor: surfaceSoft,
              borderColor: border,
              color: text,
            }}
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-bold uppercase">
              BACK TO DASHBOARD
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div
              className="flex p-1 rounded-2xl border"
              style={{
                backgroundColor: surfaceSoft,
                borderColor: border,
              }}
            >
              <button
                onClick={() => setViewMode("card")}
                className="p-2.5 rounded-xl transition-all"
                style={{
                  backgroundColor: viewMode === "card" ? accent : "transparent",
                  color:
                    viewMode === "card"
                      ? getContrastText(accent, "#ffffff")
                      : mutedText,
                }}
              >
                <FaThLarge size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className="p-2.5 rounded-xl transition-all"
                style={{
                  backgroundColor:
                    viewMode === "table" ? accent : "transparent",
                  color:
                    viewMode === "table"
                      ? getContrastText(accent, "#ffffff")
                      : mutedText,
                }}
              >
                <FaList size={14} />
              </button>
            </div>

            <div className="items-center hidden gap-2 sm:flex">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accent }}
              />
              <span
                className="text-[10px] font-black uppercase tracking-[0.3em]"
                style={{ color: mutedText }}
              >
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
              className="text-4xl md:text-6xl font-black tracking-tighter mb-2"
              style={{ color: text }}
            >
              Pending <span style={{ color: accent }}>Tables</span>
            </h1>
            <p style={{ color: mutedText }}>
              Click a table to manage guest orders.
            </p>
          </motion.div>

          <div className="flex flex-col w-full gap-3 lg:flex-row lg:w-auto lg:items-center">
            <div
              className="rounded-[2rem] px-6 py-4 backdrop-blur-sm w-full lg:w-auto border"
              style={{
                backgroundColor: surfaceSoft,
                borderColor: border,
              }}
            >
              <label
                className="block text-[10px] font-black uppercase tracking-[0.3em] mb-2"
                style={{ color: mutedText }}
              >
                Date
              </label>
              <div className="min-w-[140px]" style={{ color: text }}>
                {isDateLoading ? "Loading..." : selectedDate || "No open shift"}
              </div>
            </div>

            <div className="relative w-full group lg:w-96">
              <FaSearch
                className="absolute z-20 -translate-y-1/2 left-5 top-1/2"
                style={{ color: mutedText }}
              />
              <input
                type="text"
                placeholder="Jump to table..."
                value={searchTable}
                onChange={(e) => {
                  setSearchTable(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-[2rem] py-5 pl-14 pr-6 focus:outline-none transition-all backdrop-blur-sm border"
                style={{
                  backgroundColor: surfaceSoft,
                  borderColor: border,
                  color: text,
                }}
              />
            </div>

            <button
              onClick={handleOpenOrderModal}
              className="flex items-center justify-center gap-3 px-6 py-5 rounded-[2rem] font-bold transition-all"
              style={{
                background: `linear-gradient(180deg, ${accent} 0%, ${accentSecondary} 100%)`,
                color: getContrastText(accent, "#ffffff"),
                boxShadow: `0 12px 28px ${accentGlow}`,
              }}
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
                  className="aspect-[4/5] rounded-[2rem] animate-pulse border"
                  style={{
                    backgroundColor: toRgba(surface, 0.5),
                    borderColor: border,
                  }}
                />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "card" ? (
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
                      className="relative aspect-[4/5] rounded-[2rem] flex flex-col items-center justify-center transition-all group overflow-hidden border"
                      style={{
                        backgroundColor: surfaceSoft,
                        borderColor: border,
                        color: text,
                      }}
                    >
                      <FaLayerGroup
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl transition-colors duration-500"
                        style={{ color: toRgba(text, 0.06) }}
                      />

                      <div className="relative z-10 flex flex-col items-center">
                        <span
                          className="text-[10px] font-black tracking-[0.3em] uppercase mb-1 transition-colors"
                          style={{ color: mutedText }}
                        >
                          Table
                        </span>
                        <span className="text-3xl md:text-5xl font-black group-hover:scale-110 transition-transform duration-500">
                          {table.table_number}
                        </span>
                      </div>
                      <div
                        className="absolute bottom-6 w-1 h-1 rounded-full group-hover:w-8 transition-all"
                        style={{ backgroundColor: accent }}
                      />
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="table-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="rounded-[2.5rem] overflow-hidden border"
                  style={{
                    backgroundColor: toRgba(surface, 0.8),
                    borderColor: border,
                  }}
                >
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: toRgba(surface, 0.9) }}>
                        <th
                          className="p-8 text-[10px] font-black uppercase tracking-[0.3em]"
                          style={{ color: mutedText }}
                        >
                          Table info
                        </th>
                        <th
                          className="p-8 text-[10px] font-black uppercase tracking-[0.3em]"
                          style={{ color: mutedText }}
                        >
                          Current Status
                        </th>
                        <th
                          className="p-8 text-[10px] font-black uppercase tracking-[0.3em] text-right"
                          style={{ color: mutedText }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTables.map((table) => (
                        <tr
                          key={table.table_number}
                          className="border-b last:border-0 transition-colors"
                          style={{ borderColor: border }}
                        >
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black"
                                style={{
                                  backgroundColor: toRgba(accent, 0.12),
                                  color: accent,
                                }}
                              >
                                {table.table_number}
                              </div>
                              <span
                                className="font-bold"
                                style={{ color: text }}
                              >
                                Table {table.table_number}
                              </span>
                            </div>
                          </td>
                          <td className="p-8">
                            <span
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border"
                              style={{
                                backgroundColor: toRgba(accent, 0.1),
                                color: accent,
                                borderColor: toRgba(accent, 0.2),
                              }}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full animate-pulse"
                                style={{ backgroundColor: accent }}
                              />
                              {table.status_label || "Pending"}
                            </span>
                          </td>
                          <td className="p-8 text-right">
                            <button
                              onClick={() => handleTableSelect(table)}
                              className="px-6 py-3 text-xs font-bold rounded-2xl transition-all"
                              style={{
                                background: `linear-gradient(180deg, ${accent} 0%, ${accentSecondary} 100%)`,
                                color: getContrastText(accent, "#ffffff"),
                                boxShadow: `0 10px 24px ${accentGlow}`,
                              }}
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
              className="flex items-center gap-1 p-1.5 rounded-full shadow-xl border"
              style={{
                backgroundColor: surfaceSoft,
                borderColor: border,
              }}
            >
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 transition-all"
                style={{ color: mutedText }}
              >
                <FaChevronLeft size={12} />
              </button>

              <div
                className="flex px-2 items-center gap-4 text-[10px] font-black uppercase tracking-widest"
                style={{ color: mutedText }}
              >
                Page <span style={{ color: text }}>{currentPage}</span> of{" "}
                {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 transition-all"
                style={{ color: mutedText }}
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
