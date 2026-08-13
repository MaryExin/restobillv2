<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

// Read-only on purpose: this flag is a hidden kill-switch toggled directly in
// tbl_pos_settings (e.g. via SQL), not from any Settings screen in the app.
const BILLING_SETTING_CATEGORY = "General";
const BILLING_SETTING_DESCRIPTION = "Enable Billing";

function normalizeBoolean($value)
{
    $value = trim((string)($value ?? ""));
    return in_array(strtolower($value), ["true", "1", "yes", "on"]) ? "True" : "False";
}

try {
    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => BILLING_SETTING_CATEGORY,
        ":description" => BILLING_SETTING_DESCRIPTION,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // No row yet = Billing has always been on; only an explicit "False" row
    // (added directly in the database) turns it off.
    $isEnabled = $row === false ? true : normalizeBoolean($row["value"]) === "True";

    echo json_encode([
        "success" => true,
        "data" => [
            "billing_enabled" => $isEnabled,
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "data" => [
            "billing_enabled" => true,
        ],
    ]);
}
