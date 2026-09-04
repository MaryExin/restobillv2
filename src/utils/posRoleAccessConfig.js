export const POS_ROLE_ACCESS_SETTINGS_PATH =
  import.meta.env.VITE_POS_ROLE_ACCESS_SETTINGS_ENDPOINT ||
  "/api/pos_role_access_settings.php";

export const POS_ROLE_ACCESS_CHANGE_EVENT = "pos-role-access-config-change";

const RESPONSE_PREFIX = "pos-settings-local-response";
const LATEST_SCOPE_KEY = "pos-role-access-config-latest-scope";

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const normalizeScopeValue = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const resolveStorageScope = (explicitScope = "") => {
  if (typeof window === "undefined") return normalizeScopeValue(explicitScope) || "default";

  return (
    normalizeScopeValue(window.localStorage.getItem("companycode")) ||
    normalizeScopeValue(explicitScope) ||
    normalizeScopeValue(window.localStorage.getItem(LATEST_SCOPE_KEY)) ||
    normalizeScopeValue(window.localStorage.getItem("apiendpoint")) ||
    "default"
  );
};

export const getPosRoleAccessStorageKey = (scope = "") =>
  `${RESPONSE_PREFIX}:${encodeURIComponent(resolveStorageScope(scope))}:${POS_ROLE_ACCESS_SETTINGS_PATH}`;

export const POS_PERMISSION_GROUPS = [
  {
    id: "routes",
    title: "POS Pages",
    description: "Main POS screens, transactions, dashboards, and sync tools.",
    features: [
      { key: "home", label: "Home", locked: true },
      { key: "productList", label: "Product List" },
      { key: "productPriceSyncing", label: "Product & Price Syncing" },
      { key: "salesRecordSyncing", label: "Sales Record Syncing" },
      { key: "openNewDay", label: "Open New Day" },
      { key: "newTransaction", label: "New Transaction" },
      { key: "billing", label: "Billing" },
      { key: "payment", label: "Payment" },
      { key: "registrySales", label: "Registry Sales" },
      { key: "posReports", label: "POS Reports" },
      { key: "salesDashboard", label: "Sales Dashboard" },
    ],
  },
  {
    id: "reading",
    title: "POS Reading",
    description: "Reading permissions for the active shift.",
    features: [
      { key: "xReading", label: "X Reading" },
      { key: "zReading", label: "Z Reading" },
    ],
  },
  {
    id: "reports",
    title: "Report Modules",
    description: "Cards and tools available inside POS Reports.",
    features: [
      { key: "dashboard", label: "Dashboard" },
      { key: "dailySales", label: "Daily Sales" },
      { key: "hourlySales", label: "Hourly Sales" },
      { key: "transactions", label: "Transactions" },
      { key: "salesPerItem", label: "Sales Per Item" },
      { key: "birESales", label: "BIR E-Sales" },
      { key: "zReadingReprint", label: "Z-Reading" },
      { key: "zReadingMonthly", label: "Z-Reading Monthly" },
      { key: "customers", label: "Customers" },
      { key: "refunds", label: "Refunds" },
      { key: "voids", label: "Voids" },
      { key: "logs", label: "Logs" },
      { key: "xml", label: "XML" },
      { key: "monthlySales", label: "Monthly Sales" },
      { key: "salesPerItemPerDate", label: "Sales Per Item Per Date" },
      { key: "eJournal", label: "E-Journal Report" },
      { key: "customerHeadCount", label: "Customer Head Count" },
      { key: "pricingManagement", label: "Pricing Management" },
    ],
  },
  {
    id: "settings",
    title: "Settings Modules",
    description: "Modules shown inside the POS Settings Center.",
    features: [
      { key: "reportDatabase", label: "Report Database" },
      { key: "myAccount", label: "My Account" },
      { key: "userAccounts", label: "User Accounts" },
      { key: "userApproval", label: "User Approval" },
      {
        key: "roleAccess",
        label: "User Roles",
        developerOnly: true,
      },
      { key: "registrySales", label: "Registry Sales" },
      { key: "expensesPetty", label: "Expenses & Petty" },
      { key: "modeOfPayment", label: "Mode of Payment" },
      { key: "serviceCharge", label: "Service Charge" },
      { key: "discountCeiling", label: "Discount Ceiling" },
      { key: "discountMode", label: "Discount Mode" },
      { key: "customerInfo", label: "Customer Info" },
      { key: "tableLayout", label: "Table Layout" },
      { key: "salesTypeOrder", label: "Sales Type Order" },
      { key: "loyaltyConfiguration", label: "Loyalty Configuration" },
      { key: "emailReports", label: "Email Reports" },
      { key: "dataSecurity", label: "Data & Security" },
      { key: "appearance", label: "Appearance" },
      { key: "connectedDevices", label: "Printer Settings" },
      { key: "printOptions", label: "Print Options" },
      { key: "pictureSettings", label: "Picture Settings" },
      { key: "productSubcategories", label: "Product Subcategories" },
      { key: "pricingEngine", label: "Pricing Engine" },
      { key: "layoutMode", label: "Layout Mode" },
      { key: "secondScreen", label: "Second Screen" },
    ],
  },
];

export const POS_ROUTE_PERMISSION_BY_PATH = {
  "/poscorehomescreen": ["routes", "home"],
  "/productlist": ["routes", "productList"],
  "/pricesyncing": ["routes", "productPriceSyncing"],
  "/salesrecordssyncing": ["routes", "salesRecordSyncing"],
  "/ordering": ["routes", "newTransaction"],
  "/printbilling": ["routes", "billing"],
  "/payments": ["routes", "payment"],
  "/transactionrecords": ["routes", "registrySales"],
  "/posreports": ["routes", "posReports"],
  "/salesdashboard": ["routes", "salesDashboard"],
  "/usersqueu": ["settings", "userApproval"],
};

export const POS_SETTINGS_PERMISSION_BY_LABEL = {
  "Report Database": ["settings", "reportDatabase"],
  "My Account": ["settings", "myAccount"],
  "User Accounts": ["settings", "userAccounts"],
  "User Approval": ["settings", "userApproval"],
  "User Roles": ["settings", "roleAccess"],
  "Role Access": ["settings", "roleAccess"],
  "Registry Sales": ["settings", "registrySales"],
  "Expenses & Petty": ["settings", "expensesPetty"],
  "Mode of Payment": ["settings", "modeOfPayment"],
  "Service Charge": ["settings", "serviceCharge"],
  "Discount Ceiling": ["settings", "discountCeiling"],
  "Discount Mode": ["settings", "discountMode"],
  "Customer Info": ["settings", "customerInfo"],
  "Table Layout": ["settings", "tableLayout"],
  "Sales Type Order": ["settings", "salesTypeOrder"],
  "Loyalty Configuration": ["settings", "loyaltyConfiguration"],
  "Email Reports": ["settings", "emailReports"],
  "Data & Security": ["settings", "dataSecurity"],
  Appearance: ["settings", "appearance"],
  "Printer Settings": ["settings", "connectedDevices"],
  "Connected Devices": ["settings", "connectedDevices"],
  "Print Options": ["settings", "printOptions"],
  "Picture Settings": ["settings", "pictureSettings"],
  "Product Subcategories": ["settings", "productSubcategories"],
  "Pricing Engine": ["settings", "pricingEngine"],
  "Layout Mode": ["settings", "layoutMode"],
  "Second Screen": ["settings", "secondScreen"],
};

export const POS_REPORT_PERMISSION_BY_LABEL = {
  Dashboard: ["reports", "dashboard"],
  "Daily Sales": ["reports", "dailySales"],
  "Hourly Sales": ["reports", "hourlySales"],
  Transactions: ["reports", "transactions"],
  "Sales Per Item": ["reports", "salesPerItem"],
  "BIR E-Sales": ["reports", "birESales"],
  "Z-Reading": ["reports", "zReadingReprint"],
  "Z-Reading Monthly": ["reports", "zReadingMonthly"],
  Customers: ["reports", "customers"],
  Refunds: ["reports", "refunds"],
  Voids: ["reports", "voids"],
  Logs: ["reports", "logs"],
  XML: ["reports", "xml"],
  "Monthly Sales": ["reports", "monthlySales"],
  "Sales Per Item Per Date": ["reports", "salesPerItemPerDate"],
  "E-Journal Report": ["reports", "eJournal"],
  "E-Journal": ["reports", "eJournal"],
  "Customer Head Count": ["reports", "customerHeadCount"],
  "Pricing Management": ["reports", "pricingManagement"],
  "Price Change": ["reports", "pricingManagement"],
};

const allPermissions = () =>
  POS_PERMISSION_GROUPS.reduce((groups, group) => {
    groups[group.id] = group.features.reduce((features, feature) => {
      features[feature.key] = !feature.developerOnly;
      return features;
    }, {});
    return groups;
  }, {});

const emptyPermissions = () =>
  POS_PERMISSION_GROUPS.reduce((groups, group) => {
    groups[group.id] = group.features.reduce((features, feature) => {
      features[feature.key] = feature.developerOnly
        ? false
        : Boolean(feature.locked);
      return features;
    }, {});
    return groups;
  }, {});

const adminPermissions = () => {
  const permissions = allPermissions();
  permissions.settings.reportDatabase = false;
  return permissions;
};

const cashierPermissions = () => {
  const permissions = emptyPermissions();
  [
    ["routes", "home"],
    ["routes", "productList"],
    ["routes", "openNewDay"],
    ["routes", "newTransaction"],
    ["routes", "billing"],
    ["routes", "payment"],
    ["routes", "registrySales"],
    ["routes", "posReports"],
    ["reading", "xReading"],
    ["reading", "zReading"],
    ["reports", "dailySales"],
    ["reports", "hourlySales"],
    ["reports", "transactions"],
    ["reports", "salesPerItem"],
    ["reports", "zReadingReprint"],
    ["settings", "myAccount"],
    ["settings", "registrySales"],
    ["settings", "connectedDevices"],
    ["settings", "modeOfPayment"],
    ["settings", "printOptions"],
    ["settings", "pictureSettings"],
    ["settings", "pricingEngine"],
  ].forEach(([groupId, featureKey]) => {
    permissions[groupId][featureKey] = true;
  });
  return permissions;
};

export const DEFAULT_POS_ROLE_ACCESS_CONFIG = {
  version: 1,
  roles: [
    {
      id: "super_admin",
      name: "Super Admin",
      value: "2",
      tokens: ["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN", "2"],
      system: true,
      active: true,
      permissions: allPermissions(),
    },
    {
      id: "admin",
      name: "Admin / Supervisor",
      value: "1",
      tokens: ["ADMIN", "MANAGER", "SUPERVISOR", "1"],
      system: true,
      active: true,
      permissions: adminPermissions(),
    },
    {
      id: "cashier",
      name: "Cashier",
      value: "0",
      tokens: ["CASHIER", "0"],
      system: true,
      active: true,
      permissions: cashierPermissions(),
    },
  ],
};

export const getDefaultPosRoleAccessConfig = () =>
  clone(DEFAULT_POS_ROLE_ACCESS_CONFIG);

const roleIdentityTokens = (role) =>
  [
    role?.id,
    role?.value,
    role?.name,
    ...(Array.isArray(role?.tokens) ? role.tokens : []),
  ]
    .map(normalizeText)
    .filter(Boolean);

const normalizePermissions = (permissions = {}, basePermissions = {}) =>
  POS_PERMISSION_GROUPS.reduce((groups, group) => {
    groups[group.id] = group.features.reduce((features, feature) => {
      const baseValue = Boolean(basePermissions?.[group.id]?.[feature.key]);
      features[feature.key] = feature.developerOnly
        ? false
        : feature.locked
          ? true
          : Boolean(permissions?.[group.id]?.[feature.key] ?? baseValue);
      return features;
    }, {});
    return groups;
  }, {});

const normalizeRole = (role, baseRole = null, index = 0) => {
  const isSystemRole = Boolean(baseRole?.system);
  const name =
    String(
      isSystemRole
        ? baseRole?.name
        : role?.name || baseRole?.name || `Custom Role ${index + 1}`,
    ).trim() ||
    `Custom Role ${index + 1}`;
  const value =
    String(isSystemRole ? baseRole?.value : role?.value ?? baseRole?.value ?? name).trim() ||
    `role_${index + 1}`;
  const system = isSystemRole;
  const id =
    String(isSystemRole ? baseRole?.id : role?.id || baseRole?.id || value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_") || `role_${index + 1}`;
  const permissions = normalizePermissions(
    role?.permissions,
    baseRole?.permissions,
  );

  if (id === "super_admin" || value === "2") {
    permissions.settings.myAccount = true;
  }

  return {
    id,
    name,
    value,
    tokens: [...new Set(roleIdentityTokens({ ...baseRole, ...role, name, value }))],
    system,
    active: system ? true : role?.active !== false,
    permissions,
  };
};

export const normalizePosRoleAccessConfig = (input) => {
  const source = input?.data && Array.isArray(input.data.roles) ? input.data : input;
  const rawRoles = Array.isArray(source?.roles) ? source.roles : [];
  const defaults = getDefaultPosRoleAccessConfig();
  const normalizedRoles = [];
  const usedIds = new Set();
  const usedValues = new Set();

  defaults.roles.forEach((defaultRole, index) => {
    const override = rawRoles.find(
      (role) =>
        normalizeText(role?.id) === normalizeText(defaultRole.id) ||
        normalizeText(role?.value) === normalizeText(defaultRole.value),
    );
    const normalized = normalizeRole(override || defaultRole, defaultRole, index);
    normalizedRoles.push(normalized);
    usedIds.add(normalizeText(normalized.id));
    usedValues.add(normalizeText(normalized.value));
  });

  rawRoles.forEach((role, index) => {
    const normalized = normalizeRole(role, null, index + defaults.roles.length);
    const idToken = normalizeText(normalized.id);
    const valueToken = normalizeText(normalized.value);
    if (usedIds.has(idToken) || usedValues.has(valueToken)) return;
    normalizedRoles.push(normalized);
    usedIds.add(idToken);
    usedValues.add(valueToken);
  });

  return {
    version: Math.max(1, Number(source?.version) || 1),
    roles: normalizedRoles,
  };
};

let cachedStorageKey = "";
let cachedStorageValue = "";
let cachedConfig = null;

const invalidateMemoryCache = () => {
  cachedStorageKey = "";
  cachedStorageValue = "";
  cachedConfig = null;
};

export const notifyPosRoleAccessConfigChanged = (detail = {}) => {
  invalidateMemoryCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(POS_ROLE_ACCESS_CHANGE_EVENT, { detail }),
    );
  }
};

export const storePosRoleAccessConfig = (input, scope = "") => {
  const normalized = normalizePosRoleAccessConfig(input);
  if (typeof window === "undefined") return normalized;

  const resolvedScope = resolveStorageScope(scope);
  const key = getPosRoleAccessStorageKey(resolvedScope);
  window.localStorage.setItem(
    key,
    JSON.stringify({
      success: true,
      data: normalized,
      cachedAt: new Date().toISOString(),
    }),
  );
  window.localStorage.setItem(LATEST_SCOPE_KEY, resolvedScope);
  notifyPosRoleAccessConfigChanged({ scope: resolvedScope, source: "store" });
  return normalized;
};

export const getStoredPosRoleAccessConfig = (scope = "") => {
  if (typeof window === "undefined") return getDefaultPosRoleAccessConfig();

  const key = getPosRoleAccessStorageKey(scope);
  const raw = window.localStorage.getItem(key) || "";
  if (cachedConfig && cachedStorageKey === key && cachedStorageValue === raw) {
    return cachedConfig;
  }

  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedConfig = normalizePosRoleAccessConfig(parsed?.data || parsed);
  } catch {
    cachedConfig = getDefaultPosRoleAccessConfig();
  }

  cachedStorageKey = key;
  cachedStorageValue = raw;
  return cachedConfig;
};

export const getActivePosRoleOptions = (
  config = getStoredPosRoleAccessConfig(),
) =>
  normalizePosRoleAccessConfig(config).roles
    .filter((role) => role.active !== false)
    .map((role) => ({
      value: role.value,
      label: role.name.toUpperCase(),
      name: role.name,
      system: role.system,
    }));

export const normalizeConfiguredRoleValue = (
  value,
  config = getStoredPosRoleAccessConfig(),
) => {
  const token = normalizeText(value);
  if (!token) return "0";
  const role = normalizePosRoleAccessConfig(config).roles.find((item) =>
    roleIdentityTokens(item).includes(token),
  );
  return role?.value || String(value ?? "").trim() || "0";
};

export const getConfiguredRoleLabel = (
  value,
  config = getStoredPosRoleAccessConfig(),
) => {
  const normalizedValue = normalizeConfiguredRoleValue(value, config);
  const role = normalizePosRoleAccessConfig(config).roles.find(
    (item) => normalizeText(item.value) === normalizeText(normalizedValue),
  );
  return role?.name?.toUpperCase() || String(value || "CASHIER").toUpperCase();
};

export const nextCustomRoleValue = (config = getStoredPosRoleAccessConfig()) => {
  const numericValues = normalizePosRoleAccessConfig(config).roles
    .map((role) => Number(role.value))
    .filter((value) => Number.isInteger(value) && value >= 0);
  return String((numericValues.length ? Math.max(...numericValues) : 2) + 1);
};
