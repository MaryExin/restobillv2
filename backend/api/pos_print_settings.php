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

const PRINT_SETTINGS_CATEGORY = "Print";
const PRINT_VOID_DESCRIPTION   = "Print Void Enabled";
const PRINT_REFUND_DESCRIPTION = "Print Refund Enabled";

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
    $stmt->execute([":category" => PRINT_SETTINGS_CATEGORY, ":description" => $description]);
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
    $existingStmt->execute([":category" => PRINT_SETTINGS_CATEGORY, ":description" => $description]);
    $existingId = $existingStmt->fetchColumn();

    $val = $enabled ? "True" : "False";

    if ($existingId) {
        $pdo->prepare("UPDATE tbl_pos_settings SET `value` = :v WHERE ID = :id")
            ->execute([":v" => $val, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :cat, :desc, :v)")
            ->execute([":id" => $nextId, ":cat" => PRINT_SETTINGS_CATEGORY, ":desc" => $description, ":v" => $val]);
    }
}

function readAllSettings(PDO $pdo): array
{
    return [
        "print_void_enabled"   => readSetting($pdo, PRINT_VOID_DESCRIPTION),
        "print_refund_enabled" => readSetting($pdo, PRINT_REFUND_DESCRIPTION),
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Print settings loaded.", readAllSettings($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $body = json_decode(file_get_contents("php://input"), true) ?? [];

    if (array_key_exists("print_void_enabled", $body)) {
        saveSetting($pdo, PRINT_VOID_DESCRIPTION, normalizeBoolean($body["print_void_enabled"]) === "True");
    }
    if (array_key_exists("print_refund_enabled", $body)) {
        saveSetting($pdo, PRINT_REFUND_DESCRIPTION, normalizeBoolean($body["print_refund_enabled"]) === "True");
    }

    respond(true, "Print settings saved.", readAllSettings($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
