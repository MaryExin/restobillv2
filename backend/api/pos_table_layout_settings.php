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

const TABLE_LAYOUT_CATEGORY = "General";
const TABLE_LAYOUT_ENABLED_DESCRIPTION = "Enable Table Floor Layout";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function normalizeBoolean($value)
{
    $value = trim((string)($value ?? ""));
    return in_array(strtolower($value), ["true", "1", "yes", "on"]) ? "True" : "False";
}

function readTableLayoutSettings(PDO $pdo)
{
    $stmt = $pdo->prepare("
        SELECT ID, category, description, `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => TABLE_LAYOUT_CATEGORY,
        ":description" => TABLE_LAYOUT_ENABLED_DESCRIPTION,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $isEnabled = normalizeBoolean($row["value"] ?? "False") === "True";

    return [
        "id" => isset($row["ID"]) ? (int)$row["ID"] : null,
        "category" => TABLE_LAYOUT_CATEGORY,
        "description" => TABLE_LAYOUT_ENABLED_DESCRIPTION,
        "table_layout_enabled" => $isEnabled,
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Table layout settings loaded.", readTableLayoutSettings($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $tableLayoutEnabled = normalizeBoolean($body["table_layout_enabled"] ?? false) === "True";

    $existingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        ":category" => TABLE_LAYOUT_CATEGORY,
        ":description" => TABLE_LAYOUT_ENABLED_DESCRIPTION,
    ]);

    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $updateStmt->execute([
            ":setting_value" => $tableLayoutEnabled ? "True" : "False",
            ":id" => (int)$existingId,
        ]);
    } else {
        $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
        $nextId = (int)$nextIdStmt->fetchColumn();

        $insertStmt = $pdo->prepare("
            INSERT INTO tbl_pos_settings (ID, category, description, `value`)
            VALUES (:id, :category, :description, :setting_value)
        ");
        $insertStmt->execute([
            ":id" => $nextId,
            ":category" => TABLE_LAYOUT_CATEGORY,
            ":description" => TABLE_LAYOUT_ENABLED_DESCRIPTION,
            ":setting_value" => $tableLayoutEnabled ? "True" : "False",
        ]);
    }

    respond(true, "Table layout settings saved.", readTableLayoutSettings($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
