<?php

declare(strict_types=1);

require __DIR__ . "/pos_role_access_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);
    header("Allow: GET, POST");
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

const POS_ROLE_ACCESS_CATEGORY = "Security";
const POS_ROLE_ACCESS_DESCRIPTION = "POS Role Access Configuration";

function respond(bool $success, string $message, $data = null, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function normalizeRoleAccessText($value, int $maxLength = 255): string
{
    return substr(trim((string)($value ?? "")), 0, $maxLength);
}

function normalizeRoleAccessToken($value): string
{
    return strtoupper(normalizeRoleAccessText($value));
}

function makeRoleKey($value, string $fallback): string
{
    $clean = strtolower(preg_replace("/[^a-zA-Z0-9_-]+/", "_", normalizeRoleAccessText($value, 80)) ?? "");
    $clean = trim($clean, "_");
    return $clean !== "" ? $clean : $fallback;
}

function uniqueRoleTokens(array $tokens): array
{
    $seen = [];
    $output = [];

    foreach ($tokens as $token) {
        $clean = normalizeRoleAccessToken($token);
        if ($clean === "" || isset($seen[$clean])) {
            continue;
        }
        $seen[$clean] = true;
        $output[] = $clean;
    }

    return $output;
}

function permissionDefinitions(): array
{
    return [
        ["group" => "routes", "key" => "home", "name" => "Home", "description" => "POS home screen.", "locked" => true, "developer_only" => false, "sort" => 10],
        ["group" => "routes", "key" => "productList", "name" => "Product List", "description" => "Product list page.", "locked" => false, "developer_only" => false, "sort" => 20],
        ["group" => "routes", "key" => "productPriceSyncing", "name" => "Product & Price Syncing", "description" => "Product and price sync page.", "locked" => false, "developer_only" => false, "sort" => 30],
        ["group" => "routes", "key" => "salesRecordSyncing", "name" => "Sales Record Syncing", "description" => "Sales record sync page.", "locked" => false, "developer_only" => false, "sort" => 40],
        ["group" => "routes", "key" => "openNewDay", "name" => "Open New Day", "description" => "Open day action.", "locked" => false, "developer_only" => false, "sort" => 50],
        ["group" => "routes", "key" => "newTransaction", "name" => "New Transaction", "description" => "Ordering transaction page.", "locked" => false, "developer_only" => false, "sort" => 60],
        ["group" => "routes", "key" => "billing", "name" => "Billing", "description" => "Billing page.", "locked" => false, "developer_only" => false, "sort" => 70],
        ["group" => "routes", "key" => "payment", "name" => "Payment", "description" => "Payment page.", "locked" => false, "developer_only" => false, "sort" => 80],
        ["group" => "routes", "key" => "registrySales", "name" => "Registry Sales", "description" => "Sales registry page.", "locked" => false, "developer_only" => false, "sort" => 90],
        ["group" => "routes", "key" => "posReports", "name" => "POS Reports", "description" => "POS reports page.", "locked" => false, "developer_only" => false, "sort" => 100],
        ["group" => "routes", "key" => "salesDashboard", "name" => "Sales Dashboard", "description" => "Sales dashboard page.", "locked" => false, "developer_only" => false, "sort" => 110],

        ["group" => "reading", "key" => "xReading", "name" => "X Reading", "description" => "X reading access.", "locked" => false, "developer_only" => false, "sort" => 210],
        ["group" => "reading", "key" => "zReading", "name" => "Z Reading", "description" => "Z reading access.", "locked" => false, "developer_only" => false, "sort" => 220],

        ["group" => "reports", "key" => "dashboard", "name" => "Dashboard", "description" => "Sales dashboard report.", "locked" => false, "developer_only" => false, "sort" => 310],
        ["group" => "reports", "key" => "dailySales", "name" => "Daily Sales", "description" => "Daily sales report.", "locked" => false, "developer_only" => false, "sort" => 320],
        ["group" => "reports", "key" => "hourlySales", "name" => "Hourly Sales", "description" => "Hourly sales report.", "locked" => false, "developer_only" => false, "sort" => 330],
        ["group" => "reports", "key" => "transactions", "name" => "Transactions", "description" => "Transactions report.", "locked" => false, "developer_only" => false, "sort" => 340],
        ["group" => "reports", "key" => "salesPerItem", "name" => "Sales Per Item", "description" => "Sales per item report.", "locked" => false, "developer_only" => false, "sort" => 350],
        ["group" => "reports", "key" => "birESales", "name" => "BIR E-Sales", "description" => "BIR e-sales report.", "locked" => false, "developer_only" => false, "sort" => 360],
        ["group" => "reports", "key" => "zReadingReprint", "name" => "Z-Reading", "description" => "Z-reading reprint report.", "locked" => false, "developer_only" => false, "sort" => 370],
        ["group" => "reports", "key" => "zReadingMonthly", "name" => "Z-Reading Monthly", "description" => "Monthly Z-reading report.", "locked" => false, "developer_only" => false, "sort" => 380],
        ["group" => "reports", "key" => "customers", "name" => "Customers", "description" => "Customer report.", "locked" => false, "developer_only" => false, "sort" => 390],
        ["group" => "reports", "key" => "refunds", "name" => "Refunds", "description" => "Refunds report.", "locked" => false, "developer_only" => false, "sort" => 400],
        ["group" => "reports", "key" => "voids", "name" => "Voids", "description" => "Voids report.", "locked" => false, "developer_only" => false, "sort" => 410],
        ["group" => "reports", "key" => "logs", "name" => "Logs", "description" => "System logs report.", "locked" => false, "developer_only" => false, "sort" => 420],
        ["group" => "reports", "key" => "xml", "name" => "XML", "description" => "XML report export.", "locked" => false, "developer_only" => false, "sort" => 430],
        ["group" => "reports", "key" => "monthlySales", "name" => "Monthly Sales", "description" => "Monthly sales report.", "locked" => false, "developer_only" => false, "sort" => 440],
        ["group" => "reports", "key" => "salesPerItemPerDate", "name" => "Sales Per Item Per Date", "description" => "Sales per item by date report.", "locked" => false, "developer_only" => false, "sort" => 450],
        ["group" => "reports", "key" => "eJournal", "name" => "E-Journal Report", "description" => "Electronic journal report.", "locked" => false, "developer_only" => false, "sort" => 460],
        ["group" => "reports", "key" => "customerHeadCount", "name" => "Customer Head Count", "description" => "Customer head count report.", "locked" => false, "developer_only" => false, "sort" => 465],
        ["group" => "reports", "key" => "pricingManagement", "name" => "Pricing Management", "description" => "Pricing management report.", "locked" => false, "developer_only" => false, "sort" => 470],

        ["group" => "settings", "key" => "reportDatabase", "name" => "Report Database", "description" => "Report database settings.", "locked" => false, "developer_only" => false, "sort" => 510],
        ["group" => "settings", "key" => "myAccount", "name" => "My Account", "description" => "My account settings.", "locked" => false, "developer_only" => false, "sort" => 520],
        ["group" => "settings", "key" => "userAccounts", "name" => "User Accounts", "description" => "User account management.", "locked" => false, "developer_only" => false, "sort" => 530],
        ["group" => "settings", "key" => "userApproval", "name" => "User Approval", "description" => "User approval settings.", "locked" => false, "developer_only" => false, "sort" => 540],
        ["group" => "settings", "key" => "roleAccess", "name" => "User Roles", "description" => "Developer-only role access configuration.", "locked" => false, "developer_only" => true, "sort" => 550],
        ["group" => "settings", "key" => "registrySales", "name" => "Registry Sales", "description" => "Registry sales settings.", "locked" => false, "developer_only" => false, "sort" => 560],
        ["group" => "settings", "key" => "expensesPetty", "name" => "Expenses & Petty", "description" => "Expenses and petty cash settings.", "locked" => false, "developer_only" => false, "sort" => 570],
        ["group" => "settings", "key" => "modeOfPayment", "name" => "Mode of Payment", "description" => "Mode of payment settings.", "locked" => false, "developer_only" => false, "sort" => 580],
        ["group" => "settings", "key" => "serviceCharge", "name" => "Service Charge", "description" => "Service charge settings.", "locked" => false, "developer_only" => false, "sort" => 590],
        ["group" => "settings", "key" => "discountCeiling", "name" => "Discount Ceiling", "description" => "Discount ceiling settings.", "locked" => false, "developer_only" => false, "sort" => 600],
        ["group" => "settings", "key" => "discountMode", "name" => "Discount Mode", "description" => "Discount mode settings.", "locked" => false, "developer_only" => false, "sort" => 610],
        ["group" => "settings", "key" => "customerInfo", "name" => "Customer Info", "description" => "Customer info settings.", "locked" => false, "developer_only" => false, "sort" => 620],
        ["group" => "settings", "key" => "tableLayout", "name" => "Table Layout", "description" => "Table layout settings.", "locked" => false, "developer_only" => false, "sort" => 630],
        ["group" => "settings", "key" => "salesTypeOrder", "name" => "Sales Type Order", "description" => "Sales type order settings.", "locked" => false, "developer_only" => false, "sort" => 640],
        ["group" => "settings", "key" => "loyaltyConfiguration", "name" => "Loyalty Configuration", "description" => "Loyalty configuration settings.", "locked" => false, "developer_only" => false, "sort" => 650],
        ["group" => "settings", "key" => "emailReports", "name" => "Email Reports", "description" => "Email report settings.", "locked" => false, "developer_only" => false, "sort" => 660],
        ["group" => "settings", "key" => "dataSecurity", "name" => "Data & Security", "description" => "Data security settings.", "locked" => false, "developer_only" => false, "sort" => 670],
        ["group" => "settings", "key" => "appearance", "name" => "Appearance", "description" => "Appearance settings.", "locked" => false, "developer_only" => false, "sort" => 680],
        ["group" => "settings", "key" => "connectedDevices", "name" => "Printer Settings", "description" => "Connected device and printer settings.", "locked" => false, "developer_only" => false, "sort" => 690],
        ["group" => "settings", "key" => "printOptions", "name" => "Print Options", "description" => "Print option settings.", "locked" => false, "developer_only" => false, "sort" => 700],
        ["group" => "settings", "key" => "pictureSettings", "name" => "Picture Settings", "description" => "Picture settings.", "locked" => false, "developer_only" => false, "sort" => 710],
        ["group" => "settings", "key" => "productSubcategories", "name" => "Product Subcategories", "description" => "Product subcategory settings.", "locked" => false, "developer_only" => false, "sort" => 720],
        ["group" => "settings", "key" => "pricingEngine", "name" => "Pricing Engine", "description" => "Pricing engine settings.", "locked" => false, "developer_only" => false, "sort" => 730],
        ["group" => "settings", "key" => "layoutMode", "name" => "Layout Mode", "description" => "POS layout mode settings.", "locked" => false, "developer_only" => false, "sort" => 740],
        ["group" => "settings", "key" => "secondScreen", "name" => "Second Screen", "description" => "Second screen settings.", "locked" => false, "developer_only" => false, "sort" => 750],
    ];
}

function permissionsTemplate(bool $enabled = false): array
{
    $permissions = [];
    foreach (permissionDefinitions() as $permission) {
        $group = $permission["group"];
        $key = $permission["key"];
        if (!isset($permissions[$group])) {
            $permissions[$group] = [];
        }
        $permissions[$group][$key] = $permission["developer_only"]
            ? false
            : ((bool)$permission["locked"] || $enabled);
    }
    return $permissions;
}

function adminPermissions(): array
{
    $permissions = permissionsTemplate(true);
    $permissions["settings"]["reportDatabase"] = false;
    return $permissions;
}

function cashierPermissions(): array
{
    $permissions = permissionsTemplate(false);
    $enabled = [
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
        ["settings", "modeOfPayment"],
        ["settings", "connectedDevices"],
        ["settings", "printOptions"],
        ["settings", "pictureSettings"],
        ["settings", "pricingEngine"],
    ];

    foreach ($enabled as $pair) {
        $permissions[$pair[0]][$pair[1]] = true;
    }

    $permissions["settings"]["userAccounts"] = false;
    $permissions["settings"]["roleAccess"] = false;

    return $permissions;
}

function defaultRoleAccessConfig(): array
{
    return [
        "version" => 1,
        "roles" => [
            [
                "id" => "super_admin",
                "name" => "Super Admin",
                "value" => "2",
                "tokens" => ["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN", "2"],
                "system" => true,
                "active" => true,
                "permissions" => permissionsTemplate(true),
            ],
            [
                "id" => "admin",
                "name" => "Admin / Supervisor",
                "value" => "1",
                "tokens" => ["ADMIN", "MANAGER", "SUPERVISOR", "1"],
                "system" => true,
                "active" => true,
                "permissions" => adminPermissions(),
            ],
            [
                "id" => "cashier",
                "name" => "Cashier",
                "value" => "0",
                "tokens" => ["CASHIER", "0"],
                "system" => true,
                "active" => true,
                "permissions" => cashierPermissions(),
            ],
        ],
    ];
}

function normalizePermissionsConfig(array $permissions = [], array $basePermissions = []): array
{
    $normalized = [];
    foreach (permissionDefinitions() as $permission) {
        $group = $permission["group"];
        $key = $permission["key"];
        if (!isset($normalized[$group])) {
            $normalized[$group] = [];
        }
        $baseValue = (bool)($basePermissions[$group][$key] ?? false);
        $value = (bool)($permissions[$group][$key] ?? $baseValue);
        $normalized[$group][$key] = $permission["developer_only"]
            ? false
            : ((bool)$permission["locked"] || $value);
    }
    return $normalized;
}

function roleIdentityTokens(array $role): array
{
    $tokens = [
        $role["value"] ?? "",
        $role["name"] ?? "",
    ];
    if (isset($role["tokens"]) && is_array($role["tokens"])) {
        $tokens = array_merge($tokens, $role["tokens"]);
    }
    return uniqueRoleTokens($tokens);
}

function normalizeRoleConfig($role, ?array $baseRole = null, int $index = 0): array
{
    $role = is_array($role) ? $role : [];
    $isSystemRole = (bool)($baseRole["system"] ?? false);
    $nameSource = $isSystemRole
        ? ($baseRole["name"] ?? "")
        : ($role["name"] ?? $baseRole["name"] ?? "Custom Role " . ($index + 1));
    $name = normalizeRoleAccessText($nameSource, 100);
    if ($name === "") {
        $name = "Custom Role " . ($index + 1);
    }

    $valueSource = $isSystemRole
        ? ($baseRole["value"] ?? "")
        : ($role["value"] ?? $baseRole["value"] ?? $name);
    $value = normalizeRoleAccessText($valueSource, 45);
    if ($value === "") {
        $value = "role_" . ($index + 1);
    }

    $system = $isSystemRole;
    $idSource = $isSystemRole
        ? ($baseRole["id"] ?? $value)
        : ($role["id"] ?? $baseRole["id"] ?? $value);
    $id = makeRoleKey($idSource, "role_" . ($index + 1));
    $tokens = roleIdentityTokens([
        "value" => $value,
        "name" => $name,
        "tokens" => $role["tokens"] ?? $baseRole["tokens"] ?? [],
    ]);
    $permissions = normalizePermissionsConfig(
        is_array($role["permissions"] ?? null) ? $role["permissions"] : [],
        is_array($baseRole["permissions"] ?? null) ? $baseRole["permissions"] : []
    );

    if ($id === "super_admin" || $value === "2") {
        $permissions["settings"]["myAccount"] = true;
    }

    return [
        "id" => $id,
        "name" => $name,
        "value" => $value,
        "tokens" => $tokens,
        "system" => $system,
        "active" => $system ? true : (($role["active"] ?? true) !== false),
        "permissions" => $permissions,
    ];
}

function validateRoleAccessInput(array $config): void
{
    $roles = $config["roles"] ?? null;
    if (!is_array($roles)) {
        throw new InvalidArgumentException("Role access config must include roles.");
    }
    if (count($roles) > 100) {
        throw new InvalidArgumentException("A maximum of 100 roles is allowed.");
    }

    $usedIds = [];
    $usedValues = [];
    $usedNames = [];
    foreach ($roles as $index => $role) {
        if (!is_array($role)) {
            throw new InvalidArgumentException("Role entry " . ($index + 1) . " is invalid.");
        }

        $name = normalizeRoleAccessText($role["name"] ?? "", 101);
        $value = normalizeRoleAccessText($role["value"] ?? "", 46);
        $id = makeRoleKey($role["id"] ?? $value, "role_" . ($index + 1));
        if ($name === "" || $value === "") {
            throw new InvalidArgumentException("Every role requires a name and DB value.");
        }
        if (strlen($name) > 100 || strlen($value) > 45) {
            throw new InvalidArgumentException("Role names are limited to 100 characters and DB values to 45.");
        }
        if (!preg_match("/^[A-Za-z0-9 _-]+$/", $value)) {
            throw new InvalidArgumentException(
                "Role DB values may only contain letters, numbers, spaces, underscores, and hyphens."
            );
        }
        $canonicalValue = posRoleAuthCanonicalValue($value);
        if (
            in_array($canonicalValue, ["0", "1", "2"], true) &&
            $value !== $canonicalValue
        ) {
            throw new InvalidArgumentException(
                "Cashier, Admin, Manager, Supervisor, and Super Admin are reserved system role values."
            );
        }

        $idToken = normalizeRoleAccessToken($id);
        $valueToken = normalizeRoleAccessToken($value);
        $nameToken = normalizeRoleAccessToken($name);
        if (isset($usedIds[$idToken]) || isset($usedValues[$valueToken]) || isset($usedNames[$nameToken])) {
            throw new InvalidArgumentException("Role names, IDs, and DB values must be unique.");
        }

        $usedIds[$idToken] = true;
        $usedValues[$valueToken] = true;
        $usedNames[$nameToken] = true;
    }
}

function normalizeRoleAccessConfig($input): array
{
    $source = is_array($input) ? $input : [];
    if (isset($source["data"]) && is_array($source["data"]) && isset($source["data"]["roles"])) {
        $source = $source["data"];
    }

    $rawRoles = is_array($source["roles"] ?? null) ? $source["roles"] : [];
    $defaults = defaultRoleAccessConfig();
    $roles = [];
    $usedIds = [];
    $usedValues = [];

    foreach ($defaults["roles"] as $index => $defaultRole) {
        $override = null;
        foreach ($rawRoles as $rawRole) {
            if (!is_array($rawRole)) {
                continue;
            }
            if (
                normalizeRoleAccessToken($rawRole["id"] ?? "") === normalizeRoleAccessToken($defaultRole["id"]) ||
                normalizeRoleAccessToken($rawRole["value"] ?? "") === normalizeRoleAccessToken($defaultRole["value"])
            ) {
                $override = $rawRole;
                break;
            }
        }

        $normalized = normalizeRoleConfig($override ?? $defaultRole, $defaultRole, $index);
        $roles[] = $normalized;
        $usedIds[normalizeRoleAccessToken($normalized["id"])] = true;
        $usedValues[normalizeRoleAccessToken($normalized["value"])] = true;
    }

    foreach ($rawRoles as $index => $rawRole) {
        if (!is_array($rawRole)) {
            continue;
        }
        $normalized = normalizeRoleConfig($rawRole, null, $index + count($defaults["roles"]));
        $idToken = normalizeRoleAccessToken($normalized["id"]);
        $valueToken = normalizeRoleAccessToken($normalized["value"]);
        if (isset($usedIds[$idToken]) || isset($usedValues[$valueToken])) {
            continue;
        }
        $roles[] = $normalized;
        $usedIds[$idToken] = true;
        $usedValues[$valueToken] = true;
    }

    return [
        "version" => (int)($source["version"] ?? 1),
        "roles" => $roles,
    ];
}

function ensureRoleAccessTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `tbl_pos_roles` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `role_key` VARCHAR(80) NOT NULL,
          `role_value` VARCHAR(64) NOT NULL,
          `role_name` VARCHAR(100) NOT NULL,
          `role_tokens_json` TEXT NULL,
          `is_system` TINYINT(1) NOT NULL DEFAULT 0,
          `is_active` TINYINT(1) NOT NULL DEFAULT 1,
          `sort_order` INT NOT NULL DEFAULT 0,
          `created_by` VARCHAR(80) DEFAULT NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_tbl_pos_roles_role_key` (`role_key`),
          UNIQUE KEY `uq_tbl_pos_roles_role_value` (`role_value`),
          KEY `idx_tbl_pos_roles_active` (`is_active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `tbl_pos_permissions` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `permission_group` VARCHAR(60) NOT NULL,
          `permission_key` VARCHAR(80) NOT NULL,
          `permission_name` VARCHAR(120) NOT NULL,
          `description` VARCHAR(255) DEFAULT NULL,
          `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
          `is_developer_only` TINYINT(1) NOT NULL DEFAULT 0,
          `is_active` TINYINT(1) NOT NULL DEFAULT 1,
          `sort_order` INT NOT NULL DEFAULT 0,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_tbl_pos_permissions_key` (`permission_group`, `permission_key`),
          KEY `idx_tbl_pos_permissions_active` (`is_active`),
          KEY `idx_tbl_pos_permissions_group` (`permission_group`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `tbl_pos_role_permissions` (
          `role_id` INT UNSIGNED NOT NULL,
          `permission_id` INT UNSIGNED NOT NULL,
          `can_access` TINYINT(1) NOT NULL DEFAULT 0,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`role_id`, `permission_id`),
          KEY `idx_tbl_pos_role_permissions_permission` (`permission_id`),
          CONSTRAINT `fk_tbl_pos_role_permissions_role`
            FOREIGN KEY (`role_id`) REFERENCES `tbl_pos_roles` (`id`)
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT `fk_tbl_pos_role_permissions_permission`
            FOREIGN KEY (`permission_id`) REFERENCES `tbl_pos_permissions` (`id`)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
}

function tableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
    ");
    $stmt->execute([":table_name" => $tableName]);
    return (int)$stmt->fetchColumn() > 0;
}

function readLegacyRoleAccessSetting(PDO $pdo): ?array
{
    if (!tableExists($pdo, "tbl_pos_settings")) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => POS_ROLE_ACCESS_CATEGORY,
        ":description" => POS_ROLE_ACCESS_DESCRIPTION,
    ]);

    $value = (string)($stmt->fetchColumn() ?: "");
    if ($value === "") {
        return null;
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? normalizeRoleAccessConfig($decoded) : null;
}

function upsertPermissionDefinitions(PDO $pdo): array
{
    $stmt = $pdo->prepare("
        INSERT INTO tbl_pos_permissions (
            permission_group,
            permission_key,
            permission_name,
            description,
            is_locked,
            is_developer_only,
            is_active,
            sort_order
        ) VALUES (
            :permission_group,
            :permission_key,
            :permission_name,
            :description,
            :is_locked,
            :is_developer_only,
            1,
            :sort_order
        )
        ON DUPLICATE KEY UPDATE
            permission_name = VALUES(permission_name),
            description = VALUES(description),
            is_locked = VALUES(is_locked),
            is_developer_only = VALUES(is_developer_only),
            is_active = 1,
            sort_order = VALUES(sort_order)
    ");

    foreach (permissionDefinitions() as $permission) {
        $stmt->execute([
            ":permission_group" => $permission["group"],
            ":permission_key" => $permission["key"],
            ":permission_name" => $permission["name"],
            ":description" => $permission["description"],
            ":is_locked" => $permission["locked"] ? 1 : 0,
            ":is_developer_only" => $permission["developer_only"] ? 1 : 0,
            ":sort_order" => (int)$permission["sort"],
        ]);
    }

    $rows = $pdo->query("
        SELECT id, permission_group, permission_key
        FROM tbl_pos_permissions
        WHERE is_active = 1
    ")->fetchAll(PDO::FETCH_ASSOC);

    $map = [];
    foreach ($rows as $row) {
        $map[$row["permission_group"] . "." . $row["permission_key"]] = (int)$row["id"];
    }

    return $map;
}

function roleAccessRoleId(PDO $pdo, string $roleValue): int
{
    $stmt = $pdo->prepare("
        SELECT id
        FROM tbl_pos_roles
        WHERE role_value = :role_value
        LIMIT 1
    ");
    $stmt->execute([":role_value" => $roleValue]);
    return (int)($stmt->fetchColumn() ?: 0);
}

function roleAccessAssignmentCounts(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT classification, status, deletestatus
        FROM tbl_users_global_assignment
    ")->fetchAll(PDO::FETCH_ASSOC);

    $counts = [];
    foreach ($rows as $row) {
        $value = normalizeRoleAccessToken(
            posRoleAuthCanonicalValue($row["classification"] ?? "")
        );
        if ($value === "") {
            continue;
        }
        if (!isset($counts[$value])) {
            $counts[$value] = ["all" => 0, "active" => 0];
        }
        $counts[$value]["all"]++;
        if (
            normalizeRoleAccessToken($row["status"] ?? "") === "ACTIVE" &&
            normalizeRoleAccessToken($row["deletestatus"] ?? "") === "ACTIVE"
        ) {
            $counts[$value]["active"]++;
        }
    }

    return $counts;
}

function assertRoleAccessChangesAreSafe(PDO $pdo, array $config): void
{
    $existingRows = $pdo->query("
        SELECT role_key, role_value, role_name, is_system, is_active
        FROM tbl_pos_roles
    ")->fetchAll(PDO::FETCH_ASSOC);
    if (!$existingRows) {
        return;
    }

    $incomingByValue = [];
    $incomingByKey = [];
    foreach ($config["roles"] as $role) {
        $valueToken = normalizeRoleAccessToken($role["value"] ?? "");
        $keyToken = normalizeRoleAccessToken($role["id"] ?? "");
        $incomingByValue[$valueToken] = $role;
        $incomingByKey[$keyToken] = $role;
    }

    $assignmentCounts = roleAccessAssignmentCounts($pdo);
    foreach ($existingRows as $existing) {
        $valueToken = normalizeRoleAccessToken($existing["role_value"] ?? "");
        $keyToken = normalizeRoleAccessToken($existing["role_key"] ?? "");
        $incomingByExistingValue = $incomingByValue[$valueToken] ?? null;
        $incomingByExistingKey = $incomingByKey[$keyToken] ?? null;

        if (
            $incomingByExistingValue !== null &&
            normalizeRoleAccessToken($incomingByExistingValue["id"] ?? "") !== $keyToken
        ) {
            throw new InvalidArgumentException("Existing role DB values cannot be reassigned to a different role.");
        }
        if (
            $incomingByExistingKey !== null &&
            normalizeRoleAccessToken($incomingByExistingKey["value"] ?? "") !== $valueToken
        ) {
            throw new InvalidArgumentException("An existing role's DB value cannot be changed.");
        }

        if ((int)($existing["is_system"] ?? 0) === 1) {
            continue;
        }

        $assigned = $assignmentCounts[$valueToken] ?? ["all" => 0, "active" => 0];
        if ($incomingByExistingValue === null && $assigned["all"] > 0) {
            throw new InvalidArgumentException(
                "Reassign all users from " . ($existing["role_name"] ?? "this role") . " before deleting it."
            );
        }
        if (
            $incomingByExistingValue !== null &&
            ($incomingByExistingValue["active"] ?? true) === false &&
            $assigned["active"] > 0
        ) {
            throw new InvalidArgumentException(
                "Reassign active users from " . ($existing["role_name"] ?? "this role") . " before disabling it."
            );
        }
    }
}

function saveRoleAccessConfigToTables(PDO $pdo, array $config, string $createdBy = ""): array
{
    $normalized = normalizeRoleAccessConfig($config);
    $createdBy = normalizeRoleAccessText($createdBy, 80);

    $pdo->beginTransaction();
    try {
        assertRoleAccessChangesAreSafe($pdo, $normalized);
        $permissionMap = upsertPermissionDefinitions($pdo);

        $roleStmt = $pdo->prepare("
            INSERT INTO tbl_pos_roles (
                role_key,
                role_value,
                role_name,
                role_tokens_json,
                is_system,
                is_active,
                sort_order,
                created_by
            ) VALUES (
                :role_key,
                :role_value,
                :role_name,
                :role_tokens_json,
                :is_system,
                :is_active,
                :sort_order,
                :created_by
            )
            ON DUPLICATE KEY UPDATE
                role_key = VALUES(role_key),
                role_name = VALUES(role_name),
                role_tokens_json = VALUES(role_tokens_json),
                is_system = CASE WHEN is_system = 1 THEN 1 ELSE VALUES(is_system) END,
                is_active = VALUES(is_active),
                sort_order = VALUES(sort_order)
        ");

        $permissionStmt = $pdo->prepare("
            INSERT INTO tbl_pos_role_permissions (
                role_id,
                permission_id,
                can_access
            ) VALUES (
                :role_id,
                :permission_id,
                :can_access
            )
            ON DUPLICATE KEY UPDATE
                can_access = VALUES(can_access)
        ");

        $incomingRoleValues = [];

        foreach ($normalized["roles"] as $index => $role) {
            $roleStmt->execute([
                ":role_key" => $role["id"],
                ":role_value" => $role["value"],
                ":role_name" => $role["name"],
                ":role_tokens_json" => json_encode($role["tokens"], JSON_UNESCAPED_SLASHES),
                ":is_system" => $role["system"] ? 1 : 0,
                ":is_active" => $role["active"] ? 1 : 0,
                ":sort_order" => ($index + 1) * 10,
                ":created_by" => $createdBy !== "" ? $createdBy : null,
            ]);

            $roleId = roleAccessRoleId($pdo, $role["value"]);
            if ($roleId <= 0) {
                continue;
            }

            $incomingRoleValues[normalizeRoleAccessToken($role["value"])] = true;

            foreach (permissionDefinitions() as $permission) {
                $permissionId = $permissionMap[$permission["group"] . "." . $permission["key"]] ?? 0;
                if ($permissionId <= 0) {
                    continue;
                }

                $canAccess = !$permission["developer_only"] && (
                    (bool)$permission["locked"] ||
                    (bool)($role["permissions"][$permission["group"]][$permission["key"]] ?? false)
                );

                $permissionStmt->execute([
                    ":role_id" => $roleId,
                    ":permission_id" => $permissionId,
                    ":can_access" => $canAccess ? 1 : 0,
                ]);
            }
        }

        $customRows = $pdo->query("
            SELECT id, role_value
            FROM tbl_pos_roles
            WHERE is_system = 0
        ")->fetchAll(PDO::FETCH_ASSOC);

        $deleteStmt = $pdo->prepare("DELETE FROM tbl_pos_roles WHERE id = :id AND is_system = 0");
        foreach ($customRows as $row) {
            if (!isset($incomingRoleValues[normalizeRoleAccessToken($row["role_value"] ?? "")])) {
                $deleteStmt->execute([":id" => (int)$row["id"]]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return readRoleAccessConfigFromTables($pdo);
}

function seedMissingRolePermissions(PDO $pdo): void
{
    $permissionMap = upsertPermissionDefinitions($pdo);
    $defaults = defaultRoleAccessConfig();
    $defaultByValue = [];
    foreach ($defaults["roles"] as $role) {
        $defaultByValue[normalizeRoleAccessToken($role["value"])] = $role;
    }

    $roles = $pdo->query("
        SELECT r.id, r.role_value
        FROM tbl_pos_roles r
    ")->fetchAll(PDO::FETCH_ASSOC);

    $permissionStmt = $pdo->prepare("
        INSERT IGNORE INTO tbl_pos_role_permissions (
            role_id,
            permission_id,
            can_access
        ) VALUES (
            :role_id,
            :permission_id,
            :can_access
        )
    ");

    foreach ($roles as $roleRow) {
        $baseRole = $defaultByValue[normalizeRoleAccessToken($roleRow["role_value"] ?? "")] ?? null;
        $permissions = is_array($baseRole["permissions"] ?? null)
            ? $baseRole["permissions"]
            : permissionsTemplate(false);

        foreach (permissionDefinitions() as $permission) {
            $permissionId = $permissionMap[$permission["group"] . "." . $permission["key"]] ?? 0;
            if ($permissionId <= 0) {
                continue;
            }

            $canAccess = !$permission["developer_only"] && (
                (bool)$permission["locked"] ||
                (bool)($permissions[$permission["group"]][$permission["key"]] ?? false)
            );

            $permissionStmt->execute([
                ":role_id" => (int)$roleRow["id"],
                ":permission_id" => $permissionId,
                ":can_access" => $canAccess ? 1 : 0,
            ]);
        }
    }
}

function ensureRoleAccessReady(PDO $pdo): void
{
    ensureRoleAccessTables($pdo);

    $roleCount = (int)$pdo->query("SELECT COUNT(*) FROM tbl_pos_roles")->fetchColumn();
    if ($roleCount === 0) {
        $seed = readLegacyRoleAccessSetting($pdo) ?? defaultRoleAccessConfig();
        saveRoleAccessConfigToTables($pdo, $seed, "SYSTEM");
        return;
    }

    seedMissingRolePermissions($pdo);
}

function permissionsForRoleRows(array $rows): array
{
    $permissions = permissionsTemplate(false);
    $locked = [];
    $developerOnly = [];

    foreach (permissionDefinitions() as $permission) {
        if ($permission["locked"]) {
            $locked[$permission["group"] . "." . $permission["key"]] = true;
        }
        if ($permission["developer_only"]) {
            $developerOnly[$permission["group"] . "." . $permission["key"]] = true;
        }
    }

    foreach ($rows as $row) {
        $group = (string)($row["permission_group"] ?? "");
        $key = (string)($row["permission_key"] ?? "");
        if ($group === "" || $key === "") {
            continue;
        }

        if (!isset($permissions[$group])) {
            $permissions[$group] = [];
        }

        $permissionName = $group . "." . $key;
        $isLocked = isset($locked[$permissionName]);
        $permissions[$group][$key] = !isset($developerOnly[$permissionName]) &&
            ($isLocked || ((int)($row["can_access"] ?? 0) === 1));
    }

    return normalizePermissionsConfig($permissions);
}

function readRoleAccessConfigFromTables(PDO $pdo): array
{
    $roles = $pdo->query("
        SELECT id, role_key, role_value, role_name, role_tokens_json, is_system, is_active
        FROM tbl_pos_roles
        ORDER BY sort_order ASC, id ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    if (!$roles) {
        return defaultRoleAccessConfig();
    }

    $permissionStmt = $pdo->prepare("
        SELECT p.permission_group, p.permission_key, rp.can_access
        FROM tbl_pos_permissions p
        LEFT JOIN tbl_pos_role_permissions rp ON rp.permission_id = p.id AND rp.role_id = :role_id
        WHERE p.is_active = 1
        ORDER BY p.sort_order ASC, p.id ASC
    ");

    $configRoles = [];
    foreach ($roles as $index => $role) {
        $permissionStmt->execute([":role_id" => (int)$role["id"]]);
        $permissionRows = $permissionStmt->fetchAll(PDO::FETCH_ASSOC);

        $tokens = json_decode((string)($role["role_tokens_json"] ?? ""), true);
        if (!is_array($tokens)) {
            $tokens = [];
        }

        $configRoles[] = normalizeRoleConfig([
            "id" => $role["role_key"],
            "name" => $role["role_name"],
            "value" => $role["role_value"],
            "tokens" => $tokens,
            "system" => (int)($role["is_system"] ?? 0) === 1,
            "active" => (int)($role["is_active"] ?? 1) === 1,
            "permissions" => permissionsForRoleRows($permissionRows),
        ], null, $index);
    }

    return normalizeRoleAccessConfig([
        "version" => 1,
        "roles" => $configRoles,
    ]);
}

function comparableRoleAccessRole(array $role): array
{
    return [
        "id" => (string)($role["id"] ?? ""),
        "name" => (string)($role["name"] ?? ""),
        "value" => (string)($role["value"] ?? ""),
        "system" => (bool)($role["system"] ?? false),
        "active" => (bool)($role["active"] ?? true),
        "permissions" => normalizePermissionsConfig(
            is_array($role["permissions"] ?? null) ? $role["permissions"] : []
        ),
    ];
}

function roleAccessExceedsPermissions(array $role, array $allowedPermissions): bool
{
    foreach (permissionDefinitions() as $permission) {
        $group = $permission["group"];
        $key = $permission["key"];
        $permissionName = $group . "." . $key;
        if (
            (bool)($role["permissions"][$group][$key] ?? false) &&
            !($allowedPermissions[$permissionName] ?? false)
        ) {
            return true;
        }
    }

    return false;
}

function assertCallerMaySaveRoleAccessConfig(
    PDO $pdo,
    string $userId,
    array $config
): void {
    $account = posRoleAuthAccount($pdo, $userId);
    if ($account !== null && posRoleAuthIsDeveloperSession()) {
        return;
    }

    $callerRole = $account === null
        ? null
        : posRoleAuthRoleRow($pdo, $account["classification"] ?? "");
    if ($callerRole === null) {
        throw new InvalidArgumentException("The signed-in account has no active POS role.");
    }

    $allowedPermissions = posRoleAuthPermissionMap($pdo, (int)$callerRole["id"]);
    $incoming = normalizeRoleAccessConfig($config);
    $existing = readRoleAccessConfigFromTables($pdo);
    $incomingByValue = [];
    foreach ($incoming["roles"] as $role) {
        $incomingByValue[normalizeRoleAccessToken($role["value"] ?? "")] = $role;
    }

    foreach ($existing["roles"] as $existingRole) {
        $valueToken = normalizeRoleAccessToken($existingRole["value"] ?? "");
        $incomingRole = $incomingByValue[$valueToken] ?? null;
        $isMorePrivileged = roleAccessExceedsPermissions(
            $existingRole,
            $allowedPermissions
        );

        if ($isMorePrivileged) {
            if (
                $incomingRole === null ||
                comparableRoleAccessRole($incomingRole) !== comparableRoleAccessRole($existingRole)
            ) {
                throw new InvalidArgumentException(
                    "You cannot change a role with more access than your own."
                );
            }
        }
    }

    foreach ($incoming["roles"] as $incomingRole) {
        $valueToken = normalizeRoleAccessToken($incomingRole["value"] ?? "");
        $existingRole = null;
        foreach ($existing["roles"] as $candidate) {
            if (normalizeRoleAccessToken($candidate["value"] ?? "") === $valueToken) {
                $existingRole = $candidate;
                break;
            }
        }

        if (
            roleAccessExceedsPermissions($incomingRole, $allowedPermissions) &&
            ($existingRole === null ||
                comparableRoleAccessRole($incomingRole) !== comparableRoleAccessRole($existingRole))
        ) {
            throw new InvalidArgumentException(
                "You cannot grant permissions that your own role does not have."
            );
        }
    }
}

try {
    $authenticatedAccount = posRoleAuthRequireActiveAccount(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? "")
    );

    if (
        $_SERVER["REQUEST_METHOD"] === "POST" &&
        !posRoleAuthIsDeveloperSession()
    ) {
        respond(false, "Only the private Developer session can manage User Roles.", null, 403);
    }

    ensureRoleAccessReady($pdo);

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $loaded = readRoleAccessConfigFromTables($pdo);
        $loaded["current_role_value"] = posRoleAuthCanonicalValue(
            $authenticatedAccount["classification"] ?? ""
        );
        respond(true, "Role access settings loaded.", $loaded);
    }

    $body = json_decode(file_get_contents("php://input"), true);
    if (!is_array($body)) {
        respond(false, "Invalid JSON body.", null, 400);
    }

    $config = $body["config"] ?? $body;
    if (!is_array($config) || !isset($config["roles"]) || !is_array($config["roles"])) {
        respond(false, "Role access config must include roles.", null, 400);
    }

    validateRoleAccessInput($config);
    assertCallerMaySaveRoleAccessConfig(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        $config
    );
    $saved = saveRoleAccessConfigToTables($pdo, $config, (string)($GLOBALS["pos_user_id"] ?? "SYSTEM"));
    $saved["current_role_value"] = posRoleAuthCanonicalValue(
        $authenticatedAccount["classification"] ?? ""
    );
    respond(true, "Role access settings saved.", $saved);
} catch (InvalidArgumentException $e) {
    respond(false, $e->getMessage(), null, 422);
} catch (Throwable $e) {
    error_log("POS role access error: " . $e->getMessage());
    respond(false, "Unable to process role access settings.", null, 500);
}
