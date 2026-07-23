<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

// Fixed POS-only function list. Record-only for now -- nothing in the app
// reads these to gate/hide buttons yet.
const PERMISSION_KEYS = [
    "transactions",
    "x_reading",
    "z_reading",
    "create_user",
    "edit_delete_user",
    "view_reports",
    "settings_my_account_only",
    "open_settings",
    "open_product_list",
    "product_syncing",
    "sales_record_syncing",
];

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function readPermissions(PDO $pdo, string $userUuid): array
{
    $stmt = $pdo->prepare("
        SELECT permission_key, enabled
        FROM tbl_pos_user_permissions
        WHERE user_uuid = :user_uuid
    ");
    $stmt->execute([":user_uuid" => $userUuid]);
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $result = [];
    foreach (PERMISSION_KEYS as $key) {
        $result[$key] = isset($rows[$key]) && (int)$rows[$key] === 1;
    }
    return $result;
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $userUuid = trim((string)($_GET["user_uuid"] ?? ""));
        if ($userUuid === "") {
            respond(false, "user_uuid is required.", null, 422);
        }

        respond(true, "Permissions loaded.", [
            "user_uuid" => $userUuid,
            "permissions" => readPermissions($pdo, $userUuid),
        ]);
    }

    if ($method === "POST") {
        $body = json_decode(file_get_contents("php://input"), true);
        if (!is_array($body)) {
            $body = [];
        }

        $userUuid = trim((string)($body["user_uuid"] ?? ""));
        $permissions = is_array($body["permissions"] ?? null) ? $body["permissions"] : [];

        if ($userUuid === "") {
            respond(false, "user_uuid is required.", null, 422);
        }

        $upsert = $pdo->prepare("
            INSERT INTO tbl_pos_user_permissions (user_uuid, permission_key, enabled)
            VALUES (:user_uuid, :permission_key, :enabled)
            ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
        ");

        foreach (PERMISSION_KEYS as $key) {
            $upsert->execute([
                ":user_uuid" => $userUuid,
                ":permission_key" => $key,
                ":enabled" => !empty($permissions[$key]) ? 1 : 0,
            ]);
        }

        respond(true, "Permissions saved.", [
            "user_uuid" => $userUuid,
            "permissions" => readPermissions($pdo, $userUuid),
        ]);
    }

    respond(false, "Method not allowed.", null, 405);
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
