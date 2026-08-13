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

const VERSION_CATEGORY = "General";
const RESTAURANT_VERSION_DESCRIPTION = "Restaurant Version";
const RETAIL_VERSION_DESCRIPTION = "Retail Version";

const DEFAULT_RESTAURANT_VERSION = "1.0.1-1";
const DEFAULT_RETAIL_VERSION = "2.0.1-1";

function readVersionSetting(PDO $pdo, string $description, string $default): string
{
    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => VERSION_CATEGORY,
        ":description" => $description,
    ]);

    $value = trim((string)($stmt->fetchColumn() ?: ""));
    return $value !== "" ? $value : $default;
}

try {
    echo json_encode([
        "success" => true,
        "data" => [
            "restaurant_version" => readVersionSetting($pdo, RESTAURANT_VERSION_DESCRIPTION, DEFAULT_RESTAURANT_VERSION),
            "retail_version" => readVersionSetting($pdo, RETAIL_VERSION_DESCRIPTION, DEFAULT_RETAIL_VERSION),
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "data" => [
            "restaurant_version" => DEFAULT_RESTAURANT_VERSION,
            "retail_version" => DEFAULT_RETAIL_VERSION,
        ],
    ]);
}
