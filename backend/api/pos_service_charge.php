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

const SERVICE_CHARGE_CATEGORY = "Service";
const SERVICE_CHARGE_ENABLED_DESCRIPTION = "Service Charge Enabled";
const SERVICE_CHARGE_PERCENTAGE_DESCRIPTION = "Service Charge Percentage";

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

function normalizePercentage($value)
{
    $amount = (float)($value ?? 0);
    if (!is_finite($amount) || $amount < 0 || $amount > 100) {
        return 0.00;
    }

    return round($amount, 2);
}

function readServiceChargeSettings(PDO $pdo)
{
    $enabledStmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $enabledStmt->execute([
        ":category" => SERVICE_CHARGE_CATEGORY,
        ":description" => SERVICE_CHARGE_ENABLED_DESCRIPTION,
    ]);
    $enabledValue = $enabledStmt->fetchColumn();
    $isEnabled = normalizeBoolean($enabledValue) === "True";

    $percentageStmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $percentageStmt->execute([
        ":category" => SERVICE_CHARGE_CATEGORY,
        ":description" => SERVICE_CHARGE_PERCENTAGE_DESCRIPTION,
    ]);
    $percentageValue = (float)($percentageStmt->fetchColumn() ?: 0);
    $percentage = normalizePercentage($percentageValue);

    return [
        "service_charge_enabled" => $isEnabled,
        "service_charge_percentage" => $percentage,
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Service charge settings loaded.", readServiceChargeSettings($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $serviceChargeEnabled = normalizeBoolean($body["service_charge_enabled"] ?? false) === "True";
    $serviceChargePercentage = normalizePercentage($body["service_charge_percentage"] ?? 0);

    // Update enabled setting
    $enabledExistingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $enabledExistingStmt->execute([
        ":category" => SERVICE_CHARGE_CATEGORY,
        ":description" => SERVICE_CHARGE_ENABLED_DESCRIPTION,
    ]);

    $enabledExistingId = $enabledExistingStmt->fetchColumn();

    if ($enabledExistingId) {
        $enabledUpdateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $enabledUpdateStmt->execute([
            ":setting_value" => $serviceChargeEnabled ? "True" : "False",
            ":id" => (int)$enabledExistingId,
        ]);
    } else {
        $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
        $nextId = (int)$nextIdStmt->fetchColumn();

        $enabledInsertStmt = $pdo->prepare("
            INSERT INTO tbl_pos_settings (ID, category, description, `value`)
            VALUES (:id, :category, :description, :setting_value)
        ");
        $enabledInsertStmt->execute([
            ":id" => $nextId,
            ":category" => SERVICE_CHARGE_CATEGORY,
            ":description" => SERVICE_CHARGE_ENABLED_DESCRIPTION,
            ":setting_value" => $serviceChargeEnabled ? "True" : "False",
        ]);
    }

    // Update percentage setting
    $percentageExistingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $percentageExistingStmt->execute([
        ":category" => SERVICE_CHARGE_CATEGORY,
        ":description" => SERVICE_CHARGE_PERCENTAGE_DESCRIPTION,
    ]);

    $percentageExistingId = $percentageExistingStmt->fetchColumn();

    if ($percentageExistingId) {
        $percentageUpdateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $percentageUpdateStmt->execute([
            ":setting_value" => number_format($serviceChargePercentage, 2, ".", ""),
            ":id" => (int)$percentageExistingId,
        ]);
    } else {
        $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
        $nextId = (int)$nextIdStmt->fetchColumn();

        $percentageInsertStmt = $pdo->prepare("
            INSERT INTO tbl_pos_settings (ID, category, description, `value`)
            VALUES (:id, :category, :description, :setting_value)
        ");
        $percentageInsertStmt->execute([
            ":id" => $nextId,
            ":category" => SERVICE_CHARGE_CATEGORY,
            ":description" => SERVICE_CHARGE_PERCENTAGE_DESCRIPTION,
            ":setting_value" => number_format($serviceChargePercentage, 2, ".", ""),
        ]);
    }

    respond(true, "Service charge settings saved.", readServiceChargeSettings($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
