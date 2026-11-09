"use client";

/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiGrid,
  FiList,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";
import { securedPosFetch } from "../../../utils/posRoleFetch";

const PosTableLayout = ({
  isDark,
  accent = "#3b82f6",
  branchInfo = {},
}) => {
  const apiHost = useApiHost();
  const tableEndpoint =
    import.meta.env.VITE_POS_MANAGE_TABLES_ENDPOINT ||
    "/api/pos_manage_tables.php";
  const [isEnabled, setIsEnabled] = useState(false);
  const [initialIsEnabled, setInitialIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tables, setTables] = useState([]);
  const [tableScope, setTableScope] = useState(null);
  const [tableName, setTableName] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [isTableListLoading, setIsTableListLoading] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [tableMessage, setTableMessage] = useState("");
  const [tableError, setTableError] = useState("");

  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  const selectedScope = useMemo(
    () => ({
      categoryCode: String(
        branchInfo?.categoryCode ||
          localStorage.getItem("posBusinessCategoryCode") ||
          "",
      ).trim(),
      unitCode: String(
        branchInfo?.unitCode ||
          localStorage.getItem("posBusinessUnitCode") ||
          "",
      ).trim(),
    }),
    [branchInfo?.categoryCode, branchInfo?.unitCode],
  );

  const tableApiUrl = useMemo(() => {
    if (!apiHost) return "";

    const params = new URLSearchParams();
    if (selectedScope.categoryCode) {
      params.set("category_code", selectedScope.categoryCode);
    }
    if (selectedScope.unitCode) {
      params.set("unit_code", selectedScope.unitCode);
    }

    const query = params.toString();
    return `${apiHost}${tableEndpoint}${query ? `?${query}` : ""}`;
  }, [apiHost, selectedScope, tableEndpoint]);

  const loadTables = useCallback(
    async ({ silent = false } = {}) => {
      if (!tableApiUrl) return;

      try {
        if (!silent) setIsTableListLoading(true);
        setTableError("");

        const response = await securedPosFetch(tableApiUrl);
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load the room list.");
        }

        setTables(Array.isArray(result?.data?.tables) ? result.data.tables : []);
        setTableScope(result?.data?.scope || null);
      } catch (err) {
        console.error(err);
        setTableError(err.message || "Failed to load the room list.");
      } finally {
        if (!silent) setIsTableListLoading(false);
      }
    },
    [tableApiUrl],
  );

  useEffect(() => {
    if (!apiHost) return;

    let cancelled = false;

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(
          `${apiHost}/api/pos_table_layout_settings.php`,
        );
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || "Failed to load room layout.");
        }

        if (!cancelled) {
          const nextIsEnabled = Boolean(
            result?.data?.table_layout_enabled || false,
          );
          setIsEnabled(nextIsEnabled);
          setInitialIsEnabled(nextIsEnabled);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load room layout.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const hasChanges = isEnabled !== initialIsEnabled;

  const saveSettings = async () => {
    if (!apiHost || isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await securedPosFetch(
        `${apiHost}/api/pos_table_layout_settings.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table_layout_enabled: isEnabled,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save room layout.");
      }

      const savedIsEnabled = Boolean(
        result?.data?.table_layout_enabled || false,
      );
      setIsEnabled(savedIsEnabled);
      setInitialIsEnabled(savedIsEnabled);
      setMessage("Room layout settings saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save room layout.");
    } finally {
      setIsSaving(false);
    }
  };

  const addTable = async (event) => {
    event.preventDefault();

    const cleanTableName = tableName.trim();
    if (!tableApiUrl || isAddingTable || !cleanTableName) {
      if (!cleanTableName) setTableError("Room name is required.");
      return;
    }

    try {
      setIsAddingTable(true);
      setTableError("");
      setTableMessage("");

      const response = await securedPosFetch(
        `${apiHost}${tableEndpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category_code: selectedScope.categoryCode,
            unit_code: selectedScope.unitCode,
            table_name: cleanTableName,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to add the table.");
      }

      setTables(Array.isArray(result?.data?.tables) ? result.data.tables : []);
      setTableScope(result?.data?.scope || null);
      setTableName("");
      setTableMessage(result?.message || "Room added successfully.");
    } catch (err) {
      console.error(err);
      setTableError(err.message || "Failed to add the table.");
    } finally {
      setIsAddingTable(false);
    }
  };

  const filteredTables = useMemo(() => {
    const searchValue = tableSearch.trim().toLowerCase();
    if (!searchValue) return tables;

    return tables.filter((table) =>
      [table?.table_name, table?.status, table?.transaction_reference]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(searchValue)),
    );
  }, [tableSearch, tables]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}
      >
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.16em] uppercase border border-current/10 bg-white/5">
              <FiGrid size={12} style={{ color: accent }} />
              <span style={{ color: accent }}>Ordering Floor</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Room Layout
            </h2>

            <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
              Turn on the physical floor arrangement for Ordering, or
              keep the original room display without drag and drop.
            </p>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || isSaving || !hasChanges}
            className="inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isSaving ? (
              <FiLoader className="animate-spin" size={16} />
            ) : (
              <FiSave size={16} />
            )}
            Save Settings
          </button>
        </div>
      </div>

      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <label
          className={`mb-2 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.textSoft}`}
        >
          Room Layout Mode
        </label>

        <button
          type="button"
          onClick={() => {
            setMessage("");
            setError("");
            setIsEnabled(!isEnabled);
          }}
          disabled={isLoading || isSaving}
          className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
            isEnabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : isDark
                ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-700"
          }`}
        >
          {isEnabled ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
          <span className="text-sm font-bold">
            {isEnabled ? "Drag Layout On" : "Original Layout"}
          </span>
        </button>

        <div className={`mt-6 rounded-2xl border p-4 text-sm ${theme.panelSoft}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={theme.textMuted}>Current settings</span>
            <span className={`text-lg font-black ${theme.textPrimary}`}>
              {initialIsEnabled ? "Drag Layout On" : "Original Layout"}
            </span>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form
          onSubmit={addTable}
          className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                isDark ? "bg-slate-950/70" : "bg-blue-50"
              }`}
            >
              <FiPlus size={20} style={{ color: accent }} />
            </div>
            <div>
              <h3
                className={`font-[Poppins-Bold] text-xl ${theme.textPrimary}`}
              >
                Add Room
              </h3>
              <p className={`mt-1 font-[Poppins-Regular] text-sm ${theme.textMuted}`}>
                Add a room to the current POS business unit.
              </p>
            </div>
          </div>

          <div className={`mt-5 rounded-2xl border p-4 ${theme.panelSoft}`}>
            <p
              className={`font-[Poppins-SemiBold] text-[10px] uppercase tracking-[0.16em] ${theme.textSoft}`}
            >
              Business Unit
            </p>
            <p className={`mt-1 font-[Poppins-SemiBold] text-sm ${theme.textPrimary}`}>
              {tableScope?.unit_name || branchInfo?.branch || "Current POS branch"}
            </p>
            <p className={`mt-1 font-[Poppins-Regular] text-xs ${theme.textMuted}`}>
              {tableScope?.unit_code || selectedScope.unitCode || "Resolving unit..."}
            </p>
          </div>

          <label
            htmlFor="pos-table-name"
            className={`mt-5 block font-[Poppins-SemiBold] text-[10px] uppercase tracking-[0.16em] ${theme.textSoft}`}
          >
            Room Name
          </label>
          <input
            id="pos-table-name"
            type="text"
            maxLength={100}
            value={tableName}
            onChange={(event) => {
              setTableName(event.target.value);
              setTableError("");
              setTableMessage("");
            }}
            placeholder="e.g. Room 31"
            disabled={isAddingTable || isTableListLoading}
            className={`mt-2 w-full rounded-2xl border px-4 py-3.5 font-[Poppins-Regular] text-sm outline-none transition focus:ring-4 focus:ring-blue-500/10 ${
              isDark
                ? "border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-600"
                : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            }`}
          />

          <button
            type="submit"
            disabled={isAddingTable || isTableListLoading || !tableName.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 font-[Poppins-Bold] text-[11px] uppercase tracking-[0.16em] shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accent,
              color: isDark ? "#0f172a" : "#ffffff",
            }}
          >
            {isAddingTable ? (
              <FiLoader className="animate-spin" size={16} />
            ) : (
              <FiPlus size={16} />
            )}
            Add Room
          </button>

          {tableMessage ? (
            <p className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 font-[Poppins-SemiBold] text-sm text-emerald-500">
              {tableMessage}
            </p>
          ) : null}

          {tableError ? (
            <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 font-[Poppins-SemiBold] text-sm text-red-500">
              {tableError}
            </p>
          ) : null}
        </form>

        <div className={`min-w-0 rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  isDark ? "bg-slate-950/70" : "bg-blue-50"
                }`}
              >
                <FiList size={20} style={{ color: accent }} />
              </div>
              <div>
                <h3
                  className={`font-[Poppins-Bold] text-xl ${theme.textPrimary}`}
                >
                  Room List
                </h3>
                <p className={`mt-1 font-[Poppins-Regular] text-sm ${theme.textMuted}`}>
                  {tables.length} room{tables.length === 1 ? "" : "s"} configured
                  in tbl_pos_tables.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadTables()}
              disabled={isTableListLoading || isAddingTable}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-[Poppins-SemiBold] text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              <FiRefreshCw
                size={14}
                className={isTableListLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <div className="relative mt-5">
            <FiSearch
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textSoft}`}
              size={15}
            />
            <input
              type="search"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Search room name or status..."
              className={`w-full rounded-2xl border py-3 pl-11 pr-4 font-[Poppins-Regular] text-sm outline-none transition focus:ring-4 focus:ring-blue-500/10 ${
                isDark
                  ? "border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-600"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </div>

          <div className={`mt-4 overflow-hidden rounded-2xl border ${theme.panelSoft}`}>
            {isTableListLoading ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8">
                <FiLoader className="animate-spin" size={28} style={{ color: accent }} />
                <p className={`font-[Poppins-SemiBold] text-sm ${theme.textMuted}`}>
                  Loading room list...
                </p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="min-h-48 p-8 text-center">
                <FiGrid className={`mx-auto ${theme.textSoft}`} size={32} />
                <p className={`mt-3 font-[Poppins-SemiBold] text-sm ${theme.textPrimary}`}>
                  {tables.length === 0 ? "No rooms added yet." : "No matching rooms."}
                </p>
                <p className={`mt-1 font-[Poppins-Regular] text-xs ${theme.textMuted}`}>
                  {tables.length === 0
                    ? "Use the Add Room form to create the first room."
                    : "Try another search keyword."}
                </p>
              </div>
            ) : (
              <div className="max-h-[430px] overflow-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead
                    className={
                      isDark
                        ? "sticky top-0 bg-slate-950 text-slate-400"
                        : "sticky top-0 bg-slate-100 text-slate-500"
                    }
                  >
                    <tr>
                      <th className="px-4 py-3 font-[Poppins-Bold] text-[10px] uppercase tracking-[0.14em]">
                        ID
                      </th>
                      <th className="px-4 py-3 font-[Poppins-Bold] text-[10px] uppercase tracking-[0.14em]">
                        Room Name
                      </th>
                      <th className="px-4 py-3 font-[Poppins-Bold] text-[10px] uppercase tracking-[0.14em]">
                        Status
                      </th>
                      <th className="px-4 py-3 font-[Poppins-Bold] text-[10px] uppercase tracking-[0.14em]">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTables.map((table) => (
                      <tr
                        key={table.ID || table.table_name}
                        className={
                          isDark
                            ? "border-t border-slate-800 text-slate-300"
                            : "border-t border-slate-200 text-slate-700"
                        }
                      >
                        <td className="px-4 py-3 font-[Poppins-Regular] text-xs">
                          {table.ID}
                        </td>
                        <td className={`px-4 py-3 font-[Poppins-SemiBold] text-sm ${theme.textPrimary}`}>
                          {table.table_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 font-[Poppins-SemiBold] text-[10px] uppercase tracking-wider text-emerald-500">
                            {table.status || "Available"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-[Poppins-Regular] text-xs">
                          {table.transaction_reference || "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosTableLayout;
