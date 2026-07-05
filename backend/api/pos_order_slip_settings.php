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

const OS_CATEGORY          = "OrderSlip";
const OS_HIDE_PRICE_DESC   = "Hide Price on Order Slip";
const OS_GROUP_BY_CAT_DESC = "Group By Category";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function normalizeBoolean($value)
{
    $value = trim((string)($value ?? ""));
    return in_array(strtolower($value), ["true", "1", "yes", "on"]) ? "True" : "False";
}

function readSetting(PDO $pdo, string $description): bool
{
    $stmt = $pdo->prepare("
        SELECT `value` FROM tbl_pos_settings
        WHERE category = :category AND description = :description
        ORDER BY ID DESC LIMIT 1
    ");
    $stmt->execute([":category" => OS_CATEGORY, ":description" => $description]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return normalizeBoolean($row["value"] ?? "False") === "True";
}

function saveSetting(PDO $pdo, string $description, bool $enabled): void
{
    $existingStmt = $pdo->prepare("
        SELECT ID FROM tbl_pos_settings
        WHERE category = :category AND description = :description
        ORDER BY ID DESC LIMIT 1
    ");
    $existingStmt->execute([":category" => OS_CATEGORY, ":description" => $description]);
    $existingId = $existingStmt->fetchColumn();

    $val = $enabled ? "True" : "False";

    if ($existingId) {
        $pdo->prepare("UPDATE tbl_pos_settings SET `value` = :v WHERE ID = :id")
            ->execute([":v" => $val, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :cat, :desc, :v)")
            ->execute([":id" => $nextId, ":cat" => OS_CATEGORY, ":desc" => $description, ":v" => $val]);
    }
}

function readAllSettings(PDO $pdo): array
{
    return [
        "hide_price_on_os"  => readSetting($pdo, OS_HIDE_PRICE_DESC),
        "group_by_category" => readSetting($pdo, OS_GROUP_BY_CAT_DESC),
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Order slip settings loaded.", readAllSettings($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $body = json_decode(file_get_contents("php://input"), true) ?? [];

    if (array_key_exists("hide_price_on_os", $body)) {
        saveSetting($pdo, OS_HIDE_PRICE_DESC, normalizeBoolean($body["hide_price_on_os"]) === "True");
    }
    if (array_key_exists("group_by_category", $body)) {
        saveSetting($pdo, OS_GROUP_BY_CAT_DESC, normalizeBoolean($body["group_by_category"]) === "True");
    }

    respond(true, "Order slip settings saved.", readAllSettings($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
