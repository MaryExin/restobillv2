<?php

declare(strict_types=1);

/**
 * Convert the account classification stored on tbl_users_global_assignment
 * into the role identity shape consumed by the POS frontend. Route rows from
 * tbl_user_roles remain intact; this identity row is added alongside them.
 */
function posRoleIdentityRow($value): ?array
{
    $raw = trim((string)($value ?? ""));
    $role = strtoupper($raw);

    if ($role === "") {
        return null;
    }

    if (in_array($role, ["0", "CASHIER"], true)) {
        return ["rolename" => "CASHIER", "rolevalue" => "0"];
    }

    if (in_array($role, ["1", "ADMIN", "MANAGER", "SUPERVISOR"], true)) {
        return ["rolename" => "ADMIN", "rolevalue" => "1"];
    }

    if (in_array($role, ["2", "SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"], true)) {
        return ["rolename" => "SUPER ADMIN", "rolevalue" => "2"];
    }

    $safeValue = preg_replace('/[^A-Za-z0-9 _-]/', '', $raw) ?: "";
    $safeValue = substr(trim($safeValue), 0, 64);

    if ($safeValue === "") {
        return null;
    }

    return [
        "rolename" => strtoupper($safeValue),
        "rolevalue" => $safeValue,
    ];
}

function prependPosRoleIdentity(array $roleRows, $classification): array
{
    $identity = posRoleIdentityRow($classification);
    if ($identity === null) {
        return $roleRows;
    }

    $identityName = strtoupper((string)$identity["rolename"]);
    $identityValue = strtoupper((string)$identity["rolevalue"]);

    foreach ($roleRows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $rowName = strtoupper(trim((string)($row["rolename"] ?? "")));
        $rowValue = strtoupper(trim((string)($row["rolevalue"] ?? "")));
        if ($rowName === $identityName || ($rowValue !== "" && $rowValue === $identityValue)) {
            return $roleRows;
        }
    }

    array_unshift($roleRows, $identity);
    return $roleRows;
}

