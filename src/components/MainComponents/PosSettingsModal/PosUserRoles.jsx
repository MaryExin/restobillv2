/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiEdit3,
  FiFilter,
  FiLoader,
  FiLock,
  FiPlus,
  FiPower,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";
import {
  getStoredPosRoleAccessConfig,
  getDefaultPosRoleAccessConfig,
  nextCustomRoleValue,
  normalizePosRoleAccessConfig,
  POS_PERMISSION_GROUPS,
} from "../../../utils/posRoleAccessConfig";
import { savePosRoleAccessConfig } from "../../../utils/posRoleFetch";
import {
  hydratePosRoleAccessForHost,
  usePosDeveloperSession,
} from "../../../hooks/usePosRoleAccessConfig";

const clone = (value) => JSON.parse(JSON.stringify(value));

const ASSIGNABLE_PERMISSION_GROUPS = POS_PERMISSION_GROUPS.map((group) => ({
  ...group,
  features: group.features.filter((feature) => !feature.developerOnly),
}));

const permissionTotal = ASSIGNABLE_PERMISSION_GROUPS.reduce(
  (total, group) => total + group.features.length,
  0,
);

const countPermissions = (role) =>
  ASSIGNABLE_PERMISSION_GROUPS.reduce(
    (total, group) =>
      total +
      group.features.filter(
        (feature) => role?.permissions?.[group.id]?.[feature.key] === true,
      ).length,
    0,
  );

const countGroupPermissions = (role, group) =>
  group.features.filter(
    (feature) => role?.permissions?.[group.id]?.[feature.key] === true,
  ).length;

const isRequiredPermission = (role, groupId, feature) =>
  Boolean(feature?.locked) ||
  (String(role?.value) === "2" &&
    groupId === "settings" &&
    feature?.key === "myAccount");

const makeCustomRole = (name, config, templateRole) => {
  const value = nextCustomRoleValue(config);
  return {
    id: `custom_${value}`,
    name,
    value,
    tokens: [name.toUpperCase(), value],
    system: false,
    active: true,
    permissions: clone(templateRole?.permissions || {}),
  };
};

const StatusPill = ({ children, tone = "neutral" }) => {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-500"
      : tone === "danger"
        ? "bg-red-500/10 text-red-500"
        : "bg-slate-500/10 text-slate-400";

  return (
    <span
      className={`inline-flex min-h-[28px] items-center rounded-full px-3 py-1 text-[10px] font-[Poppins-Black] uppercase leading-tight tracking-[0.08em] ${toneClass}`}
    >
      {children}
    </span>
  );
};

const ToggleSwitch = ({ enabled, disabled, onClick, label }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={enabled}
    disabled={disabled}
    onClick={onClick}
    className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
      enabled ? "bg-emerald-500" : "bg-slate-300"
    }`}
  >
    <span
      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${
        enabled ? "left-7" : "left-1"
      }`}
    />
  </button>
);

const PosUserRoles = ({ isDark, accent = "var(--color-brandPrimary)" }) => {
  const apiHost = useApiHost();
  const developerMode = usePosDeveloperSession();
  const [config, setConfig] = useState(() => getStoredPosRoleAccessConfig());
  const [initialConfig, setInitialConfig] = useState(() =>
    getStoredPosRoleAccessConfig(),
  );
  const [selectedRoleId, setSelectedRoleId] = useState("super_admin");
  const [isPermissionPage, setIsPermissionPage] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState("cashier");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const roleAccent = accent || "var(--color-brandPrimary)";
  const accentMix = (amount) =>
    `color-mix(in srgb, ${roleAccent} ${amount}%, transparent)`;

  const theme = {
    panel: isDark
      ? "border-white/10 bg-slate-950/55"
      : "border-slate-200 bg-white shadow-sm",
    panelSoft: isDark
      ? "border-white/10 bg-white/[0.055] text-slate-200"
      : "border-slate-200 bg-slate-50 text-slate-700",
    panelQuiet: isDark
      ? "border-white/10 bg-[#0c1628]"
      : "border-slate-200 bg-white",
    row: isDark
      ? "border-white/10 bg-white/[0.045]"
      : "border-slate-200 bg-white",
    rowHover: isDark ? "hover:bg-white/[0.075]" : "hover:bg-slate-50",
    input: isDark
      ? "border-white/10 bg-white/[0.06] text-white placeholder:text-white/35"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/60" : "text-slate-500",
    textSoft: isDark ? "text-white/40" : "text-slate-400",
  };

  useEffect(() => {
    if (!apiHost || !developerMode) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        const normalized = await hydratePosRoleAccessForHost(apiHost);
        if (cancelled) return;
        setConfig(normalized);
        setInitialConfig(normalized);
        setSelectedRoleId((current) =>
          normalized.roles.some((role) => role.id === current)
            ? current
            : normalized.roles[0]?.id || "super_admin",
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            `${loadError.message || "Failed to load role access."} Using the last saved local matrix.`,
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiHost, developerMode]);

  const selectedRole =
    config.roles.find((role) => role.id === selectedRoleId) || config.roles[0];

  const roleRows = useMemo(
    () =>
      config.roles.map((role) => ({
        ...role,
        count: countPermissions(role),
      })),
    [config],
  );

  const visiblePermissionGroups = useMemo(() => {
    const search = permissionSearch.trim().toLowerCase();
    if (!selectedRole) return [];

    return ASSIGNABLE_PERMISSION_GROUPS.map((group) => {
      const enabledCount = countGroupPermissions(selectedRole, group);
      const visibleFeatures = group.features.filter((feature) => {
        const isEnabled = Boolean(
          selectedRole.permissions?.[group.id]?.[feature.key],
        );
        const matchesSearch =
          !search ||
          group.title.toLowerCase().includes(search) ||
          feature.label.toLowerCase().includes(search);
        return matchesSearch && (!showEnabledOnly || isEnabled);
      });

      return { ...group, enabledCount, visibleFeatures };
    }).filter((group) => group.visibleFeatures.length > 0);
  }, [permissionSearch, selectedRole, showEnabledOnly]);

  const permissionColumns = useMemo(() => {
    const columns = [[], []];
    const weights = [0, 0];
    visiblePermissionGroups.forEach((group) => {
      const target = weights[0] <= weights[1] ? 0 : 1;
      columns[target].push(group);
      weights[target] += group.visibleFeatures.length + 3;
    });
    return columns.filter((column) => column.length > 0);
  }, [visiblePermissionGroups]);

  const rolePermissionCount = selectedRole ? countPermissions(selectedRole) : 0;
  const rolePermissionPercent = Math.round(
    (rolePermissionCount / permissionTotal) * 100,
  );
  const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);

  const updateSelectedRole = (updater) => {
    if (!selectedRole) return;
    setMessage("");
    setError("");
    setConfig((current) => ({
      ...current,
      roles: current.roles.map((role) =>
        role.id === selectedRole.id ? updater(role) : role,
      ),
    }));
  };

  const togglePermission = (groupId, feature) => {
    if (!selectedRole || isRequiredPermission(selectedRole, groupId, feature)) {
      return;
    }
    updateSelectedRole((role) => ({
      ...role,
      permissions: {
        ...role.permissions,
        [groupId]: {
          ...role.permissions?.[groupId],
          [feature.key]: !role.permissions?.[groupId]?.[feature.key],
        },
      },
    }));
  };

  const setGroupPermissions = (group, enabled) => {
    if (!selectedRole) return;
    updateSelectedRole((role) => {
      const nextGroup = { ...role.permissions?.[group.id] };
      group.features.forEach((feature) => {
        nextGroup[feature.key] = isRequiredPermission(role, group.id, feature)
          ? true
          : enabled;
      });
      return {
        ...role,
        permissions: { ...role.permissions, [group.id]: nextGroup },
      };
    });
  };

  const renameSelectedRole = (name) => {
    const safeName = name.slice(0, 40);
    updateSelectedRole((role) => ({
      ...role,
      name: safeName,
      tokens: [
        ...new Set([
          role.value,
          safeName.toUpperCase(),
          ...(Array.isArray(role.tokens) ? role.tokens : []),
        ]),
      ],
    }));
  };

  const openRolePermissions = (roleId) => {
    setSelectedRoleId(roleId);
    setPermissionSearch("");
    setShowEnabledOnly(false);
    setMessage("");
    setError("");
    setIsPermissionPage(true);
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) {
      setError("Enter a role name first.");
      return;
    }

    const duplicate = config.roles.some(
      (role) =>
        role.name.toUpperCase() === name.toUpperCase() ||
        String(role.value).toUpperCase() === name.toUpperCase(),
    );
    if (duplicate) {
      setError("That role already exists.");
      return;
    }

    const template =
      config.roles.find((role) => role.id === copyFromRoleId) ||
      config.roles.find((role) => role.id === "cashier") ||
      config.roles[0];
    const nextRole = makeCustomRole(name, config, template);
    setConfig((current) => ({
      ...current,
      roles: [...current.roles, nextRole],
    }));
    setSelectedRoleId(nextRole.id);
    setNewRoleName("");
    setPermissionSearch("");
    setShowEnabledOnly(false);
    setMessage("");
    setError("");
    setIsPermissionPage(true);
  };

  const deleteSelectedRole = () => {
    if (!selectedRole || selectedRole.system) return;
    if (!window.confirm(`Delete role ${selectedRole.name}?`)) return;

    const remaining = config.roles.filter((role) => role.id !== selectedRole.id);
    setConfig((current) => ({
      ...current,
      roles: current.roles.filter((role) => role.id !== selectedRole.id),
    }));
    setSelectedRoleId(remaining[0]?.id || "super_admin");
    setIsPermissionPage(false);
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset role access to the default POS matrix?")) return;
    const defaults = getDefaultPosRoleAccessConfig();
    setConfig(defaults);
    setSelectedRoleId(defaults.roles[0]?.id || "super_admin");
    setPermissionSearch("");
    setShowEnabledOnly(false);
    setIsPermissionPage(false);
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!apiHost || isSaving) return;
    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      const normalized = normalizePosRoleAccessConfig(config);
      const saved = await savePosRoleAccessConfig(apiHost, normalized);
      setConfig(saved);
      setInitialConfig(saved);
      setMessage("Role access settings saved.");
    } catch (saveError) {
      setError(saveError.message || "Failed to save role access.");
    } finally {
      setIsSaving(false);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={resetDefaults}
        disabled={isLoading || isSaving}
        className={`inline-flex h-11 items-center gap-2 rounded-[16px] border px-4 text-[11px] font-[Poppins-Black] uppercase tracking-[0.12em] transition active:scale-95 disabled:opacity-50 ${theme.panelSoft}`}
      >
        <FiRefreshCw size={15} />
        Defaults
      </button>
      <button
        type="button"
        onClick={save}
        disabled={isLoading || isSaving || !hasChanges || !apiHost}
        className="inline-flex h-11 items-center gap-2 rounded-[16px] px-5 text-[11px] font-[Poppins-Black] uppercase tracking-[0.12em] text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: roleAccent }}
      >
        {isSaving ? (
          <FiLoader className="animate-spin" size={15} />
        ) : (
          <FiSave size={15} />
        )}
        Save
      </button>
    </div>
  );

  const renderPermissionGroup = (group) => (
    <section
      key={group.id}
      className={`rounded-[24px] border p-4 ${theme.panelQuiet}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className={`text-base font-[Poppins-Black] leading-tight ${theme.textPrimary}`}
            >
              {group.title}
            </h4>
            <StatusPill tone="success">
              {group.enabledCount}/{group.features.length} On
            </StatusPill>
          </div>
          <p className={`mt-1 text-xs font-[Poppins-Medium] ${theme.textMuted}`}>
            {group.description}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setGroupPermissions(group, true)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-[14px] border px-3 text-[10px] font-[Poppins-Black] uppercase tracking-[0.1em] transition active:scale-95 ${theme.panelSoft}`}
          >
            <FiCheck size={13} />
            All On
          </button>
          <button
            type="button"
            onClick={() => setGroupPermissions(group, false)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-[14px] border px-3 text-[10px] font-[Poppins-Black] uppercase tracking-[0.1em] transition active:scale-95 ${theme.panelSoft}`}
          >
            <FiPower size={13} />
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {group.visibleFeatures.map((feature) => {
          const enabled = Boolean(
            selectedRole.permissions?.[group.id]?.[feature.key],
          );
          const isRequired = isRequiredPermission(
            selectedRole,
            group.id,
            feature,
          );
          return (
            <div
              key={feature.key}
              className={`flex min-h-[64px] items-center justify-between gap-4 rounded-[18px] border px-4 py-3 ${theme.row}`}
            >
              <div className="min-w-0">
                <p
                  className={`break-words text-sm font-[Poppins-Black] leading-snug ${theme.textPrimary}`}
                >
                  {feature.label}
                </p>
                {isRequired ? (
                  <p
                    className={`mt-1 flex items-center gap-1.5 text-[10px] font-[Poppins-Black] uppercase tracking-[0.1em] ${theme.textSoft}`}
                  >
                    <FiLock size={10} />
                    Required Access
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`w-10 text-right text-[11px] font-[Poppins-Black] uppercase tracking-[0.08em] ${
                    enabled ? "text-emerald-500" : theme.textSoft
                  }`}
                >
                  {isRequired ? "Lock" : enabled ? "On" : "Off"}
                </span>
                <ToggleSwitch
                  enabled={enabled}
                  disabled={isRequired}
                  label={`${enabled ? "Disable" : "Enable"} ${feature.label}`}
                  onClick={() => togglePermission(group.id, feature)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const roleListPage = (
    <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className={`rounded-[28px] border p-5 ${theme.panel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-[10px] font-[Poppins-Black] uppercase tracking-[0.18em] ${theme.textSoft}`}
            >
              Select Role
            </p>
            <h3
              className={`mt-2 text-2xl font-[Poppins-Black] ${theme.textPrimary}`}
            >
              {config.roles.length} configured
            </h3>
          </div>
          <div
            className="grid h-12 w-12 place-items-center rounded-[18px]"
            style={{ backgroundColor: accentMix(14), color: roleAccent }}
          >
            <FiUsers size={22} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {roleRows.map((role) => {
            const percent = Math.round((role.count / permissionTotal) * 100);
            const isSelected = role.id === selectedRoleId;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => openRolePermissions(role.id)}
                className={`min-h-[158px] rounded-[24px] border p-4 text-left transition active:scale-[0.99] ${theme.row} ${theme.rowHover}`}
                style={{
                  borderColor: isSelected ? accentMix(55) : undefined,
                  backgroundColor: isSelected ? accentMix(8) : undefined,
                }}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border"
                      style={{
                        borderColor: accentMix(35),
                        color: roleAccent,
                        backgroundColor: accentMix(8),
                      }}
                    >
                      <FiUsers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`break-words text-base font-[Poppins-Black] leading-tight ${theme.textPrimary}`}
                        >
                          {role.name}
                        </p>
                        <FiChevronRight
                          className="mt-0.5 shrink-0"
                          size={18}
                          style={{ color: roleAccent }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone={role.active ? "success" : "neutral"}>
                          {role.active ? "Active" : "Disabled"}
                        </StatusPill>
                        <StatusPill>{role.system ? "System" : "Custom"}</StatusPill>
                        <StatusPill>DB {role.value}</StatusPill>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      className={`h-2 overflow-hidden rounded-full ${
                        isDark ? "bg-slate-800" : "bg-slate-200/70"
                      }`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: roleAccent }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p
                        className={`text-xs font-[Poppins-SemiBold] ${theme.textMuted}`}
                      >
                        {role.count} of {permissionTotal} permissions
                      </p>
                      <span
                        className="text-[11px] font-[Poppins-Black] uppercase tracking-[0.1em]"
                        style={{ color: roleAccent }}
                      >
                        Open
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className={`self-start rounded-[28px] border p-5 ${theme.panel}`}>
        <p
          className={`text-[10px] font-[Poppins-Black] uppercase tracking-[0.18em] ${theme.textSoft}`}
        >
          Add Role
        </p>
        <h3 className={`mt-2 text-2xl font-[Poppins-Black] ${theme.textPrimary}`}>
          New access group
        </h3>
        <input
          value={newRoleName}
          onChange={(event) => setNewRoleName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addRole()}
          placeholder="Example: Kitchen Staff"
          className={`mt-5 h-14 w-full rounded-[18px] border px-4 text-sm font-[Poppins-SemiBold] outline-none ${theme.input}`}
        />
        <label
          className={`mt-4 block text-[10px] font-[Poppins-Black] uppercase tracking-[0.14em] ${theme.textSoft}`}
        >
          Copy Access From
        </label>
        <select
          value={copyFromRoleId}
          onChange={(event) => setCopyFromRoleId(event.target.value)}
          className={`mt-2 h-14 w-full rounded-[18px] border px-4 text-sm font-[Poppins-SemiBold] outline-none ${theme.input}`}
        >
          {config.roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addRole}
          className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[18px] px-4 text-xs font-[Poppins-Black] uppercase tracking-[0.12em] text-white transition active:scale-95"
          style={{ backgroundColor: roleAccent }}
        >
          <FiPlus size={16} />
          Add Role
        </button>
      </aside>
    </div>
  );

  const permissionPage = selectedRole ? (
    <section
      className={`flex min-h-[680px] min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border ${theme.panel}`}
    >
      <div className="shrink-0 border-b border-current/10 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsPermissionPage(false)}
            className={`inline-flex h-11 items-center gap-2 rounded-[16px] border px-4 text-[11px] font-[Poppins-Black] uppercase tracking-[0.12em] transition active:scale-95 ${theme.panelSoft}`}
          >
            <FiArrowLeft size={15} />
            Roles
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                updateSelectedRole((role) => ({
                  ...role,
                  active: role.system ? true : !role.active,
                }))
              }
              disabled={selectedRole.system}
              className={`inline-flex h-11 items-center gap-2 rounded-[16px] border px-4 text-[11px] font-[Poppins-Black] uppercase tracking-[0.1em] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${theme.panelSoft}`}
            >
              {selectedRole.active ? (
                <FiToggleRight size={17} />
              ) : (
                <FiToggleLeft size={17} />
              )}
              {selectedRole.active ? "Active" : "Disabled"}
            </button>
            <button
              type="button"
              onClick={deleteSelectedRole}
              disabled={selectedRole.system}
              className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-red-400/20 bg-red-500/10 px-4 text-[11px] font-[Poppins-Black] uppercase tracking-[0.1em] text-red-500 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedRole.system ? (
                <FiLock size={15} />
              ) : (
                <FiTrash2 size={15} />
              )}
              {selectedRole.system ? "System" : "Delete"}
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_150px_150px] xl:items-end">
          <div className="min-w-0">
            <p
              className={`text-[10px] font-[Poppins-Black] uppercase tracking-[0.18em] ${theme.textSoft}`}
            >
              Role Permissions
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3
                className={`max-w-full break-words text-[26px] font-[Poppins-Black] leading-tight ${theme.textPrimary}`}
              >
                {selectedRole.name}
              </h3>
              <StatusPill tone={selectedRole.active ? "success" : "neutral"}>
                {selectedRole.active ? "Active" : "Disabled"}
              </StatusPill>
              <StatusPill>{selectedRole.system ? "System" : "Custom"}</StatusPill>
            </div>

            <label
              className={`mt-5 block text-[10px] font-[Poppins-Black] uppercase tracking-[0.16em] ${theme.textSoft}`}
            >
              Edit Role Name
            </label>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px]"
                style={{ backgroundColor: accentMix(10), color: roleAccent }}
              >
                <FiEdit3 size={18} />
              </div>
              <input
                value={selectedRole.name}
                onChange={(event) => renameSelectedRole(event.target.value)}
                disabled={selectedRole.system}
                className={`h-12 min-w-0 flex-1 rounded-[16px] border px-4 text-base font-[Poppins-Black] outline-none disabled:cursor-not-allowed disabled:opacity-70 ${theme.input}`}
              />
            </div>
          </div>

          <div className={`rounded-[16px] border px-4 py-3 ${theme.row}`}>
            <p
              className={`text-[10px] font-[Poppins-Black] uppercase tracking-[0.12em] ${theme.textSoft}`}
            >
              DB Value
            </p>
            <p className={`mt-1 text-lg font-[Poppins-Black] ${theme.textPrimary}`}>
              {selectedRole.value}
            </p>
          </div>

          <div className={`rounded-[16px] border px-4 py-3 ${theme.row}`}>
            <p
              className={`text-[10px] font-[Poppins-Black] uppercase tracking-[0.12em] ${theme.textSoft}`}
            >
              Access
            </p>
            <p
              className="mt-1 text-lg font-[Poppins-Black]"
              style={{ color: roleAccent }}
            >
              {rolePermissionPercent}%
            </p>
          </div>
        </div>

        <p className={`mt-4 text-sm font-[Poppins-SemiBold] ${theme.textMuted}`}>
          {rolePermissionCount} of {permissionTotal} permissions enabled
        </p>
        <div
          className={`mt-3 h-3 overflow-hidden rounded-full ${
            isDark ? "bg-slate-800" : "bg-slate-200/70"
          }`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${rolePermissionPercent}%`,
              backgroundColor: roleAccent,
            }}
          />
        </div>
      </div>

      <div className="shrink-0 border-b border-current/10 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <FiSearch
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: roleAccent }}
            />
            <input
              value={permissionSearch}
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Search permissions"
              className={`h-12 w-full rounded-[18px] border pl-12 pr-4 text-sm font-[Poppins-SemiBold] outline-none ${theme.input}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowEnabledOnly((current) => !current)}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border px-4 text-[11px] font-[Poppins-Black] uppercase tracking-[0.1em] transition active:scale-95 ${theme.panelSoft}`}
            style={{
              color: showEnabledOnly ? roleAccent : undefined,
              borderColor: showEnabledOnly ? accentMix(55) : undefined,
            }}
          >
            <FiFilter size={15} />
            Enabled Only
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {visiblePermissionGroups.length ? (
          <>
            <div className="space-y-4 xl:hidden">
              {visiblePermissionGroups.map(renderPermissionGroup)}
            </div>
            <div className="hidden gap-4 xl:grid xl:grid-cols-2 xl:items-start">
              {permissionColumns.map((column, columnIndex) => (
                <div key={`permission-column-${columnIndex}`} className="space-y-4">
                  {column.map(renderPermissionGroup)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div
            className={`rounded-[24px] border border-dashed p-8 text-center ${theme.panelSoft}`}
          >
            <FiSearch className="mx-auto text-3xl" style={{ color: roleAccent }} />
            <p className={`mt-3 text-sm font-[Poppins-Black] ${theme.textMuted}`}>
              No permissions found.
            </p>
          </div>
        )}
      </div>
    </section>
  ) : null;

  if (!developerMode) {
    return (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-amber-500/30 bg-amber-500/10 p-8 text-center font-[Poppins-Regular]">
        <FiLock className="mx-auto text-4xl text-amber-500" />
        <h2 className="mt-4 text-xl font-[Poppins-Black] text-amber-600">
          Developer Access Required
        </h2>
        <p className="mt-2 text-sm font-[Poppins-Medium] text-slate-500">
          Only the private Developer session can manage User Roles.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[560px] max-w-[1420px] flex-col gap-5 font-[Poppins-Regular]">
      <div className={`rounded-[26px] border p-5 ${theme.panel}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-[Poppins-Black] uppercase tracking-[0.18em]">
              <FiShield size={13} style={{ color: roleAccent }} />
              <span style={{ color: roleAccent }}>Access Control</span>
            </div>
            <h2
              className={`mt-3 text-[28px] font-[Poppins-Black] uppercase leading-tight ${theme.textPrimary}`}
            >
              User Roles
            </h2>
            <p className={`mt-2 text-sm font-[Poppins-Medium] ${theme.textMuted}`}>
              {isPermissionPage
                ? "Edit this role and control every POS permission."
                : "Choose a role card to review or update its access matrix."}
            </p>
          </div>
          {headerActions}
        </div>
      </div>

      {isLoading ? (
        <div
          className={`flex min-h-[420px] items-center justify-center rounded-[28px] border ${theme.panel}`}
        >
          <div className="text-center">
            <FiLoader
              className="mx-auto animate-spin text-4xl"
              style={{ color: roleAccent }}
            />
            <p
              className={`mt-4 text-xs font-[Poppins-Black] uppercase tracking-[0.18em] ${theme.textSoft}`}
            >
              Loading role access
            </p>
          </div>
        </div>
      ) : isPermissionPage ? (
        permissionPage
      ) : (
        roleListPage
      )}

      {message ? (
        <p className="rounded-[18px] bg-emerald-500/10 px-4 py-3 text-sm font-[Poppins-Black] text-emerald-500">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[18px] bg-red-500/10 px-4 py-3 text-sm font-[Poppins-Black] text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PosUserRoles;
