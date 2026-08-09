import {
  getStoredPosRoleAccessConfig,
  POS_REPORT_PERMISSION_BY_LABEL,
  POS_ROUTE_PERMISSION_BY_PATH,
  POS_SETTINGS_PERMISSION_BY_LABEL,
} from "./posRoleAccessConfig";

const normalizeRoleText = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const readAccessTokenPayload = () => {
  if (typeof window === "undefined") return null;

  try {
    const token = window.localStorage.getItem("access_token") || "";
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const isPosDeveloperSession = () => {
  const payload = readAccessTokenPayload();
  if (
    payload?.pos_developer_mode !== true ||
    payload?.pos_developer_full_access !== true ||
    payload?.pos_developer_read_only === true
  ) {
    return false;
  }

  const expiresAt = Number(payload?.exp || 0);
  return expiresAt > Math.floor(Date.now() / 1000);
};

export const getPosDeveloperSessionExpiry = () => {
  const payload = readAccessTokenPayload();
  if (
    payload?.pos_developer_mode !== true ||
    payload?.pos_developer_full_access !== true ||
    payload?.pos_developer_read_only === true
  ) {
    return 0;
  }
  return Number(payload?.exp || 0);
};

const hasDeveloperBypass = (explicitDeveloperMode = false) =>
  explicitDeveloperMode === true || isPosDeveloperSession();

const tryParseRoleJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("[") && !trimmed.startsWith("{"))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

export const flattenPosRoles = (roles) => {
  const output = [];

  const visit = (rawValue) => {
    const value = tryParseRoleJson(rawValue);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (value && typeof value === "object") {
      output.push(value);
      return;
    }

    if (value !== null && value !== undefined && value !== "") {
      output.push({ rolename: value });
    }
  };

  visit(roles);
  return output;
};

export const getPosRoleTokens = (roles) =>
  flattenPosRoles(roles)
    .flatMap((role) => [
      role?.rolevalue,
      role?.classification,
    ])
    .map((value) => {
      const token = normalizeRoleText(value);
      if (token === "CASHIER") return "0";
      if (["ADMIN", "MANAGER", "SUPERVISOR"].includes(token)) return "1";
      if (["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(token)) {
        return "2";
      }
      return token;
    })
    .filter(Boolean);

const getCurrentClassificationToken = () => {
  if (typeof window === "undefined") return "";
  const token = normalizeRoleText(
    window.localStorage.getItem("user_classification"),
  );
  if (token === "CASHIER") return "0";
  if (["ADMIN", "MANAGER", "SUPERVISOR"].includes(token)) return "1";
  if (["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(token)) return "2";
  return token;
};

const matchingConfiguredRoles = (roles) => {
  const config = getStoredPosRoleAccessConfig();
  const explicitTokens = new Set(getPosRoleTokens(roles));
  const classification = getCurrentClassificationToken();
  const identityTokens = classification
    ? new Set([classification])
    : explicitTokens;

  return config.roles.filter((role) => {
    if (role.active === false) return false;
    return identityTokens.has(normalizeRoleText(role.value));
  });
};

export const hasPosPermissionAccess = (
  roles,
  groupId,
  featureKey,
  isDeveloperMode = false,
) => {
  if (hasDeveloperBypass(isDeveloperMode)) return true;
  if (!groupId || !featureKey) return false;

  return matchingConfiguredRoles(roles).some(
    (role) => role.permissions?.[groupId]?.[featureKey] === true,
  );
};

const hasConfiguredRoleToken = (roles, candidates) => {
  const candidateTokens = new Set(
    candidates.map((candidate) => {
      const token = normalizeRoleText(candidate);
      if (token === "CASHIER") return "0";
      if (["ADMIN", "MANAGER", "SUPERVISOR"].includes(token)) return "1";
      if (["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(token)) {
        return "2";
      }
      return token;
    }),
  );

  return matchingConfiguredRoles(roles).some((role) =>
    candidateTokens.has(normalizeRoleText(role.value)),
  );
};

export const hasPosSuperAdminAccess = (roles) =>
  isPosDeveloperSession() ||
  hasConfiguredRoleToken(roles, ["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN", "2"]);

export const hasPosAdminSupervisorAccess = (roles) =>
  hasConfiguredRoleToken(roles, ["ADMIN", "MANAGER", "SUPERVISOR", "1"]);

export const hasPosCashierAccess = (roles) =>
  hasConfiguredRoleToken(roles, ["CASHIER", "0"]);

export const hasAnyKnownPosRole = (roles) =>
  isPosDeveloperSession() || matchingConfiguredRoles(roles).length > 0;

export const hasPosAdminAccess = (roles) =>
  hasPosSuperAdminAccess(roles) || hasPosAdminSupervisorAccess(roles);

export const hasPosRouteAccess = (
  roles,
  routeName,
  isDeveloperMode = false,
) => {
  const route = String(routeName || "");
  const developerMode = hasDeveloperBypass(isDeveloperMode);

  // These workflows authenticate against the separate web/tablet API. A
  // private local Developer token must never be treated as that account.
  if (
    developerMode &&
    ["/pricesyncing", "/salesrecordssyncing"].includes(route)
  ) {
    return false;
  }

  // Role administration is private-Developer-only, even if an old
  // tbl_user_roles row still contains the legacy route name.
  if (route === "/userroles") return developerMode;

  if (developerMode) return true;

  if (route === "/posreading") {
    return (
      hasPosPermissionAccess(roles, "reading", "xReading") ||
      hasPosPermissionAccess(roles, "reading", "zReading")
    );
  }

  const mappedPermission = POS_ROUTE_PERMISSION_BY_PATH[route];
  if (mappedPermission) {
    return hasPosPermissionAccess(
      roles,
      mappedPermission[0],
      mappedPermission[1],
    );
  }

  const hasExplicitRoute = flattenPosRoles(roles).some(
    (role) => String(role?.rolename || "") === route,
  );
  // Keep the legacy route contract for anything outside the POS matrix:
  // access still requires the exact tbl_user_roles.rolename assignment.
  return hasExplicitRoute;
};

export const hasPosSettingsAccess = (
  roles,
  settingId,
  isDeveloperMode = false,
) => {
  if (["User Roles", "Role Access"].includes(String(settingId || ""))) {
    return hasDeveloperBypass(isDeveloperMode);
  }

  if (hasDeveloperBypass(isDeveloperMode)) return true;

  const mappedPermission = POS_SETTINGS_PERMISSION_BY_LABEL[settingId];
  if (mappedPermission) {
    return hasPosPermissionAccess(
      roles,
      mappedPermission[0],
      mappedPermission[1],
    );
  }

  return hasAnyKnownPosRole(roles);
};

export const hasAnyPosSettingsAccess = (roles, isDeveloperMode = false) => {
  if (hasDeveloperBypass(isDeveloperMode)) return true;

  const permissionNames = new Set(
    Object.values(POS_SETTINGS_PERMISSION_BY_LABEL)
      .filter(([, featureKey]) => featureKey !== "roleAccess")
      .map(([groupId, featureKey]) => `${groupId}.${featureKey}`),
  );
  return [...permissionNames].some((permissionName) => {
    const [groupId, featureKey] = permissionName.split(".");
    return hasPosPermissionAccess(roles, groupId, featureKey);
  });
};

export const hasPosReportAccess = (
  roles,
  reportLabel,
  isDeveloperMode = false,
) => {
  if (hasDeveloperBypass(isDeveloperMode)) return true;

  const mappedPermission = POS_REPORT_PERMISSION_BY_LABEL[reportLabel];
  if (mappedPermission) {
    return hasPosPermissionAccess(
      roles,
      mappedPermission[0],
      mappedPermission[1],
    );
  }

  return hasPosAdminAccess(roles);
};

export const hasPosHomeActionAccess = (
  roles,
  actionKey,
  isDeveloperMode = false,
) => hasPosPermissionAccess(roles, "routes", actionKey, isDeveloperMode);

export const hasPosXReadingAccess = (roles, isDeveloperMode = false) =>
  hasPosPermissionAccess(roles, "reading", "xReading", isDeveloperMode);

export const hasPosZReadingAccess = (roles, isDeveloperMode = false) =>
  hasPosPermissionAccess(roles, "reading", "zReading", isDeveloperMode);

export const hasPosAnyReadingAccess = (roles, isDeveloperMode = false) =>
  hasPosXReadingAccess(roles, isDeveloperMode) ||
  hasPosZReadingAccess(roles, isDeveloperMode);
