"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiShield, FiLoader, FiCheck, FiSave } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PERMISSION_ITEMS = [
  {
    key: "transactions",
    label: "Transactions",
    sub: "New Transactions, Billing and Payment",
  },
  { key: "x_reading", label: "Perform X Reading" },
  { key: "z_reading", label: "Perform Z Reading" },
  { key: "create_user", label: "Create User Account" },
  { key: "edit_delete_user", label: "Edit/Delete User Account" },
  { key: "view_reports", label: "Viewing of Reports" },
  {
    key: "settings_my_account_only",
    label: "Settings",
    sub: "Fallback if Open Settings is off — locks user to My Account only",
  },
  { key: "open_settings", label: "Open Settings" },
  { key: "open_product_list", label: "Open Product List" },
  { key: "product_syncing", label: "Product Syncing" },
  { key: "sales_record_syncing", label: "Sales Record Syncing" },
];

const emptyPermissions = () =>
  PERMISSION_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});

const PosUserRoles = ({ isDark, accent, getContrastText }) => {
  const apiHost = useApiHost();
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!apiHost) return;

    (async () => {
      try {
        const res = await fetch(`${apiHost}/api/manage_users.php`);
        const data = await res.json();
        if (Array.isArray(data)) setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingUsers(false);
      }
    })();
  }, [apiHost]);

  useEffect(() => {
    if (!apiHost || !selectedUuid) {
      setPermissions(emptyPermissions());
      return;
    }

    let cancelled = false;
    setIsLoadingPermissions(true);
    setSaveMessage("");

    (async () => {
      try {
        const res = await fetch(
          `${apiHost}/api/pos_user_permissions.php?user_uuid=${encodeURIComponent(selectedUuid)}`,
        );
        const result = await res.json();
        if (!cancelled) {
          setPermissions({
            ...emptyPermissions(),
            ...(result?.data?.permissions || {}),
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsLoadingPermissions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiHost, selectedUuid]);

  const selectedUser = useMemo(
    () => users.find((u) => u.uuid === selectedUuid) || null,
    [users, selectedUuid],
  );

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!selectedUuid) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`${apiHost}/api/pos_user_permissions.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uuid: selectedUuid, permissions }),
      });
      const result = await res.json();
      setSaveMessage(
        result?.success ? "Permissions saved." : result?.message || "Save failed.",
      );
    } catch (err) {
      setSaveMessage("Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const theme = {
    panel: isDark
      ? "border-white/5 bg-white/[0.03]"
      : "border-slate-200 bg-white",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
    input: isDark
      ? "bg-white/5 border-white/10 text-white"
      : "bg-slate-50 border-slate-200 text-slate-900",
    pill: isDark
      ? "border-white/5 bg-white/[0.04]"
      : "border-slate-200 bg-slate-50",
  };

  const contrast = getContrastText ? getContrastText() : "#fff";

  return (
    <div className="space-y-8 text-left">
      {/* HEADER SECTION */}
      <div
        className={`rounded-[50px] border p-12 flex flex-col lg:flex-row items-center justify-between gap-12 ${theme.panel}`}
      >
        <div className="flex items-center gap-10">
          <div
            className="h-28 w-28 rounded-[35px] flex items-center justify-center shadow-2xl"
            style={{ backgroundColor: accent }}
          >
            <FiShield size={40} color={contrast} />
          </div>
          <div>
            <h2
              className={`text-5xl font-black uppercase tracking-tighter ${theme.textPrimary}`}
            >
              User Roles
            </h2>
            <p
              className={`text-[10px] font-black uppercase tracking-[0.5em] mt-2 ${theme.textMuted}`}
            >
              Per-user function checklist
            </p>
          </div>
        </div>
      </div>

      {/* USER SELECT */}
      <div className={`rounded-[40px] border p-8 ${theme.panel}`}>
        <label
          className={`block mb-3 text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}
        >
          Select User
        </label>
        {isLoadingUsers ? (
          <div className="flex items-center gap-3">
            <FiLoader
              className="text-2xl animate-spin"
              style={{ color: accent }}
            />
            <span className={theme.textMuted}>Loading users...</span>
          </div>
        ) : (
          <select
            value={selectedUuid}
            onChange={(e) => setSelectedUuid(e.target.value)}
            className={`w-full p-5 rounded-[25px] border outline-none font-bold text-[12px] ${theme.input}`}
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.uuid} value={u.uuid}>
                {u.firstname} {u.lastname} ({u.username})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* PERMISSIONS CHECKLIST */}
      {selectedUuid && (
        <div className={`rounded-[40px] border p-8 ${theme.panel}`}>
          <div className="flex items-center justify-between mb-6">
            <h3
              className={`text-lg font-black uppercase tracking-widest ${theme.textPrimary}`}
            >
              Functions for {selectedUser?.firstname || "User"}
            </h3>
            {isLoadingPermissions && (
              <FiLoader
                className="text-xl animate-spin"
                style={{ color: accent }}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PERMISSION_ITEMS.map((item) => {
              const checked = Boolean(permissions[item.key]);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => togglePermission(item.key)}
                  disabled={isLoadingPermissions}
                  className={`flex items-start gap-4 rounded-[25px] border p-5 text-left transition-all ${theme.pill} disabled:opacity-50`}
                >
                  <div
                    className="flex items-center justify-center w-6 h-6 mt-0.5 rounded-lg shrink-0"
                    style={{
                      backgroundColor: checked ? accent : "transparent",
                      border: checked ? "none" : "2px solid currentColor",
                      color: checked ? contrast : theme.textMuted.includes("white") ? "#64748b" : "#94a3b8",
                    }}
                  >
                    {checked && <FiCheck size={14} />}
                  </div>
                  <div>
                    <div
                      className={`text-[13px] font-black uppercase tracking-wide ${theme.textPrimary}`}
                    >
                      {item.label}
                    </div>
                    {item.sub && (
                      <div className={`text-[11px] mt-1 ${theme.textMuted}`}>
                        {item.sub}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-8">
            {saveMessage && (
              <span className={`text-[11px] font-bold ${theme.textMuted}`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || isLoadingPermissions}
              className="flex items-center gap-3 px-10 py-5 rounded-[25px] font-black uppercase text-[11px] tracking-[0.3em] hover:scale-105 transition-transform ml-auto disabled:opacity-60"
              style={{ backgroundColor: accent, color: contrast }}
            >
              <FiSave size={16} />
              {isSaving ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosUserRoles;
