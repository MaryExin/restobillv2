<<<<<<< HEAD
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useZustandLayoutMode from "../../context/useZustandLayoutMode";
=======
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
>>>>>>> master
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
import { FiEdit2, FiPlus, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../hooks/useApiHost";
import { useTheme } from "../../context/ThemeContext";

const FALLBACK_BG = "./pos-home-bg.png";
const FLOOR_TABLE_BASE_WIDTH = 280;
const FLOOR_TABLE_BASE_HEIGHT = 245;
const FLOOR_TABLE_VISUAL_WIDTH = 176;
const FLOOR_TABLE_VISUAL_HEIGHT = 128;
const FLOOR_GROUP_HEIGHT = 280;
const FLOOR_GROUP_LABEL_HEIGHT = 64;
const FLOOR_DROP_DISTANCE = 130;
const DEFAULT_ROOM_KEY = "main-room";
const DEFAULT_ROOM_NAME = "Main Room";

const getDefaultFloorLayout = () => ({ positions: {}, groups: [] });

const normalizeRoomKey = (value, fallback = DEFAULT_ROOM_KEY) => {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || fallback;
};

const normalizeFloorRooms = (rooms = []) => {
  const seen = new Set();
  const normalized = [];

  rooms.forEach((room, index) => {
    const roomName = String(room?.room_name || room?.name || "").trim();
    if (!roomName) return;

    const baseKey = normalizeRoomKey(
      room?.room_key || roomName,
      `room-${index + 1}`,
    );
    let roomKey = baseKey;
    let suffix = 2;

    while (seen.has(roomKey)) {
      roomKey = `${baseKey}-${suffix}`;
      suffix += 1;
    }

    seen.add(roomKey);
    normalized.push({
      room_key: roomKey,
      room_name: roomName,
      tables: Array.isArray(room?.tables)
        ? [
            ...new Set(
              room.tables
                .map((table) => String(table || "").trim())
                .filter(Boolean),
            ),
          ]
        : [],
      sort_order: Number.isFinite(Number(room?.sort_order))
        ? Number(room.sort_order)
        : index,
    });
  });

  return normalized.length
    ? normalized
    : [
        {
          room_key: DEFAULT_ROOM_KEY,
          room_name: DEFAULT_ROOM_NAME,
          tables: [],
          sort_order: 0,
        },
      ];
};

const readStorageValue = (key, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
};

const normalizeFloorLayout = (layout) => ({
  positions:
    layout?.positions &&
    typeof layout.positions === "object" &&
    !Array.isArray(layout.positions)
      ? layout.positions
      : {},
  groups: Array.isArray(layout?.groups) ? layout.groups : [],
});

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

const KIOSK_DEFAULT_TABLE = "Table 01";

const ViewOrdering = () => {
  const { themeSettings } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutMode } = useZustandLayoutMode();
  const apiHost = useApiHost();
  const floorRef = useRef(null);
  const floorLayoutLoadedRef = useRef(false);
  const floorLayoutSaveTimerRef = useRef(null);

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
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const [customFixedTableName, setCustomFixedTableName] = useState("");
  const [customMergeTableName, setCustomMergeTableName] = useState("");
  const [floorLayout, setFloorLayout] = useState(getDefaultFloorLayout);
  const [isLayoutLoading, setIsLayoutLoading] = useState(true);
  const [floorDrag, setFloorDrag] = useState(null);
  const [dropTargetTable, setDropTargetTable] = useState("");
  const [isTableLayoutEnabled, setIsTableLayoutEnabled] = useState(false);
  const [isTableLayoutSettingLoading, setIsTableLayoutSettingLoading] =
    useState(true);
  const [floorRooms, setFloorRooms] = useState([]);
  const [activeRoomKey, setActiveRoomKey] = useState(DEFAULT_ROOM_KEY);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isRoomsSaving, setIsRoomsSaving] = useState(false);
  const [showRoomSetupModal, setShowRoomSetupModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [setupRoomKey, setSetupRoomKey] = useState(DEFAULT_ROOM_KEY);
  const [setupSearch, setSetupSearch] = useState("");
  const [setupRoomsDraft, setSetupRoomsDraft] = useState([]);

  const itemsPerPage = 15;
  const layoutScope = useMemo(
    () => ({
      category_code:
        readStorageValue("posBusinessCategoryCode") ||
        readStorageValue("Category_Code") ||
        "default",
      unit_code:
        readStorageValue("posBusinessUnitCode") ||
        readStorageValue("Unit_Code") ||
        "default",
      layout_key: "ordering",
    }),
    [],
  );
  const activeLayoutScope = useMemo(
    () => ({
      ...layoutScope,
      layout_key: `ordering:${activeRoomKey || DEFAULT_ROOM_KEY}`,
    }),
    [activeRoomKey, layoutScope],
  );

  const accent = readCssVar("--app-accent", "#2563eb");
  const accentSecondary = readCssVar("--app-accent-secondary", "#1d4ed8");
  const bg = readCssVar("--app-bg", "#0f172a");
  const surface = readCssVar("--app-surface", "#111827");
  const surfaceSoft = readCssVar("--app-surface-soft", "rgba(15,23,42,0.72)");
  const surfaceStrong = readCssVar("--app-surface-strong", surface);
  const text = readCssVar("--app-text", "#ffffff");
  const mutedText = readCssVar("--app-muted-text", "rgba(255,255,255,0.68)");
  const softText = readCssVar("--app-soft-text", mutedText);
  const border = readCssVar("--app-border", "rgba(255,255,255,0.08)");
  const borderStrong = readCssVar("--app-border-strong", border);
  const accentGlow = readCssVar("--app-accent-glow", "rgba(37,99,235,0.35)");
  const availableColor = accent;
  const occupiedColor = accentSecondary;
  const pageBg = bg;
  const pageText = text;
  const pageMutedText = mutedText;
  const pageSoftText = softText;
  const pageSurfaceSoft = surfaceSoft;
  const pageSurfaceStrong = surfaceStrong;
  const pageBorder = border;
  const pageBorderStrong = borderStrong;

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

  const splitTableNames = (value) =>
    String(value || "")
      .split(/\s*&\s*/g)
      .map((item) => item.trim())
      .filter(Boolean);

  const getTableNumberValue = (value) => {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : null;
  };

  const getCompactTableLabel = (value) => {
    const cleanValue = String(value || "").trim();
    const compact = cleanValue.replace(/^table\s*/i, "").trim();
    return compact || cleanValue;
  };

  const tableValueMatchesMaster = (value, masterTableName) => {
    const normalizedValue = normalizeTableName(value);
    const normalizedMaster = normalizeTableName(masterTableName);

    if (!normalizedValue || !normalizedMaster) return false;
    if (normalizedValue === normalizedMaster) return true;

    const exactPartMatch = splitTableNames(value).some(
      (part) => normalizeTableName(part) === normalizedMaster,
    );

    if (exactPartMatch) return true;

    const masterNumber = getTableNumberValue(masterTableName);
    if (masterNumber === null || !/\btable\s*\d/i.test(String(value || ""))) {
      return false;
    }

    const valueNumbers = String(value || "").match(/\d+/g) || [];
    return valueNumbers.some(
      (numberValue) => Number(numberValue) === masterNumber,
    );
  };

  const buildUniqueTableNames = (tables = []) => {
    const seen = new Set();
    const merged = [];

    tables.flatMap(splitTableNames).forEach((tableName) => {
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
      String(a.table_number || a.table_name || "").localeCompare(
        String(b.table_number || b.table_name || ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      ),
    );
  };

  const getTableItemId = (tableName) =>
    `table:${normalizeTableName(tableName)}`;

  const getGroupSignature = (tableNames = []) =>
    buildUniqueTableNames(tableNames).map(normalizeTableName).join("|");

  const getGroupItemId = (tableNames = []) =>
    `group:${getGroupSignature(tableNames)}`;

  const getValidFloorPosition = (position) => {
    if (
      !position ||
      !Number.isFinite(Number(position.x)) ||
      !Number.isFinite(Number(position.y))
    ) {
      return null;
    }

    return {
      x: Math.max(0, Number(position.x)),
      y: Math.max(0, Number(position.y)),
    };
  };

  const getFloorPositionsBounds = (tableNames = [], positions = {}) => {
    const validPositions = tableNames
      .map((tableName) =>
        getValidFloorPosition(
          positions[getTableItemId(tableName)] || positions[tableName],
        ),
      )
      .filter(Boolean);

    if (validPositions.length === 0) return null;

    const minX = Math.min(...validPositions.map((position) => position.x));
    const minY = Math.min(...validPositions.map((position) => position.y));
    const maxX = Math.max(
      ...validPositions.map(
        (position) => position.x + FLOOR_TABLE_BASE_WIDTH,
      ),
    );
    const maxY = Math.max(
      ...validPositions.map(
        (position) => position.y + FLOOR_TABLE_BASE_HEIGHT,
      ),
    );

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const getFloorItemOriginalBounds = (item) => {
    const originalPositions =
      item?.original_positions ||
      item?.originalPositions ||
      item?.originalPositionsByTable ||
      {};

    return getFloorPositionsBounds(item?.tableNames || [], originalPositions);
  };

  const getFloorItemSize = (item) => {
    const tableCount = Math.max(item?.tableNames?.length || 1, 1);

    if (tableCount === 1) {
      return {
        width: FLOOR_TABLE_BASE_WIDTH,
        height: FLOOR_TABLE_BASE_HEIGHT,
      };
    }

    const originalBounds = getFloorItemOriginalBounds(item);
    const defaultGroupWidth =
      90 + tableCount * 170 + (tableCount - 1) * 40;
    const needsStackedLabelSpace =
      originalBounds?.height > FLOOR_TABLE_BASE_HEIGHT + 20;

    return {
      width: Math.max(defaultGroupWidth, originalBounds?.width || 0),
      height: Math.max(
        FLOOR_GROUP_HEIGHT,
        (originalBounds?.height || 0) +
          (needsStackedLabelSpace ? FLOOR_GROUP_LABEL_HEIGHT : 0),
      ),
    };
  };

  const getDefaultFloorPosition = (index) => ({
    x: 56 + (index % 3) * 320,
    y: 56 + Math.floor(index / 3) * 315,
  });

  const getGroupData = (tableNames = [], tableRows = []) => {
    const names = buildUniqueTableNames(tableNames);
    const txIds = [
      ...new Set(
        tableRows
          .map((table) => String(table.transaction_id || "").trim())
          .filter(Boolean),
      ),
    ];
    const occupiedTable = tableRows.find((table) => table.isOccupied);

    return {
      tableNames: names,
      table_number: names.join(" & "),
      pending_table_number:
        txIds.length === 1
          ? occupiedTable?.pending_table_number || names.join(" & ")
          : names.join(" & "),
      transaction_id: txIds.length === 1 ? txIds[0] : "",
      transactionIds: txIds,
      isOccupied:
        txIds.length > 0 || tableRows.some((table) => table.isOccupied),
      hasMixedOrders: txIds.length > 1,
      status_label:
        txIds.length > 0 || tableRows.some((table) => table.isOccupied)
          ? "Occupied"
          : "Available",
    };
  };

  const getPendingRowKey = (row) =>
    `${row?.transaction_id || ""}:${row?.table_number || ""}`;

  const buildFloorTables = (masterRows = [], pendingRows = []) => {
    const activeRows = [...pendingRows].sort(
      (a, b) => Number(b.transaction_id || 0) - Number(a.transaction_id || 0),
    );
    const matchedPendingKeys = new Set();

    const fixedTables = masterRows
      .map((row) => {
        const tableName = row.table_name || row.table_number || "";
        const pendingRow = activeRows.find((item) =>
          tableValueMatchesMaster(item?.table_number, tableName),
        );
        const isOccupied = Boolean(pendingRow);

        if (pendingRow) {
          matchedPendingKeys.add(getPendingRowKey(pendingRow));
        }

        return {
          ...row,
          table_name: tableName,
          table_number: tableName,
          status_label: isOccupied ? "Occupied" : "Available",
          transaction_status_label: pendingRow?.status_label || "",
          transaction_id: pendingRow?.transaction_id || "",
          pending_table_number: pendingRow?.table_number || "",
          isOccupied,
          isCustomTable: false,
        };
      })
      .filter((row) => row.table_number);

    const customOccupiedTables = activeRows
      .filter(
        (row) =>
          row?.table_number && !matchedPendingKeys.has(getPendingRowKey(row)),
      )
      .map((row) => ({
        ...row,
        table_name: row.table_number,
        table_number: row.table_number,
        status_label: "Occupied",
        transaction_status_label: row.status_label || "",
        pending_table_number: row.table_number,
        isOccupied: true,
        isCustomTable: true,
      }));

    return sortFloorTables([...fixedTables, ...customOccupiedTables]);
  };

  const tableHasOrder = (table) => {
    const status = String(
      table?.status_label || table?.transaction_status_label || "",
    )
      .trim()
      .toLowerCase();

    return Boolean(
      table?.isOccupied ||
      table?.transaction_id ||
      status === "pending" ||
      status === "occupied",
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
    if (!apiHost) return;

    let isMounted = true;
    setIsTableLayoutSettingLoading(true);

    fetch(`${apiHost}/api/pos_table_layout_settings.php`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Table layout setting HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;

        if (!data?.success) {
          throw new Error(
            data?.message || "Failed to load table layout setting.",
          );
        }

        setIsTableLayoutEnabled(Boolean(data?.data?.table_layout_enabled));
        setIsTableLayoutSettingLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load table layout setting:", error);
        if (!isMounted) return;

        setIsTableLayoutEnabled(false);
        setIsTableLayoutSettingLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiHost]);

  useEffect(() => {
    if (!apiHost || isTableLayoutSettingLoading) return;

    if (!isTableLayoutEnabled) {
      setFloorRooms([]);
      setActiveRoomKey(DEFAULT_ROOM_KEY);
      setIsRoomsLoading(false);
      return;
    }

    let isMounted = true;
    setIsRoomsLoading(true);

    const params = new URLSearchParams({
      category_code: layoutScope.category_code,
      unit_code: layoutScope.unit_code,
    });

    fetch(`${apiHost}/api/pos_table_rooms.php?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Room HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;

        if (data?.status !== "success") {
          throw new Error(data?.message || "Failed to load table rooms.");
        }

        const nextRooms = normalizeFloorRooms(data?.data?.rooms || []);
        setFloorRooms(nextRooms);
        setActiveRoomKey((prev) =>
          nextRooms.some((room) => room.room_key === prev)
            ? prev
            : nextRooms[0]?.room_key || DEFAULT_ROOM_KEY,
        );
        setIsRoomsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load table rooms:", error);
        if (!isMounted) return;

        setFloorRooms([
          {
            room_key: DEFAULT_ROOM_KEY,
            room_name: DEFAULT_ROOM_NAME,
            tables: [],
            sort_order: 0,
          },
        ]);
        setActiveRoomKey(DEFAULT_ROOM_KEY);
        setIsRoomsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiHost, isTableLayoutEnabled, isTableLayoutSettingLoading, layoutScope]);

  useEffect(() => {
    if (!apiHost || isTableLayoutSettingLoading) return;

    let isMounted = true;

    if (!isTableLayoutEnabled) {
      floorLayoutLoadedRef.current = false;
      setFloorLayout(getDefaultFloorLayout());
      setIsLayoutLoading(false);
      return () => {
        isMounted = false;
      };
    }

    if (isRoomsLoading || !activeRoomKey) {
      return () => {
        isMounted = false;
      };
    }

    floorLayoutLoadedRef.current = false;
    setIsLayoutLoading(true);

    const params = new URLSearchParams({
      category_code: activeLayoutScope.category_code,
      unit_code: activeLayoutScope.unit_code,
      layout_key: activeLayoutScope.layout_key,
    });

    fetch(`${apiHost}/api/pos_table_layout.php?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Layout HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;

        setFloorLayout(normalizeFloorLayout(data?.layout));
        floorLayoutLoadedRef.current = true;
        setIsLayoutLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load table floor layout:", error);
        if (!isMounted) return;

        setFloorLayout(getDefaultFloorLayout());
        floorLayoutLoadedRef.current = true;
        setIsLayoutLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeLayoutScope,
    activeRoomKey,
    apiHost,
    isRoomsLoading,
    isTableLayoutEnabled,
    isTableLayoutSettingLoading,
  ]);

  useEffect(() => {
    if (!apiHost || isDateLoading || isTableLayoutSettingLoading) return;

    let isMounted = true;

    const loadTables = () => {
      if (!selectedDate && !isTableLayoutEnabled) {
        setOriginalTableList([]);
        setIsLoading(false);
        return;
      }

      if (!isTableLayoutEnabled) {
        fetch(
          `${apiHost}/api/table_list.php?date=${encodeURIComponent(
            selectedDate,
          )}&onlyPending=true`,
        )
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`Pending table HTTP ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            if (!isMounted) return;

            setOriginalTableList(
              sortFloorTables(Array.isArray(data) ? data : []),
            );
            setIsLoading(false);
          })
          .catch((error) => {
            console.error("Failed to load pending tables:", error);
            if (!isMounted) return;
            setOriginalTableList([]);
            setIsLoading(false);
          });
        return;
      }

      const pendingTablesRequest = selectedDate
        ? fetch(
            `${apiHost}/api/table_list.php?date=${encodeURIComponent(
              selectedDate,
            )}&onlyPending=true`,
          ).then(async (res) => {
            if (!res.ok) {
              throw new Error(`Pending table HTTP ${res.status}`);
            }
            return res.json();
          })
        : Promise.resolve([]);

      Promise.all([
        fetch(`${apiHost}/api/master_table_list.php?includeAll=true`).then(
          async (res) => {
            if (!res.ok) {
              throw new Error(`Master table HTTP ${res.status}`);
            }
            return res.json();
          },
        ),
        pendingTablesRequest,
      ])
        .then(([masterRows, pendingRows]) => {
          if (!isMounted) return;

          setOriginalTableList(
            buildFloorTables(
              Array.isArray(masterRows) ? masterRows : [],
              Array.isArray(pendingRows) ? pendingRows : [],
            ),
          );
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to load floor tables:", error);
          if (!isMounted) return;
          setOriginalTableList([]);
          setIsLoading(false);
        });
    };

    setIsLoading(true);
    loadTables();

    const interval = selectedDate ? setInterval(loadTables, 3000) : null;
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [
    apiHost,
    selectedDate,
    tableRefreshKey,
    isDateLoading,
    isTableLayoutEnabled,
    isTableLayoutSettingLoading,
  ]);

  const activeRoom = useMemo(
    () =>
      floorRooms.find((room) => room.room_key === activeRoomKey) ||
      floorRooms[0] ||
      null,
    [activeRoomKey, floorRooms],
  );

  const roomTableList = useMemo(() => {
    if (!isTableLayoutEnabled) {
      return originalTableList;
    }

    if (!activeRoom) {
      return [];
    }

    const roomTableSet = new Set(
      (activeRoom.tables || []).map((tableName) =>
        normalizeTableName(tableName),
      ),
    );

    if (roomTableSet.size === 0) {
      return [];
    }

    return originalTableList.filter((table) =>
      roomTableSet.has(normalizeTableName(table.table_number)),
    );
  }, [activeRoom, isTableLayoutEnabled, originalTableList]);

  const filteredTables = useMemo(() => {
    return sortFloorTables(
      roomTableList.filter((table) =>
        String(table.table_number || "")
          .toLowerCase()
          .includes(searchTable.toLowerCase()),
      ),
    );
  }, [searchTable, roomTableList]);

  const defaultRoomTablePositions = useMemo(() => {
    const positions = new Map();

    sortFloorTables(roomTableList).forEach((table, index) => {
      positions.set(
        normalizeTableName(table.table_number),
        getDefaultFloorPosition(index),
      );
    });

    return positions;
  }, [roomTableList]);

  const pendingMergedTableGroups = useMemo(() => {
    const tableRowsByName = new Map(
      roomTableList.map((table) => [
        normalizeTableName(table.table_number),
        table,
      ]),
    );
    const groupsBySignature = new Map();

    roomTableList.forEach((table) => {
      const txId = String(table.transaction_id || "").trim();
      const mergedParts = buildUniqueTableNames(
        splitTableNames(table.pending_table_number || ""),
      );

      if (!txId || mergedParts.length < 2) return;

      const groupNames = mergedParts.filter((tableName) =>
        tableRowsByName.has(normalizeTableName(tableName)),
      );

      if (groupNames.length < 2 || groupNames.length !== mergedParts.length) {
        return;
      }

      const signature = getGroupSignature(groupNames);

      if (!groupsBySignature.has(signature)) {
        groupsBySignature.set(signature, {
          signature,
          id: getGroupItemId(groupNames),
          tables: groupNames,
          active_transaction_id: txId,
        });
      }
    });

    return Array.from(groupsBySignature.values());
  }, [roomTableList]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTables.length / itemsPerPage),
  );
  const currentTables = filteredTables.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const occupiedCount = filteredTables.filter(tableHasOrder).length;
  const availableCount = Math.max(filteredTables.length - occupiedCount, 0);
  const isPageLoading =
    isLoading ||
    isDateLoading ||
    isTableLayoutSettingLoading ||
    (isTableLayoutEnabled && (isLayoutLoading || isRoomsLoading));

  useEffect(() => {
    if (!apiHost || !isTableLayoutEnabled || !floorLayoutLoadedRef.current) {
      return;
    }

    if (floorLayoutSaveTimerRef.current) {
      clearTimeout(floorLayoutSaveTimerRef.current);
    }

    floorLayoutSaveTimerRef.current = setTimeout(() => {
      fetch(`${apiHost}/api/pos_table_layout.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...layoutScope,
          ...activeLayoutScope,
          positions: floorLayout.positions,
          groups: floorLayout.groups,
        }),
      }).catch((error) => {
        console.error("Failed to save table floor layout:", error);
      });
    }, 450);

    return () => {
      if (floorLayoutSaveTimerRef.current) {
        clearTimeout(floorLayoutSaveTimerRef.current);
      }
    };
  }, [activeLayoutScope, apiHost, floorLayout, isTableLayoutEnabled]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const floorItems = useMemo(() => {
    const tableRowsByName = new Map(
      roomTableList.map((table) => [
        normalizeTableName(table.table_number),
        table,
      ]),
    );
    const visibleTableNames = new Set(
      filteredTables.map((table) => normalizeTableName(table.table_number)),
    );
    const groupedTableNames = new Set();

    const groupedItems = floorLayout.groups
      .map((group) => {
        const groupNames = buildUniqueTableNames(group?.tables || []).filter(
          (tableName) => tableRowsByName.has(normalizeTableName(tableName)),
        );

        if (groupNames.length < 2) return null;

        const hasVisibleTable = groupNames.some((tableName) =>
          visibleTableNames.has(normalizeTableName(tableName)),
        );

        if (!hasVisibleTable) return null;

        groupNames.forEach((tableName) => {
          groupedTableNames.add(normalizeTableName(tableName));
        });

        const groupTables = groupNames
          .map((tableName) =>
            tableRowsByName.get(normalizeTableName(tableName)),
          )
          .filter(Boolean);

        return {
          id: group.id || getGroupItemId(groupNames),
          isGroup: true,
          tables: groupTables,
          original_positions:
            group.original_positions ||
            group.originalPositions ||
            group.originalPositionsByTable ||
            {},
          active_transaction_id:
            group.active_transaction_id || group.activeTransactionId || "",
          ...getGroupData(groupNames, groupTables),
        };
      })
      .filter(Boolean);

    const singleItems = filteredTables
      .filter(
        (table) =>
          !groupedTableNames.has(normalizeTableName(table.table_number)),
      )
      .map((table) => ({
        id: getTableItemId(table.table_number),
        isGroup: false,
        tables: [table],
        ...getGroupData([table.table_number], [table]),
      }));

    return [...groupedItems, ...singleItems].sort((a, b) =>
      String(a.table_number).localeCompare(String(b.table_number), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [floorLayout.groups, filteredTables, roomTableList]);

  const positionedFloorItems = useMemo(
    () =>
      floorItems.map((item, index) => {
        const firstTablePosition =
          item.tableNames.length > 0
            ? floorLayout.positions[getTableItemId(item.tableNames[0])]
            : null;
        const firstTableDefaultPosition =
          item.tableNames.length > 0
            ? defaultRoomTablePositions.get(
                normalizeTableName(item.tableNames[0]),
              )
            : null;
        const originalBounds = item.isGroup
          ? getFloorItemOriginalBounds(item)
          : null;
        const originalBoundsPosition = originalBounds
          ? {
              x: originalBounds.x,
              y: originalBounds.y,
            }
          : null;
        const position =
          floorLayout.positions[item.id] ||
          firstTablePosition ||
          originalBoundsPosition ||
          firstTableDefaultPosition ||
          getDefaultFloorPosition(index);

        return {
          ...item,
          position,
          size: getFloorItemSize(item),
        };
      }),
    [defaultRoomTablePositions, floorItems, floorLayout.positions],
  );

  const floorBounds = useMemo(() => {
    const maxBottom = positionedFloorItems.reduce(
      (max, item) =>
        Math.max(max, Number(item.position?.y || 0) + item.size.height),
      0,
    );

    return {
      height: Math.max(1180, maxBottom + 120),
    };
  }, [positionedFloorItems]);

  const cardDisplayItems = isTableLayoutEnabled
    ? positionedFloorItems
    : currentTables;
  const displayItemCount =
    viewMode === "card" ? cardDisplayItems.length : currentTables.length;
  const shouldShowEmptyState =
    displayItemCount === 0 && !(isTableLayoutEnabled && viewMode === "card");
  const setupActiveRoom = useMemo(
    () =>
      setupRoomsDraft.find((room) => room.room_key === setupRoomKey) ||
      setupRoomsDraft[0] ||
      null,
    [setupRoomKey, setupRoomsDraft],
  );
  const setupFilteredTables = useMemo(() => {
    return sortFloorTables(
      originalTableList.filter((table) =>
        String(table.table_number || "")
          .toLowerCase()
          .includes(setupSearch.toLowerCase()),
      ),
    );
  }, [originalTableList, setupSearch]);
  const setupActiveRoomTableCount = setupActiveRoom?.tables?.length || 0;

  const getAssignedRoomKey = (tableName, rooms = floorRooms) => {
    const tableKey = normalizeTableName(tableName);
    const room = rooms.find((item) =>
      (item.tables || []).some(
        (roomTableName) => normalizeTableName(roomTableName) === tableKey,
      ),
    );

    return room?.room_key || "";
  };

  const persistFloorRooms = async (nextRooms) => {
    const normalizedRooms = normalizeFloorRooms(nextRooms).map(
      (room, index) => ({
        ...room,
        sort_order: index,
      }),
    );

    setFloorRooms(normalizedRooms);

    if (!apiHost || !isTableLayoutEnabled) return normalizedRooms;

    try {
      setIsRoomsSaving(true);
      const response = await fetch(`${apiHost}/api/pos_table_rooms.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category_code: layoutScope.category_code,
          unit_code: layoutScope.unit_code,
          rooms: normalizedRooms,
        }),
      });
      const result = await response.json();

      if (!response.ok || result?.status !== "success") {
        throw new Error(result?.message || "Failed to save table rooms.");
      }

      const savedRooms = normalizeFloorRooms(
        result?.data?.rooms || normalizedRooms,
      );
      setFloorRooms(savedRooms);
      setActiveRoomKey((prev) =>
        savedRooms.some((room) => room.room_key === prev)
          ? prev
          : savedRooms[0]?.room_key || DEFAULT_ROOM_KEY,
      );
      return savedRooms;
    } catch (error) {
      console.error("Failed to save table rooms:", error);
      alert(error.message || "Failed to save table rooms.");
      return normalizedRooms;
    } finally {
      setIsRoomsSaving(false);
    }
  };

  const getUniqueRoomKey = (roomName, rooms = floorRooms) => {
    const baseKey = normalizeRoomKey(roomName, `room-${rooms.length + 1}`);
    const existingKeys = new Set(rooms.map((room) => room.room_key));
    let roomKey = baseKey;
    let suffix = 2;

    while (existingKeys.has(roomKey)) {
      roomKey = `${baseKey}-${suffix}`;
      suffix += 1;
    }

    return roomKey;
  };

  const openAddRoomModal = () => {
    setNewRoomName(`Room ${floorRooms.length + 1}`);
    setShowAddRoomModal(true);
  };

  const closeAddRoomModal = () => {
    setShowAddRoomModal(false);
    setNewRoomName("");
  };

  const handleSaveNewRoom = () => {
    const cleanName = String(newRoomName || "").trim();
    if (!cleanName) return;

    const roomKey = getUniqueRoomKey(cleanName);
    const nextRooms = [
      ...floorRooms,
      {
        room_key: roomKey,
        room_name: cleanName,
        tables: [],
        sort_order: floorRooms.length,
      },
    ];

    setActiveRoomKey(roomKey);
    persistFloorRooms(nextRooms);
    closeAddRoomModal();
  };

  const openRoomSetup = () => {
    const nextDraft = normalizeFloorRooms(floorRooms);
    setSetupRoomsDraft(nextDraft);
    setSetupRoomKey(
      nextDraft.some((room) => room.room_key === activeRoomKey)
        ? activeRoomKey
        : nextDraft[0]?.room_key || DEFAULT_ROOM_KEY,
    );
    setSetupSearch("");
    setShowRoomSetupModal(true);
  };

  const setDraftTableAssigned = (tableName, targetRoomKey, shouldAssign) => {
    const cleanTableName = String(tableName || "").trim();
    if (!cleanTableName || !targetRoomKey) return;

    const tableKey = normalizeTableName(cleanTableName);

    setSetupRoomsDraft((prev) =>
      normalizeFloorRooms(prev).map((room) => {
        const nextTables = (room.tables || []).filter(
          (roomTableName) => normalizeTableName(roomTableName) !== tableKey,
        );

        if (shouldAssign && room.room_key === targetRoomKey) {
          nextTables.push(cleanTableName);
        }

        return {
          ...room,
          tables: buildUniqueTableNames(nextTables),
        };
      }),
    );
  };

  const assignVisibleTablesToSetupRoom = () => {
    if (!setupActiveRoom) return;

    const tableNames = setupFilteredTables.map((table) => table.table_number);
    const tableKeys = new Set(tableNames.map(normalizeTableName));

    setSetupRoomsDraft((prev) =>
      normalizeFloorRooms(prev).map((room) => {
        const nextTables = (room.tables || []).filter(
          (roomTableName) => !tableKeys.has(normalizeTableName(roomTableName)),
        );

        if (room.room_key === setupActiveRoom.room_key) {
          nextTables.push(...tableNames);
        }

        return {
          ...room,
          tables: buildUniqueTableNames(nextTables),
        };
      }),
    );
  };

  const clearSetupRoomTables = () => {
    if (!setupActiveRoom) return;

    setSetupRoomsDraft((prev) =>
      normalizeFloorRooms(prev).map((room) =>
        room.room_key === setupActiveRoom.room_key
          ? { ...room, tables: [] }
          : room,
      ),
    );
  };

  const saveRoomSetup = async () => {
    const savedRooms = await persistFloorRooms(setupRoomsDraft);
    setSetupRoomsDraft(savedRooms);
    setShowRoomSetupModal(false);
  };

  const handleRenameRoom = (roomKey) => {
    const room = floorRooms.find((item) => item.room_key === roomKey);
    if (!room) return;

    const roomName = window.prompt("Rename room", room.room_name);
    const cleanName = String(roomName || "").trim();
    if (!cleanName || cleanName === room.room_name) return;

    persistFloorRooms(
      floorRooms.map((item) =>
        item.room_key === roomKey ? { ...item, room_name: cleanName } : item,
      ),
    );
  };

  const handleDeleteRoom = (roomKey) => {
    if (floorRooms.length <= 1) {
      alert("You need at least one room.");
      return;
    }

    const room = floorRooms.find((item) => item.room_key === roomKey);
    if (!room) return;

    if (
      !window.confirm(
        `Delete ${room.room_name}? Tables will move to another room.`,
      )
    ) {
      return;
    }

    const targetRoom = floorRooms.find((item) => item.room_key !== roomKey);
    if (!targetRoom) return;

    const movingTables = room.tables || [];
    const nextRooms = floorRooms
      .filter((item) => item.room_key !== roomKey)
      .map((item) =>
        item.room_key === targetRoom.room_key
          ? {
              ...item,
              tables: buildUniqueTableNames([
                ...(item.tables || []),
                ...movingTables,
              ]),
            }
          : item,
      );

    if (activeRoomKey === roomKey) {
      setActiveRoomKey(targetRoom.room_key);
    }

    persistFloorRooms(nextRooms);
  };

  const moveFloorItemToRoom = (item, targetRoomKey) => {
    if (!targetRoomKey || targetRoomKey === activeRoomKey) return;

    const movingTables = buildUniqueTableNames(
      item?.tableNames?.length ? item.tableNames : getTableMergeParts(item),
    );
    const movingTableSet = new Set(movingTables.map(normalizeTableName));

    if (movingTables.length === 0) return;

    const nextRooms = floorRooms.map((room) => {
      const keptTables = (room.tables || []).filter(
        (tableName) => !movingTableSet.has(normalizeTableName(tableName)),
      );

      if (room.room_key === targetRoomKey) {
        return {
          ...room,
          tables: buildUniqueTableNames([...keptTables, ...movingTables]),
        };
      }

      return {
        ...room,
        tables: keptTables,
      };
    });

    setActiveRoomKey(targetRoomKey);
    persistFloorRooms(nextRooms);
  };

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

<<<<<<< HEAD
  // Kiosk Mode: skip table selection and open ordering screen immediately.
  useEffect(() => {
    if (layoutMode !== "Kiosk") return;

    if (location.state?.kioskEdit) {
      const { kioskTransactionId, kioskTableName } = location.state;
      openOrderList(
        kioskTableName || KIOSK_DEFAULT_TABLE,
        kioskTransactionId || "",
      );
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.kioskAutoOpen) {
      openOrderList(KIOSK_DEFAULT_TABLE, "");
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
=======
  const handleOrderSaved = () => {
    setTableRefreshKey((prev) => prev + 1);
  };
>>>>>>> master

  const handleTableSelect = (table) => {
    const tableValue = table.pending_table_number || table.table_number;
    const txId = table.transaction_id || "";

    if (table.hasMixedOrders) {
      alert(
        "This combined table contains more than one active order. Please separate the tables before opening an order.",
      );
      return;
    }

    if (tableHasOrder(table)) {
      setPendingTableToOpen(tableValue);
      setTransactionId(txId);
      setShowPendingConfirmModal(true);
      return;
    }

    openOrderList(tableValue, "");
  };

  const getTableMergeValue = (table) =>
    table?.tableNames?.length
      ? table.tableNames.join(" & ")
      : table?.pending_table_number || table?.table_number || "";

  const getTableMergeParts = (table) =>
    splitTableNames(getTableMergeValue(table));

  const getMergeTargetItem = (sourceId, position, size) => {
    const sourceCenter = {
      x: Number(position?.x || 0) + size.width / 2,
      y: Number(position?.y || 0) + size.height / 2,
    };

    return (
      positionedFloorItems
        .filter((item) => item.id !== sourceId)
        .map((item) => {
          const itemSize = item.size || getFloorItemSize(item);
          const itemPosition = item.position || { x: 0, y: 0 };
          const itemCenter = {
            x: Number(itemPosition.x || 0) + itemSize.width / 2,
            y: Number(itemPosition.y || 0) + itemSize.height / 2,
          };
          const isInside =
            sourceCenter.x >= Number(itemPosition.x || 0) - 18 &&
            sourceCenter.x <=
              Number(itemPosition.x || 0) + itemSize.width + 18 &&
            sourceCenter.y >= Number(itemPosition.y || 0) - 18 &&
            sourceCenter.y <=
              Number(itemPosition.y || 0) + itemSize.height + 18;
          const distance = Math.hypot(
            sourceCenter.x - itemCenter.x,
            sourceCenter.y - itemCenter.y,
          );

          return {
            item,
            distance,
            isInside,
          };
        })
        .filter(
          ({ distance, isInside }) =>
            isInside || distance <= FLOOR_DROP_DISTANCE,
        )
        .sort((a, b) => {
          if (a.isInside && !b.isInside) return -1;
          if (!a.isInside && b.isInside) return 1;
          return a.distance - b.distance;
        })[0]?.item || null
    );
  };

  const mergeFloorItems = (sourceItem, targetItem) => {
    const sourceTxIds = sourceItem.transactionIds || [];
    const targetTxIds = targetItem.transactionIds || [];
    const mergedTxIds = [...new Set([...sourceTxIds, ...targetTxIds])].filter(
      Boolean,
    );

    if (mergedTxIds.length > 1) {
      alert(
        "Both tables already have active orders. Open one table first, then merge from the order screen.",
      );
      return false;
    }

    const mergedTables = buildUniqueTableNames([
      ...getTableMergeParts(sourceItem),
      ...getTableMergeParts(targetItem),
    ]);

    if (mergedTables.length < 2) return false;

    const mergedGroupId = getGroupItemId(mergedTables);
    const mergedNameSet = new Set(mergedTables.map(normalizeTableName));
    const originalPositions = {};

    [sourceItem, targetItem].forEach((floorItem) => {
      const itemOriginalPositions =
        floorItem.original_positions ||
        floorItem.originalPositions ||
        floorItem.originalPositionsByTable ||
        {};

      (floorItem.tableNames || []).forEach((tableName, index) => {
        const tableId = getTableItemId(tableName);
        const existingPosition =
          itemOriginalPositions[tableId] || itemOriginalPositions[tableName];
        const validExistingPosition =
          getValidFloorPosition(existingPosition);

        originalPositions[tableId] =
          validExistingPosition
            ? validExistingPosition
            : floorItem.isGroup
              ? {
                  x:
                    Number(floorItem.position?.x || 0) +
                    (index % 3) * FLOOR_TABLE_BASE_WIDTH,
                  y:
                    Number(floorItem.position?.y || 0) +
                    Math.floor(index / 3) * FLOOR_TABLE_BASE_HEIGHT,
                }
              : {
                  x: Math.max(0, Number(floorItem.position?.x || 0)),
                  y: Math.max(0, Number(floorItem.position?.y || 0)),
              };
      });
    });

    const mergedBounds = getFloorPositionsBounds(
      mergedTables,
      originalPositions,
    );

    setFloorLayout((prev) => {
      const positions = { ...prev.positions };
      const groupPosition = mergedBounds ||
        positions[targetItem.id] ||
        targetItem.position || { x: 24, y: 24 };

      delete positions[sourceItem.id];
      delete positions[targetItem.id];

      mergedTables.forEach((tableName) => {
        delete positions[getTableItemId(tableName)];
      });

      positions[mergedGroupId] = {
        x: Math.max(0, Number(groupPosition.x || 0)),
        y: Math.max(0, Number(groupPosition.y || 0)),
      };

      const groups = prev.groups.filter((group) => {
        if (group.id === sourceItem.id || group.id === targetItem.id) {
          return false;
        }

        return !buildUniqueTableNames(group.tables || []).some((tableName) =>
          mergedNameSet.has(normalizeTableName(tableName)),
        );
      });

      return {
        positions,
        groups: [
          ...groups,
          {
            id: mergedGroupId,
            tables: mergedTables,
            original_positions: originalPositions,
            active_transaction_id: mergedTxIds[0] || "",
          },
        ],
      };
    });

    return true;
  };

  const splitFloorGroup = (event, item) => {
    event.stopPropagation();
    event.preventDefault();

    if (!item.isGroup) return;

    setFloorLayout((prev) => {
      const positions = { ...prev.positions };
      const groupPosition = positions[item.id] ||
        item.position || { x: 24, y: 24 };

      delete positions[item.id];

      item.tableNames.forEach((tableName, index) => {
        const originalPositions =
          item.original_positions ||
          item.originalPositions ||
          item.originalPositionsByTable ||
          {};
        const originalPosition =
          originalPositions[getTableItemId(tableName)] ||
          originalPositions[tableName];

        positions[getTableItemId(tableName)] =
          originalPosition &&
          Number.isFinite(Number(originalPosition.x)) &&
          Number.isFinite(Number(originalPosition.y))
            ? {
                x: Math.max(0, Number(originalPosition.x)),
                y: Math.max(0, Number(originalPosition.y)),
              }
            : {
                x: Math.max(
                  0,
                  Number(groupPosition.x || 0) + (index % 3) * 300,
                ),
                y: Math.max(
                  0,
                  Number(groupPosition.y || 0) + Math.floor(index / 3) * 240,
                ),
              };
      });

      return {
        positions,
        groups: prev.groups.filter((group) => group.id !== item.id),
      };
    });
  };

  const getSingleTableRestorePosition = (group, tableName, index) => {
    const groupPosition = floorLayout.positions[group.id] ||
      group.position || { x: 24, y: 24 };
    const originalPositions =
      group.original_positions ||
      group.originalPositions ||
      group.originalPositionsByTable ||
      {};
    const tablePosition =
      originalPositions[getTableItemId(tableName)] ||
      originalPositions[tableName];

    if (
      tablePosition &&
      Number.isFinite(Number(tablePosition.x)) &&
      Number.isFinite(Number(tablePosition.y))
    ) {
      return {
        x: Math.max(0, Number(tablePosition.x)),
        y: Math.max(0, Number(tablePosition.y)),
      };
    }

    return {
      x: Math.max(0, Number(groupPosition.x || 0) + (index % 3) * 300),
      y: Math.max(
        0,
        Number(groupPosition.y || 0) + Math.floor(index / 3) * 240,
      ),
    };
  };

  useEffect(() => {
    if (
      !floorLayoutLoadedRef.current ||
      !isTableLayoutEnabled ||
      originalTableList.length === 0 ||
      floorLayout.groups.length === 0
    ) {
      return;
    }

    const tableRowsByName = new Map(
      originalTableList.map((table) => [
        normalizeTableName(table.table_number),
        table,
      ]),
    );
    let changed = false;
    const positions = { ...floorLayout.positions };
    const groups = [];

    floorLayout.groups.forEach((group) => {
      const groupNames = buildUniqueTableNames(group?.tables || []).filter(
        (tableName) => tableRowsByName.has(normalizeTableName(tableName)),
      );

      if (groupNames.length < 2) {
        changed = true;
        return;
      }

      const groupTables = groupNames
        .map((tableName) => tableRowsByName.get(normalizeTableName(tableName)))
        .filter(Boolean);
      const liveGroupData = getGroupData(groupNames, groupTables);
      const trackedTransactionId = String(
        group.active_transaction_id || group.activeTransactionId || "",
      ).trim();

      if (trackedTransactionId && !liveGroupData.transaction_id) {
        changed = true;
        delete positions[group.id];

        groupNames.forEach((tableName, index) => {
          positions[getTableItemId(tableName)] = getSingleTableRestorePosition(
            group,
            tableName,
            index,
          );
        });

        return;
      }

      if (
        liveGroupData.transaction_id &&
        trackedTransactionId !== String(liveGroupData.transaction_id)
      ) {
        changed = true;
        groups.push({
          ...group,
          active_transaction_id: String(liveGroupData.transaction_id),
        });
        return;
      }

      groups.push(group);
    });

    if (changed) {
      setFloorLayout((prev) => ({
        ...prev,
        positions,
        groups,
      }));
    }
  }, [
    floorLayout.groups,
    floorLayout.positions,
    isTableLayoutEnabled,
    originalTableList,
  ]);

  useEffect(() => {
    if (
      !floorLayoutLoadedRef.current ||
      !isTableLayoutEnabled ||
      isLayoutLoading ||
      pendingMergedTableGroups.length === 0
    ) {
      return;
    }

    const pendingGroupsBySignature = new Map(
      pendingMergedTableGroups.map((group) => [group.signature, group]),
    );
    const pendingTableKeys = new Set(
      pendingMergedTableGroups.flatMap((group) =>
        group.tables.map(normalizeTableName),
      ),
    );

    setFloorLayout((prev) => {
      const positions = { ...prev.positions };
      const groups = [];
      const existingSignatures = new Set();
      let changed = false;

      prev.groups.forEach((group) => {
        const groupNames = buildUniqueTableNames(group?.tables || []);
        const signature = getGroupSignature(groupNames);
        const pendingGroup = pendingGroupsBySignature.get(signature);
        const overlapsPendingGroup = groupNames.some((tableName) =>
          pendingTableKeys.has(normalizeTableName(tableName)),
        );

        if (overlapsPendingGroup && !pendingGroup) {
          const originalPositions =
            group.original_positions ||
            group.originalPositions ||
            group.originalPositionsByTable ||
            {};

          groupNames.forEach((tableName, index) => {
            const tableId = getTableItemId(tableName);
            const restorePosition =
              getValidFloorPosition(
                originalPositions[tableId] || originalPositions[tableName],
              ) ||
              defaultRoomTablePositions.get(normalizeTableName(tableName)) ||
              getDefaultFloorPosition(index);

            positions[tableId] = restorePosition;
          });

          delete positions[group.id || getGroupItemId(groupNames)];
          changed = true;
          return;
        }

        if (pendingGroup) {
          existingSignatures.add(signature);

          const activeTransactionId = String(
            group.active_transaction_id || group.activeTransactionId || "",
          );
          const shouldUpdate =
            group.id !== pendingGroup.id ||
            activeTransactionId !== pendingGroup.active_transaction_id ||
            getGroupSignature(group.tables || []) !== pendingGroup.signature;

          groups.push(
            shouldUpdate
              ? {
                  ...group,
                  id: pendingGroup.id,
                  tables: pendingGroup.tables,
                  active_transaction_id: pendingGroup.active_transaction_id,
                }
              : group,
          );

          changed = changed || shouldUpdate;
          return;
        }

        groups.push(group);
      });

      pendingMergedTableGroups.forEach((pendingGroup) => {
        if (existingSignatures.has(pendingGroup.signature)) return;

        const originalPositions = {};

        pendingGroup.tables.forEach((tableName, index) => {
          const tableId = getTableItemId(tableName);
          originalPositions[tableId] =
            getValidFloorPosition(positions[tableId]) ||
            defaultRoomTablePositions.get(normalizeTableName(tableName)) ||
            getDefaultFloorPosition(index);
        });

        const groupBounds = getFloorPositionsBounds(
          pendingGroup.tables,
          originalPositions,
        );

        pendingGroup.tables.forEach((tableName) => {
          delete positions[getTableItemId(tableName)];
        });

        positions[pendingGroup.id] = {
          x: Math.max(0, Number(groupBounds?.x || 24)),
          y: Math.max(0, Number(groupBounds?.y || 24)),
        };

        groups.push({
          id: pendingGroup.id,
          tables: pendingGroup.tables,
          original_positions: originalPositions,
          active_transaction_id: pendingGroup.active_transaction_id,
        });

        existingSignatures.add(pendingGroup.signature);
        changed = true;
      });

      if (!changed) return prev;

      return {
        ...prev,
        positions,
        groups,
      };
    });
  }, [
    defaultRoomTablePositions,
    floorLayout.groups,
    isLayoutLoading,
    isTableLayoutEnabled,
    pendingMergedTableGroups,
  ]);

  const handleFloorPointerDown = (event, item) => {
    if (event.button !== 0) return;
    if (event.target.closest("[data-floor-action]")) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    setFloorDrag({
      item,
      itemId: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: Number(item.position?.x || 0),
      originY: Number(item.position?.y || 0),
      moved: false,
    });

    setDropTargetTable("");
  };

  const handleFloorPointerMove = (event, item) => {
    if (!floorDrag || floorDrag.itemId !== item.id) return;

    event.preventDefault();

    const dx = event.clientX - floorDrag.startX;
    const dy = event.clientY - floorDrag.startY;
    const nextPosition = {
      x: Math.max(0, floorDrag.originX + dx),
      y: Math.max(0, floorDrag.originY + dy),
    };
    const moved = floorDrag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;

    setFloorLayout((prev) => ({
      ...prev,
      positions: {
        ...prev.positions,
        [item.id]: nextPosition,
      },
    }));

    if (moved) {
      const targetItem = getMergeTargetItem(item.id, nextPosition, item.size);
      setDropTargetTable(targetItem?.id || "");
    }

    setFloorDrag((prev) =>
      prev && prev.itemId === item.id
        ? {
            ...prev,
            moved,
            currentPosition: nextPosition,
          }
        : prev,
    );
  };

  const handleFloorPointerUp = (event, item) => {
    if (!floorDrag || floorDrag.itemId !== item.id) return;

    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(floorDrag.pointerId);

    const dragSnapshot = floorDrag;
    const finalPosition = floorLayout.positions[item.id] ||
      dragSnapshot.currentPosition ||
      item.position || { x: 0, y: 0 };
    const targetItem = dragSnapshot.moved
      ? getMergeTargetItem(item.id, finalPosition, item.size)
      : null;

    setFloorDrag(null);
    setDropTargetTable("");

    if (dragSnapshot.moved) {
      if (targetItem) {
        mergeFloorItems(item, targetItem);
      }
      return;
    }

    handleTableSelect(item);
  };

  const handleFloorPointerCancel = () => {
    setFloorDrag(null);
    setDropTargetTable("");
  };

  const resetActiveRoomLayout = () => {
    if (!isTableLayoutEnabled || !activeRoom) return;

    const shouldReset = window.confirm(
      `Reset the layout for ${activeRoom.room_name}? Table assignments will stay in this room.`,
    );

    if (!shouldReset) return;

    setFloorDrag(null);
    setDropTargetTable("");
    floorLayoutLoadedRef.current = true;
    setFloorLayout(getDefaultFloorLayout());
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
        backgroundColor: pageBg,
        color: pageText,
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
          background: `linear-gradient(180deg, ${toRgba(pageBg, 0.82)} 0%, ${toRgba(
            pageBg,
            0.9,
          )} 55%, ${toRgba(pageBg, 0.96)} 100%)`,
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
            onOrderSaved={handleOrderSaved}
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

      <AnimatePresence>
        {showAddRoomModal && (
          <motion.div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 px-4 py-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveNewRoom();
              }}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-white/30"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                    Room Setup
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    Add Room
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeAddRoomModal}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="px-6 py-5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(event) => setNewRoomName(event.target.value)}
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-black text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  placeholder="Main Hall"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeAddRoomModal}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!String(newRoomName || "").trim() || isRoomsSaving}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRoomsSaving ? "Saving..." : "Create Room"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoomSetupModal && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] bg-slate-50 shadow-2xl ring-1 ring-white/30"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                    Room Setup
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    Assign Tables
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Choose a room, then mark every table that belongs there.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRoomSetupModal(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-950 p-4">
                  <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Rooms
                  </p>

                  <div className="flex flex-col gap-2">
                    {setupRoomsDraft.map((room) => {
                      const isActive = room.room_key === setupActiveRoom?.room_key;

                      return (
                        <button
                          key={room.room_key}
                          type="button"
                          onClick={() => setSetupRoomKey(room.room_key)}
                          className="rounded-2xl border px-4 py-3 text-left transition-all hover:translate-x-1"
                          style={{
                            background: isActive
                              ? `linear-gradient(135deg, ${accent} 0%, ${accentSecondary} 100%)`
                              : "rgba(255,255,255,0.05)",
                            borderColor: isActive
                              ? accent
                              : "rgba(255,255,255,0.08)",
                            color: "#ffffff",
                          }}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="block truncate text-sm font-black">
                              {room.room_name}
                            </span>
                            {isActive ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
                            ) : null}
                          </span>
                          <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200">
                            {(room.tables || []).length} tables
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Selected Room
                        </p>
                        <h3 className="text-xl font-black text-slate-900">
                          {setupActiveRoom?.room_name || DEFAULT_ROOM_NAME}
                        </h3>
                        <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-100">
                          {setupActiveRoomTableCount} assigned tables
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={assignVisibleTablesToSetupRoom}
                          disabled={!setupActiveRoom || setupFilteredTables.length === 0}
                          className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Assign Visible
                        </button>

                        <button
                          type="button"
                          onClick={clearSetupRoomTables}
                          disabled={!setupActiveRoom}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Clear Room
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-4">
                      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                      <input
                        type="text"
                        value={setupSearch}
                        onChange={(event) => setSetupSearch(event.target.value)}
                        placeholder="Search all tables..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {setupFilteredTables.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm font-semibold text-slate-500">
                        No tables found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {setupFilteredTables.map((table) => {
                          const tableName = table.table_number;
                          const assignedRoomKey = getAssignedRoomKey(
                            tableName,
                            setupRoomsDraft,
                          );
                          const assignedRoom = setupRoomsDraft.find(
                            (room) => room.room_key === assignedRoomKey,
                          );
                          const isAssignedToSetup =
                            assignedRoomKey === setupActiveRoom?.room_key;
                          const assignmentLabel = isAssignedToSetup
                            ? "In this room"
                            : assignedRoom
                              ? `In ${assignedRoom.room_name}`
                              : "Unassigned";
                          const statusColors = isAssignedToSetup
                            ? {
                                bg: toRgba(accent, 0.12),
                                text: accent,
                                ring: toRgba(accent, 0.24),
                              }
                            : assignedRoom
                              ? {
                                  bg: toRgba(accentSecondary, 0.12),
                                  text: accentSecondary,
                                  ring: toRgba(accentSecondary, 0.24),
                                }
                              : {
                                  bg: surfaceSoft,
                                  text: mutedText,
                                  ring: border,
                                };

                          return (
                            <button
                              key={tableName}
                              type="button"
                              onClick={() =>
                                setDraftTableAssigned(
                                  tableName,
                                  setupActiveRoom?.room_key,
                                  !isAssignedToSetup,
                                )
                              }
                              disabled={!setupActiveRoom}
                              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                borderColor: isAssignedToSetup
                                  ? accent
                                  : "#e2e8f0",
                                boxShadow: isAssignedToSetup
                                  ? `0 16px 34px ${toRgba(accent, 0.14)}`
                                  : undefined,
                              }}
                            >
                              {isAssignedToSetup ? (
                                <span className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />
                              ) : null}

                              <span
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black transition-all group-hover:scale-105"
                                style={{
                                  backgroundColor: isAssignedToSetup
                                    ? accent
                                    : "#f8fafc",
                                  borderColor: isAssignedToSetup
                                    ? accent
                                    : "#cbd5e1",
                                  color: isAssignedToSetup
                                    ? getContrastText(accent, "#ffffff")
                                    : mutedText,
                                }}
                              >
                                {isAssignedToSetup ? (
                                  <FaCheck size={14} />
                                ) : (
                                  getCompactTableLabel(tableName)
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="block truncate text-sm font-black text-slate-900">
                                    {tableName}
                                  </span>
                                  <span
                                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1"
                                    style={{
                                      backgroundColor: statusColors.bg,
                                      color: statusColors.text,
                                      boxShadow: `inset 0 0 0 1px ${statusColors.ring}`,
                                    }}
                                  >
                                    {assignmentLabel}
                                  </span>
                                </span>
                                <span className="mt-2 block truncate text-xs font-semibold text-slate-500">
                                  {isAssignedToSetup
                                    ? `Click to remove from ${setupActiveRoom?.room_name}`
                                    : `Click to assign to ${setupActiveRoom?.room_name}`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setShowRoomSetupModal(false)}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={saveRoomSetup}
                      disabled={isRoomsSaving}
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isRoomsSaving ? "Saving..." : "Save Assignments"}
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="sticky top-0 z-40 backdrop-blur-xl px-4 py-4 mb-8 border-b"
        style={{
          backgroundColor: toRgba(pageBg, 0.74),
          borderColor: pageBorder,
        }}
      >
        <div className="flex items-center justify-between mx-auto max-w-7xl">
          <button
            onClick={() => navigate("/poscorehomescreen")}
            className="flex items-center gap-3 mt-2 px-10 py-6 rounded-full transition-all border"
            style={{
              backgroundColor: pageSurfaceSoft,
              borderColor: pageBorder,
              color: pageText,
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
                backgroundColor: pageSurfaceSoft,
                borderColor: pageBorder,
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
                      : pageMutedText,
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
                      : pageMutedText,
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
                style={{ color: pageMutedText }}
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
            {isTableLayoutEnabled ? (
              <>
                <h1
                  className="text-4xl md:text-6xl font-black tracking-tighter mb-2"
                  style={{ color: pageText }}
                >
                  Table <span style={{ color: accent }}>Floor</span>
                </h1>
                <div
                  className="flex flex-wrap gap-2"
                  style={{ color: pageMutedText }}
                >
                  <span
                    className="rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em]"
                    style={{
                      borderColor: toRgba(availableColor, 0.34),
                      backgroundColor: toRgba(availableColor, 0.12),
                      color: availableColor,
                    }}
                  >
                    Available {availableCount}
                  </span>
                  <span
                    className="rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em]"
                    style={{
                      borderColor: toRgba(occupiedColor, 0.28),
                      backgroundColor: toRgba(occupiedColor, 0.1),
                      color: pageMutedText,
                    }}
                  >
                    Occupied {occupiedCount}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h1
                  className="text-4xl md:text-6xl font-black tracking-tighter mb-2"
                  style={{ color: pageText }}
                >
                  Pending <span style={{ color: accent }}>Tables</span>
                </h1>
                <p style={{ color: pageMutedText }}>
                  Click a table to manage guest orders.
                </p>
              </>
            )}
          </motion.div>

          <div className="flex flex-col w-full gap-3 lg:flex-row lg:w-auto lg:items-center">
            <div
              className="rounded-[2rem] px-6 py-4 backdrop-blur-sm w-full lg:w-auto border"
              style={{
                backgroundColor: pageSurfaceSoft,
                borderColor: pageBorder,
              }}
            >
              <label
                className="block text-[10px] font-black uppercase tracking-[0.3em] mb-2"
                style={{ color: pageMutedText }}
              >
                Date
              </label>
              <div className="min-w-[140px]" style={{ color: pageText }}>
                {isDateLoading ? "Loading..." : selectedDate || "No open shift"}
              </div>
            </div>

            <div className="relative w-full group lg:w-96">
              <FaSearch
                className="absolute z-20 -translate-y-1/2 left-5 top-1/2"
                style={{ color: pageMutedText }}
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
                  backgroundColor: pageSurfaceSoft,
                  borderColor: pageBorder,
                  color: pageText,
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

        <main className=" w-full">
          {isPageLoading ? (
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
          ) : shouldShowEmptyState ? (
            <div
              className="rounded-[1.5rem] border px-6 py-12 text-center"
              style={{
                backgroundColor: surfaceSoft,
                borderColor: border,
                color: mutedText,
              }}
            >
              No tables found.
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "card" ? (
                isTableLayoutEnabled ? (
                  <div
                    className="grid overflow-hidden rounded-[1.5rem] border shadow-2xl lg:grid-cols-[190px_minmax(0,1fr)]"
                    style={{
                      backgroundColor: pageSurfaceStrong,
                      borderColor: pageBorderStrong,
                      boxShadow: `0 28px 70px ${toRgba(pageBg, 0.42)}`,
                    }}
                  >
                    <aside
                      className="p-4"
                      style={{
                        backgroundColor: pageSurfaceStrong,
                        color: pageText,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className="text-[10px] font-black uppercase tracking-[0.24em]"
                            style={{ color: pageSoftText }}
                          >
                            {isRoomsSaving ? "Saving" : "Rooms"}
                          </p>
                          <h3 className="mt-1 text-lg font-black">Available</h3>
                        </div>

                        <button
                          type="button"
                          onClick={openAddRoomModal}
                          disabled={isRoomsSaving}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                          style={{
                            backgroundColor: availableColor,
                            color: getContrastText(availableColor, "#ffffff"),
                          }}
                        >
                          <FiPlus size={16} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={openRoomSetup}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                        style={{
                          background:
                            `linear-gradient(135deg, ${accent} 0%, ${accentSecondary} 100%)`,
                          color: getContrastText(accent, "#ffffff"),
                          boxShadow: `0 16px 28px ${accentGlow}`,
                        }}
                      >
                        <FiEdit2 size={14} />
                        <span>Assign Tables</span>
                      </button>

                      <button
                        type="button"
                        onClick={resetActiveRoomLayout}
                        disabled={!activeRoom || isLayoutLoading}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                        style={{
                          backgroundColor: toRgba(pageText, 0.08),
                          borderColor: pageBorder,
                          color: pageText,
                        }}
                      >
                        <FiRotateCcw size={14} />
                        <span>Reset Layout</span>
                      </button>

                      <div className="mt-5 flex flex-col gap-2">
                        {floorRooms.map((room) => {
                          const isActive = room.room_key === activeRoomKey;
                          const roomCount = (room.tables || []).length;

                          return (
                            <div
                              key={room.room_key}
                              className="group flex items-center gap-2 rounded-xl border p-1.5"
                              style={{
                                backgroundColor: isActive
                                  ? accent
                                  : toRgba(pageText, 0.04),
                                borderColor: isActive
                                  ? accentSecondary
                                  : pageBorder,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveRoomKey(room.room_key)}
                                className="min-w-0 flex-1 rounded-xl px-3 py-3 text-left transition-all"
                              >
                                <span
                                  className="block truncate text-sm font-black"
                                  style={{
                                    color: isActive
                                      ? getContrastText(accent, "#ffffff")
                                      : pageText,
                                  }}
                                >
                                  {room.room_name}
                                </span>
                                <span
                                  className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em]"
                                  style={{
                                    color: isActive
                                      ? toRgba(
                                          getContrastText(accent, "#ffffff"),
                                          0.72,
                                        )
                                      : pageSoftText,
                                  }}
                                >
                                  {roomCount} tables
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRenameRoom(room.room_key)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all"
                                style={{
                                  color: isActive
                                    ? getContrastText(accent, "#ffffff")
                                    : pageText,
                                  backgroundColor: toRgba(pageText, 0.08),
                                }}
                              >
                                <FiEdit2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteRoom(room.room_key)}
                                disabled={floorRooms.length <= 1}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-35"
                                style={{
                                  color: isActive
                                    ? getContrastText(accent, "#ffffff")
                                    : pageText,
                                  backgroundColor: toRgba(pageText, 0.08),
                                }}
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </aside>

                    <motion.div
                      key="card-view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="overflow-y-auto overflow-x-hidden p-5"
                      style={{
                        backgroundColor: pageSurfaceSoft,
                      }}
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p
                            className="text-[10px] font-black uppercase tracking-[0.22em]"
                            style={{ color: pageSoftText }}
                          >
                            Restaurant Floor
                          </p>
                          <h2
                            className="text-xl font-black"
                            style={{ color: pageText }}
                          >
                            {activeRoom?.room_name || DEFAULT_ROOM_NAME}
                          </h2>
                        </div>
                        <div
                          className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em]"
                          style={{ color: pageMutedText }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: availableColor,
                                boxShadow: `0 0 12px ${toRgba(
                                  availableColor,
                                  0.8,
                                )}`,
                              }}
                            />
                            Available
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: occupiedColor,
                                opacity: 0.62,
                              }}
                            />
                            Occupied
                          </span>
                        </div>
                      </div>
                      <div
                        ref={floorRef}
                        className="relative rounded-xl border"
                        style={{
                          width: "100%",
                          minWidth: 0,
                          height: floorBounds.height,
                          backgroundColor: pageBg,
                          backgroundImage:
                            `linear-gradient(${pageBorderStrong} 1px, transparent 1px), linear-gradient(90deg, ${pageBorderStrong} 1px, transparent 1px)`,
                          backgroundSize: "24px 24px",
                          borderColor: pageBorder,
                        }}
                      >
                        {positionedFloorItems.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                            <div
                              className="rounded-xl border border-dashed px-8 py-7 shadow-sm"
                              style={{
                                backgroundColor: pageSurfaceSoft,
                                borderColor: pageBorderStrong,
                              }}
                            >
                              <p
                                className="text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: pageSoftText }}
                              >
                                Empty Room
                              </p>
                              <p
                                className="mt-2 max-w-sm text-sm font-semibold"
                                style={{ color: pageMutedText }}
                              >
                                Use the room selector on a table from another
                                room to move it here. The room tabs stay
                                available on the left.
                              </p>
                            </div>
                          </div>
                        )}

                        {positionedFloorItems.map((item) => {
                          const tableTone = item.isOccupied
                            ? occupiedColor
                            : availableColor;
                          const isDropTarget = dropTargetTable === item.id;
                          const isDragging = floorDrag?.itemId === item.id;
                          const groupBounds = item.isGroup
                            ? getFloorItemOriginalBounds(item)
                            : null;
                          const groupOriginalPositions =
                            item.original_positions ||
                            item.originalPositions ||
                            item.originalPositionsByTable ||
                            {};
                          const groupLayoutHeight = item.isGroup
                            ? Math.max(
                                groupBounds?.height || 0,
                                Number(item.size?.height || 0) -
                                  FLOOR_GROUP_LABEL_HEIGHT,
                              )
                            : 0;
                          const groupBoundsOffsetX =
                            item.isGroup && groupBounds
                              ? Math.max(
                                  0,
                                  (Number(item.size?.width || 0) -
                                    groupBounds.width) /
                                    2,
                                )
                              : 0;
                          const groupBoundsOffsetY =
                            item.isGroup && groupBounds
                              ? Math.max(
                                  0,
                                  (groupLayoutHeight - groupBounds.height) / 2,
                                )
                              : 0;
                          const isVerticalGroup =
                            item.isGroup &&
                            groupBounds &&
                            groupBounds.height > groupBounds.width;

                          return (
                            <motion.div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{
                                opacity: 1,
                                scale: isDragging ? 1.02 : 1,
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  handleTableSelect(item);
                                }
                              }}
                              onPointerDown={(event) =>
                                handleFloorPointerDown(event, item)
                              }
                              onPointerMove={(event) =>
                                handleFloorPointerMove(event, item)
                              }
                              onPointerUp={(event) =>
                                handleFloorPointerUp(event, item)
                              }
                              onPointerCancel={handleFloorPointerCancel}
                              className="group absolute flex select-none flex-col items-center justify-center overflow-visible rounded-[1.25rem] border p-4 text-center outline-none transition-shadow"
                              style={{
                                left: Number(item.position?.x || 0),
                                top: Number(item.position?.y || 0),
                                width: item.size.width,
                                height: item.size.height,
                                cursor: isDragging ? "grabbing" : "grab",
                                touchAction: "none",
                                background: isDropTarget
                                  ? toRgba(tableTone, 0.12)
                                  : "transparent",
                                borderColor: isDropTarget
                                  ? tableTone
                                  : "transparent",
                                boxShadow: isDropTarget
                                  ? `0 0 0 3px ${toRgba(
                                      tableTone,
                                      0.34,
                                    )}, 0 20px 42px ${toRgba(tableTone, 0.2)}`
                                  : "none",
                                color: item.isOccupied
                                  ? pageMutedText
                                  : getContrastText(
                                      availableColor,
                                      pageText,
                                    ),
                                zIndex: isDragging || isDropTarget ? 20 : 1,
                              }}
                            >
                              {item.isGroup && (
                                <button
                                  type="button"
                                  data-floor-action="split"
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onClick={(event) =>
                                    splitFloorGroup(event, item)
                                  }
                                  className="absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border"
                                  style={{
                                    backgroundColor: pageSurfaceStrong,
                                    borderColor: pageBorderStrong,
                                    color: pageText,
                                  }}
                                >
                                  <FiX size={14} />
                                </button>
                              )}

                              {floorRooms.length > 1 && (
                                <select
                                  data-floor-action="room"
                                  value={activeRoomKey}
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    moveFloorItemToRoom(
                                      item,
                                      event.target.value,
                                    )
                                  }
                                  className={`absolute top-3 z-20 max-w-[132px] rounded-full border px-2 py-1 text-[10px] font-bold outline-none ${
                                    item.isGroup ? "left-12" : "left-3"
                                  }`}
                                  style={{
                                    backgroundColor: pageSurfaceStrong,
                                    borderColor: pageBorderStrong,
                                    color: pageText,
                                  }}
                                >
                                  {floorRooms.map((room) => (
                                    <option
                                      key={room.room_key}
                                      value={room.room_key}
                                    >
                                      {room.room_name}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div
                                className="absolute right-5 top-5 h-3 w-3 rounded-full shadow"
                                style={{
                                  backgroundColor: tableTone,
                                  boxShadow: `0 0 0 5px ${toRgba(tableTone, 0.12)}`,
                                  opacity: item.isOccupied ? 0.72 : 1,
                                }}
                              />

                              {item.isGroup && (
                                <div
                                  className={
                                    isVerticalGroup
                                      ? "absolute left-1/2 top-16 z-0 w-2 -translate-x-1/2 rounded-full"
                                      : "absolute left-14 right-14 top-[104px] z-0 h-2 rounded-full"
                                  }
                                  style={{
                                    backgroundColor: toRgba(tableTone, 0.32),
                                    ...(isVerticalGroup
                                      ? {
                                          height: Math.max(
                                            80,
                                            groupLayoutHeight - 128,
                                          ),
                                        }
                                      : {}),
                                  }}
                                />
                              )}

                              <div
                                className={
                                  item.isGroup && groupBounds
                                    ? "absolute inset-0 z-10"
                                    : `relative z-10 flex max-w-full items-center justify-center ${
                                        item.isGroup ? "flex-wrap gap-10" : ""
                                      }`
                                }
                              >
                                {item.tableNames.map((tableName) => {
                                  const tableId = getTableItemId(tableName);
                                  const originalPosition =
                                    getValidFloorPosition(
                                      groupOriginalPositions[tableId] ||
                                        groupOriginalPositions[tableName],
                                    );
                                  const groupTableStyle =
                                    item.isGroup &&
                                    groupBounds &&
                                    originalPosition
                                      ? {
                                          left:
                                            groupBoundsOffsetX +
                                            originalPosition.x -
                                            groupBounds.x +
                                            (FLOOR_TABLE_BASE_WIDTH -
                                              FLOOR_TABLE_VISUAL_WIDTH) /
                                              2,
                                          top:
                                            groupBoundsOffsetY +
                                            originalPosition.y -
                                            groupBounds.y +
                                            (FLOOR_TABLE_BASE_HEIGHT -
                                              FLOOR_TABLE_VISUAL_HEIGHT) /
                                              2,
                                        }
                                      : undefined;

                                  return (
                                    <div
                                      key={tableName}
                                      className={`h-32 w-44 shrink-0 ${
                                        item.isGroup &&
                                        groupBounds &&
                                        originalPosition
                                          ? "absolute"
                                          : "relative"
                                      }`}
                                      style={groupTableStyle}
                                    >
                                    <div
                                      className="absolute left-1/2 top-0 h-7 w-20 -translate-x-1/2 rounded-full border"
                                      style={{
                                        backgroundColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.12 : 0.2,
                                        ),
                                        borderColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.28 : 0.48,
                                        ),
                                      }}
                                    />
                                    <div
                                      className="absolute bottom-0 left-1/2 h-7 w-20 -translate-x-1/2 rounded-full border"
                                      style={{
                                        backgroundColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.12 : 0.2,
                                        ),
                                        borderColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.28 : 0.48,
                                        ),
                                      }}
                                    />
                                    <div
                                      className="absolute left-0 top-1/2 h-20 w-7 -translate-y-1/2 rounded-full border"
                                      style={{
                                        backgroundColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.12 : 0.2,
                                        ),
                                        borderColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.28 : 0.48,
                                        ),
                                      }}
                                    />
                                    <div
                                      className="absolute right-0 top-1/2 h-20 w-7 -translate-y-1/2 rounded-full border"
                                      style={{
                                        backgroundColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.12 : 0.2,
                                        ),
                                        borderColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.28 : 0.48,
                                        ),
                                      }}
                                    />
                                    <div
                                      className="absolute left-1/2 top-1/2 flex h-24 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.35rem] border shadow-lg"
                                      style={{
                                        background: `linear-gradient(180deg, ${toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.52 : 0.95,
                                        )} 0%, ${
                                          item.isOccupied
                                            ? toRgba(tableTone, 0.72)
                                            : tableTone
                                        } 100%)`,
                                        borderColor: toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.38 : 0.72,
                                        ),
                                        boxShadow: `0 12px 28px ${toRgba(
                                          tableTone,
                                          item.isOccupied ? 0.12 : 0.28,
                                        )}`,
                                      }}
                                    >
                                      <span
                                        className="max-w-[6.5rem] break-words text-center text-4xl font-black leading-none"
                                        style={{
                                          color: getContrastText(
                                            tableTone,
                                            "#ffffff",
                                          ),
                                        }}
                                      >
                                        {getCompactTableLabel(tableName)}
                                      </span>
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>

                              <div
                                className={
                                  item.isGroup
                                    ? "absolute bottom-4 left-4 right-4 z-10 min-h-[44px] max-w-full"
                                    : "relative z-10 mt-5 min-h-[44px] max-w-full"
                                }
                              >
                                <p className="break-words text-sm font-extrabold leading-tight">
                                  {item.table_number}
                                </p>
                                <p
                                  className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]"
                                  style={{
                                    color: item.isOccupied
                                      ? pageMutedText
                                      : availableColor,
                                  }}
                                >
                                  {item.status_label}
                                </p>
                                {item.hasMixedOrders && (
                                  <p
                                    className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                                    style={{ color: pageMutedText }}
                                  >
                                    Multiple active orders
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <motion.div
                    key="default-card-view"
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
                        type="button"
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
                )
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
                      {currentTables.map((table) => {
                        const hasOrder = tableHasOrder(table);
                        const tableTone = hasOrder
                          ? occupiedColor
                          : availableColor;

                        return (
                          <tr
                            key={table.table_number}
                            className="border-b last:border-0 transition-colors"
                            style={{
                              borderColor: pageBorder,
                              backgroundColor: "transparent",
                            }}
                          >
                            <td className="p-8">
                              <div className="flex items-center gap-4">
                                <div
                                  className="flex h-12 w-12 items-center justify-center rounded-2xl font-black"
                                  style={{
                                    backgroundColor: toRgba(tableTone, 0.14),
                                    color: tableTone,
                                  }}
                                >
                                  {getCompactTableLabel(table.table_number)}
                                </div>
                                <div>
                                  <p
                                    className="font-bold leading-tight"
                                    style={{ color: pageText }}
                                  >
                                    {table.table_number}
                                  </p>
                                  {table.pending_table_number &&
                                    normalizeTableName(
                                      table.pending_table_number,
                                    ) !==
                                      normalizeTableName(
                                        table.table_number,
                                      ) && (
                                      <p
                                        className="mt-1 text-xs font-semibold"
                                        style={{ color: pageMutedText }}
                                      >
                                        {table.pending_table_number}
                                      </p>
                                    )}
                                </div>
                              </div>
                            </td>
                            <td className="p-8">
                              <span
                                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                                style={{
                                  backgroundColor: toRgba(tableTone, 0.12),
                                  color: hasOrder ? pageMutedText : availableColor,
                                  borderColor: toRgba(tableTone, 0.28),
                                }}
                              >
                                <div
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: tableTone }}
                                />
                                {table.status_label}
                              </span>
                            </td>
                            <td className="p-8 text-right">
                              <button
                                onClick={() => handleTableSelect(table)}
                                className="rounded-2xl px-6 py-3 text-xs font-bold transition-all"
                                style={{
                                  background: hasOrder
                                    ? `linear-gradient(180deg, ${toRgba(
                                        occupiedColor,
                                        0.62,
                                      )} 0%, ${toRgba(
                                        occupiedColor,
                                        0.42,
                                      )} 100%)`
                                    : `linear-gradient(180deg, ${availableColor} 0%, ${accentSecondary} 100%)`,
                                  color: getContrastText(tableTone, "#ffffff"),
                                  boxShadow: hasOrder
                                    ? `0 10px 24px ${toRgba(occupiedColor, 0.24)}`
                                    : `0 10px 24px ${toRgba(availableColor, 0.24)}`,
                                }}
                              >
                                {hasOrder ? "Open Order" : "New Order"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>

        {(!isTableLayoutEnabled || viewMode === "table") && totalPages > 1 && (
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
