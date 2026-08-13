<?php

declare(strict_types=1);

require_once __DIR__ . "/pos_developer_auth.php";

function posRoleAuthIsDeveloperSession(): bool
{
    return ($GLOBALS["pos_developer_mode"] ?? false) === true;
}

function posRoleAuthCanonicalValue($value): string
{
    $role = strtoupper(trim((string)($value ?? "")));
    if ($role === "CASHIER") {
        return "0";
    }
    if (in_array($role, ["ADMIN", "MANAGER", "SUPERVISOR"], true)) {
        return "1";
    }
    if (in_array($role, ["SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"], true)) {
        return "2";
    }

    return trim((string)($value ?? ""));
}

function posRoleAuthRespond(string $message, int $statusCode = 403): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => false,
        "message" => $message,
        "error" => $message,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function posRoleAuthTableExists(PDO $pdo, string $tableName): bool
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

function posRoleAuthAccount(PDO $pdo, string $userId): ?array
{
    if (
        posRoleAuthIsDeveloperSession() &&
        hash_equals(posDeveloperSubject(), $userId)
    ) {
        return posDeveloperVirtualAccount();
    }

    $stmt = $pdo->prepare("
        SELECT uuid, classification, email
        FROM tbl_users_global_assignment
        WHERE uuid = :uuid
          AND UPPER(TRIM(status)) = 'ACTIVE'
          AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
        LIMIT 1
    ");
    $stmt->execute([":uuid" => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function posRoleAuthRequireActiveAccount(PDO $pdo, string $userId): array
{
    $account = posRoleAuthAccount($pdo, $userId);
    if ($account === null) {
        posRoleAuthRespond("Your account is inactive or no longer available.", 403);
    }

    return $account;
}

function posRoleAuthRoleRow(
    PDO $pdo,
    $classification,
    bool $includeInactive = false
): ?array {
    if (
        !posRoleAuthTableExists($pdo, "tbl_pos_roles") ||
        !posRoleAuthTableExists($pdo, "tbl_pos_permissions") ||
        !posRoleAuthTableExists($pdo, "tbl_pos_role_permissions")
    ) {
        return null;
    }

    $sql = "
        SELECT id, role_key, role_value, role_name, is_system, is_active
        FROM tbl_pos_roles
        WHERE UPPER(TRIM(role_value)) = UPPER(TRIM(:role_value))
    ";
    if (!$includeInactive) {
        $sql .= " AND is_active = 1";
    }
    $sql .= " LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ":role_value" => posRoleAuthCanonicalValue($classification),
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function posRoleAuthPermissionMap(PDO $pdo, int $roleId): array
{
    $stmt = $pdo->prepare("
        SELECT
            CONCAT(p.permission_group, '.', p.permission_key) AS permission_name,
            rp.can_access,
            p.is_developer_only
        FROM tbl_pos_permissions p
        INNER JOIN tbl_pos_role_permissions rp
            ON rp.permission_id = p.id
           AND rp.role_id = :role_id
        WHERE p.is_active = 1
    ");
    $stmt->execute([":role_id" => $roleId]);

    $permissions = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $permissions[(string)$row["permission_name"]] =
            (int)($row["is_developer_only"] ?? 0) !== 1 &&
            (int)($row["can_access"] ?? 0) === 1;
    }

    return $permissions;
}

function posRoleAuthHasPermission(
    PDO $pdo,
    string $userId,
    string $groupId,
    string $permissionKey
): bool {
    $account = posRoleAuthAccount($pdo, $userId);
    if ($account === null) {
        return false;
    }

    if (posRoleAuthIsDeveloperSession()) {
        return true;
    }

    $role = posRoleAuthRoleRow($pdo, $account["classification"] ?? "");
    if ($role === null) {
        return false;
    }

    $permissionName = $groupId . "." . $permissionKey;
    $permissions = posRoleAuthPermissionMap($pdo, (int)$role["id"]);
    return ($permissions[$permissionName] ?? false) === true;
}

function posRoleAuthRequirePermission(
    PDO $pdo,
    string $userId,
    string $groupId,
    string $permissionKey
): void {
    posRoleAuthRequireActiveAccount($pdo, $userId);

    if (posRoleAuthIsDeveloperSession()) {
        return;
    }

    if (!posRoleAuthTableExists($pdo, "tbl_pos_roles")) {
        posRoleAuthRespond("Role access configuration is not initialized.", 503);
    }

    if (!posRoleAuthHasPermission($pdo, $userId, $groupId, $permissionKey)) {
        posRoleAuthRespond("Your role does not allow this action.", 403);
    }
}

function posRoleAuthRequireAnyPermission(
    PDO $pdo,
    string $userId,
    array $permissionPairs
): void {
    $account = posRoleAuthRequireActiveAccount($pdo, $userId);

    if (posRoleAuthIsDeveloperSession()) {
        return;
    }

    if (
        !posRoleAuthTableExists($pdo, "tbl_pos_roles") ||
        !posRoleAuthTableExists($pdo, "tbl_pos_permissions") ||
        !posRoleAuthTableExists($pdo, "tbl_pos_role_permissions")
    ) {
        posRoleAuthRespond("Role access configuration is not initialized.", 503);
    }

    $role = posRoleAuthRoleRow($pdo, $account["classification"] ?? "");
    if ($role === null) {
        posRoleAuthRespond("Your role does not allow this action.", 403);
    }

    $permissions = posRoleAuthPermissionMap($pdo, (int)$role["id"]);
    foreach ($permissionPairs as $permissionPair) {
        if (!is_array($permissionPair) || count($permissionPair) < 2) {
            continue;
        }

        $groupId = trim((string)($permissionPair[0] ?? ""));
        $permissionKey = trim((string)($permissionPair[1] ?? ""));
        if ($groupId === "" || $permissionKey === "") {
            continue;
        }

        if (($permissions[$groupId . "." . $permissionKey] ?? false) === true) {
            return;
        }
    }

    posRoleAuthRespond("Your role does not allow this action.", 403);
}

function posRoleAuthCanManageRoleValue(
    PDO $pdo,
    string $userId,
    $targetRoleValue
): bool {
    $account = posRoleAuthAccount($pdo, $userId);
    if ($account === null) {
        return false;
    }

    if (posRoleAuthIsDeveloperSession()) {
        return true;
    }

    $callerRole = posRoleAuthRoleRow($pdo, $account["classification"] ?? "");
    $targetRole = posRoleAuthRoleRow($pdo, $targetRoleValue, true);
    if ($callerRole === null || $targetRole === null) {
        return false;
    }

    $callerPermissions = posRoleAuthPermissionMap($pdo, (int)$callerRole["id"]);
    $targetPermissions = posRoleAuthPermissionMap($pdo, (int)$targetRole["id"]);

    foreach ($targetPermissions as $permissionName => $enabled) {
        if ($enabled && !($callerPermissions[$permissionName] ?? false)) {
            return false;
        }
    }

    return true;
}

function posRoleAuthHasActiveAssignment(PDO $pdo, $roleValue): bool
{
    $targetValue = strtoupper(posRoleAuthCanonicalValue($roleValue));
    $rows = $pdo->query("
        SELECT classification
        FROM tbl_users_global_assignment
        WHERE UPPER(TRIM(status)) = 'ACTIVE'
          AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        if (
            strtoupper(posRoleAuthCanonicalValue($row["classification"] ?? "")) ===
            $targetValue
        ) {
            return true;
        }
    }

    return false;
}

function posRoleAuthRequireManageRoleValue(
    PDO $pdo,
    string $userId,
    $targetRoleValue
): void {
    // The authoritative CSV can be installed without a Super Admin account.
    // Permit one active role-access manager to bootstrap the first one; after
    // that, the normal permission-subset ceiling applies.
    if (
        posRoleAuthCanonicalValue($targetRoleValue) === "2" &&
        !posRoleAuthHasActiveAssignment($pdo, "2") &&
        posRoleAuthHasPermission($pdo, $userId, "settings", "roleAccess")
    ) {
        return;
    }

    if (!posRoleAuthCanManageRoleValue($pdo, $userId, $targetRoleValue)) {
        posRoleAuthRespond(
            "You cannot assign or manage a role with more access than your own.",
            403
        );
    }
}
